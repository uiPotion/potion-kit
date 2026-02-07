#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { runChat } from "./commands/chat.js";
import { runClear } from "./commands/clear.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Built output is dist/index.js → package.json is one level up
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as {
  version?: string;
};

const program = new Command();

program
  .name("potion-kit")
  .description("CLI to build static sites with Handlebars, Markdown, and SCSS")
  .version(pkg.version ?? "0.0.0");

program
  .command("chat [message...]", { isDefault: true })
  .description(
    "Chat with the AI (default command). Conversation is kept in .potion-kit/ so you can build the site over multiple turns."
  )
  .action(async (messageParts: string[]) => {
    await runChat(messageParts ?? []);
  });

program
  .command("clear")
  .description("Clear chat history for this project (next chat starts a new conversation)")
  .action(async () => {
    await runClear();
  });

program.parse();
