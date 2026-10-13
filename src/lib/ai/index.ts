import "server-only";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import type { AIProvider, ProviderName } from "./provider";

export type AIStatus = {
  configured: boolean;
  provider: ProviderName | null;
  model: string | null;
  transcription: boolean;
};

const keys = () => ({
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
});

function build(name: ProviderName, key: string): AIProvider {
  if (name === "anthropic") return new AnthropicProvider(key);
  if (name === "openai") return new OpenAIProvider(key);
  return new GeminiProvider(key);
}

/** Provider de texto. Usa o preferido se tiver chave; senão Anthropic, OpenAI, Gemini. null = IA não configurada. */
export function getProvider(prefer?: ProviderName | null): AIProvider | null {
  const k = keys();
  if (prefer && k[prefer]) return build(prefer, k[prefer]!);
  for (const name of ["anthropic", "openai", "gemini"] as const) {
    if (k[name]) return build(name, k[name]!);
  }
  return null;
}

/** Transcrição no servidor: OpenAI (Whisper) ou Gemini. Sem nenhum, o app usa a do navegador. */
export function getTranscriber(): AIProvider | null {
  const k = keys();
  if (k.openai) return new OpenAIProvider(k.openai);
  if (k.gemini) return new GeminiProvider(k.gemini);
  return null;
}

export function availableProviders(): Record<ProviderName, boolean> {
  const k = keys();
  return { anthropic: Boolean(k.anthropic), openai: Boolean(k.openai), gemini: Boolean(k.gemini) };
}

export function aiStatus(prefer?: ProviderName | null): AIStatus {
  const p = getProvider(prefer);
  return {
    configured: Boolean(p),
    provider: p?.name ?? null,
    model: p?.model ?? null,
    transcription: Boolean(getTranscriber()),
  };
}
