/**
 * Config load: happy path — returns config when provider and key are set.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { loadLlmConfig } from "../src/config/load.js";

describe("config", () => {
  const envBackup: Record<string, string | undefined> = {};

  function saveEnv(keys: string[]) {
    for (const k of keys) envBackup[k] = process.env[k];
  }

  function restoreEnv() {
    for (const k of Object.keys(envBackup)) {
      if (envBackup[k] === undefined) delete process.env[k];
      else process.env[k] = envBackup[k];
    }
  }

  describe("loadLlmConfig", () => {
    it("returns config when provider and key are set via env", () => {
      saveEnv(["POTION_KIT_PROVIDER", "POTION_KIT_MODEL", "OPENAI_API_KEY"]);
      try {
        process.env.POTION_KIT_PROVIDER = "openai";
        process.env.OPENAI_API_KEY = "sk-test-key";
        const config = loadLlmConfig();
        assert.ok(config !== null);
        assert.strictEqual(config!.provider, "openai");
        assert.strictEqual(config!.apiKey, "sk-test-key");
        assert.ok(config!.model);
      } finally {
        restoreEnv();
      }
    });
    it("uses POTION_KIT_API_KEY when set", () => {
      saveEnv(["POTION_KIT_PROVIDER", "OPENAI_API_KEY", "POTION_KIT_API_KEY"]);
      try {
        process.env.POTION_KIT_PROVIDER = "openai";
        process.env.POTION_KIT_API_KEY = "key-from-potion-env";
        delete process.env.OPENAI_API_KEY;
        const config = loadLlmConfig();
        assert.ok(config !== null);
        assert.strictEqual(config!.apiKey, "key-from-potion-env");
      } finally {
        restoreEnv();
      }
    });
  });
});
