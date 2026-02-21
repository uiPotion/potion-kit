import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChatTurnTrace } from "../ai/client.js";

export interface ChatTurnEvent {
  timestamp: string;
  trace: ChatTurnTrace;
  hasVerifiedWrite: boolean;
  replyWasGuarded: boolean;
  summarySource?: string;
}

const HISTORY_DIR = ".potion-kit";
const EVENTS_FILE = "chat-events.json";
const MAX_EVENTS = 200;

function getEventsPath(cwd: string): string {
  return join(cwd, HISTORY_DIR, EVENTS_FILE);
}

export function readChatEvents(cwd: string): ChatTurnEvent[] {
  const path = getEventsPath(cwd);
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isChatTurnEvent);
  } catch {
    return [];
  }
}

export function appendChatEvent(cwd: string, event: ChatTurnEvent): void {
  const dir = join(cwd, HISTORY_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const events = readChatEvents(cwd);
  events.push(event);
  const trimmed = events.slice(-MAX_EVENTS);
  writeFileSync(getEventsPath(cwd), JSON.stringify(trimmed, null, 2), "utf-8");
}

export function clearChatEvents(cwd: string): void {
  const path = getEventsPath(cwd);
  if (existsSync(path)) writeFileSync(path, "[]", "utf-8");
}

function isChatTurnEvent(value: unknown): value is ChatTurnEvent {
  if (!value || typeof value !== "object") return false;
  const obj = value as ChatTurnEvent;
  if (
    typeof obj.timestamp !== "string" ||
    typeof obj.hasVerifiedWrite !== "boolean" ||
    typeof obj.replyWasGuarded !== "boolean" ||
    (obj.summarySource !== undefined && typeof obj.summarySource !== "string")
  ) {
    return false;
  }
  if (!obj.trace || typeof obj.trace !== "object") return false;
  const trace = obj.trace as ChatTurnTrace;
  if (
    typeof trace.stepsUsed !== "number" ||
    !Number.isFinite(trace.stepsUsed) ||
    typeof trace.finishReason !== "string" ||
    !Array.isArray(trace.toolEvents)
  ) {
    return false;
  }
  return trace.toolEvents.every(
    (e) =>
      e &&
      typeof e === "object" &&
      typeof (e as { toolName?: unknown }).toolName === "string" &&
      typeof (e as { ok?: unknown }).ok === "boolean"
  );
}
