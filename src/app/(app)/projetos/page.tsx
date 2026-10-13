import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { daysSince } from "@/lib/format";
import { ACTIVE_STATUSES, PROJECT_STATUS_LABEL, type Project } from "@/lib/types";
import { Badge, Card, Empty, LinkButton, PageHeader, Section, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Projetos" };

export default async function ProjetosPage() {
  const { supabase } = await requireUser();
  const [{ data }, fin] = await Promise.all([
    supabase.from("projects").select("*").order("priority").order("created_at"),
    supabase.from("finance_transactions").select("project_id, type, amount").not("project_id", "is", null),
  ]);
  const projects = (data ?? []) as Project[];
  const active = projects.filter((p) => ACTIVE_STATUSES.includes(p.status));
  const other = projects.filter((p) => !ACTIVE_STATUSES.includes(p.status));
  const result = (id: string) => (fin.data ?? []).filter((t) => t.project_id === id)
    .reduce((a, t) => a + (t.type === "receita" ? 1 : -1) * Number(t.amount), 0);
  const hasFin = (id: string) => (fin.data ?? []).some((t) => t.project_id === id);

  const startedRecently = projects.filter((p) => (daysSince(p.created_at) ?? 99) <= 7).length;

  return (
    <>
      <PageHeader title="Projetos"
        subtitle={active.length ? `${active.length} ativo${active.length === 1 ? "" : "s"}.${startedRecently >= 2 ? ` Você abriu ${startedRecently} esta semana. Qual vai terminar?` : ""}` : undefined}
        action={<LinkButton href="/projetos/novo" variant="primary" size="sm"><Plus size={15} /> Novo</LinkButton>} />
      {projects.length === 0 ? (
        <Empty title="Nenhum projeto cadastrado." action={<LinkButton href="/projetos/novo" variant="primary">Cadastrar primeiro projeto</LinkButton>}>
          Cada projeto precisa de uma próxima prova concreta. Sem ela, avanço vira impressão.
        </Empty>
      ) : (
        <div className="space-y-8">
          <Section title="Ativos">
            {active.length ? <List projects={active} result={result} hasFin={hasFin} /> : <p className="text-sm text-muted">Nenhum ativo.</p>}
          </Section>
          {other.length ? (
            <Section title="Ideia, pausados e encerrados">
              <List projects={other} result={result} hasFin={hasFin} muted />
            </Section>
          ) : null}
        </div>
      )}
    </>
  );
}

function List({ projects, result, hasFin, muted }: { projects: Project[]; result: (id: string) => number; hasFin: (id: string) => boolean; muted?: boolean }) {
  return (
    <Card className={cx("divide-y divide-line", muted && "opacity-80")}>
      {projects.map((p) => {
        const idle = daysSince(p.last_progress_at);
        return (
          <Link key={p.id} href={`/projetos/${p.id}`} className="block px-4 py-3.5 hover:bg-surface-2">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium">{p.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {p.priority === 1 ? <Badge tone="accent">Prioridade</Badge> : null}
                <span className="text-xs text-muted">{PROJECT_STATUS_LABEL[p.status]}</span>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              <span>Próxima prova: {p.next_proof ?? <span className="text-accent">não definida</span>}</span>
              <span className={cx(idle !== null && idle >= 5 && "text-accent")}>{idle === null ? "sem avanço registrado" : idle === 0 ? "avançou hoje" : `${idle}d sem avanço`}</span>
              {p.blocker ? <span>Bloqueio: {p.blocker}</span> : null}
              {hasFin(p.id) ? <span className="tabular-nums">Resultado: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(result(p.id))}</span> : null}
            </div>
          </Link>
        );
      })}
    </Card>
  );
}
