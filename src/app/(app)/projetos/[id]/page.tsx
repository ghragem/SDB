import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { daysSince, fmtDay, fmtMoney, fmtPct } from "@/lib/format";
import { PROJECT_STATUS_LABEL, type Project } from "@/lib/types";
import { Badge, Button, Card, Empty, LinkButton, Section, Select, cx } from "@/components/ui";
import { Submit } from "@/components/submit";
import { ProjectForm } from "../project-form";
import { NextActionForm } from "@/components/next-action-form";
import { SpeakUpdate } from "@/components/speak-update";
import { loadOperational } from "@/lib/operational";
import { actionQuality } from "@/lib/engine";
import { addUpdate, deleteProject } from "../actions";

export const metadata: Metadata = { title: "Projeto" };

const UPDATE_LABEL: Record<string, string> = { avanco: "Avanço", bloqueio: "Bloqueio", decisao: "Decisão", nota: "Nota", validacao: "Evidência" };
const COST_CATS = ["ads", "gateway", "ferramentas", "reembolso", "estoque"];

export default async function ProjetoPage({ params }: PageProps<"/projetos/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();
  const p = project as Project;

  const [updates, tx, decisions, experiments, notes, linked] = await Promise.all([
    supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(80),
    supabase.from("finance_transactions").select("id, type, amount, category, description, occurred_on, created_at").eq("project_id", id),
    supabase.from("decisions").select("id, title, verdict, status, created_at, updated_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("experiments").select("id, hypothesis, status, result, learning, created_at, updated_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("brain_notes").select("id, kind, title, body, created_at").eq("project_id", id).neq("kind", "conversa").order("created_at", { ascending: false }).limit(40),
    supabase.from("brain_links").select("from_id, relation").eq("to_kind", "projeto").eq("to_id", id).eq("from_kind", "nota"),
  ]);
  const linkedIds = (linked.data ?? []).map((l) => l.from_id).filter((x) => !(notes.data ?? []).some((n) => n.id === x));
  const linkedNotes = linkedIds.length ? (await supabase.from("brain_notes").select("id, kind, title, body, created_at").in("id", linkedIds)).data ?? [] : [];

  // Linha do tempo: tudo que o sistema sabe deste projeto, em ordem. Nada de porcentagem.
  type Ev = { at: string; kind: string; tone: "ink" | "ok" | "accent" | "muted" | "info"; text: string; href?: string };
  const events: Ev[] = [
    { at: p.created_at, kind: "Começou", tone: "muted" as const, text: "Projeto cadastrado no sistema." },
    ...(updates.data ?? []).map((u): Ev => ({
      at: u.created_at, kind: u.kind === "validacao" ? "Evidência" : UPDATE_LABEL[u.kind] ?? u.kind,
      tone: u.kind === "validacao" ? "ok" : u.is_progress ? "ink" : u.kind === "bloqueio" ? "accent" : "muted", text: u.body,
    })),
    ...(tx.data ?? []).map((t): Ev => ({
      at: t.created_at, kind: t.type === "receita" ? "Receita" : t.type === "investimento" ? "Investimento" : "Gasto",
      tone: t.type === "receita" ? "ok" : "accent", text: `${fmtMoney(Number(t.amount))}${t.description ? ` · ${t.description}` : ` · ${t.category}`}`, href: "/dinheiro",
    })),
    ...(decisions.data ?? []).map((d): Ev => ({ at: d.created_at, kind: "Decisão", tone: "info", text: `${d.title}${d.verdict ? ` → ${d.verdict.replace("_", " ")}` : " (sem veredito)"}`, href: `/decidir/${d.id}` })),
    ...(experiments.data ?? []).flatMap((e): Ev[] => [
      { at: e.created_at, kind: "Experimento", tone: "info", text: `Hipótese: ${e.hypothesis}`, href: "/decidir#risco" },
      ...(["validado", "rejeitado", "inconclusivo"].includes(e.status) ? [{ at: e.updated_at, kind: "Resultado", tone: (e.status === "validado" ? "ok" : "accent") as Ev["tone"], text: `${e.status}${e.learning ? ` · aprendizado: ${e.learning}` : e.result ? ` · ${e.result}` : ""}` }] : []),
    ]),
    ...[...(notes.data ?? []), ...linkedNotes].map((n): Ev => ({
      at: n.created_at, kind: n.kind === "hipotese" ? "Hipótese" : n.kind === "aprendizado" ? "Aprendizado" : n.kind === "erro" ? "Erro" : n.kind === "decisao" ? "Decisão" : "Nota",
      tone: n.kind === "erro" ? "accent" : "muted", text: n.title ? `${n.title}: ${n.body}` : n.body, href: `/brain?nota=${n.id}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const idle = daysSince(p.last_progress_at);
  const op = await loadOperational();
  const rank = op.ranked.findIndex((r) => r.project.id === p.id) + 1;
  const scored = rank ? op.ranked[rank - 1] : null;
  const quality = actionQuality(p.next_action);
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

      {/* Próxima ação obrigatória e o porquê do score */}
      <Card id="proxima-acao" className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="label">Próxima ação</p>
          {scored ? <span className="text-xs tabular-nums text-muted">score {scored.score} · #{rank} entre os ativos</span> : null}
        </div>
        {quality.level !== "ok" ? <p className="text-sm text-accent">{quality.reason}</p> : null}
        <NextActionForm projectId={p.id} current={p.next_action} />
        {scored ? (
          <details className="text-[13px]">
            <summary className="cursor-pointer text-muted">Por que este score?</summary>
            <div className="mt-2 font-mono">
              {scored.factors.map((f) => (
                <div key={f.label} className="flex justify-between gap-3 py-0.5">
                  <span className="text-muted">{f.label}</span>
                  <span className={cx("tabular-nums", f.points < 0 ? "text-accent" : f.points > 0 ? "text-ok" : "text-faint")}>{f.points > 0 ? `+${f.points}` : f.points}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-semibold"><span>Score final</span><span>{scored.score}</span></div>
            </div>
          </details>
        ) : null}
        {p.deadline ? <p className="text-[13px] text-muted">Prazo: {fmtDay(p.deadline)}</p> : null}
      </Card>

      {/* Progresso real, sem porcentagem inventada (seção 27) */}
      <Card className="grid grid-cols-2 divide-line sm:grid-cols-3 [&>*]:border-line [&>*]:border-b sm:[&>*:nth-last-child(-n+3)]:border-b-0">
        <Fact label="Começou" value={fmtDay(p.created_at)} />
        <Fact label="Último avanço" value={p.last_progress_at ? fmtDay(p.last_progress_at) : "Nunca registrou"} warn={!p.last_progress_at} />
        <Fact label="Dias parado" value={String(scored?.idleDays ?? idle ?? 0)} warn={(scored?.idleDays ?? idle ?? 0) >= 5} />
        <Fact label="Próxima prova" value={p.next_proof ?? "Não definida"} warn={!p.next_proof} />
        <Fact label="Próximo entregável" value={p.next_delivery ?? "Não definido"} />
        <Fact label="Bloqueio" value={p.blocker ?? "Nenhum registrado"} />
      </Card>

      <div id="registrar" className="scroll-mt-20" />
      <Section title="Registrar" action={<SpeakUpdate projectId={p.id} projectName={p.name} className="h-9" />}>
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

      <Section title="Linha do tempo" action={<span className="text-xs text-muted">{events.length} eventos</span>}>
        {events.length > 1 ? (
          <ol className="relative space-y-4 border-l border-line pl-5">
            {events.slice(0, 80).map((e, i) => (
              <li key={i} className="relative">
                <span className={cx("absolute -left-[25px] top-1.5 h-2 w-2 rounded-full", { ink: "bg-ink", ok: "bg-ok", accent: "bg-accent", muted: "bg-line-strong", info: "bg-info" }[e.tone])} />
                <p className="text-xs text-muted">{fmtDay(e.at)} · {e.kind}</p>
                {e.href ? <Link href={e.href} className="mt-0.5 block hover:underline">{e.text}</Link> : <p className="mt-0.5">{e.text}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Só o cadastro, por enquanto.">Fale ou registre o primeiro avanço real. É isso que conta os dias sem progresso.</Empty>
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
