"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { str } from "@/lib/format";

export type IdeaState = { error?: string; ok?: boolean; verdict?: string };

export async function createIdea(form: FormData) {
  const { supabase, userId } = await requireUser();
  const title = str(form.get("title"));
  if (!title) return;
  await supabase.from("ideas").insert({ user_id: userId, title, description: str(form.get("description")) });
  revalidatePath("/ideias");
}

const Q = ["why_now", "project_losing_time", "evidence", "test_cost", "time_to_learn", "reversible"] as const;

/** Salva as respostas da regra anti-dispersão e, se pedido, tenta promover. */
export async function analyzeIdea(_: IdeaState, form: FormData): Promise<IdeaState> {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("id"));
  const intent = String(form.get("intent"));
  const answers = Object.fromEntries(Q.map((k) => [k, str(form.get(k))]));
  const oon = String(form.get("opportunity_or_novelty") ?? "");
  const kind = ["oportunidade", "novidade", "nao_sei"].includes(oon) ? oon : null;

  const patch: Record<string, unknown> = { ...answers, opportunity_or_novelty: kind };
  if (intent === "save") {
    patch.status = "analisando";
    await supabase.from("ideas").update(patch).eq("id", id);
    revalidatePath("/ideias");
    return { ok: true };
  }

  // intent === "promote"
  const missing = Q.filter((k) => !answers[k]);
  if (missing.length || !kind) {
    await supabase.from("ideas").update({ ...patch, status: "analisando" }).eq("id", id);
    revalidatePath("/ideias");
    return { verdict: "Não iniciar agora. Faltam respostas. Ideia sem justificativa não passa na frente de projeto em andamento." };
  }
  if (kind !== "oportunidade") {
    await supabase.from("ideas").update({ ...patch, status: "validar" }).eq("id", id);
    revalidatePath("/ideias");
    return { verdict: kind === "novidade" ? "Você mesmo classificou como novidade. Não iniciar agora. Ficou em Validar." : "Se você não sabe se é oportunidade, ainda não é. Ficou em Validar: defina um teste pequeno primeiro." };
  }
  const { data: idea } = await supabase.from("ideas").select("title, description").eq("id", id).single();
  const { data: project, error } = await supabase.from("projects").insert({
    user_id: userId, name: idea!.title, description: idea!.description, status: "planejamento", priority: 2,
    hypotheses: answers.evidence ? `Evidência na promoção: ${answers.evidence}` : null,
    metadata: { promoted_from_idea: id, project_losing_time: answers.project_losing_time },
  }).select("id").single();
  if (error || !project) return { error: "Não consegui criar o projeto." };
  await supabase.from("ideas").update({ ...patch, status: "promover", promoted_project_id: project.id }).eq("id", id);
  revalidatePath("/ideias");
  revalidatePath("/projetos");
  return { ok: true, verdict: `Promovida a projeto. ${answers.project_losing_time} vai perder tempo por isso. Registrado.` };
}

export async function setIdeaStatus(form: FormData) {
  const { supabase } = await requireUser();
  const status = String(form.get("status"));
  if (!["capturada","analisando","validar","teste","descartada","arquivada"].includes(status)) return;
  await supabase.from("ideas").update({ status, discard_reason: str(form.get("discard_reason")) }).eq("id", String(form.get("id")));
  revalidatePath("/ideias");
}
