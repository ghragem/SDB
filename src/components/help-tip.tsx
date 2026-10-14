"use client";

import { useState } from "react";

/** "?" ao lado de um termo. Toque abre uma frase curta (funciona no celular, sem hover). */
export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={open} aria-label="O que é isso?"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        className="ml-1.5 inline-grid h-5 w-5 place-items-center rounded-full border border-line-strong align-middle text-[11px] font-semibold text-muted hover:text-ink">?</button>
      {open ? <span className="mt-1 block text-[12.5px] font-normal leading-snug text-muted">{text}</span> : null}
    </>
  );
}
