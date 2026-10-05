import { describe, expect, it } from "vitest";
import { buildRefineConversationHistory } from "@/lib/refineHistory";
import type { Message } from "@/types";

describe("refine conversation history", () => {
  it("includes the latest user message in the follow-up request", () => {
    const history: Message[] = [
      { id: "1", role: "user", content: "First request", timestamp: "2026-10-01T00:00:00.000Z" },
      { id: "2", role: "assistant", content: "First answer", timestamp: "2026-10-01T00:00:01.000Z" },
    ];
    const latest: Message = { id: "3", role: "user", content: "Refine the summary", timestamp: "2026-10-01T00:00:02.000Z" };

    expect(buildRefineConversationHistory(history, latest)).toEqual([
      ...history,
      latest,
    ]);
  });

  it("caps the conversation to the most recent entries", () => {
    const history = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Message ${index}`,
      timestamp: `2026-10-01T00:00:${String(index).padStart(2, "0")}.000Z`,
    }) as Message);
    const latest: Message = { id: "10", role: "user", content: "Newest request", timestamp: "2026-10-01T00:01:00.000Z" };

    const requestHistory = buildRefineConversationHistory(history, latest);
    expect(requestHistory).toHaveLength(8);
    expect(requestHistory.at(-1)?.content).toBe("Newest request");
  });
});
