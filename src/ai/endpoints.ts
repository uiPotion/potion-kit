/**
 * All remote endpoints used by potion-kit (npm, UI Potion, doc allowlist).
 * Single source of truth for URLs and allowlisted hosts.
 */

/** npm registry base (no trailing slash). */
export const NPM_REGISTRY_BASE = "https://registry.npmjs.org";

/** UI Potion site base (no trailing slash). */
export const UIPOTION_BASE = "https://uipotion.com";

/** Harold.js doc site hostnames (for fetch_doc_page allowlist). */
export const DOC_ALLOWED_HOSTS = new Set([
  "haroldjs.com",
  "www.haroldjs.com",
  "uipotion.com",
  "www.uipotion.com",
]);

/** URL for a package's "latest" version in the npm registry. */
export function npmPackageLatestUrl(packageName: string): string {
  return `${NPM_REGISTRY_BASE}/${packageName}/latest`;
}

/** URL for the UI Potion potions index JSON. */
export const potionsIndexUrl = `${UIPOTION_BASE}/potions-index.json`;

/** URL for a single potion spec JSON (category + id). */
export function potionSpecUrl(category: string, id: string): string {
  return `${UIPOTION_BASE}/potions/${category}/${id}.json`;
}

/** Whether a URL is allowed for fetch_doc_page (haroldjs.com or uipotion.com only). */
export function isDocUrlAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DOC_ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}
