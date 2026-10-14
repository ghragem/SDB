"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { captureToInbox, commitCapture, discardCapture, interpretCapture, type CommitResult } from "@/app/(app)/capturar/actions";
import { KIND_LABEL, destination, type CaptureItem, type CaptureKind } from "@/lib/interpret";
import { enqueue, offlineSupported } from "@/lib/offline-queue";
import { Recorder, type RecordingResult } from "./recorder";
import { Badge, Button, ErrorNote, Textarea, cx } from "./ui";

type Phase = "compose" | "interpreting" | "review" | "saving" | "done";
const MONEY: CaptureKind[] = ["despesa", "receita"];
const WITH_PROJECT: CaptureKind[] = ["avanco", "evidencia", "bloqueio", "despesa", "receita", "aprendizado", "hipotese", "tarefa", "nota"];

/**
 * Captura universal: falar ou escrever → interpretar → "Entendi isso" → confirmar → salvar em vários módulos.
 * Nada é gravado antes da confirmação (a captura bruta fica guardada como pendente).
 */
export function CaptureSheet({ open, onClose, context }: { open: boolean; onClose: () => void; context: { projectId: string; projectName: string } | null }) {
  const [phase, setPhase] = useState<Phase>("compose");
  const [rec, setRec] = useState<RecordingResult | null>(null);
  const [text, setText] = useState("");
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [items, setItems] = useState<(CaptureItem & { include: boolean })[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [interpreter, setInterpreter] = useState<"regras" | "ia">("regras");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function reset() {
    setPhase("compose"); setRec(null); setText(""); setCaptureId(null); setItems([]); setNote(null); setError(null); setResult(null);
  }
  function close() {
    // Captura interpretada e não confirmada fica guardada como pendente; fechar não perde nada.
    onClose(); setTimeout(reset, 200);
  }

  if (!open) return null;
  const online = typeof navigator === "undefined" || navigator.onLine;
  const source: "audio" | "texto" = rec ? "audio" : "texto";

  async function interpret() {
    setError(null);
    if (!navigator.onLine) return saveOffline();
    setPhase("interpreting");
    try {
      const r = await interpretCapture({ text, source, audioPath: rec?.audioPath ?? null, projectId: context?.projectId ?? null });
      if (r.error || !r.captureId) { setError(r.error ?? "Falha ao interpretar."); setPhase("compose"); return; }
      setCaptureId(r.captureId); setItems((r.items ?? []).map((i) => ({ ...i, include: true }))); setProjects(r.projects ?? []);
      setInterpreter(r.interpreter ?? "regras"); setNote(r.aiNote ?? null); setPhase("review");
    } catch {
      setError("A conexão caiu. Tente de novo ou guarde no aparelho."); setPhase("compose");
    }
  }

  async function saveOffline() {
    if (!offlineSupported()) { setError("Sem internet e sem armazenamento local neste navegador."); return; }
    await enqueue({ kind: "nota", body: text.trim() || "Áudio sem transcrição", audio: null });
    window.dispatchEvent(new Event("sdb:queued"));
    close();
  }

  async function toInbox() {
    setPhase("saving");
    const r = await captureToInbox({ captureId, text, source, audioPath: rec?.audioPath ?? null }).catch(() => ({ error: "A conexão caiu." }) as CommitResult);
    if (r.error) { setError(r.error); setPhase(captureId ? "review" : "compose"); return; }
    setResult(r); setPhase("done");
  }

  async function confirm() {
    if (!captureId) return;
    setPhase("saving"); setError(null);
    const chosen: CaptureItem[] = items.filter((i) => i.include).map((i) => ({ id: i.id, kind: i.kind, text: i.text, projectId: i.projectId, amount: i.amount, confidence: i.confidence, why: i.why }));
    const r = await commitCapture(captureId, chosen).catch(() => ({ error: "A conexão caiu. Nada foi perdido: tente de novo." }) as CommitResult);
    if (r.error && !r.ok) { setError(r.error); setPhase("review"); return; }
    setResult(r); setPhase("done");
  }

  async function discard() {
    if (captureId) await discardCapture(captureId).catch(() => {});
    close();
  }

  const update = (id: string, patch: Partial<CaptureItem & { include: boolean }>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const included = items.filter((i) => i.include).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Capturar">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/60" onClick={close} />
      <div className="pb-safe relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold">{phase === "review" || phase === "saving" ? `Entendi isso do seu ${source === "audio" ? "áudio" : "texto"}` : phase === "done" ? "Registrado" : "Fala o que aconteceu"}</p>
            <p className="truncate text-xs text-muted">
              {phase === "review" ? "Revise, ajuste e confirme. Nada foi salvo ainda." : context ? `Sobre ${context.projectName}` : "Progresso, gasto, ideia, preocupação. Do jeito que vier."}
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center text-muted"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {phase === "compose" || phase === "interpreting" ? (
            <div className="space-y-3">
              {!rec ? (
                <Recorder folder="captura" maxSec={300} label="Toque para falar" onDone={(r) => { setRec(r); setText((t) => [t, r.transcript].filter(Boolean).join(" ")); }} />
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
                  {rec.audioUrl ? <audio controls src={rec.audioUrl} className="h-9 min-w-0 flex-1" /> : <span className="flex-1">Áudio de {rec.durationSec}s</span>}
                  <button type="button" onClick={() => { setRec(null); setText(""); }} className="shrink-0 text-muted underline underline-offset-4">Regravar</button>
                </div>
              )}
              {rec && !rec.transcript ? (
                <p className="text-[13px] text-warn">Este navegador não transcreveu o áudio. {rec.audioPath ? "O áudio foi guardado. " : ""}Escreva o essencial abaixo ou mande o áudio para a Inbox.</p>
              ) : null}
              {rec?.uploadError ? <p className="text-[13px] text-accent">{rec.uploadError}</p> : null}
              <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Texto da captura"
                placeholder={context ? `Ex.: hoje uma oficina pediu demonstração do ${context.projectName}.` : "Ex.: Hoje avancei o AutoFlow, falei com duas oficinas. Gastei 120 reais numa campanha do Coach. Tive uma ideia de revender iPhone, mas não agora."} />
              {error ? <ErrorNote>{error}</ErrorNote> : null}
            </div>
          ) : null}

          {phase === "review" || phase === "saving" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge>{interpreter === "ia" ? "interpretado pela IA" : "interpretado por regras"}</Badge>
                <span>{items.length} {items.length === 1 ? "registro" : "registros"} · {included} marcados</span>
              </div>
              {note ? <p className="text-xs text-faint">{note}</p> : null}
              <details className="text-[13px]"><summary className="cursor-pointer text-muted">Texto original</summary><p className="mt-1 whitespace-pre-wrap text-muted">{text}</p></details>
              {items.length ? items.map((i) => (
                <div key={i.id} className={cx("rounded-xl border p-3", i.include ? "border-line-strong bg-bg" : "border-line opacity-55")}>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-pressed={i.include} aria-label={i.include ? "Não salvar este" : "Salvar este"} onClick={() => update(i.id, { include: !i.include })}
                      className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-md border", i.include ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>
                      {i.include ? <Check size={14} strokeWidth={3} /> : null}
                    </button>
                    <select value={i.kind} onChange={(e) => update(i.id, { kind: e.target.value as CaptureKind })} aria-label="Tipo"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-sm font-medium">
                      {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {i.confidence === "baixa" ? <Badge tone="warn">revisar</Badge> : null}
                  </div>
                  <textarea value={i.text} onChange={(e) => update(i.id, { text: e.target.value })} rows={2} aria-label="Texto"
                    className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[14.5px] focus:border-line-strong focus:outline-none" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WITH_PROJECT.includes(i.kind) ? (
                      <select value={i.projectId ?? ""} onChange={(e) => update(i.id, { projectId: e.target.value || null })} aria-label="Projeto"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-sm">
                        <option value="">Sem projeto</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : null}
                    {MONEY.includes(i.kind) ? (
                      <input inputMode="decimal" value={i.amount ?? ""} aria-label="Valor (R$)" placeholder="Valor R$"
                        onChange={(e) => { const n = Number(e.target.value.replace(/\./g, "").replace(",", ".")); update(i.id, { amount: Number.isFinite(n) && n > 0 ? n : null }); }}
                        className="h-9 w-28 rounded-lg border border-line bg-surface px-2 text-sm tabular-nums" />
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[12px] text-faint">Vai para: {destination(i.kind, Boolean(i.projectId), Boolean(i.amount))}{i.why ? ` · ${i.why}` : ""}</p>
                </div>
              )) : <p className="text-sm text-muted">Não consegui separar nenhum registro. Mande para a Inbox ou reescreva.</p>}
              {error ? <ErrorNote>{error}</ErrorNote> : null}
            </div>
          ) : null}

          {phase === "done" && result ? (
            <div className="space-y-3">
              <p className="text-sm">{result.saved?.length ?? 0} {result.saved?.length === 1 ? "registro salvo" : "registros salvos"}:</p>
              <ul className="space-y-1.5 text-sm">
                {(result.saved ?? []).map((s, n) => (
                  <li key={n} className="flex items-center gap-2"><Check size={14} className="shrink-0 text-ok" /><Link href={s.href} onClick={close} className="underline underline-offset-4">{s.label}</Link></li>
                ))}
              </ul>
              {result.error ? <ErrorNote>{result.error}</ErrorNote> : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line p-3">
          {phase === "compose" || phase === "interpreting" ? (
            online ? (
              <>
                <Button type="button" variant="primary" className="flex-1" disabled={!text.trim() || phase === "interpreting"} onClick={interpret}>
                  {phase === "interpreting" ? "Interpretando…" : "Interpretar"}
                </Button>
                <Button type="button" disabled={(!text.trim() && !rec?.audioPath) || phase === "interpreting"} onClick={toInbox}>Só mandar para a Inbox</Button>
              </>
            ) : (
              <Button type="button" variant="primary" className="flex-1" disabled={!text.trim()} onClick={saveOffline}>Sem internet: guardar no aparelho</Button>
            )
          ) : null}
          {phase === "review" || phase === "saving" ? (
            <>
              <Button type="button" variant="primary" className="flex-1" disabled={!included || phase === "saving"} onClick={confirm}>
                {phase === "saving" ? "Salvando…" : included === items.length ? "Confirmar tudo" : `Confirmar ${included}`}
              </Button>
              <Button type="button" disabled={phase === "saving"} onClick={toInbox}>Inbox</Button>
              <Button type="button" variant="ghost" disabled={phase === "saving"} onClick={discard}>Descartar</Button>
            </>
          ) : null}
          {phase === "done" ? (
            <>
              <Button type="button" variant="primary" className="flex-1" onClick={reset}>Nova captura</Button>
              <Button type="button" onClick={close}>Fechar</Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
