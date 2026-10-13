// Lê exportações de conversas no navegador. O arquivo inteiro nunca sai do aparelho:
// só as conversas escolhidas vão para o banco.
import { strFromU8, unzipSync } from "fflate";

export type ImportSource = "chatgpt" | "claude" | "texto";
export type Msg = { role: "user" | "assistant"; text: string };
export type Conversation = {
  externalId: string;
  source: ImportSource;
  title: string;
  createdAt: string | null;
  messages: Msg[];
};

/** Corpo salvo no Brain. Limite para manter a busca full-text rápida. */
export const BODY_LIMIT = 60_000;

export function toBody(c: Conversation) {
  const who = c.source === "claude" ? "Claude" : c.source === "chatgpt" ? "ChatGPT" : "IA";
  const text = c.messages.map((m) => `${m.role === "user" ? "Você" : who}: ${m.text.trim()}`).join("\n\n");
  return text.length > BODY_LIMIT ? text.slice(0, BODY_LIMIT) + "\n\n[cortado: conversa maior que o limite]" : text;
}

export async function parseFile(file: File): Promise<Conversation[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => /(^|\/)conversations[^/]*\.json$/i.test(f.name),
    });
    const jsons = Object.values(files);
    if (!jsons.length) throw new Error("Não achei conversations.json dentro do .zip. Confira se é a exportação do ChatGPT ou do Claude.");
    return jsons.flatMap((u8) => parseJson(strFromU8(u8)));
  }
  if (name.endsWith(".json")) return parseJson(await file.text());
  throw new Error("Formato não suportado. Envie o .zip da exportação ou o conversations.json.");
}

function parseJson(raw: string): Conversation[] {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error("O arquivo não é um JSON válido."); }
  if (!Array.isArray(data)) throw new Error("Formato inesperado: esperava uma lista de conversas.");
  return data.map(parseOne).filter((c): c is Conversation => c !== null && c.messages.length > 0);
}

type GptNode = { message?: { author?: { role?: string }; content?: { parts?: unknown[]; text?: string }; create_time?: number | null } | null; parent?: string | null };
type GptConv = { id?: string; conversation_id?: string; title?: string; create_time?: number; mapping?: Record<string, GptNode>; current_node?: string };
type ClaudeConv = { uuid?: string; name?: string; created_at?: string; chat_messages?: { sender?: string; text?: string; content?: { type?: string; text?: string }[] }[] };

function parseOne(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== "object") return null;
  if ("mapping" in raw) return parseGpt(raw as GptConv);
  if ("chat_messages" in raw) return parseClaude(raw as ClaudeConv);
  return null;
}

function parseGpt(c: GptConv): Conversation | null {
  const id = c.conversation_id ?? c.id;
  if (!id || !c.mapping) return null;
  // Segue o ramo ativo (do último nó até a raiz); versões editadas/descartadas ficam de fora.
  const chain: GptNode[] = [];
  let cur = c.current_node && c.mapping[c.current_node] ? c.current_node : null;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node: GptNode | undefined = c.mapping[cur];
    if (!node) break;
    chain.unshift(node);
    cur = node.parent ?? null;
  }
  const nodes = chain.length ? chain : Object.values(c.mapping).sort((a, b) => (a.message?.create_time ?? 0) - (b.message?.create_time ?? 0));
  const messages: Msg[] = [];
  for (const n of nodes) {
    const role = n.message?.author?.role;
    if (role !== "user" && role !== "assistant") continue;
    const parts = n.message?.content?.parts ?? (n.message?.content?.text ? [n.message.content.text] : []);
    const text = parts.filter((p): p is string => typeof p === "string").join("\n").trim();
    if (text) messages.push({ role, text });
  }
  return {
    externalId: `chatgpt:${id}`,
    source: "chatgpt",
    title: (c.title || "Conversa sem título").slice(0, 200),
    createdAt: c.create_time ? new Date(c.create_time * 1000).toISOString() : null,
    messages,
  };
}

function parseClaude(c: ClaudeConv): Conversation | null {
  if (!c.uuid) return null;
  const messages: Msg[] = (c.chat_messages ?? []).flatMap((m) => {
    const role = m.sender === "human" ? "user" : m.sender === "assistant" ? "assistant" : null;
    const text = (m.text || (m.content ?? []).filter((x) => x.type === "text").map((x) => x.text ?? "").join("\n")).trim();
    return role && text ? [{ role, text } as Msg] : [];
  });
  return {
    externalId: `claude:${c.uuid}`,
    source: "claude",
    title: (c.name || "Conversa sem título").slice(0, 200),
    createdAt: c.created_at ?? null,
    messages,
  };
}

/** Texto colado: linhas "Você:"/"Eu:"/"User:" viram fala do usuário; o resto, da IA. Sem marcação, tudo é do usuário. */
export function parsePasted(title: string, text: string): Conversation {
  const userRe = /^(você|voce|eu|user|usuário|usuario|gustavo)\s*:/i;
  const aiRe = /^(chatgpt|gpt|claude|ia|assistant|assistente|gemini)\s*:/i;
  const messages: Msg[] = [];
  let role: Msg["role"] = "user";
  let buf: string[] = [];
  const flush = () => { const t = buf.join("\n").trim(); if (t) messages.push({ role, text: t }); buf = []; };
  for (const line of text.split(/\r?\n/)) {
    if (userRe.test(line)) { flush(); role = "user"; buf.push(line.replace(userRe, "")); }
    else if (aiRe.test(line)) { flush(); role = "assistant"; buf.push(line.replace(aiRe, "")); }
    else buf.push(line);
  }
  flush();
  return { externalId: `texto:${Date.now()}`, source: "texto", title: title.trim() || "Conversa colada", createdAt: new Date().toISOString(), messages };
}
