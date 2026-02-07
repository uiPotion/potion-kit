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
import { createChat, type CreateChatOptions } from "../ai/client.js";
import { getFullSystemPrompt } from "../ai/system-prompt.js";
import type { ChatMessage } from "../ai/client.js";
import { readHistory, writeHistory } from "./chat-history.js";
import type { HistoryMessage } from "./chat-history.js";
import { cli, buildProgressMessage } from "../cli/formatting.js";

const DEFAULT_MESSAGE =
  "What can you help me build? I’d like to create a static site with Handlebars and the UI Potion components.";

const EXIT_COMMANDS = ["exit", "quit", "q"];

function formatChatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not a chat model|v1\/chat\/completions|v1\/completions/i.test(msg)) {
    return (
      msg +
      "\n\nUse a chat model (e.g. gpt-4o-mini, gpt-4o), not a completion-only model. Set POTION_KIT_MODEL in .env or ~/.potion-kit/config.json."
    );
  }
  return msg;
}

function printConfigError(): void {
  const cwd = process.cwd();
  const envPath = join(cwd, ".env");
  const examplePath = join(cwd, ".env.example");

  console.error(cli.error("potion-kit: missing LLM configuration.\n"));
  console.error(cli.error("Create a .env file in this directory (or set env vars) with:"));
  console.error(cli.error("  POTION_KIT_PROVIDER=openai   # or anthropic"));
  console.error(cli.error("  OPENAI_API_KEY=sk-...       # if provider is openai"));
  console.error(cli.error("  ANTHROPIC_API_KEY=...       # if provider is anthropic\n"));
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

function buildMessages(
  systemPrompt: string,
  history: HistoryMessage[],
  userMessage: string
): ChatMessage[] {
  const conversation = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];
  return [{ role: "system", content: systemPrompt }, ...conversation];
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

const DEFAULT_PROGRESS_TEXT = "Thinking… (may take a minute when using tools)";
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
    progressMessageBuilder: (step, max, toolNames) => buildProgressMessage(step, max, toolNames),
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
  const chat = createChat(config, {
    onProgress: progress.onProgress,
    progressMessageBuilder: progress.progressMessageBuilder,
    onError: (msg) => console.error(cli.error(msg)),
  });
  const history = readHistory(cwd);
  const message = userMessage || DEFAULT_MESSAGE;
  const messages = buildMessages(systemPrompt, history, message);

  try {
    console.log(cli.user("You: ") + message);
    progress.start();
    try {
      const reply = await chat.send(messages);
      progress.clear();
      const replyToSave = reply.trim() || "(No text reply from the model.)";
      writeHistory(cwd, [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: replyToSave },
      ]);
      if (reply.trim()) {
        console.log("\n" + cli.separator());
        console.log(cli.agentLabel("Potion-kit:") + "\n");
        console.log(cli.agentReply(reply));
      } else {
        console.log(
          cli.intro(
            "The model didn't return any text this time (it may have only run tools). Try rephrasing your request."
          )
        );
      }
    } finally {
      progress.clear();
    }
  } catch (err) {
    console.error(cli.error("potion-kit: chat failed: " + formatChatError(err)));
    process.exit(1);
  }
}

async function runInteractive(cwd: string, config: LlmConfig): Promise<void> {
  const systemPrompt = await getFullSystemPrompt();
  const progress = createProgressReporter();
  const chat = createChat(config, {
    onProgress: progress.onProgress,
    progressMessageBuilder: progress.progressMessageBuilder,
    onError: (msg) => console.error(cli.error(msg)),
  });
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
        const messages = buildMessages(systemPrompt, history, input);
        progress.start();
        try {
          const reply = await chat.send(messages);
          progress.clear();
          const replyToSave = reply.trim() || "(No text reply from the model.)";
          history = [
            ...history,
            { role: "user", content: input },
            { role: "assistant", content: replyToSave },
          ];
          writeHistory(cwd, history);
          if (reply.trim()) {
            console.log("\n" + cli.separator());
            console.log(cli.agentLabel("Potion-kit:") + "\n");
            console.log(cli.agentReply(reply) + "\n");
          } else {
            console.log(
              "\n" +
                cli.intro(
                  'The model didn\'t return any text this time (it may have only run tools). Try asking again or rephrase, e.g. "What were we building?" or "Summarize our plan."'
                ) +
                "\n"
            );
          }
        } finally {
          progress.clear();
        }
      } catch (err) {
        console.error(cli.error("potion-kit: chat failed: " + formatChatError(err)));
      }
      prompt();
    });
  }

  prompt();
}
