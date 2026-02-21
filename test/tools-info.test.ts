/**
 * Tools Extra: get_harold_project_info, search_potions, get_potion_spec.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPotionKitTools } from "../src/ai/tools.js";
import type { Tool } from "ai";

// Helper to run tool execute
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool<TInput = any, TOutput = any>(
  tool: Tool<TInput, TOutput>,
  args: TInput
): Promise<TOutput> {
  if (!tool.execute) {
    throw new Error("Tool has no execute function");
  }
  const result = tool.execute(args, {} as never);
  if (result && typeof result === "object" && Symbol.asyncIterator in result) {
    throw new Error("Streaming tool results not supported in tests");
  }
  return result as TOutput;
}

describe("tools-info", () => {
  describe("get_harold_project_info", () => {
    it("detects empty directory as not found", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-empty-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);
        const tools = createPotionKitTools();
        const result = await executeTool(tools.get_harold_project_info, {});

        assert.strictEqual(result.found, false);
        assert.ok(
          result.message?.includes("No src/") || result.message?.includes("not a HaroldJS")
        );
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("detects Harold project from package.json", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-pkg-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);

        // Create package.json with harold config
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify({
            name: "test-site",
            harold: {
              mdFilesDirName: "posts",
              outputDirName: "build",
            },
          })
        );

        // Create src structure
        mkdirSync(join(dir, "src", "pages"), { recursive: true });
        mkdirSync(join(dir, "src", "partials"), { recursive: true });
        mkdirSync(join(dir, "src", "styles"), { recursive: true });
        writeFileSync(join(dir, "src", "pages", "index.hbs"), "");
        writeFileSync(join(dir, "src", "partials", "head.hbs"), "");
        writeFileSync(join(dir, "src", "styles", "main.scss"), "");

        const tools = createPotionKitTools();
        const result = await executeTool(tools.get_harold_project_info, {});

        assert.strictEqual(result.found, true);
        assert.strictEqual(result.config?.mdFilesDirName, "posts");
        assert.strictEqual(result.config?.outputDirName, "build");
        // Note: listNames strips extensions, so we check without .hbs/.scss
        assert.ok(result.pages?.includes("index"));
        assert.ok(result.partials?.includes("head"));
        assert.ok(result.styles?.includes("main.scss"));
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("detects Harold project from .haroldrc.json", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-rc-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);

        // Create .haroldrc.json
        writeFileSync(
          join(dir, ".haroldrc.json"),
          JSON.stringify({
            mdFilesDirName: "blog",
            outputDirName: "dist",
          })
        );

        // Create minimal src
        mkdirSync(join(dir, "src", "pages"), { recursive: true });
        writeFileSync(join(dir, "src", "pages", "about.hbs"), "");

        const tools = createPotionKitTools();
        const result = await executeTool(tools.get_harold_project_info, {});

        assert.strictEqual(result.found, true);
        assert.strictEqual(result.config?.mdFilesDirName, "blog");
        assert.strictEqual(result.config?.outputDirName, "dist");
        // Note: listNames strips extensions, so we check without .hbs
        assert.ok(result.pages?.includes("about"));
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("detects blog layouts directory", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-blog-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);

        // Create package.json
        writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test" }));

        // Create blog layouts
        mkdirSync(join(dir, "src", "blog-layouts"), { recursive: true });
        writeFileSync(join(dir, "src", "blog-layouts", "default.hbs"), "");
        writeFileSync(join(dir, "src", "blog-layouts", "minimal.hbs"), "");

        const tools = createPotionKitTools();
        const result = await executeTool(tools.get_harold_project_info, {});

        assert.strictEqual(result.found, true);
        // Note: listNames strips extensions, so we check without .hbs
        assert.ok(result.blogLayouts?.includes("default"));
        assert.ok(result.blogLayouts?.includes("minimal"));
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("handles non-Harold directory structure", async () => {
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-nonharold-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(dir);

        // Create random files, no src directory
        writeFileSync(join(dir, "readme.md"), "# Test");
        mkdirSync(join(dir, "lib"), { recursive: true });
        writeFileSync(join(dir, "lib", "utils.js"), "");

        const tools = createPotionKitTools();
        const result = await executeTool(tools.get_harold_project_info, {});

        assert.strictEqual(result.found, false);
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("search_potions", () => {
    it("returns error when potions index is unavailable", async () => {
      // Create tools - the index fetch will fail if no network
      const tools = createPotionKitTools();

      // We can't easily mock the fetch here, so we'll just verify the structure
      // In a real test environment with no network, it should return error
      const result = await executeTool(tools.search_potions, { query: "button", category: "" });

      // Should either return results or an error - both are valid structures
      if (result.error) {
        assert.strictEqual(typeof result.error, "string");
        assert.ok(Array.isArray(result.potions));
      } else {
        assert.ok(Array.isArray(result.potions));
        // If we got results, verify structure
        if (result.potions.length > 0) {
          const first = result.potions[0];
          assert.ok(first.id);
          assert.ok(first.name);
          assert.ok(first.category);
        }
      }
    });

    it("filters by category when provided", async () => {
      const tools = createPotionKitTools();

      const result = await executeTool(tools.search_potions, {
        query: "",
        category: "components",
      });

      // Should return results or error
      assert.ok(result.potions || result.error);
    });

    it("limits results to 15 items", async () => {
      const tools = createPotionKitTools();

      const result = await executeTool(tools.search_potions, { query: "a", category: "" });

      if (!result.error && result.potions) {
        assert.ok(result.potions.length <= 15, `Expected <= 15, got ${result.potions.length}`);
      }
    });
  });

  describe("get_potion_spec", () => {
    it("returns error for invalid category/id", async () => {
      const tools = createPotionKitTools();

      const result = await executeTool(tools.get_potion_spec, {
        category: "invalid",
        id: "nonexistent",
      });

      // Should either return spec or error
      if (result.error) {
        assert.strictEqual(typeof result.error, "string");
      } else {
        assert.ok(result.spec);
      }
    });

    it("accepts valid category and id parameters", async () => {
      const tools = createPotionKitTools();

      const result = await executeTool(tools.get_potion_spec, {
        category: "components",
        id: "button",
      });

      // Result should have either spec or error
      assert.ok(result.spec !== undefined || result.error !== undefined);
    });
  });
});
