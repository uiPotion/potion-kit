/**
 * Canonical "what the static site stack is and how it works" (Harold.js).
 * Injected into the system prompt so the model has real knowledge
 */

import { npmPackageLatestUrl } from '../endpoints.js';
import { getJson } from '../remote.js';

/** Fetch the latest harold-scripts version from npm; fallback to "latest" on error. */
export async function getHaroldScriptsLatestVersion(): Promise<string> {
  const data = await getJson<{ version?: string }>(
    npmPackageLatestUrl('harold-scripts'),
    { timeoutMs: 5000 }
  );
  if (!data || typeof data.version !== 'string') return 'latest';
  return `^${data.version}`;
}

const HAROLD_CONTEXT_TEMPLATE = `
## STATIC SITE STACK (how it works)

This is the only stack you use. All projects follow this structure and these conventions.

### Config (project root: .haroldrc.json or package.json)
- mdFilesDirName: directory for markdown files (default "posts"); also used in URLs (/posts/name).
- mdFilesLayoutsDirName: directory for markdown layouts (default "blog-layouts").
- outputDirName: build output directory (default "build").
- hostDirName: optional subpath when hosting in a subdirectory.
- minifyHtml, minifyCss: optional (default true).

### Source layout (under src/)
- pages/ — Handlebars pages (index.hbs, about.hbs). Output as .html at site root.
- partials/ — Handlebars partials; include with {{> partialName}} or {{> head title="Page"}}. No underscore prefix in filenames (head.hbs, footer.hbs).
- posts/ (or name from mdFilesDirName) — Markdown files. Output as .html under that path. Subdirs allowed; structure preserved in URLs.
- blog-layouts/ (or from mdFilesLayoutsDirName) — Layouts for markdown; referenced in front matter as layout: 'layout-name'.
- styles/ — SCSS/CSS. When scaffolding from zero use one main.scss only (no @import/@use). If the project already has multiple SCSS files or partials, keep that structure. harold-scripts compiles .scss/.css files that do not start with _.
- assets/ — Images, JS, fonts; copied to build.
- jsonData/ — Auto-generated (e.g. posts.json); do not hand-edit.
- statics/ — Files copied to output root (robots.txt, manifest.json).

### Markdown front matter (required)
- layout — layout template name (string).
- title — page title (string).
- publicationDate — must be a valid YYYY-MM-DD string (e.g. 2025-01-15). Invalid or wrong-format dates break formatDate and the build.
Optional: excerpt, tags (array), coverImage, and any custom fields (all passed to the layout). Use LF line endings; CRLF can break parsing.

### Handlebars helpers (always use these)
- {{relativePath 'path'}} — for ALL links and assets (so subdirectory hosting works). Never use absolute or root paths.
- {{formatDate date=publicationDate format='dd mmmm yyyy'}} — dates. The date= value must be a valid date string (YYYY-MM-DD only), e.g. publicationDate from front matter or a literal like '2025-01-15'. Never use date='now' or any non-date string (it causes Invalid date). For copyright year use date='2025-01-01' format='yyyy'. Format options: dd, d, mmmm, mmm, mm, yyyy.
- {{postsList perPageLimit=5 currentPage=1 byTagName="tag" className="..." dateFormat="dd mmmm yyyy" noTags= false noExcerpt= false noDate= false}} — render post lists from jsonData.
- {{responsiveImg src="..." alt="..." width="..." height="..." loading="lazy"}} — responsive images.
- {{hostDirName}} — for subdirectory-aware output (e.g. data-hrld-root="{{hostDirName}}").
- Partials: {{> head}}, {{> footer}}, {{> partialName param="value"}}.

### Pages (.hbs)
- No DOCTYPE/html in page files (added by layout).
- Always use {{> partialName}} for header/footer and {{relativePath '...'}} for links and assets.
- Content in layout: {{{content}}} (triple braces for HTML from markdown).

### Build process
1. Prepare directories (build/, build/posts/).
2. Copy assets (src/assets/ → build/assets/).
3. Register Handlebars helpers and partials.
4. Generate posts: Markdown + front matter → layout → HTML in build/posts/.
5. Generate styles: SCSS → CSS → build/styles/.
6. Generate pages: src/pages/*.hbs → HTML at build root.
7. Copy jsonData and statics to build.
Commands: npm run build (full build), npm start (build + dev server + watch, e.g. localhost:3000). These require package.json with harold-scripts (see scaffold below).

### Complete project scaffold (when the site is new or missing root setup)
If get_harold_project_info returns found: false, or the user has only src/ without a working build, create the full project so they can run npm install && npm run build.

**1. package.json (project root)** — Required. Must include:
- "scripts": { "build": "harold-scripts build", "start": "harold-scripts start" }
- "devDependencies": { "harold-scripts": "<version>" } — always use the newest version (injected below).
- "harold": { "mdFilesDirName": "posts", "mdFilesLayoutsDirName": "blog-layouts", "outputDirName": "build", "minifyHtml": true, "minifyCss": true }
- "name", "version", "private": true as needed. Example:
  {"name":"my-site","version":"1.0.0","private":true,"scripts":{"build":"harold-scripts build","start":"harold-scripts start"},"devDependencies":{"harold-scripts":"__HAROLD_SCRIPTS_VERSION__"},"harold":{"mdFilesDirName":"posts","mdFilesLayoutsDirName":"blog-layouts","outputDirName":"build","minifyHtml":true,"minifyCss":true}}

**2. .gitignore (project root)** — Recommended. Include: build/, node_modules/, .env, .potion-kit/

**3. File structure (when starting from nothing)** — Keep the standard layout. Do not use @import or @use in SCSS.

- **src/styles/** — Create a single file main.scss with all styles in it. Do not add @import or @use; write plain SCSS/CSS only. No partials (_variables.scss etc.) when scaffolding from zero.
- **src/partials/** — At least head.hbs and footer.hbs (pages use {{> head}} {{> footer}}).
- **src/pages/** — At least index.hbs.
- **src/assets/** — Can be empty; create a .gitkeep or one file if the dir must exist.
- If the site will have a blog: src/posts/, src/blog-layouts/ with at least one layout.

**4. SCSS rule (scaffolding only)** — When starting from zero files (harold not implemented yet), use one main.scss only: no @import, no @use. Put all styles in that single file so the build works. Once the user has split SCSS into multiple files or uses partials/@import/@use, accept that structure and do not force a single file.

After creating package.json, tell the user to run: npm install && npm run build (or npm start for dev server).

### Conventions and don'ts
- File naming: kebab-case for posts/pages; partials without _ prefix. When scaffolding from zero use one main.scss only; if the project already uses multiple SCSS files or @import/@use, keep that structure.
- Always use relativePath for href/src. Include excerpt and tags for SEO. Semantic HTML and a11y from UI Potion specs.
- Do not edit files in build/ (generated). Do not skip required front matter. Do not use absolute paths. When talking to users, you may mention Harold.js (haroldjs.com) and that the UI is based on UI Potion specs (uipotion.com).
`;

/** Harold context with the latest harold-scripts version injected for scaffold. */
export async function getHaroldContext(): Promise<string> {
  const version = await getHaroldScriptsLatestVersion();
  return HAROLD_CONTEXT_TEMPLATE.replace(/__HAROLD_SCRIPTS_VERSION__/g, version);
}
