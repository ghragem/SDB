"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { buildDay, saveSession } from "@/lib/session";
import { str, todaySP } from "@/lib/format";
import type { SessionItem } from "@/lib/types";

export type CheckinState = { error?: string; ok?: boolean; aiError?: string | null };

const num = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

export async function submitCheckin(_: CheckinState, form: FormData): Promise<CheckinState> {
  const { supabase, userId } = await requireUser();
  const mode = String(form.get("mode"));
  if (!["falar", "escrever", "rapido"].includes(mode)) return { error: "Modo inválido." };
  const input = {
    energy: num(form.get("energy")),
    focus: num(form.get("focus")),
    pressure: num(form.get("pressure")),
    mainWorry: str(form.get("main_worry")),
    text: str(form.get("text")),
  };
  if (mode === "rapido" && (input.energy === null || input.focus === null || input.pressure === null)) {
    return { error: "Marque energia, foco e pressão." };
  }
  if (mode !== "rapido" && !input.text) return { error: mode === "falar" ? "A transcrição está vazia. Grave de novo ou escreva." : "Escreva como você está chegando." };

  // O mesmo áudio não vira dois check-ins (clique repetido no botão).
  const audioPath = str(form.get("audio_path"));
  if (audioPath) {
    const { data: dup } = await supabase.from("daily_checkins").select("id").eq("audio_path", audioPath).limit(1).maybeSingle();
    if (dup) return { ok: true };
  }

  const { data: checkin, error } = await supabase.from("daily_checkins").insert({
    user_id: userId,
    day: todaySP(),
    mode,
    energy: input.energy,
    focus: input.focus,
    pressure: input.pressure,
    main_worry: input.mainWorry,
    raw_text: input.text,
    audio_path: audioPath,
    metadata: { transcript_source: str(form.get("transcript_source")), duration_sec: Number(form.get("duration_sec")) || null },
  }).select("id").single();
  if (error || !checkin) return { error: "Não consegui salvar seu check-in. Tente de novo." };

  const day = await buildDay(supabase, userId, input);
  await supabase.from("daily_checkins").update({ day_state: day.state, reading: day.reading, reading_source: day.source }).eq("id", checkin.id);
  await saveSession(supabase, userId, day, checkin.id);
  revalidatePath("/hoje");
  return { ok: true, aiError: day.aiError };
}

export async function toggleItem(form: FormData) {
  const { supabase } = await requireUser();
  const id = String(form.get("session_id"));
  const index = Number(form.get("index"));
  const { data } = await supabase.from("daily_sessions").select("items").eq("id", id).single();
  if (!data) return;
  const items = (data.items as SessionItem[]).map((it, i) => (i === index ? { ...it, done: !it.done } : it));
  await supabase.from("daily_sessions").update({ items }).eq("id", id);
  revalidatePath("/hoje");
}

export async function logProgress(form: FormData) {
  const { supabase, userId } = await requireUser();
  const body = str(form.get("body"));
  const projectId = String(form.get("project_id"));
  if (!body) return;
  await supabase.from("project_updates").insert({ user_id: userId, project_id: projectId, body, kind: "avanco", is_progress: true });
  revalidatePath("/hoje");
  revalidatePath(`/projetos/${projectId}`);
}
