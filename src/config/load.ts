import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import type { LlmConfig, Provider } from "./types.js";

// Load .env from cwd (directory where the user ran potion-kit — works with global install).
// Does not override existing process.env, so exported vars (e.g. OPENAI_API_KEY) take precedence.
let envLoaded = false;
function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;
  loadEnv(); // dotenv default: path is process.cwd() + '/.env'
}

const CONFIG_DIR = join(homedir(), ".potion-kit");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const PROVIDER_ENV: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
};

/**
 * Load LLM config from:
 * 1. .env in current working directory (if present)
 * 2. Env vars: POTION_KIT_PROVIDER, POTION_KIT_MODEL, OPENAI_API_KEY / ANTHROPIC_API_KEY
 * 3. Optional file: ~/.potion-kit/config.json (provider, model only; never put keys there).
 *    See config.example.json in this package.
 */
export function loadLlmConfig(): LlmConfig | null {
  ensureEnvLoaded();
  const provider = (process.env.POTION_KIT_PROVIDER ?? readConfigFile().provider) as
    | Provider
    | undefined;
  const model = process.env.POTION_KIT_MODEL ?? readConfigFile().model;

  if (!provider || !["openai", "anthropic"].includes(provider)) {
    return null;
  }

  const apiKey = process.env[PROVIDER_ENV[provider]] ?? process.env.POTION_KIT_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    return null;
  }

  return {
    provider,
    model: model ?? DEFAULT_MODELS[provider],
    apiKey,
    baseUrl: process.env.POTION_KIT_BASE_URL || undefined,
  };
}

function readConfigFile(): { provider?: string; model?: string } {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const data = JSON.parse(raw) as { provider?: string; model?: string };
    return {
      provider: data.provider,
      model: data.model,
    };
  } catch {
    return {};
  }
}

export { CONFIG_DIR, CONFIG_FILE };
