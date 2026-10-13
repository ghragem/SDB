import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiDay } from "./ai/intelligence";
import { buildRulesDay, type DayContext, type DayInput } from "./day";
import { addDays, todaySP } from "./format";
import type { Project } from "./types";

export async function loadDayContext(supabase: SupabaseClient): Promise<DayContext> {
  const today = todaySP();
  const [projects, ideas7, pendingIdeas, due, open] = await Promise.all([
    supabase.from("projects").select("*").order("priority").order("created_at"),
    supabase.from("ideas").select("id", { count: "exact", head: true }).gte("created_at", addDays(today, -7)),
    supabase.from("ideas").select("id", { count: "exact", head: true }).in("status", ["capturada", "analisando"]),
    supabase.from("decisions").select("id, title").neq("status", "revisada").neq("status", "cancelada").not("review_at", "is", null).lte("review_at", today),
    supabase.from("decisions").select("id", { count: "exact", head: true }).eq("status", "aberta"),
  ]);
  return {
    projects: (projects.data ?? []) as Project[],
    ideasLast7d: ideas7.count ?? 0,
    pendingIdeas: pendingIdeas.count ?? 0,
    decisionsDue: due.data ?? [],
    openDecisions: open.count ?? 0,
  };
}

/**
 * Monta leitura + sessão do dia. Sempre roda o motor de regras; se houver IA
 * configurada, ela refina usando o contexto persistente. Se a IA falhar, fica
 * a versão por regras e o motivo vai para metadata.
 */
export async function buildDay(supabase: SupabaseClient, userId: string, input: DayInput) {
  const ctx = await loadDayContext(supabase);
  const rules = buildRulesDay(input, ctx);
  let reading = rules.reading;
  let items = rules.items;
  let source: "ia" | "regras" = "regras";
  let aiError: string | null = null;
  let confidence: string | null = null;

  const text = [input.text, input.mainWorry ? `Preocupação principal: ${input.mainWorry}` : null,
    input.energy ? `Energia ${input.energy}/5, foco ${input.focus}/5, pressão ${input.pressure}/5` : null]
    .filter(Boolean).join("\n");

  if (text) {
    try {
      const ai = await aiDay({ supabase, userId }, text, rules.state, { reading: rules.reading, items: rules.items });
      if (ai && ai.items?.length) {
        reading = ai.reading;
        items = ai.items.map((i) => ({ ...i, href: i.href ?? null, ref_id: i.ref_id ?? null, done: false }));
        source = "ia";
        confidence = ai.confidence;
      }
    } catch (e) {
      aiError = e instanceof Error ? e.message : "Falha na IA";
    }
  }
  return { state: rules.state, reading, items, source, aiError, confidence, ctx };
}

export async function saveSession(
  supabase: SupabaseClient,
  userId: string,
  day: Awaited<ReturnType<typeof buildDay>>,
  checkinId: string | null,
) {
  const today = todaySP();
  // A Home sempre lê a sessão mais recente do dia; as anteriores ficam no histórico.
  return supabase.from("daily_sessions").insert({
    user_id: userId,
    day: today,
    checkin_id: checkinId,
    day_state: day.state,
    items: day.items,
    source: day.source,
    metadata: { ai_error: day.aiError, confidence: day.confidence, reading: day.reading },
  });
}
