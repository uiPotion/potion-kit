/**
 * fetchDocPage: allowlist, HTML/JSON parsing, and truncation behavior.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { fetchDocPage } from "../src/ai/fetch-doc.js";

type FetchLike = typeof fetch;

describe("fetch-doc", () => {
  const originalFetch = globalThis.fetch as FetchLike;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects invalid URLs", async () => {
    const res = await fetchDocPage("not-a-url");
    assert.deepStrictEqual(res, { ok: false, error: "Invalid URL" });
  });

  it("rejects non-allowlisted hosts", async () => {
    const res = await fetchDocPage("https://example.com/page");
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.ok(res.error.includes("URL must be from haroldjs.com or uipotion.com"));
    }
  });

  it("parses HTML to plain text and extracts title", async () => {
    globalThis.fetch = (async () => {
      const html = `<!doctype html>
      <html>
        <head><title>Docs - Hello</title></head>
        <body>
          <script>ignore me</script>
          <style>.x{color:red}</style>
          <h1>Hello</h1>
          <p>World &amp; friends</p>
        </body>
      </html>`;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as FetchLike;

    const res = await fetchDocPage("https://haroldjs.com/docs/page");
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.title, "Docs - Hello");
      assert.ok(res.text.includes("Hello"));
      assert.ok(res.text.includes("World & friends"));
      assert.strictEqual(res.text.includes("ignore me"), false);
      assert.strictEqual(res.text.includes("color:red"), false);
    }
  });

  it("parses jsonData/posts.json as pretty JSON text", async () => {
    globalThis.fetch = (async () => {
      const body = JSON.stringify([{ fileName: "post-1", title: "Post 1" }]);
      return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    }) as FetchLike;

    const res = await fetchDocPage("https://uipotion.com/jsonData/posts.json");
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.ok(res.text.includes('\n  {\n    "fileName": "post-1"'));
    }
  });

  it("truncates oversized content", async () => {
    globalThis.fetch = (async () => {
      const html = `<html><head><title>T</title></head><body>${"a".repeat(15_500)}</body></html>`;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as FetchLike;

    const res = await fetchDocPage("https://haroldjs.com/very-long");
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.ok(res.text.endsWith("\n...[truncated]"));
    }
  });
});
