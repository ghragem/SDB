import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { LESSONS } from "@/lib/lessons";
import { fmtDay, todaySP } from "@/lib/format";
import type { SessionItem } from "@/lib/types";
import { Badge, Card, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Aprender" };

export default async function AprenderPage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const [progress, session] = await Promise.all([
    supabase.from("lesson_progress").select("data, created_at").order("created_at", { ascending: false }),
    supabase.from("daily_sessions").select("items").eq("day", today).order("created_at", { ascending: false }).limit(1),
  ]);
  const done = new Map<string, { at: string; review_at: string }>();
  for (const p of progress.data ?? []) {
    const d = p.data as { slug: string; review_at: string };
    if (!done.has(d.slug)) done.set(d.slug, { at: p.created_at, review_at: d.review_at });
  }
  const todayItem = ((session.data?.[0]?.items ?? []) as SessionItem[]).find((i) => i.kind === "estudo");
  const recommended = LESSONS.find((l) => l.slug === todayItem?.ref_id);
  const toReview = LESSONS.filter((l) => done.get(l.slug) && done.get(l.slug)!.review_at <= today);

  return (
    <>
      <PageHeader title="Aprender" subtitle="Todo estudo responde: por que agora?" />
      <div className="space-y-9">
        {recommended ? (
          <Section title="Para hoje">
            <Link href={`/aprender/${recommended.slug}`}>
              <Card className="p-4 hover:border-line-strong">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{recommended.area} · {recommended.minutes} min</p>
                <p className="mt-1 text-lg font-semibold">{recommended.title}</p>
                <p className="mt-1 text-sm text-muted">Por que agora: {todayItem?.detail ?? recommended.why}</p>
              </Card>
            </Link>
          </Section>
        ) : (
          <p className="text-sm text-muted">Faça o check-in em Hoje para receber a aula que faz sentido agora.</p>
        )}

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

        <Section title="Aulas disponíveis">
          <Card className="divide-y divide-line">
            {LESSONS.map((l) => {
              const d = done.get(l.slug);
              return (
                <Link key={l.slug} href={`/aprender/${l.slug}`} className="block px-4 py-3.5 hover:bg-surface-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{l.title}</span>
                    {d ? <Badge tone="ok">feita {fmtDay(d.at)}</Badge> : <span className="shrink-0 text-xs text-muted">{l.minutes} min</span>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">{l.area}</p>
                </Link>
              );
            })}
          </Card>
          <p className="text-xs text-faint">FAC, trilhas por habilidade e recomendação de vídeos entram nas próximas versões.</p>
        </Section>
      </div>
    </>
  );
}
