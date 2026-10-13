"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { str } from "@/lib/format";

export async function saveSettings(form: FormData) {
  const { supabase, userId } = await requireUser();
  const level = String(form.get("reality_level"));
  const provider = String(form.get("ai_provider") ?? "");
  await supabase.from("profiles").update({ display_name: str(form.get("display_name")) }).eq("user_id", userId);
  await supabase.from("preferences").update({
    reality_level: ["suave", "direto", "muito_direto"].includes(level) ? level : "muito_direto",
    ai_provider: ["anthropic", "openai"].includes(provider) ? provider : null,
  }).eq("user_id", userId);
  revalidatePath("/", "layout");
}
