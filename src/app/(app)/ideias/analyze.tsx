"use client";

import { useActionState } from "react";
import { Button, ErrorNote, Field, Input, Textarea, cx } from "@/components/ui";
import { analyzeIdea, type IdeaState } from "./actions";

type Idea = Record<string, string | null>;

const QUESTIONS: [string, string][] = [
  ["why_now", "1. Por que isso merece passar na frente?"],
  ["project_losing_time", "2. Qual projeto perderá tempo?"],
  ["evidence", "3. Qual evidência existe? (fato, não sensação)"],
  ["test_cost", "4. Quanto custa testar?"],
  ["time_to_learn", "5. Quanto tempo até aprender algo?"],
  ["reversible", "6. Isso é reversível?"],
];

export function AnalyzeIdea({ idea }: { idea: Idea }) {
  const [state, action, pending] = useActionState<IdeaState, FormData>(analyzeIdea, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={idea.id ?? ""} />
      {QUESTIONS.map(([k, label]) => (
        <Field key={k} label={label}>
          {k === "why_now" || k === "evidence" ? <Textarea name={k} rows={2} defaultValue={idea[k] ?? ""} /> : <Input name={k} defaultValue={idea[k] ?? ""} />}
        </Field>
      ))}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">7. É oportunidade ou novidade?</legend>
        <div className="grid grid-cols-3 gap-2">
          {[["oportunidade", "Oportunidade"], ["novidade", "Novidade"], ["nao_sei", "Não sei"]].map(([v, l]) => (
            <label key={v} className="relative">
              <input type="radio" name="opportunity_or_novelty" value={v} defaultChecked={idea.opportunity_or_novelty === v} className="peer sr-only" />
              <span className={cx("flex h-10 items-center justify-center rounded-lg border border-line text-sm text-muted peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-accent")}>{l}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.verdict ? <p className={cx("rounded-lg px-3 py-2 text-sm", state.ok ? "bg-surface-2" : "bg-accent-soft text-accent")}>{state.verdict}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="save" size="sm" disabled={pending}>Salvar análise</Button>
        <Button type="submit" name="intent" value="promote" variant="primary" size="sm" disabled={pending}>Promover a projeto</Button>
      </div>
    </form>
  );
}
