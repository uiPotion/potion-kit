# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.5] - 2026-02-11

### Added

- **Conversation summarization** — When history exceeds capacity, the "middle" conversation is summarized (short, information-dense) before sending to the API. Each request always includes: the first user message, an optional condensed summary, and the last N messages (default 10).
- **HBS structure rules** — System prompt and Harold context now explicitly require: no `<style>` or inline styles in .hbs; no `<script>` in .hbs. CSS must go in src/styles/*.scss, browser JS in src/assets/js/*.js. Prevents inline styles/scripts when adding pages in follow-up iterations.

### Changed

- **Project-local config file** — LLM config file lookup is now scoped to the current working directory (`./config.json`, next to `.env`) instead of reading from a home-directory config path. API keys still must not be stored in `config.json`.
- **AI step limit** — Increased maximum AI tool steps per turn from 8 to 16 to allow longer multi-step agent workflows.
- **History message selection for long chats** — When history is long, chat message assembly now prioritizes user requests from the tail and keeps only the latest assistant message, reducing stale assistant self-conditioning in subsequent turns.
- **Summary quality guardrails** — Conversation summarization now keeps durable context (user goals, constraints, unresolved issues, concrete file/command outcomes) and avoids treating unconfirmed assistant claims as facts.

### Fixed

- **Tool-use reliability in long conversations** — Added a per-turn reliability rule in chat message construction to treat older assistant replies as potentially stale and verify project state with tools before claiming changes.
- **Coverage for long-history behavior** — Updated chat message tests to assert the new reliability rule and long-history message selection behavior.

[0.0.5]: https://github.com/uiPotion/potion-kit/compare/v0.0.4...v0.0.5

## [0.0.4] - 2026-02-10

### Added

- **Moonshot (Kimi) provider** — New LLM provider: set `POTION_KIT_PROVIDER=moonshot` and `MOONSHOT_API_KEY`. Default model is `kimi-k2.5`. Uses a long-timeout fetch so reasoning models can complete.
- **Configurable chat history length** — Number of conversation turns sent to the API is configurable via `POTION_KIT_MAX_HISTORY_MESSAGES` or `maxHistoryMessages` in `~/.potion-kit/config.json`. Default remains 10.

### Changed

- **Commands** — `chat` is no longer the default command. Running `potion-kit` with no command, or with an unknown command (e.g. `potion-kit something`), shows usage and help instead of sending input to the API.
- **Request timeout** — Increased from 5 to 15 minutes per turn to support slow reasoning models.
- **Progress messages** — Removed "Step N of M" prefix; progress now shows only tool labels and "Waiting for model…" or "Model thinking…".
- **AI SDK v6** — Upgraded to `ai` ^6 and provider SDKs (OpenAI, Anthropic, Moonshot); tool API uses `inputSchema` and `stopWhen`/`stepCountIs`. Zod 4, commander 14, dotenv 17; build uses `rimraf` for cross-platform clean.

### Fixed

- **Abort/timeout errors** — When chat fails with an abort or timeout (e.g. "This operation was aborted"), the error message now suggests rerunning your prompt; conversation history is kept, so continuing often works.

[0.0.4]: https://github.com/uiPotion/potion-kit/compare/v0.0.3...v0.0.4

## [0.0.3] - 2026-02-07

### Added

- **Browser scripts in `src/assets/js/` only** — AI-seeded rules and `write_project_file` now require browser/Harold.js scripts to be placed under `src/assets/js/` (e.g. `src/assets/js/search.js`). Scripts in `statics/` or at `src/` root are no longer allowed. Templates should link them with `{{relativePath 'assets/js/…'}}`. Same guidance added to `.cursorrules` and the UI Potion consumer skill.

[0.0.3]: https://github.com/uiPotion/potion-kit/compare/v0.0.2...v0.0.3

## [0.0.2] - 2026-02-07

### Changed

- **Chat uses fewer tokens** — Only the last 10 messages (5 turns) are sent to the API per request. Older messages stay in history on disk but are not included, so long conversations stay under provider rate limits.
- **Smaller system prompt** — Rules, Harold context, and potions catalog were shortened to reduce input tokens every turn while keeping behavior the same.
- **Fewer tool steps per turn** — Max steps per chat turn reduced from 16 to 8 to lower token usage and avoid rate limits when the model uses many tools.

### Fixed

- **Rate limit errors** — When you hit the API rate limit (e.g. 30,000 input tokens/min), the error message now suggests waiting a minute and running `potion-kit clear` to start a fresh conversation.

[0.0.2]: https://github.com/uiPotion/potion-kit/compare/main...v0.0.2
