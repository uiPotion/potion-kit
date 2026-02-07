/**
 * Supported LLM providers. Add more as needed (anthropic, google, openrouter, etc.).
 */
export type Provider = 'openai' | 'anthropic';

export interface LlmConfig {
  provider: Provider;
  model: string;
  apiKey: string;
  /** Optional base URL for proxies or local models (e.g. OpenAI-compatible). */
  baseUrl?: string;
}
