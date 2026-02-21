/**
 * Config load: happy path — returns config when provider and key are set.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
    it("returns config when provider is moonshot and MOONSHOT_API_KEY is set", () => {
      saveEnv(["POTION_KIT_PROVIDER", "POTION_KIT_MODEL", "MOONSHOT_API_KEY"]);
      try {
        process.env.POTION_KIT_PROVIDER = "moonshot";
        process.env.MOONSHOT_API_KEY = "moonshot-test-key";
        const config = loadLlmConfig();
        assert.ok(config !== null);
        assert.strictEqual(config!.provider, "moonshot");
        assert.strictEqual(config!.apiKey, "moonshot-test-key");
        assert.ok(config!.model === "kimi-k2.5" || config!.model);
      } finally {
        restoreEnv();
      }
    });
    it("reads provider/model/maxHistoryMessages from local config.json", () => {
      saveEnv([
        "POTION_KIT_PROVIDER",
        "POTION_KIT_MODEL",
        "POTION_KIT_MAX_HISTORY_MESSAGES",
        "POTION_KIT_MAX_TOOL_STEPS",
        "POTION_KIT_MAX_OUTPUT_TOKENS",
        "OPENAI_API_KEY",
      ]);
      const originalCwd = process.cwd();
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-config-"));
      try {
        process.chdir(dir);
        writeFileSync(
          join(dir, "config.json"),
          JSON.stringify({
            provider: "openai",
            model: "gpt-5.2",
            maxHistoryMessages: 7,
            maxToolSteps: 9,
            maxOutputTokens: 5000,
          }),
          "utf-8"
        );
        process.env.OPENAI_API_KEY = "sk-test-key";
        delete process.env.POTION_KIT_PROVIDER;
        delete process.env.POTION_KIT_MODEL;
        delete process.env.POTION_KIT_MAX_HISTORY_MESSAGES;
        delete process.env.POTION_KIT_MAX_TOOL_STEPS;
        delete process.env.POTION_KIT_MAX_OUTPUT_TOKENS;

        const config = loadLlmConfig();
        assert.ok(config !== null);
        assert.strictEqual(config!.provider, "openai");
        assert.strictEqual(config!.model, "gpt-5.2");
        assert.strictEqual(config!.maxHistoryMessages, 7);
        assert.strictEqual(config!.maxToolSteps, 9);
        assert.strictEqual(config!.maxOutputTokens, 5000);
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
        restoreEnv();
      }
    });

    it("env vars override local config for optional limits", () => {
      saveEnv([
        "POTION_KIT_PROVIDER",
        "POTION_KIT_MAX_TOOL_STEPS",
        "POTION_KIT_MAX_OUTPUT_TOKENS",
        "OPENAI_API_KEY",
      ]);
      const originalCwd = process.cwd();
      const dir = mkdtempSync(join(tmpdir(), "potion-kit-config-"));
      try {
        process.chdir(dir);
        writeFileSync(
          join(dir, "config.json"),
          JSON.stringify({ provider: "openai", maxToolSteps: 9, maxOutputTokens: 5000 }),
          "utf-8"
        );
        process.env.OPENAI_API_KEY = "sk-test-key";
        process.env.POTION_KIT_PROVIDER = "openai";
        process.env.POTION_KIT_MAX_TOOL_STEPS = "7";
        process.env.POTION_KIT_MAX_OUTPUT_TOKENS = "3000";

        const config = loadLlmConfig();
        assert.ok(config !== null);
        assert.strictEqual(config!.maxToolSteps, 7);
        assert.strictEqual(config!.maxOutputTokens, 3000);
      } finally {
        process.chdir(originalCwd);
        rmSync(dir, { recursive: true, force: true });
        restoreEnv();
      }
    });
  });
});
