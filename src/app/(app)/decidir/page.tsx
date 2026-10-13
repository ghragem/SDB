import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { fmtDay, fmtMoney } from "@/lib/format";
import { loadOperational } from "@/lib/operational";
import { Submit } from "@/components/submit";
import { logSpend } from "./actions";
import { VERDICT_LABEL } from "@/lib/checks";
import { Badge, Card, Empty, LinkButton, PageHeader, Section, cx } from "@/components/ui";

const REV: Record<string, string> = { reversivel: "sim", parcial: "parcial", irreversivel: "não" };
import { RealityCheckPanel } from "./panels";

export const metadata: Metadata = { title: "Decidir" };

export default async function DecidirPage() {
  const { supabase } = await requireUser();
  const [op, { data }] = await Promise.all([
    loadOperational(),
    supabase.from("decisions").select("id, title, status, created_at").in("status", ["revisada", "cancelada"]).order("created_at", { ascending: false }),
  ]);
  const closed = data ?? [];
  const ai = aiStatus();

  return (
    <>
      <PageHeader title="Decidir" subtitle="Decisão relevante tem cartão, veredito e data de revisão." action={<LinkButton href="/decidir/nova" variant="primary" size="sm"><Plus size={15} /> Nova</LinkButton>} />
      <div className="space-y-8">
        <Section title="Fila de decisões">
          {op.queue.length ? (
            <>
              <Card className="divide-y divide-line">
                {op.queue.map((q, i) => {
                  const d = q.d;
                  const urgent = q.attention >= 27;
                  return (
                    <Link key={d.id} href={`/decidir/${d.id}`} className="block px-4 py-3.5 hover:bg-surface-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-start gap-2">
                          <span className="mt-0.5 font-mono text-xs text-faint">#{i + 1}</span>
                          <span className="font-medium">{d.title}</span>
                        </span>
                        <Badge tone={urgent ? "accent" : d.verdict ? "neutral" : "warn"}>{d.verdict ? VERDICT_LABEL[d.verdict] : "sem veredito"}</Badge>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
                        <Cell k="Prazo" v={d.deadline ? fmtDay(d.deadline) : "—"} warn={!d.deadline} />
                        <Cell k="Custo" v={d.amount ? fmtMoney(d.amount) : d.max_loss ? `perda máx. ${fmtMoney(d.max_loss)}` : "—"} />
                        <Cell k="Reversível" v={d.reversibility ? REV[d.reversibility] : "—"} warn={!d.reversibility} />
                        <Cell k="Status" v={q.reason} warn={urgent} />
                      </dl>
                      {q.missing.length ? <p className="mt-1.5 text-[12.5px] text-muted">Faltam: {q.missing.join(", ")}.</p> : null}
                    </Link>
                  );
                })}
              </Card>
              <p className="text-xs text-faint">Ordem: revisão atrasada, prazo vencido ou em até 3 dias, sem veredito, dados faltando.</p>
            </>
          ) : (
            <Empty title="Nenhuma decisão aberta." action={<LinkButton href="/decidir/nova" variant="primary">Registrar decisão</LinkButton>}>
              “Quero colocar R$ 2.000 numa campanha.” “Quero abandonar um projeto.” Coisas assim entram aqui antes de acontecer.
            </Empty>
          )}
        </Section>

        <Section title="Fila de risco">
          <div id="risco" className="scroll-mt-20" />
          {op.risks.length ? (
            <Card className="divide-y divide-line">
              {op.risks.map((r) => {
                const e = r.e;
                return (
                  <div key={e.id} className="px-4 py-3.5 text-sm">
                    <Link href={e.decision_id ? `/decidir/${e.decision_id}` : "/decidir"} className="font-medium hover:underline">{e.hypothesis}</Link>
                    {r.pct !== null ? (
                      <div className="mt-2">
                        <div className="flex justify-between text-[13px]">
                          <span className="tabular-nums">{fmtMoney(e.spent)} de {fmtMoney(e.max_amount!)}</span>
                          <span className={cx("tabular-nums font-semibold", r.pct >= 80 ? "text-accent" : "text-muted")}>{r.pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(r.pct, 100)} aria-label="Limite usado">
                          <div className={cx("h-full rounded-full", r.pct >= 80 ? "bg-accent" : "bg-ink/60")} style={{ width: `${Math.min(r.pct, 100)}%` }} />
                        </div>
                      </div>
                    ) : <p className="mt-1 text-[13px] text-muted">Gasto {fmtMoney(e.spent)} · sem limite máximo definido</p>}
                    {r.message ? <p className="mt-2 font-medium text-accent">{r.message}</p> : null}
                    <dl className="mt-2 space-y-0.5 text-[13px]">
                      <div><dt className="inline text-faint">Parar se: </dt><dd className="inline">{e.stop_condition ?? "—"}</dd></div>
                      <div><dt className="inline text-faint">Escalar se: </dt><dd className="inline">{e.scale_condition ?? "—"}</dd></div>
                      <div><dt className="inline text-faint">Prazo: </dt><dd className={cx("inline", r.overdue && "text-accent")}>{e.deadline ? fmtDay(e.deadline) : "—"}</dd></div>
                    </dl>
                    <form action={logSpend} className="mt-3 flex gap-2">
                      <input type="hidden" name="experiment_id" value={e.id} />
                      <input name="spent" inputMode="decimal" required placeholder="Gasto novo (R$)" aria-label="Valor gasto"
                        className="h-9 w-36 rounded-lg border border-line bg-bg px-3 text-sm placeholder:text-faint focus:border-line-strong focus:outline-none" />
                      <input name="note" placeholder="Onde (opcional)" aria-label="Nota"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm placeholder:text-faint focus:border-line-strong focus:outline-none" />
                      <Submit size="sm" pendingText="…">Lançar</Submit>
                    </form>
                  </div>
                );
              })}
            </Card>
          ) : (
            <p className="text-sm text-muted">Nenhum experimento rodando. Experimentos nascem dentro de uma decisão, com limite e critério de parada.</p>
          )}
        </Section>

        {/* Recurso de IA: com a IA desligada a seção simplesmente não aparece. */}
        {ai.configured ? (
          <Section title="Eu estou viajando?">
            <Card className="p-4"><RealityCheckPanel aiConfigured /></Card>
          </Section>
        ) : null}

        {closed.length ? (
          <Section title="Revisadas">
            <Card className="divide-y divide-line">
              {closed.map((d) => (
                <Link key={d.id} href={`/decidir/${d.id}`} className="flex justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                  <span className="truncate">{d.title}</span><span className="shrink-0 text-muted">{fmtDay(d.created_at)}</span>
                </Link>
              ))}
            </Card>
          </Section>
        ) : null}
      </div>
    </>
  );
}

function Cell({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return <div className="min-w-0"><dt className="text-faint">{k}</dt><dd className={cx("truncate", warn ? "text-accent" : "text-ink")}>{v}</dd></div>;
}
