import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { addDays, todaySP } from "./format";
import { readSignals } from "./day";
import {
  computeAlerts, dayMode, decisionQueue, nextActions, rankProjects, riskQueue,
  type DayMode, type DecisionRow, type ExperimentRow, type ProjectFacts, type ScoreProject,
} from "./engine";
import type { Checkin, Project } from "./types";

/** Junta os dados reais do dia e passa pelo motor. Uma consulta por tabela; cache por requisição (layout + página). */
// Sem argumento de propósito: cache() compara argumentos por referência e cada página cria um cliente novo.
export const loadOperational = cache(async () => {
  const supabase = await createClient();
  const today = todaySP();
  const d90 = addDays(today, -90);
  const startOfToday = new Date(`${today}T00:00:00-03:00`).toISOString();

  const [projects, updates, tx, checkins, ideas, decisions, exps, spend, reviewToday, reviewYesterday] = await Promise.all([
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
  ]);

  const all = (projects.data ?? []) as (Project & ScoreProject)[];
  const facts = new Map<string, ProjectFacts>();
  const fact = (id: string) => facts.get(id) ?? (facts.set(id, { progressCount: 0, revenue90: 0, spent90: 0 }), facts.get(id)!);
  const progressedToday = new Set<string>();
  for (const u of updates.data ?? []) {
    fact(u.project_id).progressCount++;
    if (u.created_at >= startOfToday) progressedToday.add(u.project_id);
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

  const alerts = computeAlerts({ today, state, ranked, ideasLast7d: ideas.data ?? [], decisions: queue, risks });
  const actions = nextActions({
    state, ranked, progressedToday,
    carriedFromYesterday: reviewYesterday.data?.tomorrow ?? null,
    decisions: queue, risks, reviewDone: Boolean(reviewToday.data),
  });

  return { today, checkin, mode, ranked, facts, queue, risks, alerts, actions, progressedToday, all };
});
