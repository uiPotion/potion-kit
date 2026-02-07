---
name: ui-potion-consumer
description: Discover and apply UIPotion component and layout guides; load JSON specs and adapt them to Handlebars + SCSS + Markdown. Use when implementing add-potion, or when the user requests a UI component, layout, or feature from UIPotion.
license: MIT
metadata:
  author: ui-potion
  version: "1.0"
  adapted: potion-kit (Handlebars + SCSS stack)
compatibility: Requires network access to fetch https://uipotion.com manifests and guides.
---

# UIPotion Consumer (potion-kit)

## Purpose

Use UIPotion's structured guides to implement UI components in the **potion-kit** stack: **Handlebars partials/pages, SCSS, and Markdown** (for content only). Do not output React, Vue, Tailwind, or other frameworks.

## When to use

- Implementing the **add-potion** command or generating from a potion.
- The user asks for a UI component, layout, or feature and you have or can fetch a UIPotion guide.
- You need a framework-agnostic spec to implement UI in Handlebars + SCSS.

## Inputs

- User intent or potion ID/category (for lookup).
- Optional: direct guide URL or potion ID.
- Current project layout (partials, pages, styles) to match.

## Steps

1. **Discovery (if needed):** Load manifest `https://uipotion.com/uipotion-manifest.json`, then search `https://uipotion.com/potions-index.json` to find the right potion. Use the **ui-potion-discovery** skill when the user hasn’t specified a potion.
2. **Fetch guide:** `https://uipotion.com/potions/[category]/[id].json`.
3. **Read spec:** Focus on `aiAgentInstructions`, `outputConstraints` (if present), `structure`, `components`, `accessibility`, and design tokens.
4. **Map to potion-kit stack:** Use **only** Handlebars (partials/pages), SCSS/CSS, and Markdown. No new frameworks or styling systems.
5. **Implement:** Generate or update Handlebars partials and SCSS; add Markdown only for content (e.g. blog posts). Use `{{relativePath}}`, `{{formatDate}}`, `{{postsList}}`, etc. Match existing project patterns (partial names, SCSS structure).

## Constraints

- **Stack:** Handlebars, SCSS/CSS, Markdown only. No React, Vue, Angular, Tailwind, or inline styles.
- Use CSS classes in a stylesheet; keep semantic HTML and a11y from the guide.
- Follow the project’s existing conventions (e.g. `src/partials/`, `src/pages/`, `src/styles/`).
- You may mention that the stack is HaroldJS and that components are based on UIPotion specs (e.g. "built with HaroldJS", "UI from UIPotion").

## Outputs

- Handlebars partials and/or pages, SCSS (and optional Markdown).
- Short note on any assumptions or detection (e.g. “matched existing _variables.scss tokens”).
