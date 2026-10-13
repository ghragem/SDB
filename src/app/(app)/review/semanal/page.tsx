import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { addDays, fmtDay, fmtMoney, weekStartSP } from "@/lib/format";
import { Card, Field, Input, PageHeader, Section, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { saveWeekly } from "../actions";

export const metadata: Metadata = { title: "Revisão semanal" };

export default async function SemanalPage() {
  const { supabase } = await requireUser();
  const ws = weekStartSP();
  const since = ws + "T03:00:00Z";
  const [allProjects, updates, tx, decisions, reviews, exps, running, ideas, checkins, notes, spend, existing] = await Promise.all([
    supabase.from("projects").select("id, name, status, created_at"),
    supabase.from("project_updates").select("body, kind, is_progress, project_id").gte("created_at", since),
    supabase.from("finance_transactions").select("type, amount").gte("occurred_on", ws),
    supabase.from("decisions").select("id, verdict").gte("created_at", since),
    supabase.from("decision_reviews").select("outcome, lesson").gte("created_at", since),
    supabase.from("experiments").select("id, status, learning, updated_at").gte("updated_at", since),
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "rodando"),
    supabase.from("ideas").select("status").gte("created_at", since),
    supabase.from("daily_checkins").select("id").gte("day", ws),
    supabase.from("brain_notes").select("kind, title, body").in("kind", ["aprendizado", "erro", "regra", "insight"]).gte("created_at", since).order("created_at", { ascending: false }).limit(5),
    supabase.from("experiment_spend").select("experiment_id, spent"),
    supabase.from("weekly_reviews").select("*").eq("week_start", ws).maybeSingle(),
  ]);
  const t = tx.data ?? [];
  const sum = (k: string) => t.filter((x) => x.type === k).reduce((a, x) => a + Number(x.amount), 0);
  const u = updates.data ?? [];
  const projects = allProjects.data ?? [];
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
  const statusChanges = u.filter((x) => x.body.startsWith("Estado:"));
  const progressed = [...new Set(u.filter((x) => x.is_progress).map((x) => x.project_id))];
  const active = ["planejamento", "construcao", "validacao", "operando", "escalando"];
  const stalled = projects.filter((p) => active.includes(p.status) && !progressed.includes(p.id));
  const started = projects.filter((p) => p.created_at >= since);
  const concluded = statusChanges.filter((x) => x.body.endsWith("encerrado")).map((x) => nameOf.get(x.project_id) ?? "projeto");
  const spentBy = new Map((spend.data ?? []).map((x) => [x.experiment_id, Number(x.spent)]));
  const e = exps.data ?? [];
  const lostInTests = e.filter((x) => x.status === "rejeitado").reduce((a, x) => a + (spentBy.get(x.id) ?? 0), 0);
  const learnings = [
    ...(notes.data ?? []).map((n) => n.title ? `${n.title}: ${n.body}` : n.body),
    ...(reviews.data ?? []).filter((r) => r.lesson).map((r) => r.lesson as string),
    ...e.filter((x) => x.learning).map((x) => x.learning as string),
  ].slice(0, 6);

  const snapshot = {
    projetos_com_avanco: progressed.map((id) => nameOf.get(id) ?? "projeto"),
    projetos_parados: stalled.map((p) => p.name),
    projetos_iniciados: started.length,
    projetos_concluidos: concluded.length,
    projetos_pausados: statusChanges.filter((x) => x.body.endsWith("pausado")).length,
    avancos: u.filter((x) => x.is_progress).length,
    receita: sum("receita"), despesas: sum("despesa"), investido: sum("investimento"), perdido_em_testes: lostInTests,
    decisoes: (decisions.data ?? []).length,
    decisoes_com_veredito: (decisions.data ?? []).filter((d) => d.verdict).length,
    revisoes_erradas: (reviews.data ?? []).filter((r) => r.outcome === "errou").length,
    experimentos_ativos: running.count ?? 0,
    hipoteses_aceitas: e.filter((x) => x.status === "validado").length,
    hipoteses_rejeitadas: e.filter((x) => x.status === "rejeitado").length,
    ideias_novas: (ideas.data ?? []).length,
    checkins: (checkins.data ?? []).length,
  };
  const w = existing.data;
  const rows: [string, string | number][] = [
    ["Projetos iniciados", snapshot.projetos_iniciados], ["Projetos concluídos", snapshot.projetos_concluidos], ["Avanços registrados", snapshot.avancos],
    ["Ideias criadas", snapshot.ideias_novas], ["Decisões tomadas", `${snapshot.decisoes_com_veredito} de ${snapshot.decisoes}`], ["Experimentos ativos", snapshot.experimentos_ativos],
    ["Ganho (receita)", fmtMoney(snapshot.receita)], ["Gasto (despesas)", fmtMoney(snapshot.despesas)], ["Investido", fmtMoney(snapshot.investido)],
    ["Perdido em testes rejeitados", fmtMoney(snapshot.perdido_em_testes)], ["Hipóteses aceitas / rejeitadas", `${snapshot.hipoteses_aceitas} / ${snapshot.hipoteses_rejeitadas}`], ["Check-ins", snapshot.checkins],
  ];
  const warn = snapshot.projetos_iniciados >= 2 && snapshot.projetos_concluidos === 0
    ? `Você abriu ${snapshot.projetos_iniciados} projetos esta semana e não concluiu nenhum. Qual vai terminar?`
    : snapshot.ideias_novas >= 3 && stalled.length
      ? `${snapshot.ideias_novas} ideias novas e ${stalled.length} ${stalled.length === 1 ? "projeto ativo sem avanço" : "projetos ativos sem avanço"} na semana.`
      : null;

  return (
    <>
      <PageHeader title="Revisão semanal" subtitle={`Semana de ${fmtDay(ws)} a ${fmtDay(addDays(ws, 6))}. Números do que foi registrado.`} action={<Link href="/review" className="text-sm text-muted hover:text-ink">← Diária</Link>} />
      <div className="space-y-9">
        <Card className="grid grid-cols-2 sm:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k} className="border-b border-r border-line p-3.5 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(3n)]:border-r-0">
              <p className="text-[11px] uppercase tracking-wider text-muted">{k}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </Card>
        {warn ? <p className="border-l-2 border-accent pl-3">{warn}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-4 text-sm">
            <p className="label">Com avanço</p>
            {snapshot.projetos_com_avanco.length ? <ul className="mt-1.5 space-y-0.5">{snapshot.projetos_com_avanco.map((n) => <li key={n}>{n}</li>)}</ul> : <p className="mt-1.5 text-muted">Nenhum projeto avançou.</p>}
          </Card>
          <Card className="p-4 text-sm">
            <p className="label">Parados (ativos, sem avanço na semana)</p>
            {snapshot.projetos_parados.length ? <ul className="mt-1.5 space-y-0.5 text-accent">{snapshot.projetos_parados.map((n) => <li key={n}>{n}</li>)}</ul> : <p className="mt-1.5 text-muted">Nenhum.</p>}
          </Card>
        </div>
        <Section title="Principais aprendizados">
          {learnings.length ? (
            <Card className="divide-y divide-line text-sm">{learnings.map((l, i) => <p key={i} className="px-4 py-2.5">{l}</p>)}</Card>
          ) : <p className="text-sm text-muted">Nenhum aprendizado registrado na semana (Brain, revisão de decisão ou experimento encerrado).</p>}
        </Section>
        <Section title="Decida a próxima semana">
          <Card className="p-4">
            <form action={saveWeekly} className="space-y-4">
              <input type="hidden" name="snapshot" value={JSON.stringify(snapshot)} />
              <Field label="Continuar"><Textarea name="keep_doing" rows={2} defaultValue={w?.keep_doing ?? ""} /></Field>
              <Field label="Parar"><Textarea name="stop_doing" rows={2} defaultValue={w?.stop_doing ?? ""} /></Field>
              <Field label="Começar"><Textarea name="start_doing" rows={2} defaultValue={w?.start_doing ?? ""} /></Field>
              <Field label="Prioridade da próxima semana"><Input name="week_priority" defaultValue={w?.week_priority ?? ""} /></Field>
              <Submit>{w ? "Atualizar" : "Salvar revisão"}</Submit>
            </form>
          </Card>
        </Section>
      </div>
    </>
  );
}
