/**
 * Central HTTP service for all remote calls (npm, UIPotion, doc pages).
 * Uses endpoints from ./endpoints.js and supports timeout and optional headers.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT = "potion-kit/1.0";

export interface RemoteGetOptions {
  /** Request timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Optional extra headers (User-Agent is set by default for doc fetches). */
  headers?: Record<string, string>;
  /** If true, do not add User-Agent. Use for registry/potion JSON where it's not needed. */
  noUserAgent?: boolean;
}

/**
 * GET a URL with optional timeout and headers. Returns the Response;
 * callers are responsible for res.ok, res.json(), res.text(), etc.
 */
export async function get(url: string, options: RemoteGetOptions = {}): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: extraHeaders = {},
    noUserAgent = false,
  } = options;

  const headers = new Headers(extraHeaders);
  if (!noUserAgent && !headers.has("User-Agent")) {
    headers.set("User-Agent", USER_AGENT);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: Object.fromEntries(headers),
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * GET a URL and parse JSON. Returns parsed data or null on error.
 */
export async function getJson<T = unknown>(
  url: string,
  options: RemoteGetOptions = {}
): Promise<T | null> {
  try {
    const res = await get(url, { ...options, noUserAgent: true });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    return data;
  } catch {
    return null;
  }
}

/**
 * GET a URL and return text. Returns null on error.
 */
export async function getText(url: string, options: RemoteGetOptions = {}): Promise<string | null> {
  try {
    const res = await get(url, options);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
