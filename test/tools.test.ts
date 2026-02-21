/**
 * Tools: read_project_file and write_project_file execution.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPotionKitTools } from "../src/ai/tools.js";
import type { Tool } from "ai";

// Helper to run tool execute - uses the actual Tool type from ai SDK
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool<TInput = any, TOutput = any>(
  tool: Tool<TInput, TOutput>,
  args: TInput
): Promise<TOutput> {
  if (!tool.execute) {
    throw new Error("Tool has no execute function");
  }
  const result = tool.execute(args, {} as never);
  // Tool.execute can return TOutput or AsyncIterable<TOutput>
  // We only care about the direct promise case for these tests
  if (result && typeof result === "object" && Symbol.asyncIterator in result) {
    throw new Error("Streaming tool results not supported in tests");
  }
  return result as TOutput;
}

describe("tools", () => {
  describe("read_project_file", () => {
    it("reads existing file successfully", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        // Create a test file
        mkdirSync(join(dir, "src", "partials"), { recursive: true });
        writeFileSync(join(dir, "src", "partials", "head.hbs"), "<head><title>Test</title></head>");

        const result = await executeTool(tools.read_project_file, {
          path: "src/partials/head.hbs",
        });

        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.path, "src/partials/head.hbs");
        assert.strictEqual(result.content, "<head><title>Test</title></head>");
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("returns error for non-existent file", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.read_project_file, {
          path: "src/partials/nonexistent.hbs",
        });

        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.error, "File not found");
        assert.strictEqual(result.content, null);
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects paths with ..", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.read_project_file, { path: "../outside.txt" });

        assert.strictEqual(result.ok, false);
        assert.ok(result.error?.includes(".."));
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects paths with .env", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.read_project_file, { path: ".env" });

        assert.strictEqual(result.ok, false);
        assert.ok(result.error?.includes(".env"));
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects disallowed extensions", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.read_project_file, { path: "script.py" });

        assert.strictEqual(result.ok, false);
        assert.ok(result.error?.includes("Allowed extensions"));
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("allows .js files only under src/assets/js/", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        // Should reject .js at root
        const rootResult = await executeTool(tools.read_project_file, { path: "script.js" });
        assert.strictEqual(rootResult.ok, false);
        assert.ok(rootResult.error?.includes("src/assets/js/"));

        // Create allowed path
        mkdirSync(join(dir, "src", "assets", "js"), { recursive: true });
        writeFileSync(join(dir, "src", "assets", "js", "search.js"), "// search code");

        // Should allow .js under src/assets/js/
        const allowedResult = await executeTool(tools.read_project_file, {
          path: "src/assets/js/search.js",
        });
        assert.strictEqual(allowedResult.ok, true);
        assert.strictEqual(allowedResult.content, "// search code");
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("allows .gitignore at root", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        writeFileSync(join(dir, ".gitignore"), "node_modules/\n");

        const result = await executeTool(tools.read_project_file, { path: ".gitignore" });

        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.content, "node_modules/\n");
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("write_project_file", () => {
    it("creates file successfully", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.write_project_file, {
          path: "src/partials/navbar.hbs",
          content: "<nav>Navbar content</nav>",
        });

        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.path, "src/partials/navbar.hbs");

        // Verify file was created
        const filePath = join(dir, "src", "partials", "navbar.hbs");
        assert.strictEqual(existsSync(filePath), true);
        assert.strictEqual(readFileSync(filePath, "utf8"), "<nav>Navbar content</nav>");
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("overwrites existing file", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        // Create initial file
        mkdirSync(join(dir, "src"), { recursive: true });
        writeFileSync(join(dir, "src", "test.md"), "Old content");

        const result = await executeTool(tools.write_project_file, {
          path: "src/test.md",
          content: "New content",
        });

        assert.strictEqual(result.ok, true);
        assert.strictEqual(readFileSync(join(dir, "src", "test.md"), "utf8"), "New content");
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("creates parent directories as needed", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.write_project_file, {
          path: "src/deep/nested/path/file.scss",
          content: ".class { color: red; }",
        });

        assert.strictEqual(result.ok, true);
        assert.strictEqual(
          existsSync(join(dir, "src", "deep", "nested", "path", "file.scss")),
          true
        );
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects paths with ..", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.write_project_file, {
          path: "../outside.txt",
          content: "Malicious content",
        });

        assert.strictEqual(result.ok, false);
        assert.ok(result.error?.includes(".."));

        // Verify file was NOT created outside
        assert.strictEqual(existsSync(join(dir, "..", "outside.txt")), false);
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects .env files", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.write_project_file, {
          path: ".env",
          content: "SECRET=key",
        });

        assert.strictEqual(result.ok, false);
        assert.ok(result.error?.includes(".env"));
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects .js files outside src/assets/js/", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.write_project_file, {
          path: "script.js",
          content: "console.log('hello');",
        });

        assert.strictEqual(result.ok, false);
        assert.ok(result.error?.includes("src/assets/js/"));
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("allows writing .gitignore at root", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-tools-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();

        const result = await executeTool(tools.write_project_file, {
          path: ".gitignore",
          content: "dist/\nnode_modules/\n",
        });

        assert.strictEqual(result.ok, true);
        assert.strictEqual(readFileSync(join(dir, ".gitignore"), "utf8"), "dist/\nnode_modules/\n");
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
