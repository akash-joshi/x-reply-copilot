import { beforeEach } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

// Source modules use the WXT auto-imported `browser` global (and some Chrome-only
// APIs via `chrome`). In unit tests we point both at the in-memory fake browser.
(globalThis as unknown as { browser: typeof fakeBrowser }).browser = fakeBrowser;
(globalThis as unknown as { chrome: typeof fakeBrowser }).chrome = fakeBrowser;

beforeEach(() => {
  fakeBrowser.reset();
});
