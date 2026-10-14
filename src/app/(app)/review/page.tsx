import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { addDays, fmtDay, fmtMoney, todaySP } from "@/lib/format";
import { loadOperational } from "@/lib/operational";
import { DAY_STATE_LABEL, type DayState } from "@/lib/types";
import { Card, Field, Input, PageHeader, Section, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { saveDaily } from "./actions";

export const metadata: Metadata = { title: "Review" };

const CAT: Record<string, string> = { servicos: "serviços", alimentacao: "alimentação", patrimonio: "patrimônio", ads: "anúncios" };
const NOTE: Record<string, string> = { aprendizado: "Aprendizado", erro: "Erro", hipotese: "Hipótese", decisao: "Decisão", insight: "Insight" };

export default async function ReviewPage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const since = new Date(`${today}T00:00:00-03:00`).toISOString();
  const [review, history, progress, money, decisions, lessons, ideas, checkin, op, notes] = await Promise.all([
    supabase.from("daily_reviews").select("*").eq("day", today).maybeSingle(),
    supabase.from("daily_reviews").select("*").lt("day", today).gte("day", addDays(today, -14)).order("day", { ascending: false }),
    supabase.from("project_updates").select("id, body, kind, projects(name)").eq("is_progress", true).gte("created_at", since).order("created_at"),
    supabase.from("finance_transactions").select("type, amount, category, projects(name)").gte("created_at", since),
    supabase.from("decisions").select("id, title, verdict").gte("updated_at", since),
    supabase.from("lesson_progress").select("data").gte("created_at", since),
    supabase.from("ideas").select("title").gte("created_at", since),
    supabase.from("daily_checkins").select("energy, focus, pressure, day_state").eq("day", today).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadOperational(),
    supabase.from("brain_notes").select("kind, title, body").in("kind", ["aprendizado", "erro", "hipotese", "decisao", "insight"]).gte("created_at", since),
  ]);
  const done = (progress.data ?? []) as unknown as { id: string; body: string; kind: string; projects: { name: string } | null }[];
  const tx = (money.data ?? []) as unknown as { type: string; amount: number; category: string; projects: { name: string } | null }[];
  const r = review.data;

  // O que o sistema já sabe do dia: não perguntar de novo.
  const known: string[] = [];
  const projectsMoved = [...new Set(done.map((u) => u.projects?.name).filter(Boolean))] as string[];
  if (checkin.data) known.push(`Check-in: ${checkin.data.day_state ? DAY_STATE_LABEL[checkin.data.day_state as DayState] : "sem modo"}${checkin.data.energy ? ` (energia ${checkin.data.energy}, foco ${checkin.data.focus}, pressão ${checkin.data.pressure})` : ""}.`);
  for (const u of done) known.push(`${u.projects?.name ?? "Projeto"}: ${u.kind === "validacao" ? "evidência — " : ""}${u.body}`);
  for (const t of tx) known.push(`${t.type === "receita" ? "Receita" : "Gasto"} ${fmtMoney(Number(t.amount))} em ${CAT[t.category] ?? t.category}${t.projects?.name ? ` (${t.projects.name})` : " (sem projeto)"}.`);
  for (const n of notes.data ?? []) known.push(`${NOTE[n.kind] ?? "Nota"}: ${n.title ? `${n.title} — ` : ""}${n.body.slice(0, 140)}`);
  for (const d of decisions.data ?? []) known.push(`Decisão: ${d.title}${d.verdict ? ` → ${d.verdict.replace("_", " ")}` : ""}.`);
  for (const l of lessons.data ?? []) known.push(`Estudo: ${(l.data as { slug?: string }).slug?.replace(/-/g, " ") ?? "aula"}.`);
  for (const i of ideas.data ?? []) known.push(`Ideia nova: ${i.title}.`);

  const spent = tx.filter((t) => t.type !== "receita");
  const catLabel = (c: string) => CAT[c] ?? c;
  const context = [
    projectsMoved.length ? `avançou ${projectsMoved.join(" e ")}` : null,
    spent.length ? `registrou ${fmtMoney(spent.reduce((a, t) => a + Number(t.amount), 0))} em ${[...new Set(spent.map((t) => catLabel(t.category)))].join(", ")}` : null,
  ].filter(Boolean).join(" e ");
  const autoAdvanced = done.map((u) => `${u.projects?.name ? `${u.projects.name}: ` : ""}${u.body}`).join("; ");
  const openDecisions = op.queue.map((q) => q.d.title);
  const top = op.ranked[0] ?? null;

  return (
    <>
      <PageHeader title="Review" subtitle="Dois minutos. Só o que o sistema ainda não sabe." action={<Link href="/review/semanal" className="text-sm text-muted hover:text-ink">Semanal →</Link>} />
      <div className="space-y-9">
        <Card className="p-4 text-sm">
          <p className="label">O que você já registrou hoje</p>
          {known.length ? (
            <ul className="mt-2 space-y-1">{known.map((k, i) => <li key={i} className="flex gap-2"><span className="text-ok">✓</span><span>{k}</span></li>)}</ul>
          ) : <p className="mt-2 text-muted">Nada registrado hoje ainda. Se algo aconteceu, fale pelo microfone: a revisão é sobre fatos.</p>}
        </Card>

        <Card className="p-4">
          <form action={saveDaily} className="space-y-4">
            {done.length ? (
              <Field label="1. O que avançou" hint="Preenchido com o que você registrou. Ajuste se faltou algo.">
                <Textarea name="advanced" rows={2} defaultValue={r?.advanced ?? autoAdvanced} />
              </Field>
            ) : (
              <Field label="1. O que realmente avançou?" hint="Nenhum avanço registrado hoje. Se nada avançou, escreva isso.">
                <Textarea name="advanced" rows={2} defaultValue={r?.advanced ?? ""} placeholder="Fato, não intenção." />
              </Field>
            )}
            <Field label={context ? `2. Hoje você ${context}. O que consumiu tempo sem gerar avanço?` : "2. O que consumiu tempo sem gerar avanço?"}>
              <Textarea name="wasted" rows={2} defaultValue={r?.wasted ?? ""} />
            </Field>
            <Field label={openDecisions.length ? "3. Além das abertas, ficou alguma decisão pendente?" : "3. Qual decisão ficou pendente?"}
              hint={openDecisions.length ? `Já na fila: ${openDecisions.slice(0, 3).join("; ")}${openDecisions.length > 3 ? "…" : ""}.` : undefined}>
              <Input name="pending_decision" defaultValue={r?.pending_decision ?? ""} placeholder="Nenhuma, ou qual." />
            </Field>
            <Field label="4. Qual é a primeira ação de amanhã?" hint="Aparece amanhã como ação nº 1 na Hoje.">
              <Input name="tomorrow" defaultValue={r?.tomorrow ?? ""} maxLength={200}
                placeholder={top?.project.next_action ? `Sugestão: ${top.project.name}: ${top.project.next_action}` : "Ex.: Mandar o orçamento para a oficina do Zé às 9h."} />
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
