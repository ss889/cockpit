import { describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "@/lib/llm";

describe("LLM providers", () => {
  it("uses the configured Ollama endpoint and validates structured output", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ response: '{"skills":["TypeScript"]}' }), { status: 200 })
    );
    const provider = new OllamaProvider("http://127.0.0.1:11434", "test-model");
    const result = await provider.generateStructured<{ skills: string[] }>({
      prompt: "Extract skills",
      validate: (value): value is { skills: string[] } =>
        Boolean(value && typeof value === "object" && Array.isArray((value as { skills?: unknown }).skills)),
    });

    expect(result.skills).toEqual(["TypeScript"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/generate",
      expect.objectContaining({ method: "POST" })
    );
    fetchMock.mockRestore();
  });

  it("rejects malformed structured output", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ response: "not json" }), { status: 200 })
    );
    const provider = new OllamaProvider();

    await expect(provider.generateStructured<{ skills: string[] }>({
      prompt: "Extract skills",
      validate: (value): value is { skills: string[] } => Boolean(value && typeof value === "object" && "skills" in value),
    })).rejects.toThrow();
    vi.restoreAllMocks();
  });

  it("retries malformed structured output with a JSON repair prompt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: '{"skills":["TypeScript" "Next.js"]}' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: '{"skills":["TypeScript","Next.js"]}' }), { status: 200 }));
    const provider = new OllamaProvider("http://127.0.0.1:11434", "test-model");

    const result = await provider.generateStructured<{ skills: string[] }>({
      prompt: "Extract skills",
      validate: (value): value is { skills: string[] } =>
        Boolean(value && typeof value === "object" && Array.isArray((value as { skills?: unknown }).skills)),
    });

    expect(result.skills).toEqual(["TypeScript", "Next.js"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string).prompt).toContain("could not be parsed");
    vi.restoreAllMocks();
  });
});
