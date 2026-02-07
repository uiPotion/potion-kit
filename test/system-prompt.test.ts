/**
 * System prompt: happy path — buildSystemPrompt combines rules, context, and catalog.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildSystemPrompt, POTION_KIT_RULES } from "../src/ai/system-prompt.js";

describe("system-prompt", () => {
  describe("buildSystemPrompt", () => {
    it("returns non-empty string containing rules and both context and catalog", () => {
      const haroldContext = "Harold context here.";
      const potionsCatalog = "Potions catalog here.";
      const result = buildSystemPrompt(haroldContext, potionsCatalog);
      assert.ok(result.length > 0);
      assert.ok(result.includes(POTION_KIT_RULES.trim()));
      assert.ok(result.includes(haroldContext));
      assert.ok(result.includes(potionsCatalog));
    });
  });
});
