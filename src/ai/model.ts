/**
 * Shared model creation for chat and summarization.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenAI } from "@ai-sdk/openai";
import { Agent, fetch as undiciFetch } from "undici";
import type { LlmConfig } from "../config/index.js";

const REQUEST_TIMEOUT_MS = 900_000;

const longTimeoutAgent = new Agent({
  headersTimeout: REQUEST_TIMEOUT_MS,
  bodyTimeout: REQUEST_TIMEOUT_MS,
});

function longTimeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const opts = { ...init, dispatcher: longTimeoutAgent };
  return undiciFetch(
    input as Parameters<typeof undiciFetch>[0],
    opts as Record<string, unknown>
  ) as unknown as Promise<Response>;
}

const providerCreators = {
  openai: createOpenAI,
  moonshot: createMoonshotAI,
  anthropic: createAnthropic,
} as const;

export function createModel(config: LlmConfig) {
  const create = providerCreators[config.provider];
  return create({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    fetch: longTimeoutFetch,
  })(config.model);
}
