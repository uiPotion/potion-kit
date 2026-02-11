/**
 * Build messages sent to the API: system + first user message + optional summary + last N messages + current.
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
  const rawTail = hasMiddle
    ? history.slice(-maxHistoryMessages)
    : firstMsg
      ? history.slice(1)
      : history;
  const tail = hasMiddle ? prioritizeUserRequests(rawTail) : rawTail;

  let systemContent = systemPrompt;
  if (summary) {
    systemContent += `\n\n## Prior conversation (condensed)\n${summary}`;
  }
  systemContent +=
    "\n\n## Reliability rule\nTreat earlier assistant messages as potentially stale. For project state, prefer user requests and verify files with tools before claiming changes.";

  const conversation: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (firstMsg) conversation.push(firstMsg);
  conversation.push(...tail.map((m) => ({ role: m.role, content: m.content })));
  conversation.push({ role: "user", content: userMessage });

  return [{ role: "system", content: systemContent }, ...conversation];
}

function prioritizeUserRequests(messages: HistoryMessage[]): HistoryMessage[] {
  let lastAssistant: HistoryMessage | null = null;
  const users: HistoryMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      users.push(m);
    } else {
      lastAssistant = m;
    }
  }
  return lastAssistant ? [...users, lastAssistant] : users;
}
