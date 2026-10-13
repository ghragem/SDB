import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import type { Adversarial } from "@/lib/ai/intelligence";
import { decisionFlags, suggestVerdict, VERDICT_LABEL } from "@/lib/checks";
import { fmtDay, fmtMoney, todaySP } from "@/lib/format";
import { Badge, Card, Section, cx } from "@/components/ui";
import { DecisionForm } from "../decision-form";
import { AdversarialPanel, ExperimentForm, ReviewForm, VerdictForm } from "../panels";
import { closeExperiment } from "../actions";

export const metadata: Metadata = { title: "Decisão" };

const REV: Record<string, string> = { reversivel: "Reversível", parcial: "Parcialmente reversível", irreversivel: "Irreversível" };

export default async function DecisaoPage({ params }: PageProps<"/decidir/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: d } = await supabase.from("decisions").select("*").eq("id", id).maybeSingle();
  if (!d) notFound();
  const [reviews, experiments, projects] = await Promise.all([
    supabase.from("decision_reviews").select("*").eq("decision_id", id).order("created_at", { ascending: false }),
    supabase.from("experiments").select("*").eq("decision_id", id).order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("priority"),
  ]);
  const flags = decisionFlags(d);
  const suggested = suggestVerdict(d);
  const ai = aiStatus();
  const today = todaySP();
  const due = d.review_at && d.review_at <= today;
  const project = (projects.data ?? []).find((p) => p.id === d.project_id);

  const card: [string, string | null][] = [
    ["Objetivo", d.objective], ["Motivo", d.motive], ["Valor", d.amount ? fmtMoney(Number(d.amount)) : null],
    ["Perda máxima", d.max_loss ? fmtMoney(Number(d.max_loss)) : null], ["Upside", d.upside], ["Downside", d.downside],
    ["Evidências", d.evidence], ["Suposições", d.assumptions], ["Reversibilidade", d.reversibility ? REV[d.reversibility] : null],
    ["Prazo", d.deadline ? fmtDay(d.deadline) : null], ["Alternativas", d.alternatives], ["Custo de oportunidade", d.opportunity_cost],
    ["Pre-mortem", d.premortem],
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/decidir" className="text-sm text-muted hover:text-ink">← Decidir</Link>
        <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight">{d.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          {d.verdict ? <Badge tone="accent">{VERDICT_LABEL[d.verdict]}</Badge> : <Badge tone="warn">sem veredito</Badge>}
          {project ? <Link href={`/projetos/${project.id}`} className="hover:text-ink">{project.name}</Link> : null}
          <span>registrada {fmtDay(d.created_at)}</span>
          {d.review_at ? <span className={cx(due && "text-accent")}>revisar {fmtDay(d.review_at)}</span> : null}
          {d.against_recommendation ? <span>contra a recomendação</span> : null}
        </div>
      </div>

      <Card className="divide-y divide-line">
        {card.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[170px_1fr]">
            <span className="text-muted">{k}</span>
            <span className={cx(!v && "text-faint")}>{v ?? "não informado"}</span>
          </div>
        ))}
      </Card>

      {flags.length ? (
        <Section title="Checagem por regras">
          <ul className="space-y-1.5 text-sm">
            {flags.map((f) => <li key={f} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{f}</li>)}
          </ul>
        </Section>
      ) : null}

      {d.status !== "revisada" ? (
        <Section title={d.verdict ? "Veredito" : "Resultado"}>
          <Card className="p-4">
            {!d.verdict ? <p className="mb-3 text-sm text-muted">Sugestão por regras: <span className="font-medium text-ink">{VERDICT_LABEL[suggested.verdict]}</span>. {suggested.reason}</p> : null}
            <VerdictForm id={d.id} suggested={suggested} current={{ verdict: d.verdict, reason: d.verdict_reason, confidence: d.confidence }} />
          </Card>
        </Section>
      ) : null}

      {/* Recurso de IA: some quando não há IA, a não ser que já exista uma análise salva. */}
      {ai.configured || d.metadata?.adversarial ? (
        <Section title="Modo adversarial">
          <Card className="p-4"><AdversarialPanel id={d.id} aiConfigured={ai.configured} saved={(d.metadata?.adversarial as Adversarial | undefined) ?? null} /></Card>
        </Section>
      ) : null}

      {d.verdict === "testar_pequeno" || experiments.data?.length ? (
        <Section title="Experimento">
          {experiments.data?.map((e) => (
            <Card key={e.id} className="mb-3 p-4 text-sm">
              <div className="flex justify-between gap-3"><span className="font-medium">{e.hypothesis}</span><Badge>{e.status}</Badge></div>
              <dl className="mt-2 grid gap-1 text-muted sm:grid-cols-2">
                <div>Limite: {e.max_amount ? fmtMoney(Number(e.max_amount)) : "—"}</div>
                <div>Prazo: {e.deadline ? fmtDay(e.deadline) : "—"}</div>
                <div>Métrica: {e.metric ?? "—"}</div>
                <div>Para quando: {e.stop_condition}</div>
                <div>Escala quando: {e.scale_condition ?? "—"}</div>
              </dl>
              {e.status === "rodando" || e.status === "planejado" ? (
                <form action={closeExperiment} className="mt-3 space-y-2 border-t border-line pt-3">
                  <input type="hidden" name="id" value={e.id} />
                  <input name="result" placeholder="Resultado (números reais)" className="h-10 w-full rounded-lg border border-line bg-surface px-3" />
                  <input name="learning" placeholder="Aprendizado" className="h-10 w-full rounded-lg border border-line bg-surface px-3" />
                  <div className="flex flex-wrap gap-2">
                    {["validado", "rejeitado", "inconclusivo"].map((s) => (
                      <button key={s} name="status" value={s} className="h-9 rounded-lg border border-line px-3 capitalize text-muted hover:text-ink">{s}</button>
                    ))}
                  </div>
                </form>
              ) : (
                <p className="mt-2">{e.result} {e.learning ? `· ${e.learning}` : ""}</p>
              )}
            </Card>
          ))}
          {!experiments.data?.length ? <Card className="p-4"><ExperimentForm decisionId={d.id} projectId={d.project_id} maxLoss={d.max_loss ? Number(d.max_loss) : null} /></Card> : null}
        </Section>
      ) : null}

      {d.verdict ? (
        <Section title="Revisão · previsão x realidade">
          {reviews.data?.map((r) => (
            <Card key={r.id} className="mb-3 p-4 text-sm">
              <p className="text-xs text-muted">{fmtDay(r.created_at)} · {r.outcome?.replace("_", " ")}</p>
              <p className="mt-1">{r.what_happened}</p>
              {r.expected_vs_real ? <p className="mt-1 text-muted">{r.expected_vs_real}</p> : null}
              {r.lesson ? <p className="mt-2 font-medium">{r.lesson}</p> : null}
            </Card>
          ))}
          {d.status !== "revisada" ? <Card className="p-4"><ReviewForm id={d.id} /></Card> : null}
        </Section>
      ) : null}

      <details className="rounded-[10px] border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 font-medium">Editar cartão</summary>
        <div className="border-t border-line p-4"><DecisionForm decision={d} projects={projects.data ?? []} /></div>
      </details>
    </div>
  );
}
