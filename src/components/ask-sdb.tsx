"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { ArrowUp, Mic, Square } from "lucide-react";
import { ask, type AskState } from "@/app/(app)/sdb/actions";
import type { Intent } from "@/lib/intent";
import { getSR } from "./recorder";
import { Listen } from "./listen";
import { Badge, ErrorNote, cx } from "./ui";

const SHORTCUTS: [string, string][] = [
  ["O que faço agora?", "O que faço agora?"],
  ["O que estou evitando?", "O que estou evitando?"],
  ["O que está parado?", "O que está parado?"],
  ["Onde estou dispersando?", "Onde estou me dispersando?"],
  ["O que exige decisão?", "O que exige decisão?"],
];

const noop = () => () => {};

/** Pergunte ao SDB: responde só com fatos do sistema (cada fato tem link para o registro). */
export function AskSDB({ mode, placeholder, shortcuts = true }: { mode?: Intent; placeholder?: string; shortcuts?: boolean }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<AskState>({});
  const [pending, start] = useTransition();
  const [listening, setListening] = useState(false);
  const srRef = useRef<{ stop(): void } | null>(null);
  // false no servidor e real no aparelho, sem diferença de hidratação
  const hasSR = useSyncExternalStore(noop, () => Boolean(getSR()), () => false);

  const run = (text: string) => {
    if (!text.trim()) return;
    setQ(text);
    start(async () => setState(await ask(text, mode).catch(() => ({ error: "A conexão caiu. Tente de novo." }))));
  };

  const listen = () => {
    const SR = getSR();
    if (!SR) return;
    if (listening) { srRef.current?.stop(); return; }
    const sr = new SR();
    sr.lang = "pt-BR"; sr.continuous = false; sr.interimResults = true;
    let finalText = "";
    sr.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      setQ((finalText + interim).trim());
    };
    sr.onerror = () => setListening(false);
    sr.onend = () => { setListening(false); if (finalText.trim()) run(finalText.trim()); };
    srRef.current = sr;
    setListening(true);
    sr.start();
  };

  const r = state.result;
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pergunta"
          placeholder={placeholder ?? "Pergunte: o que faço agora? o que ficou parado?"}
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
        {hasSR ? (
          <button type="button" onClick={listen} aria-label={listening ? "Parar de ouvir" : "Perguntar falando"}
            className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-lg border", listening ? "border-accent bg-accent text-accent-fg" : "border-line text-muted hover:text-ink")}>
            {listening ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
          </button>
        ) : null}
        <button type="submit" aria-label="Perguntar" disabled={pending || !q.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg disabled:opacity-50">
          <ArrowUp size={18} />
        </button>
      </form>

      {shortcuts ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SHORTCUTS.map(([label, question]) => (
            <button key={label} type="button" onClick={() => run(question)} disabled={pending}
              className="h-8 shrink-0 rounded-full border border-line px-3 text-[12.5px] text-muted hover:border-line-strong hover:text-ink">{label}</button>
          ))}
        </div>
      ) : null}

      {pending ? <p className="text-sm text-muted" role="status">Consultando seus registros…</p> : null}
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {r && !pending ? (
        <div className="rounded-xl border border-line bg-bg p-3.5">
          <p className="text-[15px] leading-relaxed">{r.answer}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{r.source === "ia" ? "IA sobre seus dados" : "regras sobre seus dados"}</Badge>
            <Listen text={r.answer} />
          </div>
          {r.note ? <p className="mt-1 text-xs text-faint">{r.note}</p> : null}
          {r.facts.length ? (
            <details className="mt-2 text-[13px]" open={r.source === "regras" && r.facts.length <= 4}>
              <summary className="cursor-pointer text-muted">Fatos usados ({r.facts.length})</summary>
              <ol className="mt-1.5 space-y-1">
                {r.facts.map((f, i) => (
                  <li key={i}><Link href={f.href} className="text-muted hover:text-ink"><span className="tabular-nums text-faint">[{i + 1}]</span> {f.text}</Link></li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
