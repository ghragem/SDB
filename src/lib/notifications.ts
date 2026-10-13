import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todaySP } from "./format";
import { loadOperational } from "./operational";

export type Notice = { key: string; body: string; href: string; tone: "accent" | "neutral" };

/**
 * Notification Center (seções 55 e 96). Os alertas do motor operacional (mesmos da Hoje)
 * mais o que só cabe aqui: Inbox pendente, ideias esquecidas, revisão semanal.
 */
export async function computeNotices(supabase: SupabaseClient): Promise<Notice[]> {
  const today = todaySP();
  const [op, ideas, inbox, review] = await Promise.all([
    loadOperational(),
    supabase.from("ideas").select("id", { count: "exact", head: true }).eq("status", "capturada").lte("created_at", addDays(today, -7)),
    supabase.from("inbox_items").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("weekly_reviews").select("id").gte("week_start", addDays(today, -7)).limit(1),
  ]);

  const out: Notice[] = op.alerts.map((a) => ({ key: a.key, body: a.text, href: a.href, tone: a.severity >= 7 ? "accent" : "neutral" }));

  // Outros projetos parados (o principal já está nos alertas)
  for (const r of op.ranked.slice(1)) {
    if (r.idleDays >= 5) out.push({ key: `p-${r.project.id}`, body: `${r.project.name} está há ${r.idleDays} dias sem avanço.`, href: "/projetos", tone: "neutral" });
  }
  const n = ideas.count ?? 0;
  if (n) out.push({ key: "ideas", body: n === 1 ? "Uma ideia capturada há mais de 7 dias sem avaliação." : `${n} ideias capturadas há mais de 7 dias sem avaliação.`, href: "/ideias", tone: "neutral" });
  if ((inbox.count ?? 0) > 0) out.push({ key: "inbox", body: `${inbox.count} ${inbox.count === 1 ? "item" : "itens"} na Inbox esperando classificação.`, href: "/inbox", tone: "neutral" });
  const dow = new Date(today + "T12:00:00Z").getUTCDay();
  if ((dow === 0 || dow === 1) && !(review.data ?? []).length) out.push({ key: "weekly", body: "Revisão semanal ainda não feita.", href: "/review/semanal", tone: "neutral" });
  return out;
}
