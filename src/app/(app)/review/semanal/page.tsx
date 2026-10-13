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
  const [projectsNew, updates, tx, decisions, reviews, exps, ideas, checkins, existing] = await Promise.all([
    supabase.from("projects").select("name, status, created_at").gte("created_at", since),
    supabase.from("project_updates").select("body, kind, is_progress, project_id").gte("created_at", since),
    supabase.from("finance_transactions").select("type, amount").gte("occurred_on", ws),
    supabase.from("decisions").select("id").gte("created_at", since),
    supabase.from("decision_reviews").select("outcome").gte("created_at", since),
    supabase.from("experiments").select("status, updated_at").gte("updated_at", since),
    supabase.from("ideas").select("status").gte("created_at", since),
    supabase.from("daily_checkins").select("id").gte("day", ws),
    supabase.from("weekly_reviews").select("*").eq("week_start", ws).maybeSingle(),
  ]);
  const t = tx.data ?? [];
  const sum = (k: string) => t.filter((x) => x.type === k).reduce((a, x) => a + Number(x.amount), 0);
  const u = updates.data ?? [];
  const statusChanges = u.filter((x) => x.body.startsWith("Estado:"));
  const snapshot = {
    projetos_iniciados: (projectsNew.data ?? []).length,
    projetos_encerrados: statusChanges.filter((x) => x.body.endsWith("encerrado")).length,
    projetos_pausados: statusChanges.filter((x) => x.body.endsWith("pausado")).length,
    avancos: u.filter((x) => x.is_progress).length,
    receita: sum("receita"), despesas: sum("despesa"), investido: sum("investimento"),
    decisoes: (decisions.data ?? []).length,
    revisoes_erradas: (reviews.data ?? []).filter((r) => r.outcome === "errou").length,
    hipoteses_aceitas: (exps.data ?? []).filter((e) => e.status === "validado").length,
    hipoteses_rejeitadas: (exps.data ?? []).filter((e) => e.status === "rejeitado").length,
    ideias_novas: (ideas.data ?? []).length,
    checkins: (checkins.data ?? []).length,
  };
  const w = existing.data;
  const rows: [string, string | number][] = [
    ["Projetos iniciados", snapshot.projetos_iniciados], ["Projetos encerrados", snapshot.projetos_encerrados], ["Projetos pausados", snapshot.projetos_pausados],
    ["Avanços registrados", snapshot.avancos], ["Novas ideias", snapshot.ideias_novas], ["Decisões registradas", snapshot.decisoes],
    ["Hipóteses aceitas", snapshot.hipoteses_aceitas], ["Hipóteses rejeitadas", snapshot.hipoteses_rejeitadas], ["Check-ins", snapshot.checkins],
    ["Receita", fmtMoney(snapshot.receita)], ["Despesas", fmtMoney(snapshot.despesas)], ["Investido", fmtMoney(snapshot.investido)],
  ];
  const warn = snapshot.projetos_iniciados > 0 && snapshot.projetos_encerrados === 0 && snapshot.projetos_iniciados >= 2
    ? `Você abriu ${snapshot.projetos_iniciados} projetos esta semana e não encerrou nenhum. Qual vai terminar?` : null;

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
        <Section title="Decida a próxima semana">
          <Card className="p-4">
            <form action={saveWeekly} className="space-y-4">
              <input type="hidden" name="snapshot" value={JSON.stringify(snapshot)} />
              <Field label="Continuar"><Textarea name="keep_doing" rows={2} defaultValue={w?.keep_doing ?? ""} /></Field>
              <Field label="Parar"><Textarea name="stop_doing" rows={2} defaultValue={w?.stop_doing ?? ""} /></Field>
              <Field label="Começar"><Textarea name="start_doing" rows={2} defaultValue={w?.start_doing ?? ""} /></Field>
              <Field label="Prioridade da semana"><Input name="week_priority" defaultValue={w?.week_priority ?? ""} /></Field>
              <Submit>{w ? "Atualizar" : "Salvar revisão"}</Submit>
            </form>
          </Card>
        </Section>
      </div>
    </>
  );
}
