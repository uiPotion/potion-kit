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

  console.error("potion-kit: missing LLM configuration.\n");
  console.error("Create a .env file in this directory (or set env vars) with:");
  console.error("  POTION_KIT_PROVIDER=openai   # or anthropic");
  console.error("  OPENAI_API_KEY=sk-...       # if provider is openai");
  console.error("  ANTHROPIC_API_KEY=...       # if provider is anthropic\n");
  if (!existsSync(envPath)) {
    console.error(`No .env found in ${cwd}.`);
    if (existsSync(examplePath)) {
      console.error(`Copy .env.example to .env:  cp .env.example .env`);
    } else {
      console.error("Add a .env file with the variables above.");
    }
  } else {
    console.error(`Found .env in ${cwd}; check POTION_KIT_PROVIDER and the matching API key.`);
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

function createProgressReporter(): {
  start: () => void;
  onProgress: CreateChatOptions["onProgress"];
  clear: () => void;
} {
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
  return {
    start: () => process.stdout.write("Thinking… (may take a minute when using tools)"),
    onProgress: (msg) => process.stdout.write("\r" + pad(msg, 72) + "\r"),
    clear: () => process.stdout.write("\r" + " ".repeat(72) + "\r"),
  };
}

async function runOneShot(cwd: string, config: LlmConfig, userMessage: string): Promise<void> {
  const systemPrompt = await getFullSystemPrompt();
  const progress = createProgressReporter();
  const chat = createChat(config, { onProgress: progress.onProgress });
  const history = readHistory(cwd);
  const message = userMessage || DEFAULT_MESSAGE;
  const messages = buildMessages(systemPrompt, history, message);

  try {
    progress.start();
    const reply = await chat.send(messages);
    progress.clear();
    const replyToSave = reply.trim() || "(No text reply from the model.)";
    writeHistory(cwd, [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: replyToSave },
    ]);
    if (reply.trim()) {
      console.log(reply);
    } else {
      console.log(
        "The model didn't return any text this time (it may have only run tools). Try rephrasing your request."
      );
    }
  } catch (err) {
    console.error("potion-kit: chat failed:", formatChatError(err));
    process.exit(1);
  }
}

async function runInteractive(cwd: string, config: LlmConfig): Promise<void> {
  const systemPrompt = await getFullSystemPrompt();
  const progress = createProgressReporter();
  const chat = createChat(config, { onProgress: progress.onProgress });
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

  console.log('Chat with the AI to build your site. Type "exit" or Ctrl+C to quit.\n');

  function prompt(): void {
    rl.question("You: ", async (line) => {
      const input = line.trim();
      if (!input || EXIT_COMMANDS.includes(input.toLowerCase())) {
        saveAndExit();
        return;
      }

      try {
        const messages = buildMessages(systemPrompt, history, input);
        progress.start();
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
          console.log("\n" + reply + "\n");
        } else {
          console.log(
            '\nThe model didn\'t return any text this time (it may have only run tools). Try asking again or rephrase, e.g. "What were we building?" or "Summarize our plan."\n'
          );
        }
      } catch (err) {
        console.error("potion-kit: chat failed:", formatChatError(err));
      }
      prompt();
    });
  }

  prompt();
}
