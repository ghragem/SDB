"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { str, todaySP, weekStartSP } from "@/lib/format";

export async function saveDaily(form: FormData) {
  const { supabase, userId } = await requireUser();
  const day = todaySP();
  await supabase.from("daily_reviews").upsert({
    user_id: userId, day,
    advanced: str(form.get("advanced")), wasted: str(form.get("wasted")), tomorrow: str(form.get("tomorrow")),
    pending_decision: str(form.get("pending_decision")),
  }, { onConflict: "user_id,day" });
  await supabase.from("daily_sessions").update({ status: "encerrada" }).eq("day", day).eq("status", "aberta");
  revalidatePath("/review");
  revalidatePath("/hoje");
}

export async function saveWeekly(form: FormData) {
  const { supabase, userId } = await requireUser();
  const snapshot = JSON.parse(String(form.get("snapshot") ?? "{}"));
  await supabase.from("weekly_reviews").upsert({
    user_id: userId, week_start: weekStartSP(),
    keep_doing: str(form.get("keep_doing")), stop_doing: str(form.get("stop_doing")),
    start_doing: str(form.get("start_doing")), week_priority: str(form.get("week_priority")), snapshot,
  }, { onConflict: "user_id,week_start" });
  revalidatePath("/review/semanal");
  revalidatePath("/notificacoes");
}
