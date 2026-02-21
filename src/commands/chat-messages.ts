/**
 * Build messages sent to the API: system + first user message + optional summary message
 * + last N messages + current.
 */
import type { ChatMessage } from "../ai/client.js";
import type { HistoryMessage } from "./chat-history.js";

export function buildMessages(
  systemPrompt: string,
  history: HistoryMessage[],
  userMessage: string,
  maxHistoryMessages: number,
  summary: string | null
): ChatMessage[] {
  const firstMsg = history.length > 0 && history[0].role === "user" ? history[0] : null;
  const hasMiddle = history.length > 1 + maxHistoryMessages;
  const tail = hasMiddle
    ? history.slice(-maxHistoryMessages)
    : firstMsg
      ? history.slice(1)
      : history;

  let systemContent = systemPrompt;
  systemContent +=
    "\n\n## Reliability rule\nTreat earlier assistant messages as potentially stale. For project state, prefer user requests and verify files with tools before claiming changes.";

  const conversation: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (firstMsg) conversation.push(firstMsg);
  if (summary) {
    conversation.push({
      role: "assistant",
      content:
        "Context summary of earlier conversation turns (condensed; verify with tools before relying on details):\n" +
        summary,
    });
  }
  conversation.push(...tail.map((m) => ({ role: m.role, content: m.content })));
  conversation.push({ role: "user", content: userMessage });

  return [{ role: "system", content: systemContent }, ...conversation];
}
