import type { ChatTurnTrace } from "../ai/client.js";

// Matches first-person past-tense claims about having performed file write operations.
// Requires "I've" / "I have" before the action verb, OR standalone "Done!" / "Finished!"
// followed by past-tense verbs to catch claims like "Done! Updated the file..."
const COMPLETION_CLAIM_PATTERN =
  /\bI(?:'ve| have) (?:created|written|updated|implemented|fixed|added|built|generated|set up|modified|applied|refactored|deleted|removed|moved|renamed)\b|\ball done\b|\beverything(?:'s| is) (?:ready|in place|done|complete)\b|^(?:Done|Finished)!?\s+(?:updated|created|written|fixed|added|built|generated|modified|implemented|refactored|deleted|removed|moved|renamed)\b/i;

export interface GuardedReply {
  replyToSave: string;
  guarded: boolean;
  hasVerifiedWrite: boolean;
}

export function guardAssistantReply(reply: string, trace: ChatTurnTrace | null): GuardedReply {
  const trimmed = reply.trim();
  const hasVerifiedWrite =
    trace?.toolEvents.some(
      (event) => event.toolName === "write_project_file" && event.ok === true
    ) ?? false;

  const looksLikeCompletionClaim = COMPLETION_CLAIM_PATTERN.test(trimmed);
  const guarded = Boolean(trimmed) && !hasVerifiedWrite && looksLikeCompletionClaim;

  // replyToSave is always the clean reply — no appended notes so history stays uncontaminated.
  return { replyToSave: trimmed, guarded, hasVerifiedWrite };
}
