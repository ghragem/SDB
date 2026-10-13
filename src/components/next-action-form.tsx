"use client";

import { useActionState, useState } from "react";
import { setNextAction, type NextActionState } from "@/app/(app)/projetos/actions";
import { ACTION_EXAMPLE, actionQuality } from "@/lib/engine";
import { Button, ErrorNote, cx } from "./ui";

/** Próxima ação obrigatória e concreta. Avisa na hora se estiver vaga; salva mesmo assim (a decisão é sua). */
export function NextActionForm({ projectId, current, compact }: { projectId: string; current?: string | null; compact?: boolean }) {
  const [text, setText] = useState(current ?? "");
  const [state, action, pending] = useActionState<NextActionState, FormData>(setNextAction, {});
  const q = actionQuality(text);
  const dirty = text.trim() !== (current ?? "").trim();

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="project_id" value={projectId} />
      <div className={cx("flex gap-2", compact ? "flex-col sm:flex-row" : "flex-col")}>
        <input name="next_action" value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
          placeholder={`Ex.: ${ACTION_EXAMPLE}`} aria-label="Próxima ação"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
        <Button type="submit" variant="primary" disabled={pending || !text.trim() || !dirty} className={compact ? "sm:w-auto" : "w-full sm:w-auto"}>
          {pending ? "Salvando…" : current ? "Atualizar ação" : "Definir ação"}
        </Button>
      </div>
      {text.trim() && q.level === "vaga" ? (
        <p className="text-[13px] text-warn">{q.reason} Bom: “{ACTION_EXAMPLE}”</p>
      ) : null}
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok && !dirty ? <p className="text-[13px] text-ok" role="status">Próxima ação salva.</p> : null}
    </form>
  );
}
