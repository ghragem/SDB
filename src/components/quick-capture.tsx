"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { capture, type CaptureState } from "@/app/(app)/inbox/actions";
import { enqueue, offlineSupported } from "@/lib/offline-queue";
import { parseMoney } from "@/lib/format";
import { Button, ErrorNote, Input, Textarea, cx } from "./ui";

const TYPES: [string, string][] = [
  ["ideia", "Ideia"], ["nota", "Nota"], ["tarefa", "Tarefa"], ["decisao", "Decisão"],
  ["despesa", "Despesa"], ["receita", "Receita"], ["erro", "Erro"], ["aprendizado", "Aprendizado"],
  ["link", "Link"], ["oportunidade", "Oportunidade"], ["conversa", "Conversa"],
];

export function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState("ideia");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CaptureState, FormData>(async (prev, fd) => {
    // Sem internet (ou se a chamada cair), guarda no aparelho e sobe sozinho quando a conexão voltar.
    const queue = async (): Promise<CaptureState> => {
      const body = String(fd.get("body") ?? "").trim();
      if (!body) return { error: "Escreva alguma coisa antes de salvar." };
      if (!offlineSupported()) return { error: "Sem internet e sem armazenamento local neste navegador." };
      const amount = parseMoney(fd.get("amount"));
      await enqueue({ kind: String(fd.get("kind") ?? "nota"), body, amount: amount && amount > 0 ? amount : null });
      window.dispatchEvent(new Event("sdb:queued"));
      formRef.current?.reset(); onClose();
      return { ok: true, offline: true, at: Date.now() };
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
    try {
      const r = await capture(prev, fd);
      if (r.ok) { formRef.current?.reset(); onClose(); }
      return r;
    } catch {
      return queue();
    }
  }, {});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const money = kind === "despesa" || kind === "receita";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Capturar">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form ref={formRef} action={action} className="pb-safe relative w-full max-w-lg rounded-t-2xl border border-line bg-surface p-4 sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-semibold">Capturar</p>
            <p className="text-xs text-muted">Capture primeiro. Classifique depois na Inbox.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="grid h-9 w-9 place-items-center text-muted"><X size={18} /></button>
        </div>
        <input type="hidden" name="kind" value={kind} />
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TYPES.map(([k, label]) => (
            <button type="button" key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
              className={cx("h-8 shrink-0 rounded-full border px-3 text-[13px]", kind === k ? "border-accent bg-accent text-accent-fg" : "border-line text-muted")}>
              {label}
            </button>
          ))}
        </div>
        <Textarea name="body" rows={4} autoFocus placeholder={kind === "link" ? "Cole o link e uma linha do porquê." : "O que aconteceu, o que você pensou?"} />
        {money ? <Input name="amount" inputMode="decimal" placeholder="Valor (R$)" className="mt-2" /> : null}
        {state.error ? <div className="mt-2"><ErrorNote>{state.error}</ErrorNote></div> : null}
        <div className="mt-3 flex justify-end">
          <Button type="submit" variant="primary" disabled={pending}>{pending ? "Salvando…" : "Registrar"}</Button>
        </div>
      </form>
    </div>
  );
}
