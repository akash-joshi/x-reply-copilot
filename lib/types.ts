/** Configuration for the OpenAI-compatible LLM backend. */
export interface LlmConfig {
  /** Base URL of the OpenAI-compatible API, e.g. http://localhost:11434/v1 */
  baseUrl: string;
  /** API key. Empty for local Ollama; required for hosted providers. */
  apiKey: string;
  /** Vision-capable model name, e.g. qwen2.5-vl or llama3.2-vision. */
  model: string;
  /** System prompt steering the analysis and suggested reply. */
  systemPrompt: string;
}

/** Tunables for the client-side viral-potential scorer. */
export interface ScoringConfig {
  /** Score in [0,1] at or above which a tweet gets a green pill. */
  greenThreshold: number;
  /** Whether to render pills on the timeline at all. */
  pillsEnabled: boolean;
}

/** Everything persisted in chrome.storage.sync. */
export interface Settings {
  llm: LlmConfig;
  scoring: ScoringConfig;
  /** Schema version, for future migrations. */
  version: number;
}

export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  llm: {
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'qwen2.5-vl',
    systemPrompt:
      'You are a witty, well-informed reply assistant for X/Twitter. ' +
      'You are shown an image of a single tweet, which may include text, ' +
      'memes, charts, or screenshots. First briefly analyse what the tweet ' +
      'is saying and any notable visual detail. Then suggest one concise, ' +
      'engaging reply that adds value and is likely to get engagement. ' +
      'Return the analysis and the suggested reply as clearly labelled sections.',
  },
  scoring: {
    greenThreshold: 0.6,
    pillsEnabled: true,
  },
  version: SETTINGS_VERSION,
};

/** Signals extracted from a tweet's DOM, fed into the scorer. */
export interface TweetSignals {
  /** Minutes since the tweet was posted, if a timestamp was found. */
  ageMinutes?: number;
  /** Number of existing replies, if shown. */
  replyCount?: number;
  /** Number of reposts, if shown. */
  repostCount?: number;
  /** Number of likes, if shown. */
  likeCount?: number;
  /** Whether the author has a verified badge. */
  verified?: boolean;
  /** Whether the tweet contains media (photo/video/card). */
  hasMedia?: boolean;
}
