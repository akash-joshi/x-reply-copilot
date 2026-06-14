export interface Provider {
  key: string;
  label: string;
  baseUrl: string;
  /** Suggested default model for this provider. */
  model: string;
  /** Whether this provider needs an API key. */
  needsKey: boolean;
  /** Short setup hint shown under the picker. */
  hint?: string;
}

export const CUSTOM_PROVIDER_KEY = 'custom';

export const PROVIDERS: Provider[] = [
  {
    key: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen3.5:9b',
    needsKey: false,
    hint: 'Run `ollama serve` with a vision model pulled.',
  },
  {
    key: 'grok-bridge',
    label: 'Grok (local CLI bridge)',
    baseUrl: 'http://localhost:11435/v1',
    model: 'grok',
    needsKey: false,
    hint: 'Run `npm run grok-bridge` and make sure `grok login` is done. No API key.',
  },
  {
    key: 'xai',
    label: 'xAI Grok (API key)',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-2-vision',
    needsKey: true,
    hint: 'Needs an xAI API key with a vision-capable model.',
  },
  {
    key: 'openai',
    label: 'OpenAI (API key)',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    needsKey: true,
    hint: 'Needs an OpenAI API key.',
  },
];

/** Which preset (if any) a base URL corresponds to, for selecting the dropdown. */
export function providerForBaseUrl(baseUrl: string): string {
  const match = PROVIDERS.find((provider) => provider.baseUrl === baseUrl);
  return match ? match.key : CUSTOM_PROVIDER_KEY;
}
