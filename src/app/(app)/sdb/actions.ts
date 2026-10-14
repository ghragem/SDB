"use server";

import { requireUser } from "@/lib/supabase/server";
import { askSDB, type CopilotAnswer, type Intent } from "@/lib/copilot";

export type AskState = { q?: string; result?: CopilotAnswer; error?: string };

export async function ask(question: string, forced?: Intent): Promise<AskState> {
  await requireUser();
  const q = question.trim();
  if (!q) return { error: "Escreva ou fale a pergunta." };
  try {
    return { q, result: await askSDB(q, forced) };
  } catch {
    return { q, error: "Não consegui consultar seus dados agora. Tente de novo." };
  }
}
