/**
 * Summarize: fallback summary building and text utilities.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { stripPreviousSummaryPrefix, buildFallbackSummary } from "../src/ai/summarize.js";

describe("summarize", () => {
  describe("stripPreviousSummaryPrefix", () => {
    it("removes 'Previous condensed summary:' prefix", () => {
      const input = "Previous condensed summary:\nUser wants a blog with navbar.";
      const result = stripPreviousSummaryPrefix(input);
      assert.strictEqual(result, "User wants a blog with navbar.");
    });

    it("removes multiple occurrences of the prefix", () => {
      const input = "Previous condensed summary: Previous condensed summary:\nUser wants a blog.";
      const result = stripPreviousSummaryPrefix(input);
      assert.strictEqual(result, "User wants a blog.");
    });

    it("handles case-insensitive prefix matching", () => {
      const input = "previous condensed summary:\nUser wants a blog.";
      const result = stripPreviousSummaryPrefix(input);
      assert.strictEqual(result, "User wants a blog.");
    });

    it("returns original text when no prefix exists", () => {
      const input = "User wants a blog with navbar.";
      const result = stripPreviousSummaryPrefix(input);
      assert.strictEqual(result, "User wants a blog with navbar.");
    });

    it("trims whitespace from result", () => {
      const input = "Previous condensed summary:   \n  User wants a blog.  ";
      const result = stripPreviousSummaryPrefix(input);
      assert.strictEqual(result, "User wants a blog.");
    });

    it("handles empty string", () => {
      const result = stripPreviousSummaryPrefix("");
      assert.strictEqual(result, "");
    });
  });

  describe("buildFallbackSummary", () => {
    it("returns empty string for empty messages", () => {
      const result = buildFallbackSummary([]);
      assert.strictEqual(result, "");
    });

    it("condenses user messages to first sentence up to 100 chars", () => {
      const messages = [
        {
          role: "user" as const,
          content:
            "Build me a beautiful landing page with dark mode. Then add a navbar and footer.",
        },
      ];
      const result = buildFallbackSummary(messages);
      assert.ok(result.includes("User:"));
      assert.ok(result.includes("Build me a beautiful landing page with dark mode."));
      assert.ok(!result.includes("Then add a navbar"));
    });

    it("condenses assistant messages and strips markdown", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: "**I'll help you** build a landing page.\n\n```html\n<div>Example</div>\n```",
        },
      ];
      const result = buildFallbackSummary(messages);
      assert.ok(result.includes("Assistant:"));
      assert.ok(!result.includes("**"));
      assert.ok(!result.includes("```"));
    });

    it("handles previous summary in assistant message specially", () => {
      const messages = [
        {
          role: "assistant" as const,
          content:
            "Previous condensed summary:\nUser wants a blog with navbar and footer. Assistant created src/partials/head.hbs.",
        },
      ];
      const result = buildFallbackSummary(messages);
      assert.ok(result.includes("User wants a blog"));
    });

    it("uses last 10 messages only", () => {
      const messages = Array.from({ length: 15 }, (_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: `Message ${i + 1}`,
      }));
      const result = buildFallbackSummary(messages);
      // slice(-10) on 15 messages gives us messages 6-15 (indices 5-14)
      assert.ok(result.includes("Message 6"), "Should include Message 6");
      assert.ok(result.includes("Message 15"), "Should include Message 15");
      // Check that early messages (1-5) are NOT included by looking for whole message patterns
      // We check for "Message X\n" or end-of-string to avoid matching "Message 1" inside "Message 11"
      const lines = result.split(/\n|User: |Assistant: /);
      const messageNumbers = lines
        .filter((l) => l.startsWith("Message "))
        .map((l) => parseInt(l.replace("Message ", "")));
      assert.ok(!messageNumbers.includes(1), "Should not include Message 1");
      assert.ok(!messageNumbers.includes(5), "Should not include Message 5");
      assert.ok(messageNumbers.includes(6), "Should include Message 6");
      assert.ok(messageNumbers.includes(15), "Should include Message 15");
    });

    it("limits total length to 1600 characters", () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: "user" as const,
        content: `Very long user message number ${i + 1} with lots of content to exceed the limit.`,
      }));
      const result = buildFallbackSummary(messages);
      assert.ok(result.length <= 1600, `Expected <= 1600 chars, got ${result.length}`);
    });

    it("condenses markdown tables in assistant messages", () => {
      const messages = [
        {
          role: "assistant" as const,
          content:
            "| Header | Value |\n|--------|-------|\n| Name   | Test  |\n\nThis is the summary.",
        },
      ];
      const result = buildFallbackSummary(messages);
      // Table structure is simplified (header line removed, cells condensed)
      // The code doesn't remove ALL pipes but does condense the table significantly
      assert.ok(result.includes("This is the summary."), "Should include the summary text");
      // The table header line should be stripped
      assert.ok(!result.includes("--------"), "Should not include table separator line");
    });

    it("handles assistant message with 'Run it:' code block", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: "**Run it:**\n```bash\nnpm run build\n```\n\nThe build will create the output.",
        },
      ];
      const result = buildFallbackSummary(messages);
      assert.ok(!result.includes("npm run build"));
      assert.ok(!result.includes("```"));
    });

    it("combines user and assistant messages with separators", () => {
      const messages = [
        { role: "user" as const, content: "Create a navbar." },
        { role: "assistant" as const, content: "I've created the navbar partial." },
        { role: "user" as const, content: "Now add a footer." },
      ];
      const result = buildFallbackSummary(messages);
      assert.ok(result.includes("User:"));
      assert.ok(result.includes("Assistant:"));
    });

    it("strips bold markers from user messages", () => {
      const messages = [
        { role: "user" as const, content: "**Important:** Create a responsive layout." },
      ];
      const result = buildFallbackSummary(messages);
      assert.ok(!result.includes("**"));
      assert.ok(result.includes("Important:"));
    });
  });
});
