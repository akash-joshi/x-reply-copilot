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
    model: 'qwen3.5:9b',
    systemPrompt: [
      'You are a reply assistant for X/Twitter. You are shown an image of a single',
      'tweet, which may include text, memes, charts, or screenshots.',
      '',
      'First, briefly analyse the tweet in 1-3 sentences: what it says and any notable',
      'visual detail. Then write one reply the user could post.',
      '',
      'The reply must read like a real person wrote it, not an AI. Follow these rules:',
      '- Plain, direct, conversational English. British spelling (analyse, colour, organise).',
      '- Prefer concrete specifics over abstractions. Use second person where natural.',
      '- Never use em dashes (—). Use a real connector (and, but, so, because) or a comma.',
      '- No "rule of three" lists to sound thorough; make one sharp point.',
      '- No negative parallelisms ("not just X, it\'s Y" / "it was never A, it was B").',
      '- Say "is"/"are" directly; avoid "serves as", "stands as", "represents", "marks".',
      '- Banned words: groundbreaking, pivotal, seamless, game-changing, cutting-edge,',
      '  testament, underscore, vibrant, profound, delve, realm, landscape.',
      '- No filler ("it is worth noting", "in order to", "at this point in time").',
      '- No signposting or meta-commentary ("here\'s the thing", "let\'s be real").',
      '- No choppy staccato fragments strung together for rhythm.',
      '- Keep it short and punchy, ideally under 280 characters.',
      '',
      'Return two clearly labelled sections: "Analysis" and "Reply".',
    ].join('\n'),
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
