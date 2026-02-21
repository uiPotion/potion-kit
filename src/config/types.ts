/**
 * Supported LLM providers. Add more as needed (google, openrouter, etc.).
 */
export type Provider = "openai" | "anthropic" | "moonshot";

export interface LlmConfig {
  provider: Provider;
  model: string;
  apiKey: string;
  /** Optional base URL for the chosen provider (e.g. proxy, LiteLLM). */
  baseUrl?: string;
  /** Max number of conversation turns (user + assistant pairs) sent to the API. Default 10. */
  maxHistoryMessages?: number;
  /** Max tool steps per turn. Default 16. */
  maxToolSteps?: number;
  /** Max output tokens per turn. Default 16384. */
  maxOutputTokens?: number;
}
