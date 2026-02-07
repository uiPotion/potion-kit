# potion-kit

CLI to build websites with **HaroldJS** (haroldjs.com) and **UIPotion** (uipotion.com): static sites with Handlebars, Markdown, and SCSS only. Chat with the AI to design and build your site; the model uses the UIPotion catalog and HaroldJS conventions and can only suggest components from real specs.

## Commands

- **`potion-kit chat`** or **`potion-kit`** (default) — Interactive chat. See [Usage](#usage) below.
- **`potion-kit chat "message"`** — Send one message and exit (one-shot).
- **`potion-kit clear`** — Clear chat history for this project (next chat starts a new conversation).

## Setup

```bash
cd potion-kit
npm install
npm run build
node dist/index.js --help
```

To use chat from another directory (e.g. your project or the playground), run from that directory and put a `.env` there (or set env vars). Copy `potion-kit/.env.example` to your project as `.env` and set your API key.

## Usage

Chat is the main way to interact with the AI. The model knows HaroldJS structure and the UIPotion catalog; it uses tools to fetch real component specs and, when run from a project dir, can see your existing partials/pages/styles. If something is missing from context, it can fetch doc pages from haroldjs.com or uipotion.com only (fallback). You can build the site iteratively over multiple turns.

### Interactive mode (recommended)

Run with no arguments to enter an interactive session:

```bash
potion-kit chat
# or
potion-kit
```

You’ll see a `You:` prompt. Type your message, press Enter; the model replies, then you get `You:` again. The process stays running so you don’t re-run the CLI every time.

- **Quit:** type `exit`, `quit`, or `q`, or press **Ctrl+C**. Your conversation is saved before exit.
- **New conversation:** run `potion-kit clear`, then run `potion-kit chat` (or `potion-kit` with a message).

### One-shot

To send a single message and exit:

```bash
potion-kit chat "I want a blog with a header and footer"
```

The reply is printed and the process exits. If you run chat again (interactive or one-shot) in the same directory, the model sees the previous conversation (see [Chat history](#chat-history)).

### Building the site

1. Run `potion-kit chat` from your project directory (where your `.env` lives).
2. Describe what you want (e.g. “I want a simple blog”, “Use the navbar potion for the header”).
3. The model uses the catalog and tools to suggest Handlebars partials, SCSS, and Markdown. Continue the conversation to add pages, layouts, or refine.
4. Start over anytime with `potion-kit clear`.

## Config

LLM config is loaded in this order (later overrides earlier):

1. **`.env` in the current working directory** (where you run potion-kit). Copy `.env.example` to `.env` and set your keys.
2. **Environment variables** (e.g. `OPENAI_API_KEY`).
3. **`~/.potion-kit/config.json`** — provider and model only; **never put API keys there**. See `config.example.json` in this package.

### .env variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POTION_KIT_PROVIDER` | yes | `openai` or `anthropic` |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | one required | API key for the chosen provider |
| `POTION_KIT_MODEL` | no | Chat model id (defaults: `gpt-4o-mini` / `claude-sonnet-4-5`). Must be a **chat** model (e.g. gpt-4o, gpt-3.5-turbo), not a completion-only model. |
| `POTION_KIT_API_KEY` | no | Fallback key if provider-specific key is not set |
| `POTION_KIT_BASE_URL` | no | Custom base URL (e.g. OpenAI-compatible proxy, LiteLLM, local model) |

Provider setup: [ai-sdk.dev](https://ai-sdk.dev).

Never commit `.env`, `~/.potion-kit/`, or paste API keys in logs.

### Chat history

Conversation is stored **per project** in `.potion-kit/chat-history.json` (in the directory where you run `potion-kit chat`). That gives the model full context on the next run. This directory is typically gitignored so chat history is not committed.

- **Interactive mode:** history is written after each turn and when you exit.
- **One-shot:** history is updated after each run.
- **Clear:** `potion-kit clear` resets history for that project.

## Development

- **Lint:** `npm run lint` — ESLint on `src/`. `npm run lint:fix` to auto-fix.
- **Format:** `npm run format` — Prettier on `src/**/*.ts`. `npm run format:check` to only check (e.g. CI).
