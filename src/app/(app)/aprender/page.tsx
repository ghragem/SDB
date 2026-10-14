import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { LESSONS } from "@/lib/lessons";
import { fmtDay, todaySP } from "@/lib/format";
import { loadOperational } from "@/lib/operational";
import { recommend, tracks } from "@/lib/learning";
import { Submit } from "@/components/submit";
import { addReference, removeReference } from "./actions";
import { Badge, Card, Field, Input, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Aprender" };

export default async function AprenderPage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const [progress, refs, exps, op] = await Promise.all([
    supabase.from("lesson_progress").select("data, created_at").order("created_at", { ascending: false }),
    supabase.from("people_references").select("id, title, data").order("created_at"),
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "rodando"),
    loadOperational(),
  ]);
  const done = new Map<string, { at: string; review_at: string }>();
  for (const p of progress.data ?? []) {
    const d = p.data as { slug: string; review_at: string };
    if (!done.has(d.slug)) done.set(d.slug, { at: p.created_at, review_at: d.review_at });
  }
  const top = op.ranked[0] ?? null;
  const worry = `${op.checkin?.main_worry ?? ""} ${op.checkin?.raw_text ?? ""}`.toLowerCase();
  const recs = recommend({
    activeProjects: op.ranked.length, ideasLast7d: op.ideasLast7d,
    dispersion: op.alerts.some((a) => a.key === "dispersao-ideias" || a.key === "ideias-ocupado"),
    revenueNoCost: op.checks.revenueNoCost.map((r) => r.name), looseSpend: op.checks.looseSpend.count,
    openDecisions: op.queue.length, topStatus: top?.project.status ?? null, topName: top?.project.name ?? null,
    runningExperiments: exps.count ?? 0, moneyWorry: /dinheiro|grana|conta|boleto|caixa/.test(worry),
  }, new Set(done.keys()));
  const toReview = LESSONS.filter((l) => done.get(l.slug) && done.get(l.slug)!.review_at <= today);

  return (
    <>
      <PageHeader title="Aprender" subtitle="Todo estudo responde: por que isso é relevante para você agora?" />
      <div className="space-y-9">
        <Section title="Para você agora">
          {recs.length ? (
            <div className="space-y-2">
              {recs.map(({ lesson, why }) => (
                <Link key={lesson.slug} href={`/aprender/${lesson.slug}`}>
                  <Card className="p-4 hover:border-line-strong">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{lesson.area} · {lesson.minutes} min{done.has(lesson.slug) ? " · já feita" : ""}</p>
                    <p className="mt-1 text-lg font-semibold">{lesson.title}</p>
                    <p className="mt-1 text-sm text-muted">Por que agora: {why}</p>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Nenhum sinal nos seus registros pede uma aula específica agora. Sem motivo, não recomendo: escolha uma trilha abaixo.</p>
          )}
        </Section>

        {toReview.length ? (
          <Section title="Revisar">
            <Card className="divide-y divide-line">
              {toReview.map((l) => (
                <Link key={l.slug} href={`/aprender/${l.slug}`} className="flex justify-between px-4 py-3 text-sm hover:bg-surface-2">
                  <span>{l.title}</span><span className="text-accent">revisar</span>
                </Link>
              ))}
            </Card>
          </Section>
        ) : null}

        <Section title="Trilhas">
          <div className="space-y-3">
            {tracks().map((t) => (
              <Card key={t.skill} className="divide-y divide-line">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm font-semibold">{t.skill}</span>
                  <span className="text-xs tabular-nums text-muted">{t.lessons.filter((l) => done.has(l.slug)).length}/{t.lessons.length} feitas</span>
                </div>
                {t.lessons.map((l) => {
                  const d = done.get(l.slug);
                  return (
                    <Link key={l.slug} href={`/aprender/${l.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className="text-[14.5px]">{l.title}</span>
                      {d ? <Badge tone="ok">feita {fmtDay(d.at)}</Badge> : <span className="shrink-0 text-xs text-muted">{l.minutes} min</span>}
                    </Link>
                  );
                })}
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Referências que você acompanha">
          {refs.data?.length ? (
            <Card className="divide-y divide-line text-sm">
              {refs.data.map((r) => {
                const d = (r.data ?? {}) as { area?: string; why?: string; disagree?: string };
                return (
                  <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{r.title}{d.area ? <span className="font-normal text-muted"> · {d.area}</span> : null}</p>
                      {d.why ? <p className="text-muted">Por que acompanho: {d.why}</p> : null}
                      {d.disagree ? <p className="text-muted">Onde discordo: {d.disagree}</p> : null}
                    </div>
                    <form action={removeReference}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-faint hover:text-accent">remover</button></form>
                  </div>
                );
              })}
            </Card>
          ) : <p className="text-sm text-muted">Nenhuma referência cadastrada.</p>}
          <details className="rounded-[10px] border border-line bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm">Adicionar referência</summary>
            <form action={addReference} className="space-y-3 border-t border-line p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome"><Input name="name" required /></Field>
                <Field label="Área"><Input name="area" placeholder="filosofia, vendas, marketing…" /></Field>
              </div>
              <Field label="Por que acompanho"><Input name="why" placeholder="O que prende sua atenção nesse conteúdo" /></Field>
              <Field label="Onde discordo" hint="Evita tratar referência como autoridade absoluta."><Input name="disagree" /></Field>
              <Submit size="sm">Salvar</Submit>
            </form>
          </details>
          <p className="text-xs text-faint">Vídeos e artigos recomendados só entram com fonte real (link verificável). A busca automática de conteúdo depende de uma integração de busca que ainda não está conectada; nada externo é inventado.</p>
        </Section>
      </div>
    </>
  );
}
