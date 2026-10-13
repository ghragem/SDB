import "server-only";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import type { AIProvider } from "./provider";

export type AIStatus = {
  configured: boolean;
  provider: "anthropic" | "openai" | null;
  model: string | null;
  transcription: boolean;
};

/** Provider de texto. Preferência: Anthropic, depois OpenAI. null = IA não configurada. */
export function getProvider(prefer?: "anthropic" | "openai" | null): AIProvider | null {
  const a = process.env.ANTHROPIC_API_KEY;
  const o = process.env.OPENAI_API_KEY;
  if (prefer === "openai" && o) return new OpenAIProvider(o);
  if (a) return new AnthropicProvider(a);
  if (o) return new OpenAIProvider(o);
  return null;
}

export function getTranscriber() {
  const o = process.env.OPENAI_API_KEY;
  return o ? new OpenAIProvider(o) : null;
}

export function aiStatus(prefer?: "anthropic" | "openai" | null): AIStatus {
  const p = getProvider(prefer);
  return {
    configured: Boolean(p),
    provider: p?.name ?? null,
    model: p?.model ?? null,
    transcription: Boolean(process.env.OPENAI_API_KEY),
  };
}
