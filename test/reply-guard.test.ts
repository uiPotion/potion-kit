/**
 * Reply guard: flag unverified completion claims.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { guardAssistantReply } from "../src/commands/reply-guard.js";

describe("reply-guard", () => {
  it("does not guard when verified write exists", () => {
    const out = guardAssistantReply("I've updated the styles.", {
      toolEvents: [{ toolName: "write_project_file", ok: true, path: "src/styles/main.scss" }],
      stepsUsed: 2,
      finishReason: "stop",
    });
    assert.strictEqual(out.guarded, false);
    assert.strictEqual(out.hasVerifiedWrite, true);
    assert.strictEqual(out.replyToSave, "I've updated the styles.");
  });

  it("flags unverified completion claim and keeps history clean", () => {
    const out = guardAssistantReply("I've updated the styles.", {
      toolEvents: [{ toolName: "read_project_file", ok: true, path: "src/styles/main.scss" }],
      stepsUsed: 2,
      finishReason: "stop",
    });
    assert.strictEqual(out.guarded, true);
    assert.strictEqual(out.hasVerifiedWrite, false);
    // replyToSave must be clean — no appended warning note in history
    assert.strictEqual(out.replyToSave, "I've updated the styles.");
  });

  it("does not guard non-completion replies", () => {
    const out = guardAssistantReply("Can you share the file path?", null);
    assert.strictEqual(out.guarded, false);
    assert.strictEqual(out.replyToSave, "Can you share the file path?");
  });

  it("does not guard on common words used in explanatory context", () => {
    const out = guardAssistantReply(
      "The component was updated in the previous session, but the config needs a tweak.",
      { toolEvents: [], stepsUsed: 1, finishReason: "stop" }
    );
    assert.strictEqual(out.guarded, false);
  });

  it("flags 'all done' with no verified write", () => {
    const out = guardAssistantReply("All done! The feature is wired up.", {
      toolEvents: [],
      stepsUsed: 1,
      finishReason: "stop",
    });
    assert.strictEqual(out.guarded, true);
    assert.strictEqual(out.replyToSave, "All done! The feature is wired up.");
  });

  it("flags 'Done! Updated...' pattern without verified write", () => {
    // This catches the case where assistant says "Done! Updated the hero code..."
    // but actually no write happened (e.g., due to tool failure or hallucination)
    const out = guardAssistantReply(
      "Done! Updated the hero code preview with real HaroldJS commands:",
      {
        toolEvents: [
          { toolName: "fetch_doc_page", ok: false },
          { toolName: "read_project_file", ok: true, path: "src/pages/index.hbs" },
        ],
        stepsUsed: 3,
        finishReason: "stop",
      }
    );
    assert.strictEqual(out.hasVerifiedWrite, false);
    assert.strictEqual(out.guarded, true);
    assert.strictEqual(
      out.replyToSave,
      "Done! Updated the hero code preview with real HaroldJS commands:"
    );
  });

  it("flags 'Finished! Created...' pattern without verified write", () => {
    const out = guardAssistantReply("Finished! Created the config file.", {
      toolEvents: [],
      stepsUsed: 1,
      finishReason: "stop",
    });
    assert.strictEqual(out.hasVerifiedWrite, false);
    assert.strictEqual(out.guarded, true);
  });
});
