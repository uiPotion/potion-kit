# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-02-07

### Changed

- **Chat uses fewer tokens** — Only the last 10 messages (5 turns) are sent to the API per request. Older messages stay in history on disk but are not included, so long conversations stay under provider rate limits.
- **Smaller system prompt** — Rules, Harold context, and potions catalog were shortened to reduce input tokens every turn while keeping behavior the same.
- **Fewer tool steps per turn** — Max steps per chat turn reduced from 16 to 8 to lower token usage and avoid rate limits when the model uses many tools.

### Fixed

- **Rate limit errors** — When you hit the API rate limit (e.g. 30,000 input tokens/min), the error message now suggests waiting a minute and running `potion-kit clear` to start a fresh conversation.

[0.0.2]: https://github.com/uiPotion/potion-kit/compare/main...v0.0.2
