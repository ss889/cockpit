import type { Message } from "@/types";

export function buildRefineConversationHistory(history: Message[], latest: Message): Message[] {
  return [...history, latest].slice(-8);
}
