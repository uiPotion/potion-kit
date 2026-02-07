/**
 * Potion-kit tools for the Vercel AI SDK. The model can only get component/layout
 * specs or project info by calling these. See https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 */
import { mkdir, writeFile, readFile, realpath } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { fetchDocPage } from "./fetch-doc.js";
import { getHaroldProjectInfo } from "./harold-project.js";
import { fetchPotionsIndex } from "./context/potions-catalog.js";
import { potionSpecUrl } from "./endpoints.js";
import { getJson } from "./remote.js";

const ALLOWED_EXTENSIONS = new Set([".hbs", ".md", ".scss", ".css", ".html", ".json"]);
/** .js only allowed under src/assets/js/ for browser scripts (Harold.js, interactions, client-side). Node.js scripts are not allowed. */
const FORBIDDEN_SUBSTRINGS = [".env", ".."];

async function isPathAllowed(
  projectRoot: string,
  relativePath: string
): Promise<{ ok: true; absolute: string } | { ok: false; error: string }> {
  const normalized = relativePath.replace(/\\/g, "/").trim();
  if (normalized.startsWith("/") || normalized.includes("..")) {
    return { ok: false, error: "Path must be relative and must not contain .." };
  }
  for (const sub of FORBIDDEN_SUBSTRINGS) {
    if (normalized.includes(sub)) {
      return { ok: false, error: `Path must not contain ${sub}` };
    }
  }
  const ext = normalized.includes(".") ? "." + normalized.split(".").pop()! : "";
  const allowedRootDotfiles = [".gitignore"];
  const isAllowedRootDotfile =
    allowedRootDotfiles.includes(normalized) ||
    allowedRootDotfiles.some((f) => normalized === f || normalized.endsWith("/" + f));
  const allowedExtensions = ALLOWED_EXTENSIONS.has(ext);
  const jsUnderAssetsJs = ext === ".js" && normalized.startsWith("src/assets/js/");
  if (!allowedExtensions && !jsUnderAssetsJs && !isAllowedRootDotfile) {
    if (ext === ".js") {
      return {
        ok: false,
        error:
          "Only browser/client-side .js under src/assets/js/ is allowed (e.g. src/assets/js/search.js). Node.js scripts are not allowed.",
      };
    }
    return {
      ok: false,
      error: `Allowed extensions: ${[...ALLOWED_EXTENSIONS].join(", ")}, or .js under src/assets/js/, or ${allowedRootDotfiles.join(", ")} in project root`,
    };
  }
  const absolute = resolve(projectRoot, normalized);
  const relFromRoot = relative(projectRoot, absolute);
  if (relFromRoot.startsWith("..")) {
    return { ok: false, error: "Path is outside the project directory" };
  }
  try {
    const canonicalRoot = await realpath(projectRoot);
    const parentDir = resolve(absolute, "..");
    const canonicalParent = await realpath(parentDir).catch(() => null);
    if (canonicalParent) {
      const canonicalAbsolute = resolve(canonicalParent, normalized.split("/").pop()!);
      const relCanonical = relative(canonicalRoot, canonicalAbsolute);
      if (relCanonical.startsWith("..")) {
        return { ok: false, error: "Path is outside the project directory" };
      }
    }
  } catch {
    // realpath can throw if path doesn't exist yet; resolve check above is enough
  }
  return { ok: true, absolute };
}

/**
 * Ensure the path (or an existing ancestor) resolves inside the project root.
 * Follows symlinks so we never read or write outside the working directory.
 * When the path or its parents don't exist yet (e.g. scaffolding), we walk up
 * until we find an existing directory and check that it is inside the project.
 */
async function ensureInsideProjectRoot(
  projectRoot: string,
  absolutePath: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const canonicalRoot = await realpath(projectRoot);
  const checkInside = (canonicalPath: string) =>
    !relative(canonicalRoot, canonicalPath).startsWith("..");

  const canonicalPath = await realpath(absolutePath).catch((e: NodeJS.ErrnoException) => {
    if (e?.code === "ENOENT") return null;
    throw e;
  });
  if (canonicalPath !== null) {
    return checkInside(canonicalPath)
      ? { ok: true }
      : { ok: false, error: "Path is outside the project directory" };
  }

  let dir = resolve(absolutePath, "..");
  while (relative(projectRoot, dir).startsWith("..") === false) {
    const canonicalDir = await realpath(dir).catch((e: NodeJS.ErrnoException) => {
      if (e?.code === "ENOENT") return null;
      throw e;
    });
    if (canonicalDir !== null) {
      return checkInside(canonicalDir)
        ? { ok: true }
        : { ok: false, error: "Path is outside the project directory" };
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return { ok: false, error: "Path is outside the project directory" };
}

/**
 * AI SDK tools: search_potions, get_potion_spec, get_harold_project_info, fetch_doc_page, write_project_file.
 * Use with generateText({ tools: createPotionKitTools() }).
 */
export function createPotionKitTools() {
  return {
    search_potions: tool({
      description:
        "Search the UIPotion index for components or layouts by keyword or category. Returns matching potions with id, name, category, excerpt. Use this to find which potions exist before suggesting or generating anything.",
      parameters: z.object({
        query: z.string().describe('Search query (e.g. "dashboard", "navbar", "button")'),
        category: z
          .string()
          .describe(
            "Filter by category: one of layouts, components, features, patterns, tooling; or empty string for no filter"
          ),
      }),
      execute: async ({ query, category }: { query: string; category: string }) => {
        try {
          const index = await fetchPotionsIndex();
          if (!index?.potions?.length) {
            return { error: "Potions index unavailable", potions: [] };
          }
          const q = query.toLowerCase();
          let list = index.potions.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.id.toLowerCase().includes(q) ||
              p.tags?.some((t) => t.toLowerCase().includes(q)) ||
              p.excerpt?.toLowerCase().includes(q)
          );
          if (category) {
            list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
          }
          return {
            potions: list.slice(0, 15).map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              excerpt: p.excerpt ?? undefined,
            })),
          };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e), potions: [] };
        }
      },
    }),

    get_potion_spec: tool({
      description:
        "Fetch the full JSON spec for a single UIPotion guide. Call with category and id from search_potions. Do not invent category or id.",
      parameters: z.object({
        category: z.string().describe("Category (e.g. layouts, components)"),
        id: z.string().describe("Potion id (e.g. dashboard, button)"),
      }),
      execute: async ({ category, id }: { category: string; id: string }) => {
        try {
          const spec = await getJson<unknown>(potionSpecUrl(category, id));
          if (spec === null) return { error: "Failed to fetch spec", spec: null };
          return { spec };
        } catch (e) {
          return { error: String(e), spec: null };
        }
      },
    }),

    get_harold_project_info: tool({
      description:
        "Get info about the current static site project (if any): HaroldJS config (.haroldrc.json or package.json), existing partials, pages, styles, blog layouts. Returns only structure (file names and config), NOT file contents. When the user is iterating or asking for a fix, call read_project_file for the relevant file(s) to get current content before editing. If the dir is empty or not a HaroldJS project, the response will say so; then scaffold with the standard layout (one main.scss, no @import/@use).",
      parameters: z.object({}),
      execute: async () => {
        try {
          return getHaroldProjectInfo(process.cwd());
        } catch (e) {
          return { found: false, message: e instanceof Error ? e.message : String(e) };
        }
      },
    }),

    read_project_file: tool({
      description:
        "Read the current contents of a file in the user's project. Path must be relative to project root (e.g. src/partials/navbar.hbs, src/pages/index.hbs, src/styles/main.scss). Use this whenever the user asks to fix, change, or update existing code: read the file first, then make minimal edits based on the exact content returned. Do not regenerate files from scratch without reading them.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "Relative path from project root, e.g. src/partials/head.hbs or src/styles/main.scss"
          ),
      }),
      execute: async ({ path: relativePath }: { path: string }) => {
        const projectRoot = resolve(process.cwd());
        const allowed = await isPathAllowed(projectRoot, relativePath);
        if (!allowed.ok) {
          return { ok: false, error: allowed.error, content: null };
        }
        const inside = await ensureInsideProjectRoot(projectRoot, allowed.absolute);
        if (!inside.ok) {
          return { ok: false, error: inside.error, content: null };
        }
        try {
          const content = await readFile(allowed.absolute, "utf8");
          return { ok: true, path: relativePath, content };
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          if (err.includes("ENOENT")) {
            return { ok: false, error: "File not found", content: null };
          }
          return { ok: false, error: err, content: null };
        }
      },
    }),

    fetch_doc_page: tool({
      description:
        "Fallback only: fetch the text content of a page from haroldjs.com or uipotion.com. You can fetch jsonData/posts.json first (e.g. https://www.haroldjs.com/jsonData/posts.json or https://uipotion.com/jsonData/posts.json) to get the doc index, then open specific pages. Use only when the information is not in the HaroldJS context or Potion specs (search_potions / get_potion_spec). Only for these two domains.",
      parameters: z.object({
        url: z
          .string()
          .describe("Full URL (must be from https://haroldjs.com or https://uipotion.com)"),
      }),
      execute: async ({ url }: { url: string }) => {
        try {
          return await fetchDocPage(url);
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),

    write_project_file: tool({
      description:
        'Create or overwrite a file in the user\'s project. Path must be relative to the project root; you cannot write outside this directory. Allowed: .hbs, .md, .scss, .css, .html, .json anywhere (including package.json, .haroldrc.json at root); .js only under src/assets/js/ for browser/Harold scripts; .gitignore at root. When the project is new or missing root setup, create package.json with scripts "build": "harold-scripts build", "start": "harold-scripts start", devDependencies harold-scripts, and a "harold" config object (see system prompt scaffold). Do NOT write Node.js scripts (no .js at project root). Do not write .env or paths containing "..".',
      parameters: z.object({
        path: z
          .string()
          .describe(
            "Relative path from project root, e.g. src/partials/navbar.hbs or src/pages/index.md"
          ),
        content: z.string().describe("Full file contents (Handlebars, Markdown, SCSS, etc.)"),
      }),
      execute: async ({ path: relativePath, content }: { path: string; content: string }) => {
        const projectRoot = resolve(process.cwd());
        const allowed = await isPathAllowed(projectRoot, relativePath);
        if (!allowed.ok) {
          return { ok: false, error: allowed.error };
        }
        const inside = await ensureInsideProjectRoot(projectRoot, allowed.absolute);
        if (!inside.ok) {
          return { ok: false, error: inside.error };
        }
        try {
          const dir = resolve(allowed.absolute, "..");
          await mkdir(dir, { recursive: true });
          await writeFile(allowed.absolute, content, "utf8");
          return { ok: true, path: relativePath };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),
  };
}
