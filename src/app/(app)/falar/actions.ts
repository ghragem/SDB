"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { str } from "@/lib/format";
import { speechMetrics, type SpeechMetrics } from "@/lib/speech";
import { speechFeedback, type SpeechFeedback } from "@/lib/ai/intelligence";
import { AIError } from "@/lib/ai/provider";

export type SpeechState = { error?: string; metrics?: SpeechMetrics; feedback?: SpeechFeedback | null; aiError?: string | null };

export async function saveSpeech(_: SpeechState, form: FormData): Promise<SpeechState> {
  const { supabase, userId } = await requireUser();
  const transcript = str(form.get("transcript"));
  const prompt = str(form.get("prompt")) ?? "Fala livre";
  const duration = Number(form.get("duration_sec")) || 0;
  if (!transcript) return { error: "Sem transcrição não há o que avaliar. Grave de novo ou corrija o texto." };
  const metrics = speechMetrics(transcript, duration);
  let feedback: SpeechFeedback | null = null;
  let aiError: string | null = null;
  try {
    feedback = await speechFeedback({ supabase, userId }, prompt, transcript,
      `${metrics.durationSec}s, ${metrics.words} palavras, ${metrics.wpm} palavras/min, vícios: ${JSON.stringify(metrics.fillers)}`);
  } catch (e) {
    aiError = e instanceof AIError ? e.message : "IA indisponível.";
  }
  const { error } = await supabase.from("speech_sessions").insert({
    user_id: userId, title: prompt,
    data: { transcript, audio_path: str(form.get("audio_path")), metrics, feedback },
  });
  if (error) return { error: "Não consegui salvar o treino." };
  revalidatePath("/falar");
  return { metrics, feedback, aiError };
}
