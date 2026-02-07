/**
 * Chat client using the Vercel AI SDK (https://ai-sdk.dev).
 * Config drives which provider we use; tools are built-in (search_potions, get_potion_spec, get_harold_project_info, fetch_doc_page, write_project_file).
 */
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LlmConfig } from "../config/index.js";
import { createPotionKitTools } from "./tools.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CreateChatOptions {
  /** Called when the model makes progress (e.g. step N of M, tool names). Use for user-facing progress. */
  onProgress?: (message: string) => void;
  /** Optional: build a user-friendly progress message from step and tool names (unique tools only). */
  progressMessageBuilder?: (step: number, maxSteps: number, toolNames: string[]) => string;
  /** Optional: called for error messages (e.g. no text from model). If not set, uses console.error. */
  onError?: (message: string) => void;
}

const REQUEST_TIMEOUT_MS = 300_000; // 5 minutes (multi-step tool use can be slow)
const MAX_STEPS = 8; // enough for tool rounds (search, get spec, write files) plus a final text reply

/**
 * Create a chat that uses the AI SDK with the configured provider.
 * send(messages) uses the first message as system if role is 'system', rest as messages.
 * Tools (search_potions, get_potion_spec, get_harold_project_info, fetch_doc_page, write_project_file) are always available; multi-step so the model can call tools then reply.
 */
export function createChat(config: LlmConfig, options: CreateChatOptions = {}) {
  const { onProgress, progressMessageBuilder, onError } = options;
  const model =
    config.provider === "openai"
      ? createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })(config.model)
      : createAnthropic({ apiKey: config.apiKey })(config.model);

  const tools = createPotionKitTools();
  let stepCount = 0;

  return {
    async send(messages: ChatMessage[]): Promise<string> {
      stepCount = 0;
      const system = messages.find((m) => m.role === "system")?.content;
      const conversation = messages.filter((m) => m.role !== "system") as Array<{
        role: "user" | "assistant";
        content: string;
      }>;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const result = await generateText({
          model,
          system: system ?? undefined,
          messages: conversation,
          tools,
          maxSteps: MAX_STEPS,
          maxTokens: 16_384, // per-step output limit; "length" finish = hit this before replying
          abortSignal: controller.signal,
          onStepFinish: (stepResult) => {
            stepCount++;
            if (onProgress) {
              const rawNames =
                (stepResult.toolCalls as Array<{ toolName: string }> | undefined)?.map(
                  (t) => t.toolName
                ) ?? [];
              const uniqueNames = [...new Set(rawNames)];
              const message = progressMessageBuilder
                ? progressMessageBuilder(stepCount, MAX_STEPS, uniqueNames)
                : `Step ${stepCount} (of up to ${MAX_STEPS})${uniqueNames.length ? ` — ${uniqueNames.join(", ")}` : " — Thinking"}…`;
              onProgress(message);
            }
          },
        });
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
        // No text in any step: log why and give a helpful fallback when hit length limit
        const errMsg = `potion-kit: model returned no text (finishReason: ${result.finishReason}, steps: ${result.steps.length}). Try asking again.`;
        if (onError) onError(errMsg);
        else console.error(errMsg);
        if (result.finishReason === "length") {
          return "The reply was cut off by the output length limit, but any file creation in earlier steps should have completed. Check your project for new files (e.g. under src/). You can run the build and ask for follow-up changes.";
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
