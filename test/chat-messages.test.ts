/**
 * Chat message building: first + summary + last N + current.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildMessages } from "../src/commands/chat-messages.js";

const sys = "System prompt";

function msg(role: "user" | "assistant", content: string) {
  return { role, content };
}

describe("chat-messages", () => {
  it("empty history: system + current only", () => {
    const out = buildMessages(sys, [], "Hello", 10, null);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].role, "system");
    assert.ok((out[0].content as string).startsWith(sys));
    assert.ok((out[0].content as string).includes("## Reliability rule"));
    assert.strictEqual(out[1].role, "user");
    assert.strictEqual(out[1].content, "Hello");
  });

  it("short history: first + rest + current", () => {
    const h = [msg("user", "First"), msg("assistant", "Ok"), msg("user", "Next")];
    const out = buildMessages(sys, h, "Now", 10, null);
    assert.strictEqual(out[0].role, "system");
    assert.strictEqual((out[0].content as string).includes("First"), false);
    assert.strictEqual(out[1].content, "First");
    assert.strictEqual(out[2].content, "Ok");
    assert.strictEqual(out[3].content, "Next");
    assert.strictEqual(out[4].content, "Now");
  });

  it("long history (30 msgs, max 10): first + last 10 + current, summary in system", () => {
    const h = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", `m${i}`)
    );
    const summary = "User wanted X. Assistant did Y.";
    const out = buildMessages(sys, h, "Current", 10, summary);

    assert.strictEqual(out[0].role, "system");
    assert.ok((out[0].content as string).includes(summary));
    assert.ok((out[0].content as string).includes("## Prior conversation"));
    assert.ok((out[0].content as string).includes("## Reliability rule"));

    assert.strictEqual(out[1].content, "m0");
    assert.strictEqual(out[2].content, "m20");
    assert.strictEqual(out[3].content, "m22");
    assert.strictEqual(out[4].content, "m24");
    assert.strictEqual(out[5].content, "m26");
    assert.strictEqual(out[6].content, "m28");
    assert.strictEqual(out[7].content, "m29");
    assert.strictEqual(out[8].content, "Current");
    assert.strictEqual(out.length, 9);
  });
});
