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
  };
}

export type ProjectState = { error?: string };

export async function createProject(_: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, userId } = await requireUser();
  const f = fields(form);
  if (!f.name) return { error: "Dê um nome ao projeto." };
  const { data, error } = await supabase.from("projects").insert({ ...f, user_id: userId }).select("id").single();
  if (error || !data) return { error: "Não consegui salvar o projeto." };
  revalidatePath("/projetos");
  redirect(`/projetos/${data.id}`);
}

export async function updateProject(_: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("id"));
  const f = fields(form);
  if (!f.name) return { error: "O projeto precisa de nome." };
  const { data: before } = await supabase.from("projects").select("status, blocker").eq("id", id).single();
  const { error } = await supabase.from("projects").update(f).eq("id", id);
  if (error) return { error: "Não consegui salvar as alterações." };
  // Mudanças relevantes viram linha do tempo (memória temporal).
  const log: { kind: string; body: string }[] = [];
  if (before && before.status !== f.status) log.push({ kind: "nota", body: `Estado: ${before.status} → ${f.status}` });
  if (before && f.blocker && before.blocker !== f.blocker) log.push({ kind: "bloqueio", body: `Bloqueio: ${f.blocker}` });
  if (log.length) await supabase.from("project_updates").insert(log.map((l) => ({ ...l, user_id: userId, project_id: id, is_progress: false })));
  revalidatePath(`/projetos/${id}`);
  revalidatePath("/projetos");
  return {};
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
