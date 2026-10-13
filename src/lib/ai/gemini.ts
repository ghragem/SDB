import { AIError, type AIProvider, type GenerateOptions } from "./provider";

// Google Gemini via REST. Tem plano gratuito (chave em aistudio.google.com, sem cartão),
// com limite por minuto e por dia. No plano gratuito o Google pode usar o conteúdo para melhorar produtos.
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  readonly model: string;

  constructor(private apiKey: string, model = process.env.GEMINI_MODEL || "gemini-2.5-flash") {
    this.model = model;
  }

  private async call(body: unknown, timeoutMs: number) {
    const res = await fetch(`${BASE}/${this.model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((e) => {
      throw new AIError("Não consegui falar com o Gemini.", e);
    });
    if (res.status === 429) throw new AIError("Limite gratuito do Gemini atingido. Tente de novo em instantes.");
    if (res.status === 400 || res.status === 403) throw new AIError("Chave do Gemini inválida ou sem permissão.");
    if (!res.ok) throw new AIError(`Gemini respondeu com erro ${res.status}.`);
    const json = (await res.json()) as GeminiResponse;
    if (json.promptFeedback?.blockReason) throw new AIError("O Gemini recusou esta solicitação.");
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!text) throw new AIError("O Gemini não devolveu texto.");
    return text;
  }

  generate({ system, prompt, schema, maxTokens = 4000 }: GenerateOptions) {
    return this.call({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(schema ? { responseMimeType: "application/json", responseJsonSchema: schema } : {}),
      },
    }, 60_000);
  }

  async transcribe(audio: Blob) {
    const data = Buffer.from(await audio.arrayBuffer()).toString("base64");
    return this.call({
      contents: [{
        role: "user",
        parts: [
          { text: "Transcreva este áudio em português do Brasil, palavra por palavra. Devolva só a transcrição, sem comentários." },
          { inlineData: { mimeType: (audio.type || "audio/webm").split(";")[0], data } },
        ],
      }],
    }, 90_000);
  }
}
