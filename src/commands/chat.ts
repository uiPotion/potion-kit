/**
 * Chat command: load config, build system prompt, send user message, print reply.
 * Conversation is persisted in .potion-kit/chat-history.json (project-scoped) so
 * you can chat over multiple runs and build the site iteratively.
 * - With no args: interactive mode (readline loop; type "exit" or Ctrl+C to quit).
 * - With a message: one-shot, then exit. Use `potion-kit clear` to start a new conversation.
 * Exits with clear error if .env / API keys are missing.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { loadLlmConfig, type LlmConfig } from "../config/index.js";
import { createChat, type ChatTurnTrace, type CreateChatOptions } from "../ai/client.js";
import { getFullSystemPrompt } from "../ai/system-prompt.js";
import {
  summarizeConversationWithRetry,
  buildFallbackSummary,
  stripPreviousSummaryPrefix,
  type SummarySource,
} from "../ai/summarize.js";
import { readHistory, readSummaryState, writeHistory, writeSummaryState } from "./chat-history.js";
import type { HistoryMessage } from "./chat-history.js";
import { buildMessages } from "./chat-messages.js";
import { cli, buildProgressMessage } from "../cli/formatting.js";
import { planSummaryUpdate, splitSummaryChunks } from "./summary-cache.js";
import { appendChatEvent } from "./chat-events.js";
import { guardAssistantReply } from "./reply-guard.js";

const DEFAULT_MESSAGE =
  "What can you help me build? I’d like to create a static site with Handlebars and the UIPotion components.";

const EXIT_COMMANDS = ["exit", "quit", "q"];

/** Default max conversation turns (user + assistant pairs) when not set in config. */
const DEFAULT_MAX_HISTORY_MESSAGES = 10;

function formatChatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not a chat model|v1\/chat\/completions|v1\/completions/i.test(msg)) {
    return (
      msg +
      "\n\nUse a chat model (e.g. gpt-5.2, gpt-4o), not a completion-only model. Set POTION_KIT_MODEL in .env or ./config.json."
    );
  }
  if (/rate limit|30,000 input tokens per minute/i.test(msg)) {
    return (
      msg +
      "\n\nWait a minute and try again. To use fewer tokens: run `potion-kit clear` to start a fresh conversation, or shorten your message."
    );
  }
  if (/abort|timeout/i.test(msg)) {
    return msg + "\n\nRerun your prompt; conversation history is kept, so continuing often works.";
  }
  return msg;
}

function printConfigError(): void {
  const cwd = process.cwd();
  const envPath = join(cwd, ".env");
  const examplePath = join(cwd, ".env.example");

  console.error(cli.error("potion-kit: missing LLM configuration.\n"));
  console.error(cli.error("Create a .env file in this directory (or set env vars) with:"));
  console.error(cli.error("  POTION_KIT_PROVIDER=openai   # or anthropic, moonshot"));
  console.error(cli.error("  OPENAI_API_KEY=sk-...       # if provider is openai"));
  console.error(cli.error("  ANTHROPIC_API_KEY=...       # if provider is anthropic"));
  console.error(cli.error("  MOONSHOT_API_KEY=...       # if provider is moonshot (Kimi)\n"));
  if (!existsSync(envPath)) {
    console.error(cli.error(`No .env found in ${cwd}.`));
    if (existsSync(examplePath)) {
      console.error(cli.error("Copy .env.example to .env:  cp .env.example .env"));
    } else {
      console.error(cli.error("Add a .env file with the variables above."));
    }
  } else {
    console.error(
      cli.error(`Found .env in ${cwd}; check POTION_KIT_PROVIDER and the matching API key.`)
    );
  }
  console.error("");
}

export async function runChat(messageParts: string[]): Promise<void> {
  const config = loadLlmConfig();
  if (!config) {
    printConfigError();
    process.exit(1);
  }

  const cwd = process.cwd();
  const hasMessage = messageParts.length > 0;
  const userMessage = hasMessage ? messageParts.join(" ").trim() : "";

  if (hasMessage) {
    await runOneShot(cwd, config, userMessage);
    return;
  }

  await runInteractive(cwd, config);
}

const DEFAULT_PROGRESS_TEXT = "Sending to model…";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴"];
const SPIN_INTERVAL_MS = 80;
const LINE_PAD = 80; // width to clear when redrawing

function createProgressReporter(): {
  start: () => void;
  onProgress: CreateChatOptions["onProgress"];
  progressMessageBuilder: CreateChatOptions["progressMessageBuilder"];
  clear: () => void;
} {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let currentMessage = DEFAULT_PROGRESS_TEXT;
  let frameIndex = 0;

  function tick(): void {
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    const line = cli.spinner(frame) + " " + cli.progress(currentMessage);
    const pad = " ".repeat(Math.max(0, LINE_PAD - (frame.length + 1 + currentMessage.length)));
    process.stdout.write("\r" + line + pad + "\r");
    frameIndex += 1;
  }

  const HIDE_CURSOR = "\x1b[?25l";
  const SHOW_CURSOR = "\x1b[?25h";

  return {
    start: () => {
      currentMessage = DEFAULT_PROGRESS_TEXT;
      frameIndex = 0;
      process.stdout.write(HIDE_CURSOR);
      intervalId = setInterval(tick, SPIN_INTERVAL_MS);
    },
    onProgress: (msg) => {
      currentMessage = msg;
    },
    progressMessageBuilder: buildProgressMessage,
    clear: () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      process.stdout.write("\r\x1b[2K\r" + SHOW_CURSOR);
    },
  };
}

async function runOneShot(cwd: string, config: LlmConfig, userMessage: string): Promise<void> {
  const systemPrompt = await getFullSystemPrompt();
  const progress = createProgressReporter();
  const { chat, traceState } = createTracedChat(config, progress);
  const history = readHistory(cwd);
  const message = userMessage || DEFAULT_MESSAGE;
  const maxHistory = config.maxHistoryMessages ?? DEFAULT_MAX_HISTORY_MESSAGES;
  const summaryResult = await getCachedOrFreshSummary(cwd, config, history, maxHistory, progress);

  const messages = buildMessages(systemPrompt, history, message, maxHistory, summaryResult.summary);

  try {
    console.log(cli.user("You: ") + message);
    const result = await sendTurnAndPersist({
      cwd,
      chat,
      progress,
      traceState,
      history,
      userMessage: message,
      messages,
      summarySource: summaryResult.source,
    });
    if (result.reply.trim()) {
      console.log("\n" + cli.separator());
      console.log(cli.agentLabel("Potion-kit:") + "\n");
      console.log(cli.agentReply(result.reply));
      if (result.guarded.guarded) {
        console.log("\n" + cli.intro(buildUnverifiedCompletionGuidance(result.trace)));
      }
    } else {
      console.log(
        cli.intro(
          "The model didn't return any text this time (it may have only run tools). Try rephrasing your request."
        )
      );
    }
  } catch (err) {
    console.error(cli.error("potion-kit: chat failed: " + formatChatError(err)));
    process.exit(1);
  }
}

async function runInteractive(cwd: string, config: LlmConfig): Promise<void> {
  const systemPrompt = await getFullSystemPrompt();
  const progress = createProgressReporter();
  const { chat, traceState } = createTracedChat(config, progress);
  let history: HistoryMessage[] = readHistory(cwd);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  function saveAndExit(): void {
    writeHistory(cwd, history);
    rl.close();
    process.exit(0);
  }

  process.on("SIGINT", () => {
    rl.close();
    writeHistory(cwd, history);
    process.exit(0);
  });

  console.log(cli.intro('Chat with the AI to build your site. Type "exit" or Ctrl+C to quit.\n'));

  function prompt(): void {
    rl.question(cli.user("You: "), async (line) => {
      const input = line.trim();
      if (!input || EXIT_COMMANDS.includes(input.toLowerCase())) {
        saveAndExit();
        return;
      }

      try {
        const maxHistory = config.maxHistoryMessages ?? DEFAULT_MAX_HISTORY_MESSAGES;
        const summaryResult = await getCachedOrFreshSummary(
          cwd,
          config,
          history,
          maxHistory,
          progress
        );
        const messages = buildMessages(
          systemPrompt,
          history,
          input,
          maxHistory,
          summaryResult.summary
        );
        const result = await sendTurnAndPersist({
          cwd,
          chat,
          progress,
          traceState,
          history,
          userMessage: input,
          messages,
          summarySource: summaryResult.source,
        });
        history = result.nextHistory;
        if (result.reply.trim()) {
          console.log("\n" + cli.separator());
          console.log(cli.agentLabel("Potion-kit:") + "\n");
          console.log(cli.agentReply(result.reply) + "\n");
          if (result.guarded.guarded) {
            console.log(cli.intro(buildUnverifiedCompletionGuidance(result.trace)) + "\n");
          }
        } else {
          console.log(
            "\n" +
              cli.intro(
                'The model didn\'t return any text this time (it may have only run tools). Try asking again or rephrase, e.g. "What were we building?" or "Summarize our plan."'
              ) +
              "\n"
          );
        }
      } catch (err) {
        console.error(cli.error("potion-kit: chat failed: " + formatChatError(err)));
      }
      prompt();
    });
  }

  prompt();
}

function normalizeTurnTrace(trace: ChatTurnTrace | null): ChatTurnTrace {
  if (trace) return trace;
  return {
    toolEvents: [],
    stepsUsed: 0,
    finishReason: "unknown",
  };
}

function createTracedChat(
  config: LlmConfig,
  progress: ReturnType<typeof createProgressReporter>
): { chat: ReturnType<typeof createChat>; traceState: { current: ChatTurnTrace | null } } {
  const traceState = { current: null as ChatTurnTrace | null };
  const chat = createChat(config, {
    onProgress: progress.onProgress,
    progressMessageBuilder: progress.progressMessageBuilder,
    onError: (msg) => console.error(cli.error(msg)),
    onTurnTrace: (trace) => {
      traceState.current = trace;
    },
  });
  return { chat, traceState };
}

async function sendTurnAndPersist(params: {
  cwd: string;
  chat: ReturnType<typeof createChat>;
  progress: ReturnType<typeof createProgressReporter>;
  traceState: { current: ChatTurnTrace | null };
  history: HistoryMessage[];
  userMessage: string;
  messages: ReturnType<typeof buildMessages>;
  summarySource: SummarySource;
}): Promise<{
  reply: string;
  guarded: ReturnType<typeof guardAssistantReply>;
  nextHistory: HistoryMessage[];
  trace: ChatTurnTrace;
}> {
  const { cwd, chat, progress, traceState, history, userMessage, messages, summarySource } = params;
  progress.start();
  try {
    traceState.current = null;
    const reply = await chat.send(messages);
    const guarded = guardAssistantReply(reply, traceState.current);
    const replyToSave = guarded.replyToSave || "(No text reply from the model.)";
    const nextHistory: HistoryMessage[] = [
      ...history,
      { role: "user" as const, content: userMessage },
      { role: "assistant" as const, content: replyToSave },
    ];
    writeHistory(cwd, nextHistory);
    const trace = normalizeTurnTrace(traceState.current);
    appendChatEvent(cwd, {
      timestamp: new Date().toISOString(),
      trace,
      hasVerifiedWrite: guarded.hasVerifiedWrite,
      replyWasGuarded: guarded.guarded,
      summarySource,
    });
    return { reply, guarded, nextHistory, trace };
  } finally {
    progress.clear();
  }
}

function buildUnverifiedCompletionGuidance(trace: ChatTurnTrace): string {
  const successfulWrites = trace.toolEvents.filter(
    (event) => event.toolName === "write_project_file" && event.ok === true
  ).length;
  const successfulReads = trace.toolEvents.filter(
    (event) => event.toolName === "read_project_file" && event.ok === true
  ).length;
  const recentTools = getRecentUniqueTools(trace, 3);
  const recentToolsText = recentTools.length > 0 ? recentTools.join(", ") : "none";

  return [
    `Unverified completion: this turn recorded ${successfulWrites} successful file writes (reads: ${successfulReads}; recent tools: ${recentToolsText}).`,
    'Ask the assistant: "Apply the requested fix now using write_project_file, then list each changed path."',
    "Then verify with npm run build (and npm test if available).",
  ].join(" ");
}

function getRecentUniqueTools(trace: ChatTurnTrace, limit: number): string[] {
  const out: string[] = [];
  for (let i = trace.toolEvents.length - 1; i >= 0; i -= 1) {
    const name = trace.toolEvents[i].toolName;
    if (!name || out.includes(name)) continue;
    out.push(name);
    if (out.length >= limit) break;
  }
  return out.reverse();
}

async function getCachedOrFreshSummary(
  cwd: string,
  config: LlmConfig,
  history: HistoryMessage[],
  maxHistory: number,
  progress: ReturnType<typeof createProgressReporter>
): Promise<{ summary: string | null; source: SummarySource }> {
  const plan = planSummaryUpdate(history, maxHistory, readSummaryState(cwd));
  if (plan.reuseCachedSummary) return { summary: plan.reuseCachedSummary, source: "cache-reuse" };

  if (plan.summarizeFrom >= plan.middleEnd) return { summary: null, source: "none" };
  const unsummarizedMiddle = history.slice(plan.summarizeFrom, plan.middleEnd);
  const chunks = splitSummaryChunks(unsummarizedMiddle);
  if (chunks.length === 0) return { summary: null, source: "none" };

  progress.start();
  progress.onProgress?.("Summarizing conversation…");
  try {
    let rollingSummary = plan.seedSummary ? stripPreviousSummaryPrefix(plan.seedSummary) : "";
    let processedChunks = 0;
    let usedPrimary = false;
    let usedRetry = false;
    let usedFallback = false;

    for (let i = 0; i < chunks.length; i += 1) {
      progress.onProgress?.(`Summarizing conversation… (${i + 1}/${chunks.length})`);
      const chunk = chunks[i];
      const summaryInput: HistoryMessage[] = rollingSummary
        ? [
            { role: "assistant", content: `Previous condensed summary:\n${rollingSummary}` },
            ...chunk,
          ]
        : chunk;

      let summarized = "";
      let chunkSource: SummarySource | null = null;
      try {
        const modelSummary = await summarizeConversationWithRetry(config, summaryInput);
        summarized = modelSummary.summary.trim();
        chunkSource = modelSummary.source;
      } catch (err) {
        summarized = "";
        chunkSource = null;
        console.warn(
          "Summarization request failed:",
          err instanceof Error ? err.message : String(err)
        );
      }

      const finalSummary = summarized || buildFallbackSummary(summaryInput);
      if (!finalSummary) {
        break;
      }

      rollingSummary = stripPreviousSummaryPrefix(finalSummary);
      processedChunks += 1;

      if (summarized) {
        if (chunkSource === "model-retry") usedRetry = true;
        else if (chunkSource === "model-primary") usedPrimary = true;
      } else {
        usedFallback = true;
      }
    }

    const finalSummary = rollingSummary || null;
    const finalSource: SummarySource = usedRetry
      ? "model-retry"
      : usedPrimary
        ? "model-primary"
        : usedFallback
          ? "fallback-local"
          : finalSummary
            ? "cache-reuse"
            : "none";

    if (!finalSummary) return { summary: null, source: finalSource };
    if (processedChunks !== chunks.length) {
      // Avoid advancing cache coverage unless every chunk was successfully summarized.
      return { summary: finalSummary, source: finalSource };
    }

    writeSummaryState(cwd, {
      summary: finalSummary,
      summarizedUntil: plan.middleEnd,
      firstUserMessage: plan.firstUserMessage,
      incrementalUpdates: plan.nextIncrementalUpdates,
    });
    return { summary: finalSummary, source: finalSource };
  } finally {
    progress.clear();
  }
}
