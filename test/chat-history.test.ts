/**
 * Chat history: happy path — write/read and clear round-trip.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readHistory, writeHistory, clearHistory } from "../src/commands/chat-history.js";

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
      assert.strictEqual(readHistory(tempDir).length, 2);
      clearHistory(tempDir);
      assert.deepStrictEqual(readHistory(tempDir), []);
    } finally {
      teardown();
    }
  });
});
