import type { HistoryMessage, SummaryState } from "./chat-history.js";

const MIDDLE_START_INDEX = 1;
export const MAX_INCREMENTAL_SUMMARY_UPDATES = 8;
export const SUMMARY_CHUNK_MAX_MESSAGES = 10;
export const SUMMARY_CHUNK_MAX_CHARS = 3200;

export interface SummaryPlan {
  firstUserMessage: string;
  middleEnd: number;
  reuseCachedSummary: string | null;
  summarizeFrom: number;
  seedSummary: string | null;
  nextIncrementalUpdates: number;
}

export function planSummaryUpdate(
  history: HistoryMessage[],
  maxHistory: number,
  cached: SummaryState | null
): SummaryPlan {
  const middleEnd = history.length - maxHistory;
  const firstUserMessage = history[0]?.role === "user" ? history[0].content : "";
  if (middleEnd <= MIDDLE_START_INDEX) {
    return {
      firstUserMessage,
      middleEnd,
      reuseCachedSummary: null,
      summarizeFrom: middleEnd,
      seedSummary: null,
      nextIncrementalUpdates: 0,
    };
  }

  const validCached =
    isValidSummaryState(cached, firstUserMessage) &&
    cached.summarizedUntil >= MIDDLE_START_INDEX &&
    cached.summarizedUntil <= middleEnd;

  if (validCached && cached.summarizedUntil === middleEnd) {
    return {
      firstUserMessage,
      middleEnd,
      reuseCachedSummary: cached.summary,
      summarizeFrom: middleEnd,
      seedSummary: cached.summary,
      nextIncrementalUpdates: cached.incrementalUpdates,
    };
  }

  const canIncrementalExtend =
    validCached &&
    cached.summarizedUntil < middleEnd &&
    cached.incrementalUpdates < MAX_INCREMENTAL_SUMMARY_UPDATES;
  const summarizeFrom = canIncrementalExtend ? cached.summarizedUntil : MIDDLE_START_INDEX;
  const seedSummary = canIncrementalExtend ? cached.summary : null;

  return {
    firstUserMessage,
    middleEnd,
    reuseCachedSummary: null,
    summarizeFrom,
    seedSummary,
    nextIncrementalUpdates: canIncrementalExtend ? cached.incrementalUpdates + 1 : 0,
  };
}

export function splitSummaryChunks(
  messages: HistoryMessage[],
  maxMessages = SUMMARY_CHUNK_MAX_MESSAGES,
  maxChars = SUMMARY_CHUNK_MAX_CHARS
): HistoryMessage[][] {
  const messageLimit =
    Number.isFinite(maxMessages) && maxMessages > 0 ? Math.floor(maxMessages) : 1;
  const charLimit = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : 1;
  const chunks: HistoryMessage[][] = [];
  let current: HistoryMessage[] = [];
  let currentChars = 0;

  for (const message of messages) {
    const messageChars = estimateMessageChars(message);
    const hitMessageLimit = current.length >= messageLimit;
    const hitCharLimit = current.length > 0 && currentChars + messageChars > charLimit;

    if (hitMessageLimit || hitCharLimit) {
      chunks.push(current);
      current = [message];
      currentChars = messageChars;
      continue;
    }

    current.push(message);
    currentChars += messageChars;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function estimateMessageChars(message: HistoryMessage): number {
  // Include small per-message overhead (role labels + separators) so chunking stays conservative.
  return message.content.length + 16;
}

function isValidSummaryState(
  state: SummaryState | null,
  firstUserMessage: string
): state is SummaryState {
  return !!state && state.summary.length > 0 && state.firstUserMessage === firstUserMessage;
}
