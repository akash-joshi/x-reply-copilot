import { DEFAULT_SETTINGS, SETTINGS_VERSION, type Settings } from './types';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const STORAGE_KEY = 'settings';

/** Overlay stored values onto defaults so missing/new fields always resolve. */
function mergeSettings(stored: DeepPartial<Settings> | undefined): Settings {
  return {
    llm: { ...DEFAULT_SETTINGS.llm, ...stored?.llm },
    scoring: { ...DEFAULT_SETTINGS.scoring, ...stored?.scoring },
    version: SETTINGS_VERSION,
  };
}

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.sync.get(STORAGE_KEY);
  return mergeSettings(result[STORAGE_KEY] as DeepPartial<Settings> | undefined);
}

export async function saveSettings(patch: DeepPartial<Settings>): Promise<void> {
  const current = await getSettings();
  const next = mergeSettings({
    llm: { ...current.llm, ...patch.llm },
    scoring: { ...current.scoring, ...patch.scoring },
  });
  await browser.storage.sync.set({ [STORAGE_KEY]: next });
}
