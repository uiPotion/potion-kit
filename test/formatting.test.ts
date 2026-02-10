/**
 * CLI formatting: buildProgressMessage tool labels and "Waiting for model".
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildProgressMessage } from "../src/cli/formatting.js";

describe("formatting", () => {
  describe("buildProgressMessage", () => {
    it("includes tool label and 'Waiting for model' when tools ran", () => {
      const msg = buildProgressMessage(1, 16, ["search_potions"]);
      assert.ok(msg.includes("Searching UIPotion catalog"));
      assert.ok(msg.includes("Waiting for model"));
    });
    it("maps known tool names to user-friendly labels", () => {
      assert.strictEqual(
        buildProgressMessage(1, 8, ["search_potions"]),
        "Searching UIPotion catalog. Waiting for model…"
      );
      assert.strictEqual(
        buildProgressMessage(2, 8, ["get_potion_spec"]),
        "Fetching UIPotion spec. Waiting for model…"
      );
      assert.strictEqual(
        buildProgressMessage(1, 8, ["get_harold_project_info"]),
        "HaroldJS: inspecting project. Waiting for model…"
      );
      assert.strictEqual(
        buildProgressMessage(1, 8, ["write_project_file"]),
        "HaroldJS: writing files. Waiting for model…"
      );
    });
    it("returns 'Model thinking' when no tools in step", () => {
      assert.strictEqual(buildProgressMessage(2, 8, []), "Model thinking…");
    });
    it("deduplicates and joins multiple tool names", () => {
      const msg = buildProgressMessage(1, 16, [
        "search_potions",
        "get_potion_spec",
        "search_potions",
      ]);
      assert.ok(msg.includes("Searching UIPotion catalog"));
      assert.ok(msg.includes("Fetching UIPotion spec"));
      assert.ok(msg.includes("Waiting for model"));
    });
  });
});
