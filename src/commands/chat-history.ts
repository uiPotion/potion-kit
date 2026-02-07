/**
 * Multi-turn chat: persist conversation in project's .potion-kit/chat-history.json
 * so each run has full context (user + assistant messages). System prompt is
 * never stored; it's injected fresh each time.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const HISTORY_DIR = ".potion-kit";
const HISTORY_FILE = "chat-history.json";

function getHistoryPath(cwd: string): string {
  return join(cwd, HISTORY_DIR, HISTORY_FILE);
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

export function clearHistory(cwd: string): void {
  const path = getHistoryPath(cwd);
  if (existsSync(path)) writeFileSync(path, "[]", "utf-8");
}
