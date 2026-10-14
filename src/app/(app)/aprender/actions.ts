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

/** Referências (pessoas que você acompanha). Servem para entender o tipo de conteúdo que prende você, não como autoridade. */
export async function addReference(form: FormData) {
  const { supabase, userId } = await requireUser();
  const name = str(form.get("name"));
  if (!name) return;
  await supabase.from("people_references").insert({
    user_id: userId, title: name.slice(0, 120),
    data: { area: str(form.get("area")), why: str(form.get("why")), disagree: str(form.get("disagree")) },
  });
  revalidatePath("/aprender");
}

export async function removeReference(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("people_references").delete().eq("id", String(form.get("id")));
  revalidatePath("/aprender");
}
