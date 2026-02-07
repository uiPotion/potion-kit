# Potion Kit

CLI to build websites with **HaroldJS** (haroldjs.com) and **UIPotion** (uipotion.com): static sites with Handlebars, Markdown, and SCSS only. Chat with the AI to design and build your site; the model uses the UIPotion catalog and HaroldJS conventions and can only suggest components from real specs.

> **Note:** potion-kit is actively developed — we’re improving and optimizing it over time. For the best experience we recommend the **newest OpenAI or Anthropic models**; they handle the outcome quality best. Extensive use consumes API tokens and costs depend on your provider’s pricing. By using the tool you accept it as-is; only you decide whether and how much to use it. We hope you enjoy building with it.

## Commands

- **`potion-kit chat`** or **`potion-kit`** (default) — Interactive chat.
- **`potion-kit chat "message"`** — Send one message and exit (one-shot).
- **`potion-kit clear`** — Clear chat history for this project (next chat starts a new conversation).

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

   For Anthropic use `POTION_KIT_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=...`. See [.env variables](#env-variables) for all options and [.env and security](#env-and-security).

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

Config is loaded in this order (later overrides earlier):

1. **`.env` in the current working directory** (where you run potion-kit).
2. **Environment variables** (e.g. `OPENAI_API_KEY`, `POTION_KIT_PROVIDER`).
3. **`~/.potion-kit/config.json`** — provider and model only; **do not put API keys there**.

#### .env variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POTION_KIT_PROVIDER` | yes | `openai` or `anthropic` |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | one required | API key for the chosen provider |
| `POTION_KIT_MODEL` | no | Chat model id (defaults: `gpt-5.2` / `claude-sonnet-4-5`). Must be a **chat** model. |
| `POTION_KIT_API_KEY` | no | Fallback key if provider-specific key is not set |
| `POTION_KIT_BASE_URL` | no | Custom base URL (e.g. OpenAI proxy, LiteLLM) |

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

- **potion-kit never sends `.env` or API keys to the model.** Keys are read only by the CLI and used for authentication with the LLM provider (OpenAI/Anthropic). They are not included in the system prompt, chat history, or any message content sent to the model. The only way a key could appear in the conversation is if you paste it yourself in a chat message — so don’t.
- **Never commit `.env`.** It contains secrets. Add `.env` to your `.gitignore`. If the AI scaffolds a project for you, ensure `.env` is in that project’s `.gitignore` too.
- **Never put API keys in `~/.potion-kit/config.json`.** That file is for provider and model only. Use `.env` or environment variables for keys.
- **Never paste API keys in logs, issues, or chat.** If you paste a key into a chat message, it becomes part of the conversation and history.
- **Where to put `.env`:** In the directory from which you run `potion-kit` (usually your project root). One `.env` per project.

### Chat history

Conversation is stored in **`.potion-kit/chat-history.json`** in the directory where you run `potion-kit chat`. The model uses it for context on the next run. Add `.potion-kit/` to `.gitignore` if you don’t want to commit chat history. Use `potion-kit clear` to reset history for that project.

### Legal

potion-kit uses [UIPotion](https://uipotion.com) specifications and catalog. **By using potion-kit you are using UIPotion’s service and agree to the [UIPotion legal disclaimer and privacy policy](https://uipotion.com/legal).** That page covers disclaimers on AI-generated code, liability, and user responsibility. Please read it before use.

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
- **`npm run test`** — Run tests (Node built-in test runner). See [TESTING.md](TESTING.md) for what’s covered and what’s mocked.
