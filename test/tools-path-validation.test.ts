/**
 * Tools: happy path — read and write allowed project files.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPotionKitTools } from "../src/ai/tools.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopOptions = { toolCallId: "test", messages: [] } as any;

describe("tools", () => {
  let tempDir: string;
  let originalCwd: string;

  function setup() {
    tempDir = mkdtempSync(join(tmpdir(), "potion-kit-project-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  }

  function teardown() {
    if (originalCwd) process.chdir(originalCwd);
    if (tempDir) rmSync(tempDir, { recursive: true });
  }

  describe("read_project_file", () => {
    it("returns content for allowed path when file exists", async () => {
      setup();
      try {
        const tools = createPotionKitTools();
        mkdirSync(join(tempDir, "src", "pages"), { recursive: true });
        writeFileSync(join(tempDir, "src", "pages", "index.hbs"), "hello", "utf-8");
        const out = await tools.read_project_file.execute(
          { path: "src/pages/index.hbs" },
          noopOptions
        );
        assert.strictEqual(out.ok, true);
        assert.strictEqual((out as { content: string }).content, "hello");
      } finally {
        teardown();
      }
    });
  });

  describe("write_project_file", () => {
    it("creates file for allowed path", async () => {
      setup();
      try {
        const tools = createPotionKitTools();
        const out = await tools.write_project_file.execute(
          { path: "src/partials/head.hbs", content: '<meta charset="utf-8">' },
          noopOptions
        );
        assert.strictEqual(out.ok, true);
        const { readFileSync } = await import("node:fs");
        const content = readFileSync(join(tempDir, "src", "partials", "head.hbs"), "utf-8");
        assert.strictEqual(content, '<meta charset="utf-8">');
      } finally {
        teardown();
      }
    });
  });
});
