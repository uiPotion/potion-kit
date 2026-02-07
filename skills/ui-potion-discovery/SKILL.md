---
name: ui-potion-discovery
description: Find the best UIPotion guide for a component, layout, or feature by searching the index and returning JSON guide URLs and human-readable page URLs. Use when the user wants a potion but hasn’t specified which one, or when implementing add-potion discovery.
license: MIT
metadata:
  author: ui-potion
  version: "1.0"
  adapted: potion-kit
compatibility: Requires network access to fetch https://uipotion.com indexes.
---

# UIPotion Discovery (potion-kit)

## Purpose

Help find the most relevant UIPotion guides for a user request so potion-kit (or the agent) can implement with the **ui-potion-consumer** skill.

## When to use

- The user asks for a UI component, layout, or feature but doesn’t name a specific potion.
- Implementing **add-potion** discovery (e.g. interactive picker or search).
- You need to map intent (e.g. “dashboard”, “navbar”, “modal”) to available guides.

## Inputs

- User intent or keywords (e.g. “dashboard”, “button”, “pricing table”).
- Optional: category preference — layouts, components, features, patterns, tooling.

## Steps

1. **Load index:** Prefer project-local `src/statics/potions-index.json` if in a generated site; otherwise `https://uipotion.com/potions-index.json`.
2. **Filter and rank:** Match category and tags to the intent; rank by relevance.
3. **Return top 1–3 matches** with:
   - Name and category
   - **JSON guide URL** (for implementation): `https://uipotion.com/potions/[category]/[id].json`
   - **Human page URL** (for context): `https://uipotion.com/potions/[category]/[id].html`

## Output format

For each match:

- **Name** — Potion title
- **Category** — layouts | components | features | patterns | tooling
- **JSON guide URL** — for fetching the agent guide
- **Human-readable URL** — for user or agent context

If no strong match exists, say so and suggest the closest option.

## Constraints

- Prefer JSON guide URLs for implementation (consumer skill).
- Provide the human page URL for review and context.
- Categories: layouts, components, features, patterns, tooling.
