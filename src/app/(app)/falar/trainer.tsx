"use client";

import { useActionState, useState } from "react";
import { Recorder, type RecordingResult } from "@/components/recorder";
import { Button, ErrorNote, Field, Input, Textarea } from "@/components/ui";
import { saveSpeech, type SpeechState } from "./actions";

export function Trainer({ initialPrompt, previous }: { initialPrompt: string; previous: { wpm: number; fillersPerMin: number } | null }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [rec, setRec] = useState<RecordingResult | null>(null);
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState<SpeechState, FormData>(saveSpeech, {});
  const m = state.metrics;

  return (
    <div className="space-y-4">
      <Field label="Exercício"><Input value={prompt} onChange={(e) => setPrompt(e.target.value)} /></Field>
      {!rec ? (
        <Recorder folder="falar" maxSec={300} label="Gravar" onDone={(r) => { setRec(r); setText(r.transcript); }} />
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="prompt" value={prompt} />
          <input type="hidden" name="duration_sec" value={rec.durationSec} />
          <input type="hidden" name="audio_path" value={rec.audioPath ?? ""} />
          {rec.audioUrl ? <audio controls src={rec.audioUrl} className="h-10 w-full" /> : null}
          <Field label="Transcrição" hint={rec.transcriptSource === "nenhuma" ? "Este navegador não transcreveu. Ouça e escreva exatamente o que você falou, com os vícios, para as métricas valerem." : "Corrija só erros de reconhecimento. Não melhore o que você falou."}>
            <Textarea name="transcript" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={pending || !!m}>{pending ? "Avaliando…" : "Avaliar"}</Button>
            <Button type="button" onClick={() => { setRec(null); setText(""); }}>Gravar de novo</Button>
          </div>
        </form>
      )}

      {m ? (
        <div className="space-y-4 rounded-[10px] border border-line bg-surface p-4">
          {state.feedback ? (
            <p className="text-3xl font-semibold tabular-nums">NOTA {state.feedback.nota.toFixed(1).replace(".", ",")}</p>
          ) : null}
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-muted">Duração</dt><dd className="font-semibold tabular-nums">{m.durationSec}s</dd></div>
            <div><dt className="text-muted">Palavras/min</dt><dd className="font-semibold tabular-nums">{m.wpm}{previous ? <span className="ml-1 font-normal text-faint">(antes {previous.wpm})</span> : null}</dd></div>
            <div><dt className="text-muted">Vícios/min</dt><dd className="font-semibold tabular-nums">{m.fillersPerMin}{previous ? <span className="ml-1 font-normal text-faint">(antes {previous.fillersPerMin})</span> : null}</dd></div>
          </dl>
          {m.fillerTotal ? (
            <p className="text-sm">{Object.entries(m.fillers).map(([w, n]) => `Você usou “${w}” ${n} ${n === 1 ? "vez" : "vezes"}.`).join(" ")}</p>
          ) : <p className="text-sm text-muted">Nenhum vício de linguagem da lista detectado na transcrição.</p>}
          {state.feedback ? (
            <>
              <div><p className="label">Problemas</p><ul className="mt-1 list-disc space-y-1 pl-5 text-[15px]">{state.feedback.problemas.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
              <div><p className="label">O que funcionou</p><p className="mt-1 text-[15px]">{state.feedback.ponto_forte}</p></div>
              <div className="rounded-lg bg-surface-2 p-3"><p className="label">Próximo exercício</p><p className="mt-1 font-medium">{state.feedback.proximo_exercicio}</p></div>
            </>
          ) : (
            <p className="text-xs text-faint">{state.aiError ? `Avaliação qualitativa indisponível: ${state.aiError}` : "Avaliação qualitativa (estrutura, clareza, conclusão) precisa de IA configurada. As métricas acima são objetivas."}</p>
          )}
          <Button type="button" size="sm" onClick={() => { setRec(null); setText(""); window.location.reload(); }}>Novo treino</Button>
        </div>
      ) : null}
    </div>
  );
}
