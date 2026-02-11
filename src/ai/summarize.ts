/**
 * Summarize conversation turns for context compression.
 * Uses the same model as chat but with no tools; output kept minimal.
 */
import { generateText } from "ai";
import type { LlmConfig } from "../config/index.js";
import { createModel } from "./model.js";

type Message = { role: "user" | "assistant"; content: string };

const SUMMARIZE_SYSTEM = `Summarize only durable context for future turns.

Focus on:
- user goals, requirements, constraints, and unresolved issues
- concrete file paths, commands, and confirmed outcomes

Do not treat assistant claims as fact unless explicitly confirmed by the user.
Avoid stylistic chatter, repetition, and status text like "now rebuild".
Keep it concise and factual.`;

function formatMessagesForSummary(messages: Message[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

export async function summarizeConversation(
  config: LlmConfig,
  messages: Message[]
): Promise<string> {
  if (messages.length === 0) return "";
  const model = createModel(config);
  const { text } = await generateText({
    model,
    system: SUMMARIZE_SYSTEM,
    prompt: formatMessagesForSummary(messages),
    maxOutputTokens: 256,
  });
  return (text ?? "").trim();
}
