"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { addDays, parseMoney, str, todaySP } from "@/lib/format";
import { adversarialReview, realityCheck, type Adversarial, type RealityCheck } from "@/lib/ai/intelligence";
import { AIError } from "@/lib/ai/provider";

export type DecisionState = { error?: string };

function cardFields(form: FormData) {
  const rev = String(form.get("reversibility") ?? "");
  return {
    title: str(form.get("title")),
    objective: str(form.get("objective")),
    motive: str(form.get("motive")),
    amount: parseMoney(form.get("amount")),
    upside: str(form.get("upside")),
    downside: str(form.get("downside")),
    max_loss: parseMoney(form.get("max_loss")),
    evidence: str(form.get("evidence")),
    assumptions: str(form.get("assumptions")),
    reversibility: ["reversivel", "parcial", "irreversivel"].includes(rev) ? rev : null,
    deadline: str(form.get("deadline")),
    alternatives: str(form.get("alternatives")),
    opportunity_cost: str(form.get("opportunity_cost")),
    premortem: str(form.get("premortem")),
    project_id: str(form.get("project_id")),
  };
}

export async function createDecision(_: DecisionState, form: FormData): Promise<DecisionState> {
  const { supabase, userId } = await requireUser();
  const f = cardFields(form);
  if (!f.title) return { error: "Escreva a decisão em uma frase." };
  const { data, error } = await supabase.from("decisions").insert({ ...f, user_id: userId }).select("id").single();
  if (error || !data) return { error: "Não consegui salvar a decisão." };
  revalidatePath("/decidir");
  redirect(`/decidir/${data.id}`);
}

export async function updateDecision(_: DecisionState, form: FormData): Promise<DecisionState> {
  const { supabase } = await requireUser();
  const id = String(form.get("id"));
  const f = cardFields(form);
  if (!f.title) return { error: "A decisão precisa de título." };
  const { error } = await supabase.from("decisions").update(f).eq("id", id);
  if (error) return { error: "Não consegui salvar." };
  revalidatePath(`/decidir/${id}`);
  return {};
}

export async function setVerdict(_: DecisionState, form: FormData): Promise<DecisionState> {
  const { supabase } = await requireUser();
  const id = String(form.get("id"));
  const verdict = String(form.get("verdict"));
  if (!["fazer", "testar_pequeno", "esperar", "nao_fazer", "faltam_dados"].includes(verdict)) return { error: "Escolha um veredito." };
  const days = Number(form.get("review_in") ?? 7);
  const confidence = String(form.get("confidence") ?? "");
  const { error } = await supabase.from("decisions").update({
    verdict,
    verdict_reason: str(form.get("verdict_reason")),
    confidence: ["alta", "media", "baixa"].includes(confidence) ? confidence : null,
    against_recommendation: form.get("against_recommendation") === "on",
    review_at: addDays(todaySP(), Number.isFinite(days) && days > 0 ? days : 7),
    status: "decidida",
  }).eq("id", id);
  if (error) return { error: "Não consegui salvar o veredito." };
  revalidatePath(`/decidir/${id}`);
  revalidatePath("/decidir");
  revalidatePath("/hoje");
  return {};
}

export async function reviewDecision(_: DecisionState, form: FormData): Promise<DecisionState> {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("id"));
  const what = str(form.get("what_happened"));
  if (!what) return { error: "Escreva o que aconteceu." };
  const outcome = String(form.get("outcome") ?? "");
  const lesson = str(form.get("lesson"));
  const { error } = await supabase.from("decision_reviews").insert({
    user_id: userId, decision_id: id, what_happened: what,
    expected_vs_real: str(form.get("expected_vs_real")), lesson,
    outcome: ["acertou", "errou", "parcial", "cedo_demais"].includes(outcome) ? outcome : null,
  });
  if (error) return { error: "Não consegui salvar a revisão." };
  await supabase.from("decisions").update({ status: outcome === "cedo_demais" ? "decidida" : "revisada", review_at: outcome === "cedo_demais" ? addDays(todaySP(), 7) : null }).eq("id", id);
  if (lesson) {
    const { data: d } = await supabase.from("decisions").select("title, project_id").eq("id", id).single();
    await supabase.from("brain_notes").insert({ user_id: userId, kind: outcome === "errou" ? "erro" : "aprendizado", title: `Revisão: ${d?.title ?? "decisão"}`, body: lesson, project_id: d?.project_id ?? null, source: "decision_review", epistemic: "analise" });
  }
  revalidatePath(`/decidir/${id}`);
  revalidatePath("/decidir");
  revalidatePath("/brain");
  return {};
}

export async function createExperiment(_: DecisionState, form: FormData): Promise<DecisionState> {
  const { supabase, userId } = await requireUser();
  const hypothesis = str(form.get("hypothesis"));
  const stop = str(form.get("stop_condition"));
  if (!hypothesis || !stop) return { error: "Hipótese e critério de parada são obrigatórios." };
  const { error } = await supabase.from("experiments").insert({
    user_id: userId, hypothesis, stop_condition: stop,
    decision_id: str(form.get("decision_id")), project_id: str(form.get("project_id")),
    max_amount: parseMoney(form.get("max_amount")), metric: str(form.get("metric")),
    deadline: str(form.get("deadline")), scale_condition: str(form.get("scale_condition")),
  });
  if (error) return { error: "Não consegui criar o experimento." };
  revalidatePath(`/decidir/${form.get("decision_id")}`);
  revalidatePath("/decidir");
  return {};
}

export async function closeExperiment(form: FormData) {
  const { supabase } = await requireUser();
  const status = String(form.get("status"));
  if (!["validado", "rejeitado", "inconclusivo"].includes(status)) return;
  await supabase.from("experiments").update({ status, result: str(form.get("result")), learning: str(form.get("learning")) }).eq("id", String(form.get("id")));
  revalidatePath("/decidir", "layout");
}

export type AdvState = { result?: Adversarial; error?: string };

export async function runAdversarial(_: AdvState, form: FormData): Promise<AdvState> {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("id"));
  const { data: d } = await supabase.from("decisions").select("*").eq("id", id).single();
  if (!d) return { error: "Decisão não encontrada." };
  const text = Object.entries({
    Decisão: d.title, Objetivo: d.objective, Motivo: d.motive, Valor: d.amount, Upside: d.upside, Downside: d.downside,
    "Perda máxima": d.max_loss, Evidências: d.evidence, Suposições: d.assumptions, Reversibilidade: d.reversibility,
    Prazo: d.deadline, Alternativas: d.alternatives, "Custo de oportunidade": d.opportunity_cost, "Pre-mortem": d.premortem,
  }).map(([k, v]) => `${k}: ${v ?? "não informado"}`).join("\n");
  try {
    const result = await adversarialReview({ supabase, userId }, text);
    if (!result) return { error: "IA não configurada." };
    await supabase.from("decisions").update({ metadata: { ...(d.metadata ?? {}), adversarial: result, adversarial_at: new Date().toISOString() } }).eq("id", id);
    revalidatePath(`/decidir/${id}`);
    return { result };
  } catch (e) {
    return { error: e instanceof AIError ? e.message : "A IA falhou. Tente de novo." };
  }
}

export type RealityState = { result?: RealityCheck; error?: string; text?: string };

export async function runRealityCheck(_: RealityState, form: FormData): Promise<RealityState> {
  const { supabase, userId } = await requireUser();
  const text = str(form.get("situation"));
  if (!text) return { error: "Explique a situação." };
  try {
    const result = await realityCheck({ supabase, userId }, text);
    if (!result) return { error: "IA não configurada.", text };
    return { result, text };
  } catch (e) {
    return { error: e instanceof AIError ? e.message : "A IA falhou. Tente de novo.", text };
  }
}

export async function saveRealityCheck(form: FormData) {
  const { supabase, userId } = await requireUser();
  const body = str(form.get("body"));
  if (!body) return;
  await supabase.from("brain_notes").insert({ user_id: userId, kind: "insight", title: "Eu estou viajando?", body, source: "reality_check", epistemic: "analise" });
  revalidatePath("/brain");
}
