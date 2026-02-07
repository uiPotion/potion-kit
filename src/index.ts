#!/usr/bin/env node

import { Command } from 'commander';
import { runChat } from './commands/chat.js';
import { runClear } from './commands/clear.js';

const program = new Command();

program
  .name('potion-kit')
  .description('CLI to build static sites with Handlebars, Markdown, and SCSS')
  .version('0.0.1');

program
  .command('chat [message...]', { isDefault: true })
  .description('Chat with the AI (default command). Conversation is kept in .potion-kit/ so you can build the site over multiple turns.')
  .action(async (messageParts: string[]) => {
    await runChat(messageParts ?? []);
  });

program
  .command('clear')
  .description('Clear chat history for this project (next chat starts a new conversation)')
  .action(async () => {
    await runClear();
  });

program.parse();
