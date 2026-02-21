/**
 * Chat history: happy path — write/read and clear round-trip.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  clearHistory,
  readHistory,
  readSummaryState,
  writeHistory,
  writeSummaryState,
} from "../src/commands/chat-history.js";

describe("chat-history", () => {
  let tempDir: string;

  function setup() {
    tempDir = mkdtempSync(join(tmpdir(), "potion-kit-test-"));
  }

  function teardown() {
    if (tempDir) rmSync(tempDir, { recursive: true });
  }

  it("persists messages and reads them back", () => {
    setup();
    try {
      const messages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there" },
      ];
      writeHistory(tempDir, messages);
      assert.deepStrictEqual(readHistory(tempDir), messages);
    } finally {
      teardown();
    }
  });

  it("clears history so next read is empty", () => {
    setup();
    try {
      writeHistory(tempDir, [
        { role: "user", content: "x" },
        { role: "assistant", content: "y" },
      ]);
      writeSummaryState(tempDir, {
        summary: "old context",
        summarizedUntil: 2,
        firstUserMessage: "x",
        incrementalUpdates: 3,
      });
      assert.strictEqual(readHistory(tempDir).length, 2);
      clearHistory(tempDir);
      assert.deepStrictEqual(readHistory(tempDir), []);
      assert.strictEqual(readSummaryState(tempDir), null);
    } finally {
      teardown();
    }
  });

  it("persists summary state and reads it back", () => {
    setup();
    try {
      const state = {
        summary: "User wants a docs site.",
        summarizedUntil: 4,
        firstUserMessage: "Let's build docs",
        incrementalUpdates: 1,
      };
      writeSummaryState(tempDir, state);
      assert.deepStrictEqual(readSummaryState(tempDir), state);
    } finally {
      teardown();
    }
  });

  it("defaults incrementalUpdates to 0 for older summary files", () => {
    setup();
    try {
      writeSummaryState(tempDir, {
        summary: "context",
        summarizedUntil: 3,
        firstUserMessage: "hello",
        incrementalUpdates: 0,
      });
      const path = join(tempDir, ".potion-kit", "chat-summary.json");
      // Simulate old schema without incrementalUpdates.
      const oldSchema = {
        summary: "context",
        summarizedUntil: 3,
        firstUserMessage: "hello",
      };
      writeFileSync(path, JSON.stringify(oldSchema, null, 2), "utf-8");

      const out = readSummaryState(tempDir);
      assert.ok(out !== null);
      assert.strictEqual(out!.incrementalUpdates, 0);
    } finally {
      teardown();
    }
  });
});
