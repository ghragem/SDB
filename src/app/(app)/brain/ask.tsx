"use client";

import { useActionState } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { ask, type AskState } from "./actions";

export function AskHistory({ aiConfigured, q }: { aiConfigured: boolean; q: string }) {
  const [state, action, pending] = useActionState<AskState, FormData>(ask, {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Por que parei de escalar Coach de Bolso?" aria-label="Pergunte ao seu histórico"
          className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
        <Button type="submit" variant="primary" className="h-12" disabled={pending}>
          {pending ? "…" : "Perguntar"}
        </Button>
      </div>
      {!aiConfigured ? <p className="text-xs text-muted">Sem IA configurada, a pergunta vira busca textual nos seus registros.</p> : null}
      {state.error && aiConfigured ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.answer ? (
        <div className="rounded-lg bg-surface-2 p-3 text-[15px] leading-relaxed">
          <p className="label mb-1">Resposta · confiança {state.confidence}</p>
          <p className="whitespace-pre-wrap">{state.answer}</p>
        </div>
      ) : null}
      {state.hits ? (
        <ol className="space-y-1.5 text-sm">
          {state.hits.length ? state.hits.map((h, i) => (
            <li key={h.kind + h.id}><a href={h.href} className="text-muted hover:text-ink"><span className="tabular-nums">[{i + 1}]</span> {h.title} <span className="text-faint">· {h.kind} · {h.created_at.slice(8, 10)}/{h.created_at.slice(5, 7)}</span></a></li>
          )) : <li className="text-muted">Não encontrado nos seus registros.</li>}
        </ol>
      ) : null}
    </form>
  );
}
