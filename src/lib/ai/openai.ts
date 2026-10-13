import { AIError, type AIProvider, type GenerateOptions } from "./provider";

// OpenAI via REST (sem SDK) para manter o bundle pequeno.
export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly model: string;

  constructor(private apiKey: string, model = process.env.OPENAI_MODEL || "gpt-4.1-mini") {
    this.model = model;
  }

  async generate({ system, prompt, schema, maxTokens = 4000 }: GenerateOptions) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        ...(schema
          ? { response_format: { type: "json_schema", json_schema: { name: "saida", strict: true, schema } } }
          : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    }).catch((e) => {
      throw new AIError("Não consegui falar com a OpenAI.", e);
    });
    if (!res.ok) throw new AIError(`OpenAI respondeu com erro ${res.status}.`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AIError("A OpenAI não devolveu texto.");
    return text;
  }

  async transcribe(audio: Blob, filename: string) {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
    form.append("language", "pt");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(90_000),
    }).catch((e) => {
      throw new AIError("Não consegui enviar o áudio para transcrição.", e);
    });
    if (!res.ok) throw new AIError(`Transcrição falhou (${res.status}).`);
    const json = (await res.json()) as { text?: string };
    return (json.text ?? "").trim();
  }
}
