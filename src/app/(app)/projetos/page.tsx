import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { daysSince } from "@/lib/format";
import { loadOperational } from "@/lib/operational";
import { SCORE_RULES, type Scored } from "@/lib/engine";
import { ACTIVE_STATUSES, PROJECT_STATUS_LABEL, type Project } from "@/lib/types";
import { Badge, Card, Empty, LinkButton, PageHeader, Section, cx } from "@/components/ui";
import { setProjectState } from "./actions";

export const metadata: Metadata = { title: "Projetos" };

const PRIORITY_LABEL: Record<number, string> = { 1: "alta", 2: "média", 3: "baixa" };
const STALE_DAYS = 5;

export default async function ProjetosPage() {
  const { supabase } = await requireUser();
  const [op, fin] = await Promise.all([
    loadOperational(),
    supabase.from("finance_transactions").select("project_id, type, amount").not("project_id", "is", null),
  ]);
  const projects = op.all as Project[];
  const ranked = op.ranked;
  const other = projects.filter((p) => !ACTIVE_STATUSES.includes(p.status));
  const result = (id: string) => (fin.data ?? []).filter((t) => t.project_id === id)
    .reduce((a, t) => a + (t.type === "receita" ? 1 : -1) * Number(t.amount), 0);
  const hasFin = (id: string) => (fin.data ?? []).some((t) => t.project_id === id);
  const stale = ranked.filter((r) => r.idleDays >= STALE_DAYS);
  const startedRecently = projects.filter((p) => (daysSince(p.created_at) ?? 99) <= 7).length;

  return (
    <>
      <PageHeader title="Projetos"
        subtitle={ranked.length ? `${ranked.length} ativo${ranked.length === 1 ? "" : "s"}, ordenados pelo score.${startedRecently >= 2 ? ` Você abriu ${startedRecently} esta semana. Qual vai terminar?` : ""}` : undefined}
        action={<LinkButton href="/projetos/novo" variant="primary" size="sm"><Plus size={15} /> Novo</LinkButton>} />
      {projects.length === 0 ? (
        <Empty title="Nenhum projeto cadastrado." action={<LinkButton href="/projetos/novo" variant="primary">Cadastrar primeiro projeto</LinkButton>}>
          Cada projeto precisa de uma próxima ação concreta. Sem ela, avanço vira impressão.
        </Empty>
      ) : (
        <div className="space-y-9">
          {stale.length ? (
            <Section title="Projetos sem avanço">
              <Card className="divide-y divide-line">
                {stale.map((r) => (
                  <div key={r.project.id} className="px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/projetos/${r.project.id}`} className="truncate font-medium hover:underline">{r.project.name}</Link>
                      <span className="shrink-0 text-sm tabular-nums text-accent">{r.idleDays} {r.idleDays === 1 ? "dia parado" : "dias parado"}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-muted">
                      Prioridade {PRIORITY_LABEL[r.project.priority]} · Próxima ação: {r.project.next_action ?? <span className="text-accent">não definida</span>}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Link href={`/projetos/${r.project.id}#proxima-acao`} className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg">Continuar</Link>
                      <StateButton id={r.project.id} to="pausar" label="Pausar" />
                      <StateButton id={r.project.id} to="arquivar" label="Arquivar" />
                    </div>
                  </div>
                ))}
              </Card>
              <p className="text-xs text-faint">Parado = {STALE_DAYS}+ dias sem avanço registrado (ou desde o cadastro). Arquivar encerra o projeto; dá para reabrir editando o estado.</p>
            </Section>
          ) : null}

          <Section title="Ativos">
            {ranked.length ? <Ranked ranked={ranked} result={result} hasFin={hasFin} /> : <p className="text-sm text-muted">Nenhum ativo.</p>}
          </Section>

          {other.length ? (
            <Section title="Ideia, pausados e encerrados">
              <Card className="divide-y divide-line opacity-80">
                {other.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <Link href={`/projetos/${p.id}`} className="min-w-0 truncate hover:underline">{p.name}</Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted">{PROJECT_STATUS_LABEL[p.status]}</span>
                      {p.status === "pausado" ? <StateButton id={p.id} to="retomar" label="Retomar" small /> : null}
                    </span>
                  </div>
                ))}
              </Card>
            </Section>
          ) : null}

          <Section title="Como o score é calculado">
            <Card id="como-calcula" className="divide-y divide-line text-sm">
              {SCORE_RULES.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:justify-between sm:gap-4">
                  <span>{k}</span><span className="text-muted sm:text-right">{v}</span>
                </div>
              ))}
            </Card>
            <p className="text-xs text-faint">Regras fixas, sem IA. Empate: vale a prioridade que você definiu, depois o projeto mais parado.</p>
          </Section>
        </div>
      )}
    </>
  );
}

function StateButton({ id, to, label, small }: { id: string; to: string; label: string; small?: boolean }) {
  return (
    <form action={setProjectState}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <button className={cx("rounded-lg border border-line px-3 text-sm text-muted hover:border-line-strong hover:text-ink", small ? "h-8" : "h-9")}>{label}</button>
    </form>
  );
}

function Ranked({ ranked, result, hasFin }: { ranked: Scored[]; result: (id: string) => number; hasFin: (id: string) => boolean }) {
  return (
    <Card className="divide-y divide-line">
      {ranked.map((r, i) => {
        const p = r.project;
        return (
          <Link key={p.id} href={`/projetos/${p.id}`} className="block px-4 py-3.5 hover:bg-surface-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-xs text-faint">#{i + 1}</span>
                <span className="truncate font-medium">{p.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {r.action.level !== "ok" ? <Badge tone="warn">{r.action.level === "ausente" ? "sem próxima ação" : "ação vaga"}</Badge> : null}
                <span className="text-xs text-muted">{PROJECT_STATUS_LABEL[p.status]}</span>
                <span className="w-12 text-right font-mono text-sm tabular-nums">{r.score}</span>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              <span>Próxima ação: {p.next_action ?? <span className="text-accent">não definida</span>}</span>
              <span className={cx(r.idleDays >= STALE_DAYS && "text-accent")}>{r.neverProgressed ? "sem avanço registrado" : r.idleDays === 0 ? "avançou hoje" : `${r.idleDays}d sem avanço`}</span>
              {p.deadline ? <span>Prazo: {p.deadline.slice(8, 10)}/{p.deadline.slice(5, 7)}</span> : null}
              {p.blocker ? <span>Bloqueio: {p.blocker}</span> : null}
              {hasFin(p.id) ? <span className="tabular-nums">Resultado: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(result(p.id))}</span> : null}
            </div>
          </Link>
        );
      })}
    </Card>
  );
}
