import { describe, it, expect } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import { getSettings, saveSettings } from '../lib/settings';
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from '../lib/types';

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('fills missing fields with defaults when only some are stored', async () => {
    const customModel = 'llama3.2-vision';
    await fakeBrowser.storage.sync.set({ settings: { llm: { model: customModel } } });

    const settings = await getSettings();

    expect(settings.llm.model).toBe(customModel);
    expect(settings.llm.baseUrl).toBe(DEFAULT_SETTINGS.llm.baseUrl);
    expect(settings.scoring).toEqual(DEFAULT_SETTINGS.scoring);
    expect(settings.version).toBe(SETTINGS_VERSION);
  });

  it('round-trips a saved patch without dropping untouched fields', async () => {
    const baseUrl = 'https://api.openai.com/v1';
    const apiKey = 'sk-test-123';
    await saveSettings({ llm: { baseUrl, apiKey } });

    const settings = await getSettings();

    expect(settings.llm.baseUrl).toBe(baseUrl);
    expect(settings.llm.apiKey).toBe(apiKey);
    expect(settings.llm.model).toBe(DEFAULT_SETTINGS.llm.model);
  });
});
