import { describe, it, expect } from 'vitest';
import { PROVIDERS, providerForBaseUrl, CUSTOM_PROVIDER_KEY } from '../lib/providers';

describe('providerForBaseUrl', () => {
  it('matches a known provider by its base URL', () => {
    const ollama = PROVIDERS.find((provider) => provider.key === 'ollama')!;
    expect(providerForBaseUrl(ollama.baseUrl)).toBe(ollama.key);

    const bridge = PROVIDERS.find((provider) => provider.key === 'grok-bridge')!;
    expect(providerForBaseUrl(bridge.baseUrl)).toBe(bridge.key);
  });

  it('falls back to custom for an unrecognised base URL', () => {
    expect(providerForBaseUrl('https://example.com/v1')).toBe(CUSTOM_PROVIDER_KEY);
  });
});
