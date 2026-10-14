"use client";

import { Mic } from "lucide-react";
import { cx } from "./ui";

/** Abre a captura universal já com o projeto como contexto ("Atualiza o AutoFlow: …"). */
export function SpeakUpdate({ projectId, projectName, className }: { projectId: string; projectName: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("sdb:capture", { detail: { projectId, projectName } }))}
      className={cx("inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-fg", className)}>
      <Mic size={16} /> Falar uma atualização
    </button>
  );
}
