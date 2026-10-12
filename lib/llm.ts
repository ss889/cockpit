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
    return generateStructuredWithRepair(input, this.getProviderName(), (request) => this.generateText(request));
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
    return generateStructuredWithRepair(input, this.getProviderName(), (request) => this.generateText(request));
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

async function generateStructuredWithRepair<T>(
  input: LLMStructuredRequest<T>,
  providerName: string,
  generateText: (input: LLMTextRequest) => Promise<string>,
): Promise<T> {
  const system = `${input.system || ""}\nReturn only valid JSON. Do not include markdown fences or commentary.`;
  let prompt = input.prompt;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await generateText({ ...input, system, prompt });
    try {
      const parsed = extractJSON(text);
      if (!input.validate(parsed)) throw new Error(`${providerName} returned invalid structured output`);
      return parsed;
    } catch (error) {
      lastError = error;
      prompt = buildRepairPrompt(input.prompt, text, error);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "invalid structured output";
  throw new Error(`${providerName} returned malformed JSON after retry: ${message}`);
}

function buildRepairPrompt(originalPrompt: string, invalidJson: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const clippedOutput = invalidJson.length > 12_000
    ? `${invalidJson.slice(0, 12_000)}\n...TRUNCATED...`
    : invalidJson;

  return [
    "The previous response was not valid JSON and could not be parsed.",
    `Parser error: ${message}`,
    "Return the corrected JSON only. Preserve the same schema and do not add markdown fences.",
    "",
    "Original task:",
    originalPrompt,
    "",
    "Invalid response to repair:",
    clippedOutput,
  ].join("\n");
}
