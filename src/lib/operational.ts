import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { addDays, todaySP } from "./format";
import { readSignals } from "./day";
import { claimedProgress } from "./interpret";
import {
  computeAlerts, dayMode, decisionQueue, nextActions, rankProjects, riskQueue, ymd,
  type CrossChecks, type DayMode, type DecisionRow, type ExperimentRow, type ProjectFacts, type ScoreProject,
} from "./engine";
import type { Checkin, Project } from "./types";

/** Junta os dados reais do dia e passa pelo motor. Uma consulta por tabela; cache por requisição (layout + página). */
// Sem argumento de propósito: cache() compara argumentos por referência e cada página cria um cliente novo.
export const loadOperational = cache(async () => {
  const supabase = await createClient();
  const today = todaySP();
  const d90 = addDays(today, -90);
  const startOfToday = new Date(`${today}T00:00:00-03:00`).toISOString();

  const [projects, updates, tx, checkins, ideas, decisions, exps, spend, reviewToday, reviewYesterday, recentCheckins, loose] = await Promise.all([
    supabase.from("projects").select("*").order("priority").order("created_at"),
    supabase.from("project_updates").select("project_id, created_at").eq("is_progress", true),
    supabase.from("finance_transactions").select("project_id, type, amount").not("project_id", "is", null).gte("occurred_on", d90),
    supabase.from("daily_checkins").select("*").eq("day", today).order("created_at", { ascending: false }).limit(1),
    supabase.from("ideas").select("id, created_at").gte("created_at", addDays(today, -7)),
    supabase.from("decisions").select("id, title, status, verdict, deadline, review_at, amount, max_loss, reversibility, evidence, downside, alternatives, premortem, created_at").in("status", ["aberta", "decidida"]),
    supabase.from("experiments").select("id, hypothesis, status, max_amount, deadline, stop_condition, scale_condition, decision_id").in("status", ["planejado", "rodando"]),
    supabase.from("experiment_spend").select("experiment_id, spent"),
    supabase.from("daily_reviews").select("id").eq("day", today).maybeSingle(),
    supabase.from("daily_reviews").select("tomorrow").eq("day", addDays(today, -1)).maybeSingle(),
    supabase.from("daily_checkins").select("day, raw_text, main_worry").gte("day", addDays(today, -1)),
    supabase.from("finance_transactions").select("amount").is("project_id", null).neq("type", "receita").gte("occurred_on", addDays(today, -30)),
  ]);

  const all = ((projects.data ?? []) as (Project & ScoreProject)[])
    .map((p) => ({ ...p, next_action_at: p.next_action_at ? new Date(p.next_action_at).toISOString() : null }));
  const facts = new Map<string, ProjectFacts>();
  const fact = (id: string) => facts.get(id) ?? (facts.set(id, { progressCount: 0, revenue90: 0, spent90: 0 }), facts.get(id)!);
  const progressedToday = new Map<string, string>();
  for (const u of updates.data ?? []) {
    fact(u.project_id).progressCount++;
    const at = new Date(u.created_at).toISOString();
    if (at >= startOfToday && at > (progressedToday.get(u.project_id) ?? "")) progressedToday.set(u.project_id, at);
  }
  for (const t of tx.data ?? []) {
    if (t.type === "receita") fact(t.project_id).revenue90 += Number(t.amount);
    else fact(t.project_id).spent90 += Number(t.amount);
  }

  const checkin = (checkins.data?.[0] ?? null) as Checkin | null;
  const mode: DayMode | null = checkin
    ? dayMode(checkin.energy, checkin.focus, checkin.pressure, readSignals({ energy: null, focus: null, pressure: null, mainWorry: checkin.main_worry, text: checkin.raw_text }, []).tired)
    : null;
  const state = mode?.state ?? null;

  const ranked = rankProjects(all, facts, today, state);
  const spentBy = new Map((spend.data ?? []).map((s) => [s.experiment_id as string, Number(s.spent)]));
  const decisionRows = (decisions.data ?? []).map((d) => ({ ...d, amount: d.amount === null ? null : Number(d.amount), max_loss: d.max_loss === null ? null : Number(d.max_loss) })) as DecisionRow[];
  const queue = decisionQueue(decisionRows, today);
  const risks = riskQueue((exps.data ?? []).map((e) => ({ ...e, max_amount: e.max_amount === null ? null : Number(e.max_amount), spent: spentBy.get(e.id) ?? 0 })) as ExperimentRow[], today);

  // Cruzamentos: o que um módulo diz e o outro não confirma.
  const refs = ranked.map((r) => ({ id: r.project.id, name: r.project.name }));
  const progressDays = new Set((updates.data ?? []).map((u) => `${u.project_id}|${ymd(u.created_at)}`));
  const claims: CrossChecks["claims"] = [];
  for (const c of recentCheckins.data ?? []) {
    for (const pid of claimedProgress(`${c.raw_text ?? ""}. ${c.main_worry ?? ""}`, refs)) {
      if (!progressDays.has(`${pid}|${c.day}`) && !claims.some((x) => x.projectId === pid && x.day === c.day)) {
        claims.push({ projectId: pid, name: refs.find((r) => r.id === pid)!.name, day: c.day });
      }
    }
  }
  const checks: CrossChecks = {
    claims,
    looseSpend: { count: (loose.data ?? []).length, total: (loose.data ?? []).reduce((a, t) => a + Number(t.amount), 0) },
    revenueNoCost: ranked.filter((r) => (facts.get(r.project.id)?.revenue90 ?? 0) > 0 && (facts.get(r.project.id)?.spent90 ?? 0) === 0)
      .map((r) => ({ id: r.project.id, name: r.project.name, revenue: facts.get(r.project.id)!.revenue90 })),
    ideasWhileBusy: ranked.length >= 3 ? (ideas.data ?? []).length : 0,
  };
  const alerts = computeAlerts({ today, state, ranked, ideasLast7d: ideas.data ?? [], decisions: queue, risks, checks });
  const actions = nextActions({
    state, ranked, progressedToday,
    carriedFromYesterday: reviewYesterday.data?.tomorrow ?? null,
    decisions: queue, risks, reviewDone: Boolean(reviewToday.data),
  });

  return { today, checkin, mode, ranked, facts, queue, risks, alerts, actions, progressedToday, all, checks, ideasLast7d: (ideas.data ?? []).length };
});
