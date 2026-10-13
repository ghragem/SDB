// Interface abstrata de IA (seção 52). O contexto pertence ao Saindo do Bairro,
// não ao provider. Trocar de provider não muda nada fora desta pasta.

export type JsonSchema = Record<string, unknown>;

export type GenerateOptions = {
  system: string;
  prompt: string;
  /** Quando presente, a resposta é JSON validado contra o schema. */
  schema?: JsonSchema;
  maxTokens?: number;
};

export interface AIProvider {
  readonly name: "anthropic" | "openai";
  readonly model: string;
  generate(opts: GenerateOptions): Promise<string>;
  transcribe?(audio: Blob, filename: string): Promise<string>;
}

export class AIError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

/** Atalhos da interface (analyze/evaluate/summarize/extract) sobre generate(). */
export async function generateJson<T>(p: AIProvider, opts: GenerateOptions & { schema: JsonSchema }): Promise<T> {
  const text = await p.generate(opts);
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new AIError("A IA devolveu uma resposta fora do formato esperado.", e);
  }
}

export const analyze = <T>(p: AIProvider, system: string, prompt: string, schema: JsonSchema) =>
  generateJson<T>(p, { system, prompt, schema });
export const evaluate = analyze;
export const extract = analyze;
export const summarize = (p: AIProvider, system: string, prompt: string) => p.generate({ system, prompt });
