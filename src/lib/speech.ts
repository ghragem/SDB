// Métricas objetivas de fala, calculadas da transcrição. Sem IA, sem chute.
const FILLERS = ["tipo", "né", "mano", "assim", "então", "aí", "sabe", "basicamente", "literalmente", "tipo assim", "na verdade"];

export function speechMetrics(transcript: string, durationSec: number) {
  const t = transcript.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  const fillers: Record<string, number> = {};
  for (const f of FILLERS) {
    const re = new RegExp(`(^|[^\\p{L}])${f}(?=[^\\p{L}]|$)`, "gu");
    const n = (t.match(re) ?? []).length;
    if (n) fillers[f] = n;
  }
  // "tipo assim" já conta em "tipo" e "assim"
  if (fillers["tipo assim"]) delete fillers["tipo assim"];
  const fillerTotal = Object.values(fillers).reduce((a, b) => a + b, 0);
  const minutes = Math.max(durationSec, 1) / 60;
  const sentences = transcript.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return {
    words: words.length,
    durationSec,
    wpm: Math.round(words.length / minutes),
    fillers,
    fillerTotal,
    fillersPerMin: Math.round((fillerTotal / minutes) * 10) / 10,
    avgSentenceWords: sentences.length ? Math.round(words.length / sentences.length) : null,
  };
}
export type SpeechMetrics = ReturnType<typeof speechMetrics>;
