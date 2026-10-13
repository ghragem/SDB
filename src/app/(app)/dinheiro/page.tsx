import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { fmtDay, fmtMoney, fmtPct, todaySP } from "@/lib/format";
import { Card, Empty, PageHeader, Section, cx } from "@/components/ui";
import { MoneyForm } from "./form";
import { deleteTransaction } from "./actions";

export const metadata: Metadata = { title: "Dinheiro" };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function DinheiroPage({ searchParams }: PageProps<"/dinheiro">) {
  const sp = await searchParams;
  const today = todaySP();
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  const { supabase } = await requireUser();
  const [{ data }, projects] = await Promise.all([
    supabase.from("finance_transactions").select("*").gte("occurred_on", start).lt("occurred_on", next).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("priority"),
  ]);
  const tx = data ?? [];
  const ps = projects.data ?? [];
  const sum = (f: (t: (typeof tx)[number]) => boolean) => tx.filter(f).reduce((a, t) => a + Number(t.amount), 0);
  const entrou = sum((t) => t.type === "receita");
  const despesas = sum((t) => t.type === "despesa");
  const investido = sum((t) => t.type === "investimento");
  const resultado = entrou - despesas;
  const caixa = entrou - despesas - investido;

  const byProject = ps.map((p) => {
    const r = sum((t) => t.project_id === p.id && t.type === "receita");
    const c = sum((t) => t.project_id === p.id && t.type !== "receita");
    return { ...p, r, c, lucro: r - c };
  }).filter((p) => p.r || p.c);

  return (
    <>
      <PageHeader title="Dinheiro" subtitle="Manual. Receita, custo, lucro, caixa e investimento não se misturam." />
      <div className="space-y-9">
        <div className="flex items-center justify-between">
          <Link href={`/dinheiro?mes=${prevMonth}`} className="h-9 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2">←</Link>
          <span className="font-medium capitalize">{MONTHS[m - 1]} {y}</span>
          <Link href={`/dinheiro?mes=${nextMonth}`} className="h-9 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2">→</Link>
        </div>

        <Card className="grid grid-cols-2 divide-line sm:grid-cols-3 [&>*]:border-line [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0 sm:[&>*:nth-child(n+4)]:border-t">
          <Stat label="Entrou" value={fmtMoney(entrou)} hint="receita" />
          <Stat label="Saiu" value={fmtMoney(despesas)} hint="custos e despesas" />
          <Stat label="Resultado" value={fmtMoney(resultado)} hint="receita − despesas" tone={resultado < 0 ? "accent" : undefined} />
          <Stat label="Investido" value={fmtMoney(investido)} hint="vira patrimônio, não custo" />
          <Stat label="Caixa do mês" value={fmtMoney(caixa)} hint="o que sobrou de verdade" tone={caixa < 0 ? "accent" : undefined} />
          <Stat label="Margem" value={entrou ? fmtPct(resultado / entrou) : "—"} hint="resultado ÷ receita" />
        </Card>

        <Section title="Lançar">
          <Card className="p-4">
            <MoneyForm projects={ps} today={today} defaultProject={typeof sp.projeto === "string" ? sp.projeto : null} />
          </Card>
        </Section>

        <Section title="Lucro por projeto">
          {byProject.length ? (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2 font-medium">Projeto</th><th className="px-4 py-2 text-right font-medium">Receita</th>
                  <th className="px-4 py-2 text-right font-medium">Custos</th><th className="px-4 py-2 text-right font-medium">Lucro</th><th className="px-4 py-2 text-right font-medium">Margem</th>
                </tr></thead>
                <tbody className="divide-y divide-line border-t border-line">
                  {byProject.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5"><Link href={`/projetos/${p.id}`} className="hover:underline">{p.name}</Link></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(p.r)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(p.c)}</td>
                      <td className={cx("px-4 py-2.5 text-right font-medium tabular-nums", p.lucro < 0 && "text-accent")}>{fmtMoney(p.lucro)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.r ? fmtPct(p.lucro / p.r) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : <p className="text-sm text-muted">Nenhum lançamento ligado a projeto neste mês.</p>}
        </Section>

        <Section title="Lançamentos">
          {tx.length ? (
            <Card className="divide-y divide-line">
              {tx.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-12 shrink-0 text-xs text-muted">{fmtDay(t.occurred_on)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{t.description || t.category}</span>
                    <span className="text-xs text-faint">{t.type} · {t.category}{t.project_id ? ` · ${ps.find((p) => p.id === t.project_id)?.name ?? ""}` : ""}</span>
                  </span>
                  <span className={cx("shrink-0 font-medium tabular-nums", t.type === "receita" ? "text-ok" : "")}>{t.type === "receita" ? "+" : "−"} {fmtMoney(Number(t.amount))}</span>
                  <form action={deleteTransaction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button aria-label="Apagar lançamento" className="px-1 text-faint hover:text-accent">×</button>
                  </form>
                </div>
              ))}
            </Card>
          ) : <Empty title="Nenhum lançamento neste mês." />}
        </Section>
      </div>
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "accent" }) {
  return (
    <div className="border-line p-4 [&:not(:nth-child(2n+1))]:border-l sm:[&:not(:nth-child(2n+1))]:border-l-0 sm:[&:not(:nth-child(3n+1))]:border-l">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className={cx("mt-1 text-lg font-semibold tabular-nums", tone === "accent" && "text-accent")}>{value}</p>
      <p className="text-[11px] text-faint">{hint}</p>
    </div>
  );
}
