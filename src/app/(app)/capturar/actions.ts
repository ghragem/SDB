"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { interpretCaptureAI } from "@/lib/ai/intelligence";
import { categoryOf, interpretRules, type CaptureItem, type CaptureKind } from "@/lib/interpret";
import { todaySP } from "@/lib/format";

const KINDS: CaptureKind[] = ["avanco", "evidencia", "bloqueio", "despesa", "receita", "ideia", "aprendizado", "hipotese", "decisao", "tarefa", "nota"];

export type InterpretResult = {
  captureId?: string;
  items?: CaptureItem[];
  interpreter?: "regras" | "ia";
  aiNote?: string | null;
  projects?: { id: string; name: string }[];
  error?: string;
};

/** Passo 1: guarda o texto bruto (pendente) e devolve o que foi entendido. Nada vira registro aqui. */
export async function interpretCapture(input: { text: string; source: "audio" | "texto"; audioPath: string | null; projectId: string | null }): Promise<InterpretResult> {
  const { supabase, userId } = await requireUser();
  const text = input.text.trim().slice(0, 8000);
  if (!text) return { error: "Não há texto para interpretar." };
  const { data: projects } = await supabase.from("projects").select("id, name").not("status", "in", "(encerrado)");
  const refs = projects ?? [];

  let items = interpretRules(text, refs, input.projectId);
  let interpreter: "regras" | "ia" = "regras";
  let aiNote: string | null = null;
  if (aiStatus().configured) {
    try {
      const out = await interpretCaptureAI({ supabase, userId }, text, refs.map((p) => p.name));
      if (out?.itens?.length) {
        items = out.itens.filter((i) => KINDS.includes(i.kind as CaptureKind) && i.text?.trim()).map((i, n) => {
          const p = i.projeto ? refs.find((r) => r.name.toLowerCase() === i.projeto!.toLowerCase()) : null;
          return {
            id: `a${n + 1}`, kind: i.kind as CaptureKind, text: i.text.trim(), projectId: p?.id ?? (input.projectId ?? null),
            amount: typeof i.valor === "number" && i.valor > 0 ? i.valor : null, confidence: "media" as const, why: "interpretado pela IA",
          };
        });
        interpreter = "ia";
      }
    } catch (e) {
      aiNote = `IA indisponível (${e instanceof Error ? e.message : "erro"}). Interpretado por regras.`;
    }
  }

  const { data, error } = await supabase.from("captures").insert({
    user_id: userId, source: input.source, transcript: text, audio_path: input.audioPath, interpreter, items,
    metadata: { project_context: input.projectId },
  }).select("id").single();
  if (error || !data) return { error: "Não consegui guardar a captura. Tente de novo." };
  return { captureId: data.id, items, interpreter, aiNote, projects: refs };
}

export type CommitResult = { ok?: boolean; saved?: { kind: string; label: string; href: string }[]; error?: string };

/** Passo 2: grava só o que foi confirmado, cada item no módulo certo. */
export async function commitCapture(captureId: string, items: CaptureItem[]): Promise<CommitResult> {
  const { supabase, userId } = await requireUser();
  const { data: cap } = await supabase.from("captures").select("id, status, audio_path").eq("id", captureId).maybeSingle();
  if (!cap) return { error: "Captura não encontrada." };
  if (cap.status !== "pendente") return { error: "Esta captura já foi resolvida." };
  const { data: projects } = await supabase.from("projects").select("id, name");
  const nameOf = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const meta = { capture_id: captureId };
  const today = todaySP();
  const saved: { kind: string; table: string; id: string; label: string; href: string }[] = [];
  const failures: string[] = [];

  for (const raw of items.slice(0, 30)) {
    const kind = KINDS.includes(raw.kind) ? raw.kind : "nota";
    const text = String(raw.text ?? "").trim().slice(0, 2000);
    if (!text) continue;
    const projectId = raw.projectId && nameOf.has(raw.projectId) ? raw.projectId : null;
    const amount = typeof raw.amount === "number" && raw.amount > 0 ? Math.round(raw.amount * 100) / 100 : null;
    const pname = projectId ? nameOf.get(projectId)! : null;
    let r: { table: string; id?: string; label: string; href: string } | null = null;

    const toInbox = async (k: string, why: string) => {
      const { data } = await supabase.from("inbox_items").insert({ user_id: userId, kind: k, body: text, amount, metadata: { ...meta, motivo: why, project_id: projectId } }).select("id").single();
      return { table: "inbox_items", id: data?.id, label: `Inbox: ${why}`, href: "/inbox" };
    };
    const note = async (k: string, epistemic: string | null) => {
      const { data } = await supabase.from("brain_notes").insert({ user_id: userId, kind: k, body: text, project_id: projectId, epistemic, source: "captura", metadata: meta }).select("id").single();
      return { table: "brain_notes", id: data?.id, label: `Brain${pname ? ` · ${pname}` : ""}`, href: pname ? `/projetos/${projectId}` : "/brain" };
    };

    if (kind === "avanco" || kind === "evidencia" || kind === "bloqueio") {
      if (projectId) {
        const k = kind === "avanco" ? "avanco" : kind === "evidencia" ? "validacao" : "bloqueio";
        const { data } = await supabase.from("project_updates").insert({ user_id: userId, project_id: projectId, kind: k, body: text, is_progress: kind !== "bloqueio", metadata: meta }).select("id").single();
        r = { table: "project_updates", id: data?.id, label: `${pname}: ${kind === "evidencia" ? "evidência" : kind}`, href: `/projetos/${projectId}` };
      } else r = kind === "evidencia" ? await note("nota", "fato") : await toInbox("nota", "sem projeto");
    } else if (kind === "despesa" || kind === "receita") {
      if (amount) {
        const type = kind === "receita" ? "receita" : /\binvesti/i.test(text) ? "investimento" : "despesa";
        const { data } = await supabase.from("finance_transactions").insert({
          user_id: userId, type, amount, category: kind === "receita" ? (/\bservi/i.test(text) ? "servicos" : "vendas") : categoryOf(text),
          project_id: projectId, description: text, occurred_on: today, metadata: meta,
        }).select("id").single();
        r = { table: "finance_transactions", id: data?.id, label: `Dinheiro: ${kind} ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${pname ? ` · ${pname}` : " · sem projeto"}`, href: "/dinheiro" };
      } else r = await toInbox(kind, "falta o valor");
    } else if (kind === "ideia") {
      const { data } = await supabase.from("ideas").insert({ user_id: userId, title: text.slice(0, 200), metadata: meta }).select("id").single();
      r = { table: "ideas", id: data?.id, label: "Ideias (capturada)", href: "/ideias" };
    } else if (kind === "aprendizado") r = await note("aprendizado", "analise");
    else if (kind === "hipotese") r = await note("hipotese", "hipotese");
    else if (kind === "decisao") r = await note("decisao", "opiniao");
    else if (kind === "tarefa") r = await toInbox("tarefa", "tarefa");
    else r = await note("nota", null);

    if (r?.id) saved.push({ kind, table: r.table, id: r.id, label: r.label, href: r.href });
    else failures.push(text.slice(0, 40));
  }

  await supabase.from("captures").update({ status: "confirmada", items, saved: saved.map(({ kind, table, id }) => ({ kind, table, id })) }).eq("id", captureId);
  revalidatePath("/", "layout");
  if (failures.length) return { ok: saved.length > 0, saved, error: `Não consegui salvar ${failures.length} item(ns): ${failures.join("; ")}.` };
  return { ok: true, saved };
}

/** Sem interpretar: manda o texto (e o áudio) para a Inbox, para classificar depois. */
export async function captureToInbox(input: { captureId: string | null; text: string; source: "audio" | "texto"; audioPath: string | null }): Promise<CommitResult> {
  const { supabase, userId } = await requireUser();
  const text = input.text.trim() || (input.audioPath ? "Áudio sem transcrição. Ouça e classifique." : "");
  if (!text) return { error: "Nada para mandar." };
  const { data, error } = await supabase.from("inbox_items").insert({
    user_id: userId, kind: input.audioPath && !input.text.trim() ? "audio" : "nota", body: text.slice(0, 8000),
    metadata: { audio_path: input.audioPath, capture_id: input.captureId, source: input.source },
  }).select("id").single();
  if (error || !data) return { error: "Não consegui mandar para a Inbox." };
  if (input.captureId) await supabase.from("captures").update({ status: "inbox", saved: [{ kind: "inbox", table: "inbox_items", id: data.id }] }).eq("id", input.captureId);
  revalidatePath("/", "layout");
  return { ok: true, saved: [{ kind: "inbox", label: "Inbox", href: "/inbox" }] };
}

export async function discardCapture(captureId: string) {
  const { supabase } = await requireUser();
  await supabase.from("captures").update({ status: "descartada" }).eq("id", captureId).eq("status", "pendente");
}
