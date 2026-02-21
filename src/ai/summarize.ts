/**
 * Summarize conversation turns for context compression.
 * Uses the same model as chat but with no tools; output kept minimal.
 */
import { generateText } from "ai";
import type { LlmConfig } from "../config/index.js";
import { createModel } from "./model.js";

type Message = { role: "user" | "assistant"; content: string };

export type SummarySource =
  | "none"
  | "cache-reuse"
  | "model-primary"
  | "model-retry"
  | "fallback-local";

const SUMMARIZE_SYSTEM = `Summarize only durable context for future turns.

Focus on:
- user goals, requirements, constraints, and unresolved issues
- concrete file paths, commands, and confirmed outcomes

Do not treat assistant claims as fact unless explicitly confirmed by the user.
Avoid stylistic chatter, repetition, and status text like "now rebuild".
Output plain text only (no markdown headings, no bold, no code fences).
Be concise but complete: write at least 2-3 sentences or 3-5 bullet points so the summary is useful. Do not include the phrase "Previous condensed summary" in your output.`;

const SUMMARIZE_RETRY_SYSTEM = `Summarize the conversation in plain text.
Include:
- user goals and requested changes
- concrete files/commands and outcomes
- unresolved issues

Use 3-6 short lines (at least 3 lines). No markdown. Do not include the phrase "Previous condensed summary" in your output.`;

const MAX_PROMPT_CHARS = 5500;
const PREVIOUS_SUMMARY_MAX_CHARS = 1000;
/** Reject model summaries shorter than this; caller will use fallback condensing. */
const MIN_SUMMARY_CHARS = 80;

function formatMessagesForSummary(messages: Message[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

/**
 * Keep message boundaries intact; only shorten an oversized cached-summary prefix.
 * Chunking in summary-cache should handle large ranges without dropping messages here.
 */
function trimMessagesForPrompt(messages: Message[]): Message[] {
  const raw = formatMessagesForSummary(messages);
  if (raw.length <= MAX_PROMPT_CHARS) return messages;
  const first = messages[0];
  if (
    first?.role === "assistant" &&
    first.content.trimStart().startsWith("Previous condensed summary:")
  ) {
    const body = first.content.replace(/^Previous condensed summary:\s*/i, "").trim();
    const tail =
      body.length <= PREVIOUS_SUMMARY_MAX_CHARS
        ? body
        : body.slice(0, PREVIOUS_SUMMARY_MAX_CHARS - 3).trimEnd() + "...";
    const trimmedFirst: Message = {
      role: "assistant",
      content: `Previous condensed summary:\n${tail}`,
    };
    return [trimmedFirst, ...messages.slice(1)];
  }
  return messages;
}

export async function summarizeConversationWithRetry(
  config: LlmConfig,
  messages: Message[]
): Promise<{ summary: string; source: SummarySource | null }> {
  if (messages.length === 0) return { summary: "", source: null };
  const model = createModel(config);
  const trimmed = trimMessagesForPrompt(messages);
  const prompt = formatMessagesForSummary(trimmed);

  const summarizerMessages = [{ role: "user" as const, content: prompt }];
  const { text, finishReason } = await generateText({
    model,
    system: SUMMARIZE_SYSTEM,
    messages: summarizerMessages,
    maxOutputTokens: 512,
  });
  const primary = stripPreviousSummaryPrefix(
    normalizeSummary(text ?? "", finishReason === "length")
  );
  if (primary && primary.length >= MIN_SUMMARY_CHARS) {
    return { summary: primary, source: "model-primary" };
  }

  const retry = await generateText({
    model,
    system: SUMMARIZE_RETRY_SYSTEM,
    messages: summarizerMessages,
    maxOutputTokens: 320,
  });
  const retrySummary = stripPreviousSummaryPrefix(
    normalizeSummary(retry.text ?? "", retry.finishReason === "length")
  );
  if (retrySummary && retrySummary.length >= MIN_SUMMARY_CHARS) {
    return { summary: retrySummary, source: "model-retry" };
  }

  return { summary: "", source: null };
}

/**
 * Remove the "Previous condensed summary:" label so it is never persisted and never
 * accumulates when we reuse the cached summary for incremental updates.
 */
export function stripPreviousSummaryPrefix(text: string): string {
  return text.replace(/^(?:Previous condensed summary:\s*)+/im, "").trim();
}

const FALLBACK_MAX_LENGTH = 1600;
const PREVIOUS_SUMMARY_TAIL = 380;
const USER_SNIP = 100;
const ASSISTANT_SNIP = 130;

export function buildFallbackSummary(messages: Message[]): string {
  if (messages.length === 0) return "";
  const parts: string[] = [];
  for (const message of messages.slice(-10)) {
    const raw = message.content.trim();
    if (!raw) continue;
    if (message.role === "user") {
      parts.push(`User: ${condenseUserMessage(raw)}`);
      continue;
    }
    if (raw.startsWith("Previous condensed summary:")) {
      let body = stripPreviousSummaryPrefix(raw);
      body = body.replace(/(?:Previous condensed summary:\s*)+/gi, "").trim();
      if (body) parts.push(condenseToSentences(body, PREVIOUS_SUMMARY_TAIL));
      continue;
    }
    parts.push(`Assistant: ${condenseAssistantMessage(raw)}`);
  }
  const joined = stripPreviousSummaryPrefix(parts.join("\n\n").trim());
  return joined.slice(0, FALLBACK_MAX_LENGTH);
}

function condenseUserMessage(content: string): string {
  const oneLine = content
    .replace(/\s+/g, " ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
  const firstSentence = oneLine.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? oneLine;
  return (
    firstSentence.length <= USER_SNIP ? firstSentence : firstSentence.slice(0, USER_SNIP - 1) + "…"
  ).slice(0, USER_SNIP);
}

function condenseAssistantMessage(content: string): string {
  const text = content
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n\s*\|[\s|\-:]+\|/g, "") // strip markdown table header line
    .replace(/\|\s*[^|\n]+\|/g, " ") // strip table cells to space
    .replace(/\*\*Run it:\*\*?\s*```[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstSentence = text.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? text;
  const snip = (
    firstSentence.length <= ASSISTANT_SNIP
      ? firstSentence
      : firstSentence.slice(0, ASSISTANT_SNIP - 1) + "…"
  ).slice(0, ASSISTANT_SNIP);
  return snip || text.slice(0, ASSISTANT_SNIP);
}

function condenseToSentences(text: string, maxChars: number): string {
  const oneLine = text
    .replace(/\s+/g, " ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
  if (oneLine.length <= maxChars) return oneLine;
  const at = oneLine.slice(0, maxChars);
  const last = Math.max(at.lastIndexOf(". "), at.lastIndexOf("! "), at.lastIndexOf("? "));
  return (last > maxChars / 2 ? oneLine.slice(0, last + 1) : at.trimEnd() + "…").trim();
}

function normalizeSummary(raw: string, mayBeTruncated: boolean): string {
  const cleaned = raw
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s.*\n+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
  if (!cleaned) return "";
  if (!mayBeTruncated) return cleaned;
  const trimmed = trimToCompleteBoundary(cleaned);
  if (trimmed) return trimmed;
  const atWord = cleaned.slice(0, 400).trimEnd();
  const lastSpace = atWord.lastIndexOf(" ");
  return lastSpace > 100 ? atWord.slice(0, lastSpace) : atWord;
}

function trimToCompleteBoundary(text: string): string {
  const lastSentenceEnd = Math.max(
    text.lastIndexOf("."),
    text.lastIndexOf("!"),
    text.lastIndexOf("?")
  );
  if (lastSentenceEnd >= 0) {
    return text.slice(0, lastSentenceEnd + 1).trim();
  }
  const lastLineBreak = text.lastIndexOf("\n");
  if (lastLineBreak > 40) {
    return text.slice(0, lastLineBreak).trim();
  }
  if (text.length > 80) {
    return text.slice(0, 77).trimEnd() + "...";
  }
  return text;
}
