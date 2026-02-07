/**
 * Clear command: delete chat history for the current project so the next
 * chat run starts a new conversation.
 */
import { clearHistory } from "./chat-history.js";

export async function runClear(): Promise<void> {
  const cwd = process.cwd();
  clearHistory(cwd);
  console.log(
    "Chat history cleared for this project. The next chat will start a new conversation."
  );
}
