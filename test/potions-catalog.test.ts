/**
 * Potions catalog: happy path — formatPotionsCatalog returns text with potion entries.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { formatPotionsCatalog, type PotionsIndex } from "../src/ai/context/potions-catalog.js";

describe("potions-catalog", () => {
  describe("formatPotionsCatalog", () => {
    it("returns catalog text containing category and potion id/name for non-empty index", () => {
      const index: PotionsIndex = {
        potions: [
          { id: "button", name: "Button", category: "components" },
          { id: "dashboard", name: "Dashboard", category: "layouts" },
        ],
      };
      const result = formatPotionsCatalog(index);
      assert.ok(result.length > 0);
      assert.ok(result.includes("UI POTIONS"));
      assert.ok(result.includes("components"));
      assert.ok(result.includes("layouts"));
      assert.ok(result.includes("button"));
      assert.ok(result.includes("Button"));
      assert.ok(result.includes("dashboard"));
      assert.ok(result.includes("Dashboard"));
    });
  });
});
