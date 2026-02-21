# Potion Kit

CLI to build websites with **HaroldJS** (haroldjs.com) and **UIPotion** (uipotion.com): static sites with Handlebars, Markdown, and SCSS only. Chat with the AI to design and build your site; the model uses the UIPotion catalog and HaroldJS conventions and can only suggest components from real specs.

> **Note:** potion-kit is actively vibe coded — we’re improving and optimizing it over time. For the best experience we recommend the **newest OpenAI or Anthropic models**; they handle the outcome quality best. For a good cheaper option, use **Kimi K2.5**. Extensive use consumes API tokens and costs depend on your provider’s pricing. By using the tool you accept it as-is; only you decide whether and how much to use it. We hope you enjoy building with it.

## Commands

- **`potion-kit chat`** — Interactive chat.
- **`potion-kit chat "message"`** — Send one message and exit (one-shot).
- **`potion-kit clear`** — Clear chat state for this project (history, summary cache, and event trace ledger).
- **`potion-kit`** or **`potion-kit --help`** — Show usage and available commands. Unknown commands (e.g. `potion-kit clean`) also show help and do not call the API.

---

## Usage (from npm)

Use potion-kit as an installed CLI: run it from any directory where you have a `.env` with your LLM API key. No need to clone this repo.

### Install

**Option A — npx (no install):**

```bash
npx potion-kit chat
```

**Option B — global install:**

```bash
npm install -g potion-kit
potion-kit chat
```

### Run in your project (or empty directory)

1. **Go to the directory** where you want to work (new site or existing project). It can be an empty folder.

   ```bash
   mkdir my-site && cd my-site
   ```

2. **Create a `.env` file** in that directory with your LLM provider and API key. Minimal contents:

   ```env
   POTION_KIT_PROVIDER=openai
   OPENAI_API_KEY=sk-your-key-here
   ```

   For Anthropic use `POTION_KIT_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=...`. For Kimi (by Moonshot) use `POTION_KIT_PROVIDER=moonshot` and `MOONSHOT_API_KEY=...`. See [.env variables](#env-variables) for all options and [.env and security](#env-and-security).

3. **Run potion-kit** from that same directory:

   ```bash
   npx potion-kit chat
   # or, if installed globally:
   potion-kit chat
   ```

   The tool reads `.env` from the **current working directory**, so always run `potion-kit` from the directory that contains your `.env` (and where you want the AI to read/write files).

### Usage examples

**Interactive chat (recommended):**

```bash
cd my-project
npx potion-kit chat
# or: potion-kit chat
```

Type your message at the `You:` prompt, press Enter; the model replies. Type `exit`, `quit`, or `q` (or Ctrl+C) to quit. Your conversation is saved for the next run.

**One-shot (single message then exit):**

```bash
npx potion-kit chat "I want a blog with a header and footer"
npx potion-kit chat "Add the navbar potion to the layout"
```

**Start a new conversation** (clear history for this directory):

```bash
npx potion-kit clear
npx potion-kit chat "Let's build a docs site"
```

### Config

Config precedence (highest to lowest):

1. **Environment variables** already present in your shell/process (e.g. `OPENAI_API_KEY`, `POTION_KIT_PROVIDER`).
2. **`.env` in the current working directory** (loaded by dotenv only for variables not already set).
3. **`./config.json`** (in the current working directory) — provider, model, and optional `maxHistoryMessages`, `maxToolSteps`, `maxOutputTokens`; **do not put API keys there**.

#### .env variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POTION_KIT_PROVIDER` | yes | `openai`, `anthropic`, or `moonshot` |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `MOONSHOT_API_KEY` | one required | API key for the chosen provider |
| `POTION_KIT_MODEL` | no | Chat model id (defaults: `gpt-5.2` / `claude-sonnet-4-5` / `kimi-k2.5`). Must be a **chat** model. |
| `POTION_KIT_API_KEY` | no | Fallback key if provider-specific key is not set |
| `POTION_KIT_BASE_URL` | no | Custom base URL for the chosen provider (e.g. proxy, LiteLLM) |
| `POTION_KIT_MAX_HISTORY_MESSAGES` | no | Max conversation turns sent to the API (default 10) |
| `POTION_KIT_MAX_TOOL_STEPS` | no | Max tool steps per turn (default 16) |
| `POTION_KIT_MAX_OUTPUT_TOKENS` | no | Max output tokens per turn (default 16384) |

**Minimal `.env`:**

```env
POTION_KIT_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

**With optional model:**

```env
POTION_KIT_PROVIDER=openai
POTION_KIT_MODEL=gpt-5.2
OPENAI_API_KEY=sk-your-key-here
```

#### .env and security

- **potion-kit never sends `.env` or API keys to the model.** Keys are read only by the CLI and used for authentication with the LLM provider (OpenAI, Anthropic, or Moonshot). They are not included in the system prompt, chat history, or any message content sent to the model. The only way a key could appear in the conversation is if you paste it yourself in a chat message — so don’t.
- **Never commit `.env`.** It contains secrets. Add `.env` to your `.gitignore`. If the AI scaffolds a project for you, ensure `.env` is in that project’s `.gitignore` too.
- **Never put API keys in `config.json`.** That file is for provider and model only. Use `.env` or environment variables for keys.
- **Never paste API keys in logs, issues, or chat.** If you paste a key into a chat message, it becomes part of the conversation and history.
- **Where to put `.env`:** In the directory from which you run `potion-kit` (usually your project root). One `.env` per project.

### Chat history

Conversation is stored in **`.potion-kit/chat-history.json`** in the directory where you run `potion-kit chat`. The model uses it for context on the next run. Each request sends: the **first user message** (always kept), a **condensed summary** of the middle conversation (when history exceeds capacity), and the **last N messages** (default 10). Summary state is cached in `.potion-kit/chat-summary.json` and updated incrementally to avoid re-summarizing the same old turns every request. Per-turn tool traces are stored in `.potion-kit/chat-events.json` so completion claims can be cross-checked against recorded tool activity. Set `POTION_KIT_MAX_HISTORY_MESSAGES` or `maxHistoryMessages` in `./config.json` to change the tail size, and tune generation with `POTION_KIT_MAX_TOOL_STEPS` / `POTION_KIT_MAX_OUTPUT_TOKENS`. Add `.potion-kit/` to `.gitignore` if you don’t want to commit chat state. Use `potion-kit clear` to reset chat state for that project.

**File formats (`.potion-kit/`):**

- **`chat-history.json`** — Array of `{ role: "user" | "assistant", content: string }`. Raw conversation in order.
- **`chat-summary.json`** — Object: `summary` (string), `summarizedUntil` (number, exclusive index into history), `firstUserMessage` (string, for cache validation), `incrementalUpdates` (number).
- **`chat-events.json`** — Array of per-turn events. Each: `timestamp` (ISO string), `trace` (`stepsUsed`, `finishReason`, `toolEvents`: `{ toolName, ok }[]`), `hasVerifiedWrite` (true if this turn had a successful `write_project_file`), `replyWasGuarded` (true if the reply looked like a completion claim but had no verified write), optional `summarySource`.

**Summaries:** The middle-conversation summary is generated by the same model as chat (one extra API call when history exceeds the tail). The model is asked for at least 2–3 sentences or 3–5 bullet points. If it returns a valid plain-text summary of at least 80 characters it is stored and reused; if the response is empty or too short, a local fallback (condensed last messages) is used instead so the cache never stores stub summaries. Use a capable chat model (e.g. GPT-4o, Claude Sonnet) for best summary quality; very small or completion-only models may often trigger the fallback.

### Legal

potion-kit uses [UIPotion](https://uipotion.com) specifications and catalog. **By using potion-kit you are using UIPotion’s service and agree to the [UIPotion legal disclaimer and privacy policy](https://uipotion.com/legal).** That page covers disclaimers on AI-generated code, liability, and user responsibility. Please read it before use.

**AI providers and your data.** You choose the model and provider (e.g. OpenAI, Anthropic, Kimi/Moonshot) in config. You are aware what is sent in each request. By using a provider you agree to that provider’s terms of service, acceptable use, and data policies. potion-kit does not control how providers retain, process, or review your prompts and responses.

**Sensitive data and cloud LLM risk.** If your prompts include proprietary code, secrets, customer data, financials, or internal docs, the main risk is that you are voluntarily sending sensitive material to a third party. The precise risk depends on the provider’s retention, access controls, internal review practices, and breach likelihood. This is the general “cloud LLM” risk; consider what you send and which provider you use.

---

## Development (potion-kit repo)

For contributing to potion-kit or running from source.

### Setup

```bash
git clone <repo>
cd potion-kit
npm install
npm run build
```

### Run locally

```bash
node dist/index.js --help
node dist/index.js chat
```

Put a `.env` in the repo (or in a test directory) and run from there. Copy `.env.example` to `.env` and set your API key.

### Scripts

- **`npm run build`** — Compile TypeScript to `dist/`.
- **`npm run lint`** — ESLint on `src/`. `npm run lint:fix` to auto-fix.
- **`npm run format`** — Prettier on `src/**/*.ts`. `npm run format:check` to only check.
- **`npm run typecheck`** — `tsc --noEmit`.
- **`npm run test`** — Run tests (Node built-in test runner; tests live in `test/`).
