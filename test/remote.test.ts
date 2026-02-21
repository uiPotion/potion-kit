/**
 * Remote HTTP helpers: basic request/parse behavior.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { get, getJson, getText } from "../src/ai/remote.js";

type FetchLike = typeof fetch;

describe("remote", () => {
  const originalFetch = globalThis.fetch as FetchLike;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("get adds User-Agent header by default", async () => {
    let receivedHeaders: Record<string, string> | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      receivedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response("ok", { status: 200 });
    }) as FetchLike;

    const res = await get("https://example.com/docs");
    assert.strictEqual(res.ok, true);
    const normalized = Object.fromEntries(
      Object.entries(receivedHeaders ?? {}).map(([k, v]) => [k.toLowerCase(), v])
    );
    assert.strictEqual(normalized["user-agent"], "potion-kit/1.0");
  });

  it("get respects noUserAgent option", async () => {
    let receivedHeaders: Record<string, string> | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      receivedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response("ok", { status: 200 });
    }) as FetchLike;

    const res = await get("https://example.com/no-ua", { noUserAgent: true });
    assert.strictEqual(res.ok, true);
    assert.strictEqual("User-Agent" in (receivedHeaders ?? {}), false);
  });

  it("getJson returns parsed JSON on success", async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ ok: true, n: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as FetchLike;

    const data = await getJson<{ ok: boolean; n: number }>("https://example.com/data.json");
    assert.deepStrictEqual(data, { ok: true, n: 1 });
  });

  it("getJson returns null on non-OK status", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as FetchLike;
    const data = await getJson("https://example.com/fail.json");
    assert.strictEqual(data, null);
  });

  it("getText returns text on success and null on non-OK", async () => {
    globalThis.fetch = (async () => new Response("hello", { status: 200 })) as FetchLike;
    const okText = await getText("https://example.com/ok.txt");
    assert.strictEqual(okText, "hello");

    globalThis.fetch = (async () => new Response("bad", { status: 404 })) as FetchLike;
    const badText = await getText("https://example.com/missing.txt");
    assert.strictEqual(badText, null);
  });
});
