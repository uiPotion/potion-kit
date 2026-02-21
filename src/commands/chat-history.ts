/**
 * Multi-turn chat: persist conversation in project's .potion-kit/chat-history.json
 * so each run has full context (user + assistant messages). System prompt is
 * never stored; it's injected fresh each time.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stripPreviousSummaryPrefix } from "../ai/summarize.js";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SummaryState {
  /** Condensed summary of history[1..summarizedUntil). */
  summary: string;
  /** Exclusive history index covered by summary (starts at 1, before recent tail). */
  summarizedUntil: number;
  /** First user message at time of summary creation; used to validate cache continuity. */
  firstUserMessage: string;
  /** Number of incremental summary extensions since last full refresh. */
  incrementalUpdates: number;
}

const HISTORY_DIR = ".potion-kit";
const HISTORY_FILE = "chat-history.json";
const SUMMARY_FILE = "chat-summary.json";

function getHistoryPath(cwd: string): string {
  return join(cwd, HISTORY_DIR, HISTORY_FILE);
}

function getSummaryPath(cwd: string): string {
  return join(cwd, HISTORY_DIR, SUMMARY_FILE);
}

export function readHistory(cwd: string): HistoryMessage[] {
  const path = getHistoryPath(cwd);
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (m): m is HistoryMessage =>
        m != null &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof (m as HistoryMessage).content === "string"
    );
  } catch {
    return [];
  }
}

export function writeHistory(cwd: string, messages: HistoryMessage[]): void {
  const dir = join(cwd, HISTORY_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getHistoryPath(cwd), JSON.stringify(messages, null, 2), "utf-8");
}

export function readSummaryState(cwd: string): SummaryState | null {
  const path = getSummaryPath(cwd);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const candidate = data as SummaryState;
    if (
      typeof candidate.summary !== "string" ||
      typeof candidate.summarizedUntil !== "number" ||
      !Number.isFinite(candidate.summarizedUntil) ||
      candidate.summarizedUntil < 1 ||
      typeof candidate.firstUserMessage !== "string"
    ) {
      return null;
    }
    const incrementalUpdatesRaw = (data as { incrementalUpdates?: unknown }).incrementalUpdates;
    const incrementalUpdates =
      typeof incrementalUpdatesRaw === "number" &&
      Number.isFinite(incrementalUpdatesRaw) &&
      incrementalUpdatesRaw >= 0
        ? incrementalUpdatesRaw
        : 0;
    const summary = stripPreviousSummaryPrefix(candidate.summary);
    return { ...candidate, summary, incrementalUpdates };
  } catch {
    return null;
  }
}

export function writeSummaryState(cwd: string, state: SummaryState): void {
  const dir = join(cwd, HISTORY_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getSummaryPath(cwd), JSON.stringify(state, null, 2), "utf-8");
}

export function clearSummaryState(cwd: string): void {
  const path = getSummaryPath(cwd);
  if (existsSync(path)) writeFileSync(path, "{}", "utf-8");
}

export function clearHistory(cwd: string): void {
  const path = getHistoryPath(cwd);
  if (existsSync(path)) writeFileSync(path, "[]", "utf-8");
  clearSummaryState(cwd);
}
