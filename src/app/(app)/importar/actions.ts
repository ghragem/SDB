"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { extractFromConversation } from "@/lib/ai/intelligence";
import { AIError } from "@/lib/ai/provider";

export type ImportItem = {
  externalId: string;
  source: "chatgpt" | "claude" | "texto";
  title: string;
  createdAt: string | null;
  body: string;
  messageCount: number;
};

const SOURCES = ["chatgpt", "claude", "texto"];
const MAX_BODY = 61_000;

/** Salva um lote de conversas no Brain como "conversa". Reimportar a mesma conversa não duplica. */
export async function importBatch(items: ImportItem[]): Promise<{ inserted: { id: string; title: string }[]; skipped: number; error?: string }> {
  const { supabase, userId } = await requireUser();
  const clean = items
    .filter((i) => SOURCES.includes(i.source) && typeof i.externalId === "string" && i.externalId.length < 200 && i.body?.trim())
    .slice(0, 200);
  if (!clean.length) return { inserted: [], skipped: items.length };

  const ids = clean.map((i) => i.externalId);
  const { data: existing } = await supabase.from("brain_notes").select("metadata").eq("kind", "conversa").in("metadata->>external_id", ids);
  const have = new Set((existing ?? []).map((e) => (e.metadata as { external_id?: string }).external_id));
  const fresh = clean.filter((i) => !have.has(i.externalId));
  if (!fresh.length) return { inserted: [], skipped: items.length };

  const { data, error } = await supabase.from("brain_notes").insert(fresh.map((i) => ({
    user_id: userId,
    kind: "conversa",
    title: i.title.slice(0, 200),
    body: i.body.slice(0, MAX_BODY),
    source: i.source,
    epistemic: "opiniao",
    metadata: { external_id: i.externalId, conversation_created_at: i.createdAt, messages: i.messageCount, imported_at: new Date().toISOString() },
  }))).select("id, title");
  if (error) return { inserted: [], skipped: items.length - fresh.length, error: "Não consegui salvar parte das conversas. Tente de novo; as já salvas não duplicam." };
  return { inserted: (data ?? []).map((d) => ({ id: d.id, title: d.title ?? "" })), skipped: items.length - fresh.length };
}

/** Registro da importação (histórico em import_jobs). */
export async function finishImport(summary: { source: string; file: string | null; found: number; selected: number; inserted: number; skipped: number }) {
  const { supabase, userId } = await requireUser();
  await supabase.from("import_jobs").insert({
    user_id: userId,
    title: `Importação ${summary.source}`,
    data: summary,
    status: "concluido",
  });
  revalidatePath("/brain");
  revalidatePath("/importar");
}

/**
 * IA lê só a parte do Gustavo na conversa e propõe itens. Os itens entram na Inbox como pendentes:
 * nada vira ideia, decisão ou tarefa sem confirmação.
 */
export async function extractToInbox(noteId: string): Promise<{ count?: number; error?: string }> {
  const ctx = await requireUser();
  const { supabase, userId } = ctx;
  const { data: note } = await supabase.from("brain_notes").select("id, title, body, metadata").eq("id", noteId).eq("kind", "conversa").maybeSingle();
  if (!note) return { error: "Conversa não encontrada." };
  const meta = note.metadata as { extracted_at?: string };
  if (meta.extracted_at) return { count: 0 };

  // Só as falas do Gustavo: é ali que estão as intenções dele.
  const userText = note.body
    .split(/\n\n(?=(?:Você|ChatGPT|Claude|IA): )/)
    .filter((b: string) => b.startsWith("Você: "))
    .map((b: string) => b.slice(6))
    .join("\n---\n")
    .slice(0, 12_000);
  if (!userText.trim()) return { count: 0 };

  let out;
  try {
    out = await extractFromConversation(ctx, note.title ?? "", userText);
  } catch (e) {
    return { error: e instanceof AIError ? e.message : "Falha na IA." };
  }
  if (!out) return { error: "IA não configurada." };

  const { data: projects } = await supabase.from("projects").select("id, name");
  const byName = new Map((projects ?? []).map((p) => [p.name.toLowerCase(), p.id]));
  const rows = out.itens.slice(0, 8).filter((i) => i.text?.trim()).map((i) => ({
    user_id: userId,
    kind: i.kind,
    body: i.text.trim().slice(0, 2000),
    metadata: { source: "importacao", note_id: note.id, conversation: note.title, project_id: i.projeto ? byName.get(i.projeto.toLowerCase()) ?? null : null },
  }));
  if (rows.length) {
    const { error } = await supabase.from("inbox_items").insert(rows);
    if (error) return { error: "Não consegui salvar os itens na Inbox." };
  }
  await supabase.from("brain_notes").update({ metadata: { ...note.metadata, extracted_at: new Date().toISOString(), extracted: rows.length } }).eq("id", note.id);
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
  return { count: rows.length };
}
