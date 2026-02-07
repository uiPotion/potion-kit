/**
 * Endpoints: happy path — URL builders and allowed hosts return expected values.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  npmPackageLatestUrl,
  potionSpecUrl,
  isDocUrlAllowed,
  NPM_REGISTRY_BASE,
  UIPOTION_BASE,
} from "../src/ai/endpoints.js";

describe("endpoints", () => {
  describe("npmPackageLatestUrl", () => {
    it("returns npm registry latest URL for package name", () => {
      assert.strictEqual(
        npmPackageLatestUrl("harold-scripts"),
        `${NPM_REGISTRY_BASE}/harold-scripts/latest`
      );
    });
  });

  describe("potionSpecUrl", () => {
    it("returns UIPotion spec URL for category and id", () => {
      assert.strictEqual(
        potionSpecUrl("layouts", "dashboard"),
        `${UIPOTION_BASE}/potions/layouts/dashboard.json`
      );
      assert.strictEqual(
        potionSpecUrl("components", "button"),
        `${UIPOTION_BASE}/potions/components/button.json`
      );
    });
  });

  describe("isDocUrlAllowed", () => {
    it("allows haroldjs.com and www.haroldjs.com", () => {
      assert.strictEqual(isDocUrlAllowed("https://haroldjs.com/docs"), true);
      assert.strictEqual(isDocUrlAllowed("https://www.haroldjs.com/docs"), true);
    });
    it("allows uipotion.com and www.uipotion.com", () => {
      assert.strictEqual(isDocUrlAllowed("https://uipotion.com/about"), true);
      assert.strictEqual(isDocUrlAllowed("https://www.uipotion.com/potions"), true);
    });
  });
});
