/**
 * Clear command: clears history and summary state in current project.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeHistory, writeSummaryState } from "../src/commands/chat-history.js";
import { appendChatEvent } from "../src/commands/chat-events.js";
import { runClear } from "../src/commands/clear.js";

describe("clear", () => {
  it("clears chat history and summary cache for current directory", async () => {
    const originalCwd = process.cwd();
    const dir = mkdtempSync(join(tmpdir(), "potion-kit-clear-"));
    const logs: string[] = [];
    const originalLog = console.log;

    try {
      process.chdir(dir);
      writeHistory(dir, [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ]);
      writeSummaryState(dir, {
        summary: "context",
        summarizedUntil: 2,
        firstUserMessage: "hello",
        incrementalUpdates: 4,
      });
      appendChatEvent(dir, {
        timestamp: "2026-02-18T12:00:00.000Z",
        trace: {
          toolEvents: [{ toolName: "write_project_file", ok: true, path: "src/pages/index.hbs" }],
          stepsUsed: 2,
          finishReason: "stop",
        },
        hasVerifiedWrite: true,
        replyWasGuarded: false,
      });

      console.log = (...args: unknown[]) => logs.push(args.join(" "));
      await runClear();

      const historyPath = join(dir, ".potion-kit", "chat-history.json");
      const summaryPath = join(dir, ".potion-kit", "chat-summary.json");
      const eventsPath = join(dir, ".potion-kit", "chat-events.json");
      assert.ok(existsSync(historyPath));
      assert.ok(existsSync(summaryPath));
      assert.ok(existsSync(eventsPath));
      assert.strictEqual(readFileSync(historyPath, "utf-8"), "[]");
      assert.strictEqual(readFileSync(summaryPath, "utf-8"), "{}");
      assert.strictEqual(readFileSync(eventsPath, "utf-8"), "[]");
      assert.ok(
        logs.some((line) =>
          line.includes(
            "Chat history cleared for this project. The next chat will start a new conversation."
          )
        )
      );
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
