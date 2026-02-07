/**
 * Harold project detection: happy path — getHaroldProjectInfo returns structure for valid project.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getHaroldProjectInfo } from "../src/ai/harold-project.js";

describe("harold-project", () => {
  let tempDir: string;

  function setup() {
    tempDir = mkdtempSync(join(tmpdir(), "potion-kit-harold-"));
  }

  function teardown() {
    if (tempDir) rmSync(tempDir, { recursive: true });
  }

  describe("getHaroldProjectInfo", () => {
    it("returns found with config and file lists when src has partials, pages, styles", () => {
      setup();
      try {
        mkdirSync(join(tempDir, "src", "partials"), { recursive: true });
        mkdirSync(join(tempDir, "src", "pages"), { recursive: true });
        mkdirSync(join(tempDir, "src", "styles"), { recursive: true });
        writeFileSync(join(tempDir, "src", "partials", "head.hbs"), "", "utf-8");
        writeFileSync(join(tempDir, "src", "pages", "index.hbs"), "", "utf-8");
        writeFileSync(join(tempDir, "src", "styles", "main.scss"), "", "utf-8");

        const info = getHaroldProjectInfo(tempDir);

        assert.strictEqual(info.found, true);
        assert.ok(info.config);
        assert.strictEqual(info.config?.mdFilesDirName, "posts");
        assert.strictEqual(info.config?.outputDirName, "build");
        assert.deepStrictEqual(info.partials, ["head"]);
        assert.deepStrictEqual(info.pages, ["index"]);
        assert.ok(info.styles?.includes("main.scss"));
      } finally {
        teardown();
      }
    });
  });
});
