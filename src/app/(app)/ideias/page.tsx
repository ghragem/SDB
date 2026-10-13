import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { daysSince, fmtDay } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, Section } from "@/components/ui";
import { Submit } from "@/components/submit";
import { AnalyzeIdea } from "./analyze";
import { createIdea, setIdeaStatus } from "./actions";
import Link from "next/link";

export const metadata: Metadata = { title: "Ideias" };

const GROUPS: [string, string[]][] = [
  ["Capturadas", ["capturada"]],
  ["Em análise", ["analisando", "validar", "teste"]],
  ["Promovidas", ["promover"]],
  ["Descartadas e arquivadas", ["descartada", "arquivada"]],
];
const STATUS_LABEL: Record<string, string> = { capturada: "Capturada", analisando: "Analisando", validar: "Validar", teste: "Teste", promover: "Promovida", descartada: "Descartada", arquivada: "Arquivada" };

export default async function IdeiasPage() {
  const { supabase } = await requireUser();
  const [{ data }, active] = await Promise.all([
    supabase.from("ideas").select("*").order("created_at", { ascending: false }),
    supabase.from("projects").select("name").in("status", ["construcao", "validacao", "operando", "escalando"]).order("priority").limit(1),
  ]);
  const ideas = data ?? [];
  const recent = ideas.filter((i) => (daysSince(i.created_at) ?? 99) <= 7).length;

  return (
    <>
      <PageHeader title="Ideias" subtitle="Toda ideia nova entra aqui. Nenhuma vira projeto automaticamente." />

      <form action={createIdea} className="mb-8 space-y-2">
        <input name="title" required placeholder="Tive uma ideia de…" aria-label="Nova ideia"
          className="h-12 w-full rounded-lg border border-line bg-surface px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
        <div className="flex justify-end"><Submit size="sm">Capturar</Submit></div>
      </form>

      {recent >= 3 && active.data?.[0] ? (
        <p className="mb-6 border-l-2 border-accent pl-3 text-sm">
          {recent} ideias nos últimos 7 dias. {active.data[0].name} continua sendo o projeto ativo. Você não precisa de outra ideia; precisa colocar a atual na rua.
        </p>
      ) : null}

      {ideas.length === 0 ? (
        <Empty title="Nenhuma ideia registrada.">Capture aqui ou pelo + em qualquer tela. Analise depois.</Empty>
      ) : (
        <div className="space-y-8">
          {GROUPS.map(([title, statuses]) => {
            const list = ideas.filter((i) => statuses.includes(i.status));
            if (!list.length) return null;
            return (
              <Section key={title} title={`${title} · ${list.length}`}>
                <div className="space-y-2">
                  {list.map((i) => (
                    <Card key={i.id} id={i.id}>
                      <details>
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5">
                          <span className="min-w-0">
                            <span className="block font-medium">{i.title}</span>
                            <span className="text-xs text-muted">{fmtDay(i.created_at)}{i.description ? ` · ${i.description.slice(0, 80)}` : ""}</span>
                          </span>
                          <Badge tone={i.status === "promover" ? "ok" : i.status === "descartada" ? "neutral" : "warn"}>{STATUS_LABEL[i.status]}</Badge>
                        </summary>
                        <div className="space-y-4 border-t border-line p-4">
                          {i.status === "promover" && i.promoted_project_id ? (
                            <p className="text-sm">Virou projeto. <Link className="underline underline-offset-4" href={`/projetos/${i.promoted_project_id}`}>Abrir</Link></p>
                          ) : (
                            <>
                              <p className="label">Regra anti-dispersão</p>
                              <AnalyzeIdea idea={i} />
                              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                                {["teste", "arquivada"].map((s) => (
                                  <form key={s} action={setIdeaStatus}>
                                    <input type="hidden" name="id" value={i.id} />
                                    <input type="hidden" name="status" value={s} />
                                    <button className="h-9 rounded-lg border border-line px-3 text-sm text-muted hover:text-ink">{s === "teste" ? "Marcar em teste" : "Arquivar"}</button>
                                  </form>
                                ))}
                                <form action={setIdeaStatus} className="flex flex-1 gap-2">
                                  <input type="hidden" name="id" value={i.id} />
                                  <input type="hidden" name="status" value="descartada" />
                                  <input name="discard_reason" placeholder="Motivo do descarte" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-faint" />
                                  <button className="h-9 rounded-lg px-3 text-sm text-accent hover:bg-accent-soft">Descartar</button>
                                </form>
                              </div>
                            </>
                          )}
                          {i.discard_reason ? <p className="text-sm text-muted">Motivo do descarte: {i.discard_reason}</p> : null}
                        </div>
                      </details>
                    </Card>
                  ))}
                </div>
              </Section>
            );
          })}
        </div>
      )}
    </>
  );
}
