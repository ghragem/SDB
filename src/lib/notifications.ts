import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, daysSince, todaySP } from "./format";

export type Notice = { key: string; body: string; href: string; tone: "accent" | "neutral" };

/**
 * Notification Center (seções 55 e 96). Calculado a partir dos dados reais,
 * nada de "Vamos estudar!". Só aparece o que pede ação.
 */
export async function computeNotices(supabase: SupabaseClient): Promise<Notice[]> {
  const today = todaySP();
  const [projects, decisions, ideas, inbox, experiments, review] = await Promise.all([
    supabase.from("projects").select("id, name, last_progress_at, created_at").in("status", ["planejamento", "construcao", "validacao", "operando", "escalando"]),
    supabase.from("decisions").select("id, title, review_at").neq("status", "revisada").neq("status", "cancelada").not("review_at", "is", null).lte("review_at", today),
    supabase.from("ideas").select("id, title, created_at").eq("status", "capturada").lte("created_at", addDays(today, -7)),
    supabase.from("inbox_items").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("experiments").select("id, hypothesis, deadline").eq("status", "rodando").not("deadline", "is", null).lt("deadline", today),
    supabase.from("weekly_reviews").select("id").gte("week_start", addDays(today, -7)).limit(1),
  ]);

  const out: Notice[] = [];
  for (const p of projects.data ?? []) {
    const idle = daysSince(p.last_progress_at ?? p.created_at) ?? 0;
    if (idle >= 5) out.push({ key: `p-${p.id}`, body: `${p.name} está há ${idle} dias sem atualização.`, href: `/projetos/${p.id}`, tone: "accent" });
  }
  for (const d of decisions.data ?? []) {
    out.push({ key: `d-${d.id}`, body: `Decisão precisa ser revisada: ${d.title}.`, href: `/decidir/${d.id}`, tone: "accent" });
  }
  for (const e of experiments.data ?? []) {
    out.push({ key: `e-${e.id}`, body: `Uma hipótese venceu sem conclusão registrada: ${e.hypothesis}.`, href: `/decidir`, tone: "accent" });
  }
  if ((ideas.data ?? []).length) {
    const n = ideas.data!.length;
    out.push({ key: "ideas", body: n === 1 ? "Existe uma ideia capturada há mais de 7 dias sem avaliação." : `Existem ${n} ideias capturadas há mais de 7 dias sem avaliação.`, href: "/ideias", tone: "neutral" });
  }
  if ((inbox.count ?? 0) > 0) {
    out.push({ key: "inbox", body: `${inbox.count} ${inbox.count === 1 ? "item" : "itens"} na Inbox esperando classificação.`, href: "/inbox", tone: "neutral" });
  }
  const dow = new Date(today + "T12:00:00Z").getUTCDay();
  if ((dow === 0 || dow === 1) && !(review.data ?? []).length) {
    out.push({ key: "weekly", body: "Revisão semanal ainda não feita.", href: "/review/semanal", tone: "neutral" });
  }
  return out;
}
