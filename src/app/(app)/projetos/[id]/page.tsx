import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { daysSince, fmtDay, fmtMoney, fmtPct } from "@/lib/format";
import { PROJECT_STATUS_LABEL, type Project } from "@/lib/types";
import { Badge, Button, Card, Empty, LinkButton, Section, Select, cx } from "@/components/ui";
import { Submit } from "@/components/submit";
import { ProjectForm } from "../project-form";
import { addUpdate, deleteProject } from "../actions";

export const metadata: Metadata = { title: "Projeto" };

const UPDATE_LABEL: Record<string, string> = { avanco: "Avanço", bloqueio: "Bloqueio", decisao: "Decisão", nota: "Nota", validacao: "Validação" };
const COST_CATS = ["ads", "gateway", "ferramentas", "reembolso", "estoque"];

export default async function ProjetoPage({ params }: PageProps<"/projetos/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();
  const p = project as Project;

  const [updates, tx, decisions, experiments] = await Promise.all([
    supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("finance_transactions").select("type, amount, category").eq("project_id", id),
    supabase.from("decisions").select("id, title, verdict, status").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("experiments").select("id, hypothesis, status").eq("project_id", id).order("created_at", { ascending: false }),
  ]);

  const idle = daysSince(p.last_progress_at);
  const t = tx.data ?? [];
  const revenue = t.filter((x) => x.type === "receita").reduce((a, x) => a + Number(x.amount), 0);
  const costBy = (cat: string) => t.filter((x) => x.type !== "receita" && x.category === cat).reduce((a, x) => a + Number(x.amount), 0);
  const costs = t.filter((x) => x.type !== "receita").reduce((a, x) => a + Number(x.amount), 0);
  const other = costs - COST_CATS.reduce((a, c) => a + costBy(c), 0);
  const profit = revenue - costs;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/projetos" className="text-sm text-muted hover:text-ink">← Projetos</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-[26px] font-semibold tracking-tight">{p.name}</h1>
          <Badge>{PROJECT_STATUS_LABEL[p.status]}</Badge>
          {p.priority === 1 ? <Badge tone="accent">Prioridade</Badge> : null}
        </div>
        {p.description ? <p className="mt-1 text-muted">{p.description}</p> : null}
      </div>

      {/* Progresso real, sem porcentagem inventada (seção 27) */}
      <Card className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Fact label="Próxima prova" value={p.next_proof ?? "Não definida"} warn={!p.next_proof} />
        <Fact label="Bloqueio" value={p.blocker ?? "Nenhum registrado"} />
        <Fact label="Dias sem progresso" value={idle === null ? "Nunca registrou" : String(idle)} warn={idle === null || idle >= 5} />
      </Card>

      <Section title="Registrar">
        <form action={addUpdate} className="space-y-2">
          <input type="hidden" name="project_id" value={p.id} />
          <div className="flex gap-2">
            <Select name="kind" defaultValue="avanco" className="w-36 shrink-0" aria-label="Tipo">
              {Object.entries(UPDATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <input name="body" required placeholder="Fato, não intenção." aria-label="Texto"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
          </div>
          <div className="flex justify-end"><Submit size="sm">Registrar</Submit></div>
        </form>
      </Section>

      <Section title="Linha do tempo">
        {updates.data?.length ? (
          <ol className="relative space-y-4 border-l border-line pl-5">
            {updates.data.map((u) => (
              <li key={u.id} className="relative">
                <span className={cx("absolute -left-[25px] top-1.5 h-2 w-2 rounded-full", u.is_progress ? "bg-ink" : u.kind === "bloqueio" ? "bg-accent" : "bg-line-strong")} />
                <p className="text-xs text-muted">{fmtDay(u.created_at)} · {UPDATE_LABEL[u.kind] ?? u.kind}</p>
                <p className="mt-0.5">{u.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Nenhum registro ainda.">Registre o primeiro avanço real. É isso que conta os dias sem progresso.</Empty>
        )}
      </Section>

      <Section title="Mini DRE" action={<Link href={`/dinheiro?projeto=${p.id}`} className="text-sm text-muted hover:text-ink">Lançar</Link>}>
        {t.length ? (
          <Card className="p-4 text-sm">
            <Row label="Receita" value={fmtMoney(revenue)} strong />
            {COST_CATS.map((c) => costBy(c) ? <Row key={c} label={c[0].toUpperCase() + c.slice(1)} value={`− ${fmtMoney(costBy(c))}`} /> : null)}
            {other ? <Row label="Outros custos" value={`− ${fmtMoney(other)}`} /> : null}
            <div className="my-2 border-t border-line" />
            <Row label="Lucro" value={fmtMoney(profit)} strong tone={profit < 0 ? "accent" : undefined} />
            <Row label="Margem" value={revenue ? fmtPct(profit / revenue) : "—"} />
            {revenue > 0 ? (
              <p className="mt-3 text-muted">
                Você faturou {fmtMoney(revenue)} neste projeto. Depois dos custos registrados, {profit >= 0 ? `sobraram ${fmtMoney(profit)}` : `faltaram ${fmtMoney(-profit)}`}. Avalie pelo resultado, não pelo faturamento.
              </p>
            ) : null}
          </Card>
        ) : (
          <Empty title="Nenhum lançamento ligado a este projeto.">Sem receita e custo registrados, não dá para dizer se ele dá lucro.</Empty>
        )}
      </Section>

      <div className="grid gap-8 sm:grid-cols-2 sm:gap-4">
        <Section title="Decisões" action={<Link href={`/decidir/nova?projeto=${p.id}`} className="text-sm text-muted hover:text-ink">Nova</Link>}>
          {decisions.data?.length ? (
            <Card className="divide-y divide-line">
              {decisions.data.map((d) => (
                <Link key={d.id} href={`/decidir/${d.id}`} className="flex justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                  <span className="truncate">{d.title}</span><span className="shrink-0 text-xs text-muted">{d.verdict?.replace("_", " ") ?? d.status}</span>
                </Link>
              ))}
            </Card>
          ) : <p className="text-sm text-muted">Nenhuma decisão ligada.</p>}
        </Section>
        <Section title="Experimentos">
          {experiments.data?.length ? (
            <Card className="divide-y divide-line">
              {experiments.data.map((e) => (
                <div key={e.id} className="flex justify-between gap-3 px-4 py-3 text-sm"><span className="truncate">{e.hypothesis}</span><span className="shrink-0 text-xs text-muted">{e.status}</span></div>
              ))}
            </Card>
          ) : <p className="text-sm text-muted">Nenhum experimento. Crie a partir de uma decisão com veredito “testar pequeno”.</p>}
        </Section>
      </div>

      <details className="rounded-[10px] border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 font-medium">Editar projeto</summary>
        <div className="border-t border-line p-4"><ProjectForm project={p} /></div>
      </details>

      <form action={deleteProject} className="flex justify-end">
        <input type="hidden" name="id" value={p.id} />
        <Button variant="danger" size="sm" type="submit">Apagar projeto</Button>
      </form>
      <LinkButton href="/projetos" variant="ghost" size="sm" className="sr-only">Voltar</LinkButton>
    </div>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="p-4">
      <p className="label">{label}</p>
      <p className={cx("mt-1", warn && "text-accent")}>{value}</p>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "accent" }) {
  return (
    <div className="flex justify-between py-1">
      <span className={cx(strong ? "font-medium" : "text-muted")}>{label}</span>
      <span className={cx("tabular-nums", strong && "font-semibold", tone === "accent" && "text-accent")}>{value}</span>
    </div>
  );
}
