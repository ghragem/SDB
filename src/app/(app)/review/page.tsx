import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { addDays, fmtDay, todaySP } from "@/lib/format";
import { Card, Field, Input, PageHeader, Section, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { saveDaily } from "./actions";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const [review, history, progress] = await Promise.all([
    supabase.from("daily_reviews").select("*").eq("day", today).maybeSingle(),
    supabase.from("daily_reviews").select("*").lt("day", today).gte("day", addDays(today, -14)).order("day", { ascending: false }),
    supabase.from("project_updates").select("id, body, projects(name)").eq("is_progress", true).gte("created_at", new Date(`${today}T00:00:00-03:00`).toISOString()).order("created_at"),
  ]);
  const done = (progress.data ?? []) as unknown as { id: string; body: string; projects: { name: string } | null }[];
  const r = review.data;

  return (
    <>
      <PageHeader title="Review" subtitle="Dois minutos. Quatro perguntas." action={<Link href="/review/semanal" className="text-sm text-muted hover:text-ink">Semanal →</Link>} />
      <div className="space-y-9">
        <div className="text-sm text-muted">
          {done.length ? (
            <>
              <p>Avanços registrados hoje:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink">
                {done.map((u) => <li key={u.id}>{u.projects?.name ? <span className="text-muted">{u.projects.name}: </span> : null}{u.body}</li>)}
              </ul>
            </>
          ) : <p>Nenhum avanço de projeto registrado hoje. Se algo avançou, registre no projeto: a revisão é sobre fatos.</p>}
        </div>
        <Card className="p-4">
          <form action={saveDaily} className="space-y-4">
            <Field label="1. O que realmente avançou?"><Textarea name="advanced" rows={2} defaultValue={r?.advanced ?? ""} placeholder="Fato, não intenção." /></Field>
            <Field label="2. Onde perdeu tempo?"><Textarea name="wasted" rows={2} defaultValue={r?.wasted ?? ""} /></Field>
            <Field label="3. Qual decisão ficou pendente?"><Input name="pending_decision" defaultValue={r?.pending_decision ?? ""} placeholder="Nenhuma, ou qual." /></Field>
            <Field label="4. Qual é a primeira ação de amanhã?" hint="Aparece amanhã como ação nº 1 na Hoje.">
              <Input name="tomorrow" defaultValue={r?.tomorrow ?? ""} maxLength={200} placeholder="Ex.: Mandar o orçamento para a oficina do Zé às 9h." />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Submit>{r ? "Atualizar revisão" : "Encerrar o dia"}</Submit>
              {r ? <span role="status" className="text-[13px] text-ok">Revisão salva às {new Date(r.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.</span> : null}
            </div>
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
                  {h.pending_decision ? <p className="mt-1"><span className="text-muted">Decisão pendente:</span> {h.pending_decision}</p> : null}
                  {h.tomorrow ? <p className="mt-1"><span className="text-muted">Primeira ação seguinte:</span> {h.tomorrow}</p> : null}
                </Card>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
}
