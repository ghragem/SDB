"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "./ui";

// Reconhecimento de voz do navegador (sem custo). Tipos mínimos porque o DOM lib não inclui.
type SR = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const getSR = (): (new () => SR) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export type RecordingResult = {
  transcript: string;
  durationSec: number;
  audioPath: string | null;
  audioUrl: string | null;
  transcriptSource: "navegador" | "servidor" | "nenhuma";
  uploadError: string | null;
};

const now = () => Date.now();

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
};

/**
 * Gravador com timer, waveform simples, cancelar e enviar (seção 146).
 * Transcreve com o reconhecimento do navegador; se não houver, tenta o servidor
 * (só funciona se a transcrição estiver configurada). O áudio vai para o Storage privado.
 */
export function Recorder({ onDone, folder = "checkin", maxSec = 180, label = "Toque para falar" }: {
  onDone: (r: RecordingResult) => void;
  folder?: string;
  maxSec?: number;
  label?: string;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [live, setLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(28).fill(0.08));

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const srRef = useRef<SR | null>(null);
  const finalRef = useRef("");
  const liveRef = useRef("");
  const cancelledRef = useRef(false);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(() => () => { cancelledRef.current = true; srRef.current?.abort(); cleanup(); }, [cleanup]);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      setSeconds(s);
      if (s >= maxSec) mediaRef.current?.stop();
    }, 250);
    return () => clearInterval(t);
  }, [phase, maxSec]);

  async function start() {
    setError(null);
    setLive("");
    finalRef.current = "";
    liveRef.current = "";
    cancelledRef.current = false;
    chunksRef.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Sem acesso ao microfone. Libere nas configurações do navegador ou escreva.");
      return;
    }
    streamRef.current = stream;

    // Waveform
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevels((l) => [...l.slice(1), Math.max(0.08, Math.min(1, peak * 2.2))]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* waveform é opcional */ }

    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    mediaRef.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => finish(rec.mimeType || mime || "audio/webm");
    rec.start(1000);

    const SRClass = getSR();
    if (SRClass) {
      try {
        const sr = new SRClass();
        sr.lang = "pt-BR";
        sr.continuous = true;
        sr.interimResults = true;
        sr.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalRef.current += r[0].transcript + " ";
            else interim += r[0].transcript;
          }
          liveRef.current = (finalRef.current + interim).trim();
          setLive(liveRef.current);
        };
        sr.onerror = () => {};
        sr.onend = () => {
          // Safari/Chrome encerram sozinhos após silêncio: reinicia enquanto grava.
          if (mediaRef.current?.state === "recording") { try { sr.start(); } catch {} }
        };
        sr.start();
        srRef.current = sr;
      } catch { srRef.current = null; }
    }

    startRef.current = now();
    setSeconds(0);
    setPhase("recording");
  }

  function stop() {
    srRef.current?.stop();
    srRef.current = null;
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
    setPhase("processing");
  }

  function cancel() {
    cancelledRef.current = true;
    srRef.current?.abort();
    srRef.current = null;
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
    cleanup();
    setPhase("idle");
    setLive("");
  }

  async function finish(mime: string) {
    cleanup();
    if (cancelledRef.current) return;
    const durationSec = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    const blob = new Blob(chunksRef.current, { type: mime.split(";")[0] });
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
    // Dá um instante para o reconhecimento entregar o último trecho
    await new Promise((r) => setTimeout(r, 400));
    let transcript = (finalRef.current || liveRef.current).trim();
    let transcriptSource: RecordingResult["transcriptSource"] = transcript ? "navegador" : "nenhuma";

    if (!transcript && blob.size > 0) {
      try {
        const fd = new FormData();
        fd.append("audio", blob, `audio.${ext}`);
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        if (res.ok) {
          const json = (await res.json()) as { text?: string };
          if (json.text) { transcript = json.text; transcriptSource = "servidor"; }
        }
      } catch { /* segue sem transcrição */ }
    }

    let audioPath: string | null = null;
    let audioUrl: string | null = null;
    let uploadError: string | null = null;
    if (blob.size > 0) {
      audioUrl = URL.createObjectURL(blob);
      try {
        const supabase = createClient();
        const { data: claims } = await supabase.auth.getClaims();
        const uid = claims?.claims?.sub;
        if (uid) {
          const path = `${uid}/${folder}/${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
          const { error } = await supabase.storage.from("audio").upload(path, blob, { contentType: blob.type || "audio/webm" });
          if (error) uploadError = "Não consegui salvar seu áudio."; else audioPath = path;
        }
      } catch {
        uploadError = "Não consegui salvar seu áudio.";
      }
    }
    setPhase("idle");
    onDone({ transcript, durationSec, audioPath, audioUrl, transcriptSource, uploadError });
  }

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div>
      {phase === "idle" ? (
        <button type="button" onClick={start}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-ink text-[16px] font-medium text-bg active:scale-[0.99] transition-transform">
          <Mic size={20} /> {label}
        </button>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-3">
            <span className={cx("h-2.5 w-2.5 rounded-full", phase === "recording" ? "bg-accent animate-pulse" : "bg-faint")} />
            <span className="font-mono text-sm tabular-nums">{mm}:{ss}</span>
            <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden>
              {levels.map((l, i) => <span key={i} className="w-full rounded-full bg-ink/70" style={{ height: `${Math.round(l * 100)}%` }} />)}
            </div>
          </div>
          {live ? <p className="mt-2 line-clamp-3 text-sm text-muted">{live}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={cancel} disabled={phase !== "recording"} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line text-sm text-muted disabled:opacity-50"><X size={16} /> Cancelar</button>
            <button type="button" onClick={stop} disabled={phase !== "recording"} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-accent-fg disabled:opacity-60">
              {phase === "processing" ? "Processando…" : <><Square size={14} /> Enviar</>}
            </button>
          </div>
        </div>
      )}
      {error ? <p role="alert" className="mt-2 text-sm text-accent">{error}</p> : null}
    </div>
  );
}
