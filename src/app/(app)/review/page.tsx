import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { addDays, fmtDay, todaySP } from "@/lib/format";
import type { SessionItem } from "@/lib/types";
import { Card, Field, PageHeader, Section, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { saveDaily } from "./actions";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const [review, session, history, progress] = await Promise.all([
    supabase.from("daily_reviews").select("*").eq("day", today).maybeSingle(),
    supabase.from("daily_sessions").select("items").eq("day", today).order("created_at", { ascending: false }).limit(1),
    supabase.from("daily_reviews").select("*").lt("day", today).gte("day", addDays(today, -14)).order("day", { ascending: false }),
    supabase.from("project_updates").select("id", { count: "exact", head: true }).eq("is_progress", true).gte("created_at", today + "T03:00:00Z"),
  ]);
  const items = (session.data?.[0]?.items ?? []) as SessionItem[];
  const done = items.filter((i) => i.done).length;
  const r = review.data;

  return (
    <>
      <PageHeader title="Review" subtitle="Dois minutos. Três perguntas." action={<Link href="/review/semanal" className="text-sm text-muted hover:text-ink">Semanal →</Link>} />
      <div className="space-y-9">
        <p className="text-sm text-muted">
          Hoje: {items.length ? `${done} de ${items.length} itens da sessão feitos` : "sem sessão"} · {progress.count ?? 0} avanço{progress.count === 1 ? "" : "s"} de projeto registrado{progress.count === 1 ? "" : "s"}.
        </p>
        <Card className="p-4">
          <form action={saveDaily} className="space-y-4">
            <Field label="1. O que realmente avançou hoje?"><Textarea name="advanced" rows={2} defaultValue={r?.advanced ?? ""} /></Field>
            <Field label="2. Onde desperdicei energia?"><Textarea name="wasted" rows={2} defaultValue={r?.wasted ?? ""} /></Field>
            <Field label="3. O que amanhã já pode começar decidido?"><Textarea name="tomorrow" rows={2} defaultValue={r?.tomorrow ?? ""} /></Field>
            <Submit>{r ? "Atualizar revisão" : "Encerrar o dia"}</Submit>
          </form>
        </Card>

        {history.data?.length ? (
          <Section title="Últimos 14 dias">
            <div className="space-y-2">
              {history.data.map((h) => (
                <Card key={h.id} className="p-4 text-sm">
                  <p className="text-xs text-muted">{fmtDay(h.day)}</p>
                  {h.advanced ? <p className="mt-1"><span className="text-muted">Avançou:</span> {h.advanced}</p> : null}
                  {h.wasted ? <p className="mt-1"><span className="text-muted">Desperdício:</span> {h.wasted}</p> : null}
                  {h.tomorrow ? <p className="mt-1"><span className="text-muted">Amanhã:</span> {h.tomorrow}</p> : null}
                </Card>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
}
