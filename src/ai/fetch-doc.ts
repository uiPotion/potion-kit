/**
 * Fetch a doc page or jsonData/posts.json from allowlisted domains only
 * (haroldjs.com, uipotion.com). HaroldJS sites always generate jsonData/posts.json
 * with the doc index (fileName, title, excerpt, etc.). The model can fetch that
 * first, then open specific pages. Used as a fallback when info isn't in context
 * or Potion specs.
 */

import { DOC_ALLOWED_HOSTS } from "./endpoints.js";
import { get } from "./remote.js";

const MAX_CHARS = 14_000;

/**
 * Strip HTML to rough plain text: remove script/style, then tags, collapse whitespace.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchDocPage(
  url: string
): Promise<{ ok: true; title?: string; text: string } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (!DOC_ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      error: `URL must be from haroldjs.com or uipotion.com. Got: ${parsed.hostname}`,
    };
  }

  try {
    const res = await get(url);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    const isJson =
      parsed.pathname.endsWith("/jsonData/posts.json") || contentType.includes("application/json");
    const raw = await res.text();

    let text: string;
    let title: string | undefined;
    if (isJson) {
      try {
        const data = JSON.parse(raw) as unknown;
        text = JSON.stringify(data, null, 2);
      } catch {
        text = raw;
      }
    } else {
      text = htmlToText(raw);
      const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) title = htmlToText(titleMatch[1]);
    }
    const truncated =
      text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n...[truncated]" : text;
    return { ok: true, title, text: truncated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
