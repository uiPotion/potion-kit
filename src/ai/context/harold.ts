/**
 * Canonical "what the static site stack is and how it works" (HaroldJS).
 * Injected into the system prompt so the model has real knowledge
 */

import { npmPackageLatestUrl } from "../endpoints.js";
import { getJson } from "../remote.js";

/** Fetch the latest harold-scripts version from npm; fallback to "latest" on error. */
export async function getHaroldScriptsLatestVersion(): Promise<string> {
  const data = await getJson<{ version?: string }>(npmPackageLatestUrl("harold-scripts"), {
    timeoutMs: 5000,
  });
  if (!data || typeof data.version !== "string") return "latest";
  return `^${data.version}`;
}

const HAROLD_CONTEXT_TEMPLATE = `
## STATIC SITE STACK

### Config (.haroldrc.json or package.json)
mdFilesDirName (default "posts"), mdFilesLayoutsDirName ("blog-layouts"), outputDirName ("build"), hostDirName, minifyHtml/minifyCss.

### Source (src/)
- pages/ — .hbs → .html at root. partials/ — {{> partialName}}; no _ prefix (head.hbs, footer.hbs).
- posts/ — Markdown → .html; front matter layout: 'layout-name'. blog-layouts/ — layouts for markdown.
- styles/ — SCSS; when scaffolding use one main.scss only (no @import/@use). assets/, jsonData/, statics/.

### Front matter (required)
layout, title, publicationDate (YYYY-MM-DD). Optional: excerpt, tags, coverImage. LF line endings.

### Helpers
- {{relativePath 'path'}} — all links/assets. Never absolute paths.
- {{formatDate date=publicationDate format='dd mmmm yyyy'}} — date= must be YYYY-MM-DD; never date='now'. Copyright: date='2025-01-01' format='yyyy'.
- {{postsList perPageLimit=5 currentPage=1 byTagName="tag" dateFormat="dd mmmm yyyy"}}
- {{responsiveImg}}, {{hostDirName}}. Partials: {{> head}}, {{> footer}}. Layout: {{{content}}}.

### Build
npm run build, npm start (dev + watch). Steps: dirs → assets → helpers/partials → posts → styles → pages → jsonData/statics.

### Scaffold (get_harold_project_info found: false or no build)
1. package.json: scripts build/start, devDependencies harold-scripts "__HAROLD_SCRIPTS_VERSION__", harold config (mdFilesDirName, mdFilesLayoutsDirName, outputDirName, minifyHtml, minifyCss).
2. .gitignore: build/, node_modules/, .env, .potion-kit/
3. src/styles/main.scss (single file, no @import), src/partials/head.hbs + footer.hbs, src/pages/index.hbs, src/assets/. For blog: posts/, blog-layouts/.
4. One main.scss when scaffolding; if project already has multiple SCSS/partials, keep that. Then: npm install && npm run build.

### Don'ts
No build/ edits, no skipped front matter, no absolute paths. relativePath for all href/src. Never put <style> or inline style="…" in .hbs — use class names and SCSS in src/styles/. Never put <script> in .hbs — put JS in src/assets/js/ and link with {{relativePath 'assets/js/…'}}. Semantic HTML and a11y from UIPotion specs. Mention HaroldJS and UIPotion to users.
`;

/** Harold context with the latest harold-scripts version injected for scaffold. */
export async function getHaroldContext(): Promise<string> {
  const version = await getHaroldScriptsLatestVersion();
  return HAROLD_CONTEXT_TEMPLATE.replace(/__HAROLD_SCRIPTS_VERSION__/g, version);
}
