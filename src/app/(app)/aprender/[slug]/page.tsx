import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { lessonBySlug } from "@/lib/lessons";
import { fmtDay } from "@/lib/format";
import { Card, Field, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { saveExercise } from "../actions";

export const metadata: Metadata = { title: "Aula" };

export default async function AulaPage({ params }: PageProps<"/aprender/[slug]">) {
  const { slug } = await params;
  const lesson = lessonBySlug(slug);
  if (!lesson) notFound();
  const { supabase } = await requireUser();
  const { data: past } = await supabase.from("lesson_progress").select("data, created_at").eq("data->>slug", slug).order("created_at", { ascending: false });

  const blocks: [string, string][] = [
    ["Conceito", lesson.concept],
    ["Explicação simples", lesson.simple],
    ["Exemplo", lesson.example],
    ["Como isso aparece na sua vida", lesson.inYourLife],
  ];

  return (
    <article className="space-y-8">
      <div>
        <Link href="/aprender" className="text-sm text-muted hover:text-ink">← Aprender</Link>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-accent">{lesson.area} · {lesson.minutes} min</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">{lesson.title}</h1>
      </div>
      {blocks.map(([t, body]) => (
        <section key={t}>
          <h2 className="label">{t}</h2>
          <p className="mt-2 text-[17px] leading-relaxed">{body}</p>
        </section>
      ))}
      <section>
        <h2 className="label">Exercício</h2>
        <p className="mt-2 text-[17px] leading-relaxed">{lesson.exercise}</p>
        <Card className="mt-4 p-4">
          <form action={saveExercise} className="space-y-3">
            <input type="hidden" name="slug" value={lesson.slug} />
            <Field label="Sua resposta"><Textarea name="answer" rows={5} required /></Field>
            <Field label="Aplicação: o que você vai fazer com isso esta semana?"><Textarea name="application" rows={2} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="to_brain" defaultChecked className="h-4 w-4 accent-[var(--accent)]" /> Salvar no Brain</label>
            <Submit>Registrar</Submit>
          </form>
        </Card>
        <p className="mt-2 text-xs text-faint">Revisar novamente em {lesson.reviewInDays} dias.</p>
      </section>
      {past?.length ? (
        <section>
          <h2 className="label">Suas respostas</h2>
          <div className="mt-2 space-y-2">
            {past.map((p, i) => {
              const d = p.data as { answer: string; application?: string };
              return (
                <Card key={i} className="p-4 text-sm">
                  <p className="text-xs text-muted">{fmtDay(p.created_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{d.answer}</p>
                  {d.application ? <p className="mt-2 text-muted">Aplicação: {d.application}</p> : null}
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}
