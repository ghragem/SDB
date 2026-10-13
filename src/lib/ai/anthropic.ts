import Anthropic from "@anthropic-ai/sdk";
import { AIError, type AIProvider, type GenerateOptions } from "./provider";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5") {
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
    this.model = model;
  }

  async generate({ system, prompt, schema, maxTokens = 4000 }: GenerateOptions) {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          effort: "low",
          ...(schema ? { format: { type: "json_schema", schema } } : {}),
        },
      });
      if (response.stop_reason === "refusal") {
        throw new AIError("A IA recusou esta solicitação.");
      }
      const text = response.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("")
        .trim();
      if (!text) throw new AIError("A IA não devolveu texto.");
      return text;
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Anthropic.AuthenticationError) throw new AIError("Chave da Anthropic inválida.", e);
      if (e instanceof Anthropic.RateLimitError) throw new AIError("Limite da Anthropic atingido. Tente de novo em instantes.", e);
      if (e instanceof Anthropic.APIError) throw new AIError(`Anthropic respondeu com erro ${e.status}.`, e);
      throw new AIError("Não consegui falar com a Anthropic.", e);
    }
  }
}
