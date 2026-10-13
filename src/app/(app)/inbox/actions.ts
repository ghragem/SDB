"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { parseMoney, str, todaySP } from "@/lib/format";

export type CaptureState = { ok?: boolean; error?: string; at?: number };

const KINDS = ["ideia","nota","audio","link","despesa","receita","erro","aprendizado","decisao","oportunidade","tarefa","foto","print","conversa"];

export async function capture(_: CaptureState, form: FormData): Promise<CaptureState> {
  const { supabase, userId } = await requireUser();
  const kind = String(form.get("kind") ?? "nota");
  const body = str(form.get("body"));
  const amount = parseMoney(form.get("amount"));
  if (!KINDS.includes(kind)) return { error: "Tipo inválido." };
  if (!body) return { error: "Escreva alguma coisa antes de salvar." };
  if ((kind === "despesa" || kind === "receita") && (amount === null || amount <= 0)) return { error: "Informe o valor." };
  const { error } = await supabase.from("inbox_items").insert({ user_id: userId, kind, body, amount });
  if (error) return { error: "Não consegui salvar. Tente de novo." };
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}

/** Classifica um item: cria o registro de destino e marca como classificado. */
export async function route(form: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("id"));
  const to = String(form.get("to"));
  const { data: item } = await supabase.from("inbox_items").select("*").eq("id", id).single();
  if (!item) return;

  let routedTable: string | null = null;
  let routedId: string | null = null;

  if (to === "ideia") {
    const { data } = await supabase.from("ideas").insert({ user_id: userId, title: item.body.slice(0, 140), description: item.body.length > 140 ? item.body : null }).select("id").single();
    routedTable = "ideas"; routedId = data?.id ?? null;
  } else if (to === "decisao") {
    const { data } = await supabase.from("decisions").insert({ user_id: userId, title: item.body.slice(0, 200) }).select("id").single();
    routedTable = "decisions"; routedId = data?.id ?? null;
  } else if (to === "despesa" || to === "receita") {
    if (!item.amount) return;
    const { data } = await supabase.from("finance_transactions").insert({
      user_id: userId, type: to, amount: item.amount, description: item.body, occurred_on: todaySP(),
      category: String(form.get("category") ?? "outros"), project_id: str(form.get("project_id")),
    }).select("id").single();
    routedTable = "finance_transactions"; routedId = data?.id ?? null;
  } else if (to === "projeto") {
    const projectId = str(form.get("project_id"));
    if (!projectId) return;
    const { data } = await supabase.from("project_updates").insert({ user_id: userId, project_id: projectId, body: item.body, kind: "nota", is_progress: false }).select("id").single();
    routedTable = "project_updates"; routedId = data?.id ?? null;
  } else {
    // Brain: nota, insight, erro, aprendizado, link, conversa, oportunidade...
    const kindMap: Record<string, string> = { erro: "erro", aprendizado: "aprendizado", link: "link", conversa: "conversa", insight: "insight", oportunidade: "pesquisa" };
    const isUrl = /^https?:\/\//.test(item.body.trim());
    const { data } = await supabase.from("brain_notes").insert({
      user_id: userId, kind: kindMap[to] ?? (isUrl ? "link" : "nota"), body: item.body, url: isUrl ? item.body.trim() : null, source: "inbox",
    }).select("id").single();
    routedTable = "brain_notes"; routedId = data?.id ?? null;
  }

  await supabase.from("inbox_items").update({ status: "classificado", routed_table: routedTable, routed_id: routedId }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function discard(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("inbox_items").update({ status: "descartado" }).eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
}
