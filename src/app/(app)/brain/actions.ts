"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { str } from "@/lib/format";
import { askHistory } from "@/lib/ai/intelligence";
import { AIError } from "@/lib/ai/provider";

const KINDS = ["nota","insight","erro","aprendizado","decisao","ideia","pessoa","referencia","link","conversa","pesquisa","hipotese","regra"];

export async function createNote(form: FormData) {
  const { supabase, userId } = await requireUser();
  const body = str(form.get("body"));
  if (!body) return;
  const kind = String(form.get("kind") ?? "nota");
  const ep = String(form.get("epistemic") ?? "");
  await supabase.from("brain_notes").insert({
    user_id: userId, body, title: str(form.get("title")), url: str(form.get("url")),
    kind: KINDS.includes(kind) ? kind : "nota",
    epistemic: ["fato", "analise", "hipotese", "opiniao"].includes(ep) ? ep : null,
    project_id: str(form.get("project_id")),
  });
  if (kind === "regra") {
    await supabase.from("reality_rules").insert({ user_id: userId, rule: str(form.get("title")) ?? body.slice(0, 160), detail: body, origin: "experiencia", position: 100 });
  }
  revalidatePath("/brain");
}

export async function deleteNote(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("brain_notes").delete().eq("id", String(form.get("id")));
  revalidatePath("/brain");
}

type Hit = { kind: string; id: string; title: string; snippet: string; href: string; created_at: string };
export type AskState = { answer?: string; confidence?: string; error?: string; q?: string; hits?: Hit[] };

export async function ask(_: AskState, form: FormData): Promise<AskState> {
  const { supabase, userId } = await requireUser();
  const q = str(form.get("q"));
  if (!q) return {};
  const { data } = await supabase.rpc("search_all", { q });
  const hits = ((data ?? []) as Hit[]).slice(0, 15);
  try {
    const r = await askHistory({ supabase, userId }, q, hits);
    if (!r) return { q, hits, error: "IA não configurada. Mostrando só a busca." };
    return { q, hits, answer: r.answer, confidence: r.confidence };
  } catch (e) {
    return { q, hits, error: e instanceof AIError ? e.message : "A IA falhou." };
  }
}
