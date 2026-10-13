"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { buildDay, saveSession } from "@/lib/session";

export type OnboardingState = { error?: string };

const RULES = [
  ["Não comece outra coisa só porque parece mais interessante.", "Analise primeiro."],
  ["Não confunda venda com lucro.", "Faturamento sem margem não conta como vitória."],
  ["Teste pequeno antes de apostar grande.", "Valor máximo, prazo e critério de parada antes de gastar."],
  ["Conteúdo sem aplicação é entretenimento.", null],
  ["Dado ruim é melhor que número inventado.", null],
] as const;

const STATUSES = ["ideia","planejamento","construcao","validacao","operando","escalando","pausado"];

export async function finishOnboarding(_: OnboardingState, form: FormData): Promise<OnboardingState> {
  const { supabase, userId } = await requireUser();

  const goals = String(form.get("goals") ?? "").trim() || null;
  const skills = form.getAll("skills").map(String).filter(Boolean);
  const problems = String(form.get("problems") ?? "").trim() || null;
  const reality = String(form.get("reality") ?? "muito_direto");
  const names = form.getAll("project_name").map((v) => String(v).trim());
  const statuses = form.getAll("project_status").map(String);
  const proofs = form.getAll("project_proof").map((v) => String(v).trim());

  const projects = names
    .map((name, i) => ({ name, status: STATUSES.includes(statuses[i]) ? statuses[i] : "construcao", next_proof: proofs[i] || null, priority: i === 0 ? 1 : 2 }))
    .filter((p) => p.name);

  const { error: pErr } = await supabase.from("profiles")
    .update({ goals, skills_focus: skills, recurring_problems: problems, onboarded_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (pErr) return { error: "Não consegui salvar seu perfil. Tente de novo." };

  await supabase.from("preferences").update({ reality_level: ["suave","direto","muito_direto"].includes(reality) ? reality : "muito_direto" }).eq("user_id", userId);

  if (projects.length) {
    const { error } = await supabase.from("projects").insert(projects.map((p) => ({ ...p, user_id: userId })));
    if (error) return { error: "Não consegui salvar os projetos. Tente de novo." };
  }

  const { count } = await supabase.from("reality_rules").select("id", { count: "exact", head: true });
  if (!count) {
    await supabase.from("reality_rules").insert(RULES.map(([rule, detail], i) => ({ user_id: userId, rule, detail, position: i + 1 })));
  }

  // Primeira experiência nunca é dashboard vazio: sessão inicial a partir do que ele acabou de contar.
  const day = await buildDay(supabase, userId, { energy: null, focus: null, pressure: null, mainWorry: null, text: null });
  await saveSession(supabase, userId, day, null);

  redirect("/hoje");
}
