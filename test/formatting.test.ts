/**
 * CLI formatting: happy path — buildProgressMessage maps tool names to labels.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildProgressMessage } from "../src/cli/formatting.js";

describe("formatting", () => {
  describe("buildProgressMessage", () => {
    it("maps known tool names to user-friendly labels", () => {
      assert.strictEqual(
        buildProgressMessage(1, 16, ["search_potions"]),
        "Searching UIPotion catalog…"
      );
      assert.strictEqual(
        buildProgressMessage(2, 16, ["get_potion_spec"]),
        "Fetching UIPotion spec…"
      );
      assert.strictEqual(
        buildProgressMessage(1, 16, ["get_harold_project_info"]),
        "HaroldJS: inspecting project…"
      );
      assert.strictEqual(
        buildProgressMessage(1, 16, ["write_project_file"]),
        "HaroldJS: writing files…"
      );
    });
    it("deduplicates and joins multiple tool names", () => {
      const msg = buildProgressMessage(1, 16, [
        "search_potions",
        "get_potion_spec",
        "search_potions",
      ]);
      assert.ok(msg.includes("Searching UIPotion catalog"));
      assert.ok(msg.includes("Fetching UIPotion spec"));
    });
  });
});
