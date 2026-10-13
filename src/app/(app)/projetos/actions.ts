"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { str } from "@/lib/format";

const STATUSES = ["ideia","planejamento","construcao","validacao","operando","escalando","pausado","encerrado"];

function fields(form: FormData) {
  const status = String(form.get("status") ?? "construcao");
  const priority = Number(form.get("priority") ?? 2);
  return {
    name: str(form.get("name")),
    description: str(form.get("description")),
    status: STATUSES.includes(status) ? status : "construcao",
    priority: [1, 2, 3].includes(priority) ? priority : 2,
    objective: str(form.get("objective")),
    next_proof: str(form.get("next_proof")),
    next_delivery: str(form.get("next_delivery")),
    blocker: str(form.get("blocker")),
    hypotheses: str(form.get("hypotheses")),
    risks: str(form.get("risks")),
    next_action: str(form.get("next_action")),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(form.get("deadline") ?? "")) ? String(form.get("deadline")) : null,
  };
}

export type ProjectState = { error?: string };

export async function createProject(_: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, userId } = await requireUser();
  const f = fields(form);
  if (!f.name) return { error: "Dê um nome ao projeto." };
  const { data, error } = await supabase.from("projects").insert({ ...f, user_id: userId, next_action_at: f.next_action ? new Date().toISOString() : null }).select("id").single();
  if (error || !data) return { error: "Não consegui salvar o projeto." };
  revalidatePath("/projetos");
  redirect(`/projetos/${data.id}`);
}

export async function updateProject(_: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("id"));
  const f = fields(form);
  if (!f.name) return { error: "O projeto precisa de nome." };
  const { data: before } = await supabase.from("projects").select("status, blocker, next_action").eq("id", id).single();
  const actionChanged = before && (before.next_action ?? null) !== f.next_action;
  const { error } = await supabase.from("projects").update({ ...f, ...(actionChanged ? { next_action_at: f.next_action ? new Date().toISOString() : null } : {}) }).eq("id", id);
  if (error) return { error: "Não consegui salvar as alterações." };
  // Mudanças relevantes viram linha do tempo (memória temporal).
  const log: { kind: string; body: string }[] = [];
  if (before && before.status !== f.status) log.push({ kind: "nota", body: `Estado: ${before.status} → ${f.status}` });
  if (actionChanged && f.next_action) log.push({ kind: "nota", body: `Próxima ação: ${f.next_action}` });
  if (before && f.blocker && before.blocker !== f.blocker) log.push({ kind: "bloqueio", body: `Bloqueio: ${f.blocker}` });
  if (log.length) await supabase.from("project_updates").insert(log.map((l) => ({ ...l, user_id: userId, project_id: id, is_progress: false })));
  revalidatePath(`/projetos/${id}`);
  revalidatePath("/projetos");
  revalidatePath("/hoje");
  return {};
}

export type NextActionState = { ok?: boolean; error?: string };

/** Define a próxima ação (Hoje, projeto, lista de parados). Vaga é salva, mas a tela avisa. */
export async function setNextAction(_: NextActionState, form: FormData): Promise<NextActionState> {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("project_id"));
  const action = str(form.get("next_action"));
  if (!action) return { error: "Escreva a ação. Uma frase com verbo, número ou pessoa." };
  const { error } = await supabase.from("projects").update({ next_action: action.slice(0, 300), next_action_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Não consegui salvar a próxima ação." };
  await supabase.from("project_updates").insert({ user_id: userId, project_id: id, kind: "nota", body: `Próxima ação: ${action.slice(0, 300)}`, is_progress: false });
  revalidatePath("/hoje");
  revalidatePath("/projetos");
  revalidatePath(`/projetos/${id}`);
  return { ok: true };
}

/** Continuar / pausar / arquivar a partir da lista de projetos sem avanço. Arquivar = encerrar (reversível no projeto). */
export async function setProjectState(form: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("id"));
  const to = String(form.get("to"));
  const map: Record<string, string> = { pausar: "pausado", arquivar: "encerrado", retomar: "construcao" };
  const status = map[to];
  if (!status) return;
  const { data: before } = await supabase.from("projects").select("status").eq("id", id).single();
  if (!before || before.status === status) return;
  await supabase.from("projects").update({ status }).eq("id", id);
  await supabase.from("project_updates").insert({ user_id: userId, project_id: id, kind: "nota", body: `Estado: ${before.status} → ${status}`, is_progress: false, metadata: { status_from: before.status, status_to: status } });
  revalidatePath("/projetos");
  revalidatePath("/hoje");
  revalidatePath(`/projetos/${id}`);
}

export async function addUpdate(form: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("project_id"));
  const body = str(form.get("body"));
  const kind = String(form.get("kind") ?? "avanco");
  if (!body) return;
  await supabase.from("project_updates").insert({
    user_id: userId, project_id: id, body,
    kind: ["avanco","bloqueio","decisao","nota","validacao"].includes(kind) ? kind : "avanco",
    is_progress: kind === "avanco" || kind === "validacao",
  });
  revalidatePath(`/projetos/${id}`);
  revalidatePath("/hoje");
}

export async function deleteProject(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("projects").delete().eq("id", String(form.get("id")));
  revalidatePath("/projetos");
  redirect("/projetos");
}
