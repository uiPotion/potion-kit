/**
 * Summary cache planning: rolling cursor updates and chunk splitting.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  MAX_INCREMENTAL_SUMMARY_UPDATES,
  planSummaryUpdate,
  splitSummaryChunks,
} from "../src/commands/summary-cache.js";
import type { HistoryMessage } from "../src/commands/chat-history.js";

function history(count: number): HistoryMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `m${i}`,
  }));
}

describe("summary-cache", () => {
  it("returns no summary work when history does not exceed tail size", () => {
    const plan = planSummaryUpdate(history(11), 10, null);
    assert.strictEqual(plan.reuseCachedSummary, null);
    assert.strictEqual(plan.summarizeFrom, 1);
    assert.strictEqual(plan.seedSummary, null);
    assert.strictEqual(plan.nextIncrementalUpdates, 0);
  });

  it("reuses cached summary when it already covers full middle range", () => {
    const h = history(16);
    const plan = planSummaryUpdate(h, 10, {
      summary: "cached",
      summarizedUntil: 6,
      firstUserMessage: "m0",
      incrementalUpdates: 3,
    });
    assert.strictEqual(plan.reuseCachedSummary, "cached");
    assert.strictEqual(plan.summarizeFrom, 6);
    assert.strictEqual(plan.seedSummary, "cached");
    assert.strictEqual(plan.nextIncrementalUpdates, 3);
  });

  it("incrementally extends from summarizedUntil before drift threshold", () => {
    const h = history(16);
    const plan = planSummaryUpdate(h, 10, {
      summary: "older summary",
      summarizedUntil: 4,
      firstUserMessage: "m0",
      incrementalUpdates: 2,
    });
    assert.strictEqual(plan.reuseCachedSummary, null);
    assert.strictEqual(plan.summarizeFrom, 4);
    assert.strictEqual(plan.middleEnd, 6);
    assert.strictEqual(plan.seedSummary, "older summary");
    assert.strictEqual(plan.nextIncrementalUpdates, 3);
  });

  it("forces full middle re-summary at incremental update threshold", () => {
    const h = history(16);
    const plan = planSummaryUpdate(h, 10, {
      summary: "older summary",
      summarizedUntil: 4,
      firstUserMessage: "m0",
      incrementalUpdates: MAX_INCREMENTAL_SUMMARY_UPDATES,
    });
    assert.strictEqual(plan.reuseCachedSummary, null);
    assert.strictEqual(plan.summarizeFrom, 1);
    assert.strictEqual(plan.middleEnd, 6);
    assert.strictEqual(plan.seedSummary, null);
    assert.strictEqual(plan.nextIncrementalUpdates, 0);
  });

  it("falls back to full refresh when first user message changed", () => {
    const h = history(16);
    const plan = planSummaryUpdate(h, 10, {
      summary: "older summary",
      summarizedUntil: 5,
      firstUserMessage: "different first prompt",
      incrementalUpdates: 1,
    });
    assert.strictEqual(plan.reuseCachedSummary, null);
    assert.strictEqual(plan.summarizeFrom, 1);
    assert.strictEqual(plan.seedSummary, null);
    assert.strictEqual(plan.nextIncrementalUpdates, 0);
  });

  it("splits unsummarized messages into contiguous chunks", () => {
    const messages = history(7); // m0..m6
    const chunks = splitSummaryChunks(messages, 3, 10_000);
    assert.deepStrictEqual(
      chunks.map((chunk) => chunk.length),
      [3, 3, 1]
    );
    assert.deepStrictEqual(
      chunks.flat().map((m) => m.content),
      messages.map((m) => m.content)
    );
  });

  it("keeps oversized single messages without dropping them", () => {
    const messages: HistoryMessage[] = [
      { role: "user", content: "x".repeat(200) },
      { role: "assistant", content: "ok" },
    ];
    const chunks = splitSummaryChunks(messages, 10, 50);
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].length, 1);
    assert.strictEqual(chunks[0][0].content.length, 200);
    assert.strictEqual(chunks[1].length, 1);
    assert.strictEqual(chunks[1][0].content, "ok");
  });
});
