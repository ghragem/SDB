import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { fmtDay, fmtMoney } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, Section } from "@/components/ui";
import { discard, route } from "./actions";

export const metadata: Metadata = { title: "Inbox" };

const CATS = ["vendas","servicos","salario","ads","gateway","ferramentas","reembolso","estoque","faculdade","lazer","compras","moradia","transporte","alimentacao","patrimonio","outros"];
const btn = "h-9 rounded-lg border border-line px-3 text-sm text-muted hover:border-line-strong hover:text-ink";

export default async function InboxPage() {
  const { supabase } = await requireUser();
  const [{ data }, projects, done] = await Promise.all([
    supabase.from("inbox_items").select("*").eq("status", "pendente").order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").not("status", "eq", "encerrado").order("priority"),
    supabase.from("inbox_items").select("id, kind, body, routed_table, status, created_at").neq("status", "pendente").order("updated_at", { ascending: false }).limit(10),
  ]);
  const items = data ?? [];
  const ps = projects.data ?? [];

  return (
    <>
      <PageHeader title="Inbox" subtitle="Capture primeiro. Classifique depois. Use o + em qualquer tela." />
      <div className="space-y-8">
        {items.length ? (
          <div className="space-y-2">
            {items.map((it) => {
              const money = it.kind === "despesa" || it.kind === "receita";
              return (
                <Card key={it.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <Badge>{it.kind}</Badge>
                    {money ? <span className="text-sm font-semibold tabular-nums">{fmtMoney(Number(it.amount))}</span> : null}
                    <span className="ml-auto text-xs text-faint">{fmtDay(it.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap">{it.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {money ? (
                      <form action={route} className="flex flex-wrap gap-2">
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="to" value={it.kind} />
                        <select name="category" defaultValue={it.kind === "receita" ? "vendas" : "outros"} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Categoria">
                          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select name="project_id" defaultValue="" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Projeto">
                          <option value="">Sem projeto</option>
                          {ps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button className="h-9 rounded-lg bg-ink px-3 text-sm font-medium text-bg">Lançar em Dinheiro</button>
                      </form>
                    ) : (
                      <>
                        {[["ideia", "→ Ideia"], ["decisao", "→ Decisão"], [it.kind === "tarefa" || it.kind === "decisao" || it.kind === "ideia" ? "nota" : it.kind, "→ Brain"]].map(([to, label]) => (
                          <form key={label} action={route}>
                            <input type="hidden" name="id" value={it.id} />
                            <input type="hidden" name="to" value={to} />
                            <button className={btn}>{label}</button>
                          </form>
                        ))}
                        {ps.length ? (
                          <form action={route} className="flex gap-2">
                            <input type="hidden" name="id" value={it.id} />
                            <input type="hidden" name="to" value="projeto" />
                            <select name="project_id" required defaultValue="" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Projeto">
                              <option value="" disabled>Projeto…</option>
                              {ps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button className={btn}>→ Projeto</button>
                          </form>
                        ) : null}
                      </>
                    )}
                    <form action={discard} className="ml-auto">
                      <input type="hidden" name="id" value={it.id} />
                      <button className="h-9 px-2 text-sm text-faint hover:text-accent">Descartar</button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Empty title="Inbox vazia.">Nada esperando classificação.</Empty>
        )}

        {done.data?.length ? (
          <Section title="Classificados recentemente">
            <Card className="divide-y divide-line text-sm">
              {done.data.map((d) => (
                <div key={d.id} className="flex justify-between gap-3 px-4 py-2.5">
                  <span className="truncate text-muted">{d.body}</span>
                  <span className="shrink-0 text-xs text-faint">{d.status === "descartado" ? "descartado" : d.routed_table?.replace("_", " ")}</span>
                </div>
              ))}
            </Card>
          </Section>
        ) : null}
      </div>
    </>
  );
}
