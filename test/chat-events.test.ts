/**
 * Chat events: persist and clear per-turn trace ledger.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendChatEvent, clearChatEvents, readChatEvents } from "../src/commands/chat-events.js";

describe("chat-events", () => {
  it("appends and reads event traces", () => {
    const dir = mkdtempSync(join(tmpdir(), "potion-kit-events-"));
    try {
      appendChatEvent(dir, {
        timestamp: "2026-02-18T12:00:00.000Z",
        trace: {
          toolEvents: [
            { toolName: "read_project_file", ok: true, path: "src/pages/index.hbs" },
            { toolName: "write_project_file", ok: true, path: "src/pages/index.hbs" },
          ],
          stepsUsed: 3,
          finishReason: "stop",
        },
        hasVerifiedWrite: true,
        replyWasGuarded: false,
      });
      const events = readChatEvents(dir);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].trace.toolEvents.length, 2);
      assert.strictEqual(events[0].hasVerifiedWrite, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("clearChatEvents resets ledger to empty array", () => {
    const dir = mkdtempSync(join(tmpdir(), "potion-kit-events-"));
    try {
      appendChatEvent(dir, {
        timestamp: "2026-02-18T12:00:00.000Z",
        trace: { toolEvents: [], stepsUsed: 0, finishReason: "stop" },
        hasVerifiedWrite: false,
        replyWasGuarded: true,
      });
      clearChatEvents(dir);
      assert.deepStrictEqual(readChatEvents(dir), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
