import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import type { LlmConfig, Provider } from "./types.js";

// Load .env from cwd (directory where the user ran potion-kit — works with global install).
// Does not override existing process.env, so exported vars (e.g. OPENAI_API_KEY) take precedence.
let envLoaded = false;
function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;
  loadEnv({ quiet: true }); // dotenv default: path is process.cwd() + '/.env'
}

const CONFIG_FILE = "config.json";

const PROVIDER_ENV: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-5.2",
  anthropic: "claude-sonnet-4-5",
  moonshot: "kimi-k2.5",
};

/**
 * Load LLM config with precedence:
 * 1. Existing env vars (shell/process)
 * 2. .env in current working directory (dotenv fills only missing env vars)
 * 3. Optional file: ./config.json in current working directory
 *    (provider, model, maxHistoryMessages, maxToolSteps, maxOutputTokens; never put keys there)
 * Env vars used: POTION_KIT_PROVIDER, POTION_KIT_MODEL, OPENAI_API_KEY / ANTHROPIC_API_KEY / MOONSHOT_API_KEY.
 *    See config.example.json in this package.
 */
export function loadLlmConfig(): LlmConfig | null {
  ensureEnvLoaded();
  const file = readConfigFile();
  const provider = (process.env.POTION_KIT_PROVIDER ?? file.provider) as Provider | undefined;
  const model = process.env.POTION_KIT_MODEL ?? file.model;

  if (!provider || !["openai", "anthropic", "moonshot"].includes(provider)) {
    return null;
  }

  const apiKey = process.env[PROVIDER_ENV[provider]] ?? process.env.POTION_KIT_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    return null;
  }

  const maxHistoryMessages = parseMaxHistoryMessages(
    process.env.POTION_KIT_MAX_HISTORY_MESSAGES ?? file.maxHistoryMessages
  );
  const maxToolSteps = parsePositiveInt(process.env.POTION_KIT_MAX_TOOL_STEPS ?? file.maxToolSteps);
  const maxOutputTokens = parsePositiveInt(
    process.env.POTION_KIT_MAX_OUTPUT_TOKENS ?? file.maxOutputTokens
  );

  return {
    provider,
    model: model ?? DEFAULT_MODELS[provider],
    apiKey,
    baseUrl: process.env.POTION_KIT_BASE_URL || undefined,
    maxHistoryMessages,
    maxToolSteps,
    maxOutputTokens,
  };
}

function readConfigFile(): {
  provider?: string;
  model?: string;
  maxHistoryMessages?: number;
  maxToolSteps?: number;
  maxOutputTokens?: number;
} {
  const configPath = join(process.cwd(), CONFIG_FILE);
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = readFileSync(configPath, "utf-8");
    const data = JSON.parse(raw) as {
      provider?: string;
      model?: string;
      maxHistoryMessages?: number;
      maxToolSteps?: number;
      maxOutputTokens?: number;
    };
    return {
      provider: data.provider,
      model: data.model,
      maxHistoryMessages: data.maxHistoryMessages,
      maxToolSteps: data.maxToolSteps,
      maxOutputTokens: data.maxOutputTokens,
    };
  } catch {
    return {};
  }
}

function parseMaxHistoryMessages(value: string | number | undefined): number | undefined {
  return parsePositiveInt(value);
}

export { CONFIG_FILE };

function parsePositiveInt(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (!Number.isFinite(n) || n < 1) return undefined;
  return n;
}
