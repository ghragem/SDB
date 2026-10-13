"use client";

import { useActionState } from "react";
import { Button, ErrorNote, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { Submit } from "@/components/submit";
import { VERDICT_LABEL } from "@/lib/checks";
import type { Adversarial } from "@/lib/ai/intelligence";
import {
  createExperiment, reviewDecision, runAdversarial, runRealityCheck, saveRealityCheck, setVerdict,
  type AdvState, type DecisionState, type RealityState,
} from "./actions";

export function VerdictForm({ id, suggested, current }: { id: string; suggested: { verdict: string; reason: string }; current: { verdict: string | null; reason: string | null; confidence: string | null } }) {
  const [state, action] = useActionState<DecisionState, FormData>(setVerdict, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Object.entries(VERDICT_LABEL).map(([k, l]) => (
          <label key={k} className="relative">
            <input type="radio" name="verdict" value={k} defaultChecked={(current.verdict ?? suggested.verdict) === k} className="peer sr-only" />
            <span className="flex h-10 items-center justify-center rounded-lg border border-line px-2 text-center text-[13px] text-muted peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-fg peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{l}</span>
          </label>
        ))}
      </div>
      <Field label="Por quê"><Textarea name="verdict_reason" rows={2} defaultValue={current.reason ?? suggested.reason} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Confiança">
          <Select name="confidence" defaultValue={current.confidence ?? "media"}>
            <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
          </Select>
        </Field>
        <Field label="Revisar em">
          <Select name="review_in" defaultValue="7">
            <option value="3">3 dias</option><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="against_recommendation" className="h-4 w-4 accent-[var(--accent)]" />
        Estou decidindo contra a recomendação (fica registrado para revisar depois)
      </label>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit>Registrar veredito</Submit>
    </form>
  );
}

export function ReviewForm({ id }: { id: string }) {
  const [state, action] = useActionState<DecisionState, FormData>(reviewDecision, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="O que aconteceu?"><Textarea name="what_happened" rows={3} required /></Field>
      <Field label="Previsão x realidade"><Textarea name="expected_vs_real" rows={2} /></Field>
      <Field label="Resultado">
        <Select name="outcome" defaultValue="parcial">
          <option value="acertou">Acertou</option><option value="parcial">Parcial</option><option value="errou">Errou</option><option value="cedo_demais">Cedo demais para saber</option>
        </Select>
      </Field>
      <Field label="O que aprendemos? O que muda agora?" hint="Vai para o Brain."><Textarea name="lesson" rows={3} /></Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit>Registrar revisão</Submit>
    </form>
  );
}

export function ExperimentForm({ decisionId, projectId, maxLoss }: { decisionId: string; projectId: string | null; maxLoss: number | null }) {
  const [state, action] = useActionState<DecisionState, FormData>(createExperiment, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="decision_id" value={decisionId} />
      <input type="hidden" name="project_id" value={projectId ?? ""} />
      <Field label="Hipótese"><Textarea name="hypothesis" rows={2} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor máximo (R$)"><Input name="max_amount" inputMode="decimal" defaultValue={maxLoss ?? ""} /></Field>
        <Field label="Prazo"><Input name="deadline" type="date" /></Field>
      </div>
      <Field label="Métrica"><Input name="metric" /></Field>
      <Field label="Para quando" hint="Critério de parada. Depois de começar, não muda por emoção."><Input name="stop_condition" required /></Field>
      <Field label="Escala quando"><Input name="scale_condition" /></Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit>Criar experimento</Submit>
    </form>
  );
}

export function AdversarialPanel({ id, aiConfigured, saved }: { id: string; aiConfigured: boolean; saved: Adversarial | null }) {
  const [state, action, pending] = useActionState<AdvState, FormData>(runAdversarial, {});
  const r = state.result ?? saved;
  if (!aiConfigured) {
    return <p className="text-sm text-muted">O modo adversarial precisa de um provider de IA configurado no servidor. Hoje não há nenhum, então ele está desligado em vez de fingir uma análise.</p>;
  }
  return (
    <div className="space-y-4">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Construindo argumentos…" : r ? "Rodar de novo" : "Destrua minha ideia"}</Button>
      </form>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {r ? (
        <div className="space-y-4 text-[15px]">
          <Block title="Contra">{r.against}</Block>
          <Block title="A favor">{r.for}</Block>
          <ListBlock title="Fatos" items={r.facts} />
          <ListBlock title="Incertezas" items={r.uncertainties} />
          <ListBlock title="Riscos" items={r.risks} />
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="label">Veredito da IA · confiança {r.confidence}</p>
            <p className="mt-1 font-medium">{VERDICT_LABEL[r.verdict]}</p>
            <p className="mt-1">{r.recommendation}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="label">{title}</p><p className="mt-1 leading-relaxed">{children}</p></div>;
}
function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="label">{title}</p>
      {items.length ? <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="mt-1 text-muted">Nenhum.</p>}
    </div>
  );
}

export function RealityCheckPanel({ aiConfigured }: { aiConfigured: boolean }) {
  const [state, action, pending] = useActionState<RealityState, FormData>(runRealityCheck, {});
  const r = state.result;
  const asText = r ? [
    ["Fatos", r.fatos], ["Suposições", r.suposicoes], ["Emoções", r.emocoes], ["Vieses", r.vieses], ["Riscos", r.riscos],
  ].map(([t, xs]) => `${t}:\n${(xs as string[]).map((x) => `- ${x}`).join("\n") || "- nenhum"}`).join("\n\n") + `\n\nPróxima ação: ${r.proxima_acao}\n\nSituação: ${state.text}` : "";
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        <Textarea name="situation" rows={3} defaultValue={state.text} placeholder="Explique a situação como contaria para um amigo." disabled={!aiConfigured} />
        <Button type="submit" disabled={pending || !aiConfigured}>{pending ? "Separando…" : "Eu estou viajando?"}</Button>
        {!aiConfigured ? <p className="text-xs text-muted">Precisa de IA configurada no servidor.</p> : null}
      </form>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {r ? (
        <div className="space-y-3 text-[15px]">
          {([["Fatos", r.fatos], ["Suposições", r.suposicoes], ["Emoções", r.emocoes], ["Vieses", r.vieses], ["Riscos", r.riscos]] as const).map(([t, xs]) => (
            <ListBlock key={t} title={t} items={xs} />
          ))}
          <div className={cx("rounded-lg bg-surface-2 p-3")}><p className="label">Próxima ação</p><p className="mt-1 font-medium">{r.proxima_acao}</p></div>
          <form action={saveRealityCheck}>
            <input type="hidden" name="body" value={asText} />
            <Button type="submit" size="sm">Salvar no Brain</Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
