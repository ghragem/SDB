"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { addDays, str, todaySP } from "@/lib/format";
import { lessonBySlug } from "@/lib/lessons";

export async function saveExercise(form: FormData) {
  const { supabase, userId } = await requireUser();
  const slug = String(form.get("slug"));
  const lesson = lessonBySlug(slug);
  const answer = str(form.get("answer"));
  if (!lesson || !answer) return;
  await supabase.from("lesson_progress").insert({
    user_id: userId, title: lesson.title, status: "feita",
    data: { slug, answer, application: str(form.get("application")), review_at: addDays(todaySP(), lesson.reviewInDays) },
  });
  if (form.get("to_brain") === "on") {
    await supabase.from("brain_notes").insert({ user_id: userId, kind: "aprendizado", title: lesson.title, body: [answer, str(form.get("application"))].filter(Boolean).join("\n\nAplicação: "), source: `aula:${slug}` });
  }
  revalidatePath(`/aprender/${slug}`);
  revalidatePath("/aprender");
}
