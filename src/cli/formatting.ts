/**
 * CLI formatting: colors and user-facing progress labels.
 * Use for chat (You / agent separation), errors (red), and progress lines.
 */
import chalk from "chalk";

export const cli = {
  /** "You:" prompt and user message styling */
  user: (s: string) => chalk.cyan(s),
  /** Label for the assistant (e.g. "Potion-kit") */
  agentLabel: (s: string) => chalk.green.bold(s),
  /** Agent reply body - subtle so the content stands out */
  agentReply: (s: string) => s,
  /** Separator line between user and agent */
  separator: () => chalk.dim("─".repeat(40)),
  /** Progress line (thinking, step description) */
  progress: (s: string) => chalk.dim(s),
  /** Spinner character (distinct from progress text) */
  spinner: (s: string) => chalk.cyan(s),
  /** Error messages */
  error: (s: string) => chalk.red(s),
  /** One-shot intro line */
  intro: (s: string) => chalk.dim(s),
} as const;

/** Map internal tool names to short, user-friendly progress labels. Mention HaroldJS or UIPotion where relevant. */
const TOOL_PROGRESS_LABELS: Record<string, string> = {
  search_potions: "Searching UIPotion catalog",
  get_potion_spec: "Fetching UIPotion spec",
  get_harold_project_info: "HaroldJS: inspecting project",
  read_project_file: "HaroldJS: reading files",
  fetch_doc_page: "Loading docs (HaroldJS / UIPotion)",
  write_project_file: "HaroldJS: writing files",
};

/**
 * Build progress text: activity only (no step numbers). Tool names mapped to user-friendly labels.
 */
export function buildProgressMessage(
  _step: number,
  _maxSteps: number,
  toolNames: string[]
): string {
  const uniqueLabels = [
    ...new Set(toolNames.map((name) => TOOL_PROGRESS_LABELS[name] ?? name).filter(Boolean)),
  ];
  return uniqueLabels.length ? uniqueLabels.join(", ") + "…" : "Thinking…";
}
