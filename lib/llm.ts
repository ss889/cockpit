import { createAnthropicClient } from "@/lib/anthropicClient";
import { extractJSON } from "@/lib/extractJSON";

export type LLMTextRequest = {
  system?: string;
  prompt: string;
  maxTokens?: number;
};

export type LLMStructuredRequest<T> = LLMTextRequest & {
  validate: (value: unknown) => value is T;
};

export type LLMHealth = {
  healthy: boolean;
  provider: string;
  model: string;
  detail?: string;
};

export interface LLMProvider {
  generateText(input: LLMTextRequest): Promise<string>;
  generateStructured<T>(input: LLMStructuredRequest<T>): Promise<T>;
  getProviderName(): string;
  getModelName(): string;
  healthCheck(): Promise<LLMHealth>;
}

export class AnthropicProvider implements LLMProvider {
  private readonly model: string;

  constructor(model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5") {
    this.model = model;
  }

  async generateText(input: LLMTextRequest): Promise<string> {
    const response = await createAnthropicClient().messages.create({
      model: this.model,
      max_tokens: input.maxTokens || 2048,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });
    return response.content
      .flatMap((block) => block.type === "text" ? [block.text] : [])
      .join("\n")
      .trim();
  }

  async generateStructured<T>(input: LLMStructuredRequest<T>): Promise<T> {
    const text = await this.generateText({
      ...input,
      system: `${input.system || ""}\nReturn only valid JSON. Do not include markdown fences or commentary.`,
    });
    const parsed = extractJSON(text);
    if (!input.validate(parsed)) throw new Error(`${this.getProviderName()} returned invalid structured output`);
    return parsed;
  }

  getProviderName(): string { return "anthropic"; }
  getModelName(): string { return this.model; }

  async healthCheck(): Promise<LLMHealth> {
    const healthy = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    return { healthy, provider: this.getProviderName(), model: this.model, detail: healthy ? undefined : "ANTHROPIC_API_KEY is not configured" };
  }
}

export class OllamaProvider implements LLMProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    model = process.env.OLLAMA_MODEL || "llama3.1:8b"
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
  }

  async generateText(input: LLMTextRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: [input.system, input.prompt].filter(Boolean).join("\n\n"),
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Ollama request failed: ${response.status}`);
    const data = await response.json() as { response?: unknown };
    if (typeof data.response !== "string" || !data.response.trim()) throw new Error("Ollama returned no text");
    return data.response.trim();
  }

  async generateStructured<T>(input: LLMStructuredRequest<T>): Promise<T> {
    const text = await this.generateText({
      ...input,
      system: `${input.system || ""}\nReturn only valid JSON. Do not include markdown fences or commentary.`,
    });
    const parsed = extractJSON(text);
    if (!input.validate(parsed)) throw new Error(`${this.getProviderName()} returned invalid structured output`);
    return parsed;
  }

  getProviderName(): string { return "ollama"; }
  getModelName(): string { return this.model; }

  async healthCheck(): Promise<LLMHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3_000) });
      return { healthy: response.ok, provider: this.getProviderName(), model: this.model, detail: response.ok ? undefined : `Ollama returned ${response.status}` };
    } catch (error) {
      return { healthy: false, provider: this.getProviderName(), model: this.model, detail: error instanceof Error ? error.message : "Ollama unavailable" };
    }
  }
}

export function getLLMProvider(): LLMProvider {
  return (process.env.LLM_PROVIDER || "anthropic").toLowerCase() === "ollama"
    ? new OllamaProvider()
    : new AnthropicProvider();
}