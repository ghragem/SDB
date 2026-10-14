"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { str } from "@/lib/format";

const KINDS = ["nota","insight","erro","aprendizado","decisao","ideia","pessoa","referencia","link","conversa","pesquisa","hipotese","regra"];

export async function createNote(form: FormData) {
  const { supabase, userId } = await requireUser();
  const body = str(form.get("body"));
  if (!body) return;
  const kind = String(form.get("kind") ?? "nota");
  const ep = String(form.get("epistemic") ?? "");
  await supabase.from("brain_notes").insert({
    user_id: userId, body, title: str(form.get("title")), url: str(form.get("url")),
    kind: KINDS.includes(kind) ? kind : "nota",
    epistemic: ["fato", "analise", "hipotese", "opiniao"].includes(ep) ? ep : null,
    project_id: str(form.get("project_id")),
  });
  if (kind === "regra") {
    await supabase.from("reality_rules").insert({ user_id: userId, rule: str(form.get("title")) ?? body.slice(0, 160), detail: body, origin: "experiencia", position: 100 });
  }
  revalidatePath("/brain");
}

export async function deleteNote(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("brain_notes").delete().eq("id", String(form.get("id")));
  revalidatePath("/brain");
}

const LINK_KINDS = ["nota", "projeto", "decisao", "ideia", "experimento"];
const RELATIONS = ["relacionado", "causou", "levou_a", "contradiz", "confirma", "aprendizado_de"];

/** Relaciona uma nota a outro registro (erro → aprendizado → decisão). */
export async function linkNote(form: FormData) {
  const { supabase, userId } = await requireUser();
  const from = String(form.get("from_id"));
  const [toKind, toId] = String(form.get("to") ?? "").split(":");
  const relation = String(form.get("relation") ?? "relacionado");
  if (!LINK_KINDS.includes(toKind) || !/^[0-9a-f-]{36}$/.test(toId ?? "") || toId === from) return;
  await supabase.from("brain_links").upsert({
    user_id: userId, from_kind: "nota", from_id: from, to_kind: toKind, to_id: toId,
    relation: RELATIONS.includes(relation) ? relation : "relacionado",
  }, { onConflict: "user_id,from_kind,from_id,to_kind,to_id" });
  revalidatePath("/brain");
  if (toKind === "projeto") revalidatePath(`/projetos/${toId}`);
}

export async function unlink(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("brain_links").delete().eq("id", String(form.get("id")));
  revalidatePath("/brain");
}
