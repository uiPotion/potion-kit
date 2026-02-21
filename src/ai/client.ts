/**
 * Chat client using the Vercel AI SDK (https://ai-sdk.dev).
 * Config drives which provider we use; tools are built-in (search_potions, get_potion_spec, get_harold_project_info, fetch_doc_page, write_project_file).
 */
import { generateText, stepCountIs } from "ai";
import type { LlmConfig } from "../config/index.js";
import { createModel } from "./model.js";
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
  /** Optional: structured trace of tools used in the current turn. */
  onTurnTrace?: (trace: ChatTurnTrace) => void;
}

export interface ChatToolEvent {
  toolName: string;
  ok: boolean;
  path?: string;
  error?: string;
}

export interface ChatTurnTrace {
  toolEvents: ChatToolEvent[];
  stepsUsed: number;
  finishReason: string;
}

const REQUEST_TIMEOUT_MS = 900_000; // 15 minutes (multi-step tool use and reasoning models can be slow)
const DEFAULT_MAX_STEPS = 16; // tool rounds per turn; higher limit for longer multi-tool flows
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384; // per-turn output limit
const RATE_LIMIT_RETRY_DELAY_MS = 60_000; // wait 1 min before single retry on 429 (limit is per minute)

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /rate limit|30,000 input tokens per minute|429/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a chat that uses the AI SDK with the configured provider.
 * send(messages) uses the first message as system if role is 'system', rest as messages.
 * Tools (search_potions, get_potion_spec, get_harold_project_info, read_project_file, fetch_doc_page, write_project_file) are always available; multi-step so the model can call tools then reply.
 */
export function createChat(config: LlmConfig, options: CreateChatOptions = {}) {
  const { onProgress, progressMessageBuilder, onError, onTurnTrace } = options;
  const model = createModel(config);
  const maxToolSteps = config.maxToolSteps ?? DEFAULT_MAX_STEPS;
  const maxOutputTokens = config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const tools = createPotionKitTools();

  return {
    async send(messages: ChatMessage[]): Promise<string> {
      const toolEvents: ChatToolEvent[] = [];
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
          stopWhen: stepCountIs(maxToolSteps),
          maxOutputTokens, // per-turn output limit; "length" finish = hit this before replying
          maxRetries: 0, // we handle 429 ourselves with one delayed retry
          abortSignal: controller.signal,
          onStepFinish: (stepResult) => {
            toolEvents.push(...extractToolEvents(stepResult));
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
        onTurnTrace?.({
          toolEvents,
          stepsUsed: result.steps.length,
          finishReason: result.finishReason,
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
        // No text in any step: step limit or length; give a helpful fallback so the user isn't left with nothing
        const stepsUsed = result.steps.length;
        const hitStepLimit = result.finishReason === "tool-calls" || stepsUsed >= maxToolSteps;
        if (onError) {
          onError(
            hitStepLimit
              ? `Step limit reached (${stepsUsed}/${maxToolSteps} steps). The assistant may have created or updated files but didn't get to send a final message. Check your project and ask again if you want a summary or more changes.`
              : `potion-kit: model returned no text (finishReason: ${result.finishReason}, steps: ${stepsUsed}). Try asking again.`
          );
        } else {
          console.error(
            hitStepLimit
              ? `Step limit reached (${stepsUsed}/${maxToolSteps} steps). Check your project for changes.`
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

function extractToolEvents(stepResult: unknown): ChatToolEvent[] {
  const step = stepResult as {
    toolCalls?: Array<{ toolName?: unknown; toolCallId?: unknown }>;
    toolResults?: Array<{
      toolName?: unknown;
      toolCallId?: unknown;
      /** AI SDK v6: tool return value */
      output?: unknown;
      /** Legacy / stream shape */
      result?: unknown;
      isError?: unknown;
    }>;
  };
  const calls = Array.isArray(step.toolCalls) ? step.toolCalls : [];
  const results = Array.isArray(step.toolResults) ? step.toolResults : [];

  // No calls recorded — read events directly from results (some SDK versions omit toolCalls).
  if (calls.length === 0) {
    return results.map((r) =>
      parseToolEvent(typeof r.toolName === "string" ? r.toolName : "unknown_tool", r)
    );
  }

  return calls.map((call) => {
    const toolName = typeof call.toolName === "string" ? call.toolName : "unknown_tool";
    const matched = results.find(
      (r) =>
        call.toolCallId != null &&
        r.toolCallId != null &&
        String(call.toolCallId) === String(r.toolCallId)
    );
    return parseToolEvent(toolName, matched);
  });
}

function parseToolEvent(
  toolName: string,
  result: { output?: unknown; result?: unknown; isError?: unknown } | undefined
): ChatToolEvent {
  if (!result) return { toolName, ok: false };

  // AI SDK sets isError on tool result entries (e.g. stream path).
  if (typeof result.isError === "boolean") return { toolName, ok: !result.isError };

  // AI SDK v6 uses .output for the tool return value; fallback to .result for other shapes.
  const raw = result.output !== undefined ? result.output : result.result;
  const payload = raw && typeof raw === "object" ? raw : null;
  if (payload) {
    const p = payload as { ok?: unknown; path?: unknown };
    // Tools like write_project_file/read_project_file return { ok: true|false }; others return e.g. { spec }, { potions }.
    const ok = typeof p.ok === "boolean" ? p.ok : true;
    const path = typeof p.path === "string" ? p.path : undefined;
    return { toolName, ok, path };
  }

  return { toolName, ok: raw !== undefined };
}
