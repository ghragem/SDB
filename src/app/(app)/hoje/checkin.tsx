"use client";

import { useActionState, useState } from "react";
import { Keyboard, Mic, Zap } from "lucide-react";
import { Recorder, type RecordingResult } from "@/components/recorder";
import { Button, ErrorNote, Input, Textarea, cx } from "@/components/ui";
import { submitCheckin, type CheckinState } from "./actions";

type Mode = "falar" | "escrever" | "rapido";

export function Checkin({ transcriptionServer }: { transcriptionServer: boolean }) {
  const [mode, setMode] = useState<Mode>("falar");
  const [rec, setRec] = useState<RecordingResult | null>(null);
  const [text, setText] = useState("");
  const [scales, setScales] = useState<{ energy: number | null; focus: number | null; pressure: number | null }>({ energy: null, focus: null, pressure: null });
  // Depois de salvar, limpa o formulário: com a gravação ainda na tela parecia que nada tinha sido salvo
  // e o check-in acabava registrado duas vezes.
  const [state, action, pending] = useActionState<CheckinState, FormData>(async (prev, form) => {
    const r = await submitCheckin(prev, form);
    if (r.ok) { setRec(null); setText(""); setScales({ energy: null, focus: null, pressure: null }); }
    return r;
  }, {});

  const modes: { k: Mode; label: string; icon: typeof Mic }[] = [
    { k: "falar", label: "Áudio", icon: Mic },
    { k: "escrever", label: "Texto", icon: Keyboard },
    { k: "rapido", label: "Rápido", icon: Zap },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1" role="tablist" aria-label="Modo do check-in">
        {modes.map(({ k, label, icon: Icon }) => (
          <button key={k} type="button" role="tab" onClick={() => { setMode(k); setRec(null); }} aria-selected={mode === k}
            className={cx("flex h-9 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors",
              mode === k ? "bg-accent text-accent-fg" : "text-muted hover:text-ink")}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {mode ? (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="mode" value={mode} />
          {scales.energy ? <input type="hidden" name="energy" value={scales.energy} /> : null}
          {scales.focus ? <input type="hidden" name="focus" value={scales.focus} /> : null}
          {scales.pressure ? <input type="hidden" name="pressure" value={scales.pressure} /> : null}

          {mode === "falar" ? (
            rec ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="label">Transcrição</span>
                  <span className="text-xs text-faint">{rec.durationSec}s · {rec.transcriptSource === "navegador" ? "reconhecimento do navegador" : rec.transcriptSource === "servidor" ? "transcrição do servidor" : "sem transcrição"}</span>
                </div>
                {rec.audioUrl ? <audio controls src={rec.audioUrl} className="h-10 w-full" /> : null}
                <Textarea name="text" rows={5} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={rec.transcriptSource === "nenhuma" ? "Este navegador não transcreveu o áudio. O áudio foi salvo; escreva aqui o essencial do que você falou." : ""} />
                {rec.uploadError ? <p className="text-xs text-accent">{rec.uploadError} O texto ainda pode ser salvo.</p> : null}
                <input type="hidden" name="audio_path" value={rec.audioPath ?? ""} />
                <input type="hidden" name="transcript_source" value={rec.transcriptSource} />
                <input type="hidden" name="duration_sec" value={rec.durationSec} />
                <button type="button" onClick={() => { setRec(null); setText(""); }} className="text-sm text-muted underline underline-offset-4">Gravar de novo</button>
              </div>
            ) : (
              <>
                <Recorder maxSec={60} label="Fale por 1 minuto" onDone={(r) => { setRec(r); setText(r.transcript); }} />
                <p className="text-xs text-faint">Fale por 30 a 60 segundos: como está chegando, o que preocupa, o que pensa em fazer. {transcriptionServer ? "" : "A transcrição usa o reconhecimento de voz do navegador."}</p>
              </>
            )
          ) : null}

          {mode === "escrever" ? (
            <Textarea name="text" rows={5} autoFocus value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Ex.: hoje tô meio preocupado com dinheiro, pensei em mexer no AutoFlow, mas tive outra ideia também." />
          ) : null}

          {mode === "rapido" ? (
            <div className="space-y-3">
              <Scale label="Energia" value={scales.energy} onChange={(v) => setScales((s) => ({ ...s, energy: v }))} />
              <Scale label="Foco" value={scales.focus} onChange={(v) => setScales((s) => ({ ...s, focus: v }))} />
              <Scale label="Pressão" value={scales.pressure} onChange={(v) => setScales((s) => ({ ...s, pressure: v }))} />
              <Input name="main_worry" placeholder="Preocupação principal (opcional)" />
              <Input name="text" placeholder="Prioridade, projeto ou dinheiro em uma linha (opcional)" />
            </div>
          ) : null}

          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
          {(mode !== "falar" || rec) ? (
            <Button type="submit" variant="primary" className="w-full" disabled={pending}>
              {pending ? "Lendo seu dia…" : "Registrar check-in"}
            </Button>
          ) : null}
        </form>
      ) : null}
      {state.ok && !pending ? <p className="mt-2 text-sm text-ok" role="status">Check-in registrado. A leitura e a sessão do dia foram atualizadas.</p> : null}
      {state.ok && state.aiError ? <p className="mt-2 text-xs text-faint">IA indisponível agora ({state.aiError}). Leitura feita por regras.</p> : null}
    </div>
  );
}

function Scale({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-sm font-medium">{label}</span>
      <div className="grid flex-1 grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)}
            className={cx("h-10 rounded-lg border text-sm tabular-nums", value === n ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-muted")}>{n}</button>
        ))}
      </div>
    </div>
  );
}
