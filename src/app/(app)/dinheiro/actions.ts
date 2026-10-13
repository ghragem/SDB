"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { parseMoney, str, todaySP } from "@/lib/format";

export type MoneyState = { error?: string; ok?: number };

export async function addTransaction(_: MoneyState, form: FormData): Promise<MoneyState> {
  const { supabase, userId } = await requireUser();
  const type = String(form.get("type"));
  const amount = parseMoney(form.get("amount"));
  if (!["receita", "despesa", "investimento"].includes(type)) return { error: "Escolha o tipo." };
  if (amount === null || amount <= 0) return { error: "Informe um valor maior que zero." };
  const { error } = await supabase.from("finance_transactions").insert({
    user_id: userId, type, amount,
    category: String(form.get("category") ?? "outros"),
    occurred_on: str(form.get("occurred_on")) ?? todaySP(),
    project_id: str(form.get("project_id")),
    description: str(form.get("description")),
  });
  if (error) return { error: "Não consegui salvar o lançamento." };
  revalidatePath("/dinheiro");
  revalidatePath("/hoje");
  return { ok: Date.now() };
}

export async function deleteTransaction(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("finance_transactions").delete().eq("id", String(form.get("id")));
  revalidatePath("/dinheiro");
}
