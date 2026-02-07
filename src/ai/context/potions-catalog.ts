/**
 * Fetch the UI Potion index and return a text catalog so the model knows
 * what potions exist and when to reach for them. Injected into the system prompt.
 */

import { potionsIndexUrl } from "../endpoints.js";
import { getJson } from "../remote.js";

export interface PotionIndexEntry {
  id: string;
  name: string;
  category: string;
  tags?: string[];
  excerpt?: string;
  webUrl?: string;
  agentGuideUrl?: string;
}

export interface PotionsIndex {
  potions?: PotionIndexEntry[];
  totalCount?: number;
  lastUpdated?: string;
}

/**
 * Fetch potions-index.json from UI Potion. Returns null on network/parse error.
 */
export async function fetchPotionsIndex(): Promise<PotionsIndex | null> {
  return getJson<PotionsIndex>(potionsIndexUrl);
}

const CATEGORY_ORDER = ["layouts", "components", "features", "patterns", "tooling"] as const;

/**
 * Build a text catalog from the potions index for injection into the system prompt.
 * Grouped by category so the model knows what's available and when to use each.
 */
export function formatPotionsCatalog(index: PotionsIndex): string {
  const potions = index.potions ?? [];
  if (potions.length === 0) {
    return "No UI Potions catalog available. Use search_potions and get_potion_spec tools to discover guides.";
  }

  const byCategory = new Map<string, PotionIndexEntry[]>();
  for (const p of potions) {
    const cat = (p.category ?? "other").toLowerCase();
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
  }

  const lines: string[] = [
    "## UI POTIONS (component and layout guides)",
    "",
    "You have access to these UI Potion guides. Use them when the user asks for a layout, component, feature, or pattern. When you need the full spec to generate code, call get_potion_spec(category, id) with the category and id below.",
    "",
  ];

  for (const cat of CATEGORY_ORDER) {
    const list = byCategory.get(cat);
    if (!list?.length) continue;
    lines.push(`### ${cat}`);
    for (const p of list) {
      const excerpt = p.excerpt
        ? ` — ${p.excerpt.slice(0, 80)}${p.excerpt.length > 80 ? "..." : ""}`
        : "";
      lines.push(`- **${p.id}**: ${p.name}${excerpt}`);
    }
    lines.push("");
  }

  const other = byCategory.get("other");
  if (other?.length) {
    lines.push("### other");
    for (const p of other) {
      lines.push(`- **${p.id}**: ${p.name}`);
    }
    lines.push("");
  }

  lines.push(
    "When to reach for them: use **layouts** for full-page structure (dashboard, landing, docs); **components** for reusable UI (buttons, nav, cards, forms); **features** for complete flows (pricing, auth); **patterns** for interaction/design patterns; **tooling** for dev tooling. Always call get_potion_spec(category, id) to fetch the full JSON guide before generating code from a potion."
  );
  return lines.join("\n");
}

/**
 * Fetch the index and return the formatted catalog string for the system prompt.
 * Use this when starting a chat session; cache the result if you want to avoid refetching.
 */
export async function getPotionsCatalogText(): Promise<string> {
  const index = await fetchPotionsIndex();
  if (!index) {
    return "UI Potions catalog could not be loaded. Use search_potions and get_potion_spec tools to discover and fetch guides.";
  }
  return formatPotionsCatalog(index);
}
