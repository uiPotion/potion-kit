/**
 * Chat client using the Vercel AI SDK (https://ai-sdk.dev).
 * Config drives which provider we use; tools are built-in (search_potions, get_potion_spec, get_harold_project_info, fetch_doc_page, write_project_file).
 */
import { generateText, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenAI } from "@ai-sdk/openai";
import { Agent, fetch as undiciFetch } from "undici";
import type { LlmConfig } from "../config/index.js";
import { createPotionKitTools } from "./tools.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CreateChatOptions {
  /** Called when the model makes progress (e.g. step N of M, tool names). Use for user-facing progress. */
  onProgress?: (message: string) => void;
  /** Optional: build a user-friendly progress message from tool names (unique tools only). */
  progressMessageBuilder?: (toolNames: string[]) => string;
  /** Optional: called for error messages (e.g. no text from model). If not set, uses console.error. */
  onError?: (message: string) => void;
}

const REQUEST_TIMEOUT_MS = 900_000; // 15 minutes (multi-step tool use and reasoning models can be slow)
const MAX_STEPS = 8; // tool rounds per turn; lower to reduce token usage and stay under rate limits
const RATE_LIMIT_RETRY_DELAY_MS = 60_000; // wait 1 min before single retry on 429 (limit is per minute)

/** Custom fetch with long headers/body timeouts so slow APIs (e.g. Moonshot reasoning) don't hit undici defaults. */
const longTimeoutAgent = new Agent({
  headersTimeout: REQUEST_TIMEOUT_MS,
  bodyTimeout: REQUEST_TIMEOUT_MS,
});

function longTimeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const opts = { ...init, dispatcher: longTimeoutAgent };
  // Casts: undici and DOM fetch types differ; at runtime undici accepts URL, string, or Request
  return undiciFetch(
    input as Parameters<typeof undiciFetch>[0],
    opts as Record<string, unknown>
  ) as unknown as Promise<Response>;
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /rate limit|30,000 input tokens per minute|429/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const providerCreators = {
  openai: createOpenAI,
  moonshot: createMoonshotAI,
  anthropic: createAnthropic,
} as const;

function createModel(config: LlmConfig) {
  const create = providerCreators[config.provider];
  const options = {
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    fetch: longTimeoutFetch,
  };
  return create(options)(config.model);
}

/**
 * Create a chat that uses the AI SDK with the configured provider.
 * send(messages) uses the first message as system if role is 'system', rest as messages.
 * Tools (search_potions, get_potion_spec, get_harold_project_info, read_project_file, fetch_doc_page, write_project_file) are always available; multi-step so the model can call tools then reply.
 */
export function createChat(config: LlmConfig, options: CreateChatOptions = {}) {
  const { onProgress, progressMessageBuilder, onError } = options;
  const model = createModel(config);

  const tools = createPotionKitTools();

  return {
    async send(messages: ChatMessage[]): Promise<string> {
      const system = messages.find((m) => m.role === "system")?.content;
      const conversation = messages.filter((m) => m.role !== "system") as Array<{
        role: "user" | "assistant";
        content: string;
      }>;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      if (onProgress) onProgress("Sending to model…");

      const doRequest = async () =>
        generateText({
          model,
          system: system ?? undefined,
          messages: conversation,
          tools,
          stopWhen: stepCountIs(MAX_STEPS),
          maxOutputTokens: 16_384, // per-step output limit; "length" finish = hit this before replying
          maxRetries: 0, // we handle 429 ourselves with one delayed retry
          abortSignal: controller.signal,
          onStepFinish: (stepResult) => {
            if (onProgress) {
              const rawNames =
                (stepResult.toolCalls as Array<{ toolName: string }> | undefined)?.map(
                  (t) => t.toolName
                ) ?? [];
              const uniqueNames = [...new Set(rawNames)];
              const message = progressMessageBuilder
                ? progressMessageBuilder(uniqueNames)
                : uniqueNames.length > 0
                  ? `${uniqueNames.join(", ")}. Waiting for model…`
                  : "Model thinking…";
              onProgress(message);
            }
          },
        });

      type ChatResult = { text?: string; steps: Array<{ text?: string }>; finishReason: string };
      let result: ChatResult;
      try {
        result = (await doRequest()) as ChatResult;
      } catch (firstErr) {
        if (!isRateLimitError(firstErr)) throw firstErr;
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        result = (await doRequest()) as ChatResult;
      }

      try {
        const text = result.text?.trim() ?? "";
        if (text) return text;
        const fromSteps = result.steps
          .map((s) => (s as { text?: string }).text?.trim())
          .filter(Boolean) as string[];
        if (fromSteps.length) {
          const combined = fromSteps.join("\n\n");
          if (result.finishReason === "length") {
            return (
              combined +
              "\n\n[Reply was cut off by length limit; files may still have been created.]"
            );
          }
          return combined;
        }
        // No text in any step: step limit or length; give a helpful fallback so the user isn't left with nothing
        const stepsUsed = result.steps.length;
        const hitStepLimit = result.finishReason === "tool-calls" || stepsUsed >= MAX_STEPS;
        if (onError) {
          onError(
            hitStepLimit
              ? `Step limit reached (${stepsUsed} steps). The assistant may have created or updated files but didn't get to send a final message. Check your project and ask again if you want a summary or more changes.`
              : `potion-kit: model returned no text (finishReason: ${result.finishReason}, steps: ${stepsUsed}). Try asking again.`
          );
        } else {
          console.error(
            hitStepLimit
              ? `Step limit reached (${stepsUsed} steps). Check your project for changes.`
              : `potion-kit: model returned no text (finishReason: ${result.finishReason}, steps: ${stepsUsed}). Try asking again.`
          );
        }
        if (result.finishReason === "length") {
          return "The reply was cut off by the output length limit, but any file creation in earlier steps should have completed. Check your project for new files (e.g. under src/). You can run the build and ask for follow-up changes.";
        }
        if (hitStepLimit) {
          return "I hit the step limit while working on your project, so I didn't get to send a final message. Check your project for any files I created or updated (e.g. under src/). Run `npm run build` or `npm start` to try the site, and ask again if you want a summary or more changes.";
        }
        return "";
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            `Request timed out after ${REQUEST_TIMEOUT_MS / 60_000} minutes. Try again or use a shorter message.`
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
