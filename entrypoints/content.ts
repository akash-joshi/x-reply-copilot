import { injectPill } from '../lib/pills';
import { getSettings } from '../lib/settings';

export default defineContentScript({
  // Production matches X; localhost is included so the same content script runs
  // against the locally-served timeline fixture during development. Chrome match
  // patterns ignore the port, so this covers any local dev server.
  matches: ['https://x.com/*', 'https://twitter.com/*', 'http://localhost/*'],
  async main() {
    const settings = await getSettings();
    if (!settings.scoring.pillsEnabled) return;
    const threshold = settings.scoring.greenThreshold;

    const scan = () => {
      for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
        injectPill(article, threshold);
      }
    };

    scan();

    // X virtualises the timeline, mounting tweets as the user scrolls. Re-scan on
    // DOM mutations, batched into a single animation frame to avoid jank. injectPill
    // is idempotent, so re-scanning already-scored tweets is a cheap no-op.
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        scan();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },
});
