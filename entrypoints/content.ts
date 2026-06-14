import { injectPill } from '../lib/pills';
import { getSettings } from '../lib/settings';
import { extractAuthorHandle, extractTextSnippet } from '../lib/tweet-dom';
import { GET_FOCUSED_TWEET_RECT, type ContentRequest, type ContentResponse } from '../lib/messaging';

/** The tweet whose vertical centre is nearest the viewport centre, if any is visible. */
function getFocusedTweetRect(): ContentResponse {
  const centreY = window.innerHeight / 2;
  let best: { article: Element; rect: DOMRect } | undefined;
  let bestDistance = Infinity;

  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    const rect = article.getBoundingClientRect();
    if (rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const distance = Math.abs((rect.top + rect.bottom) / 2 - centreY);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { article, rect };
    }
  }

  if (!best) return { error: 'No tweet is currently in view.' };
  const { article, rect } = best;
  return {
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    handle: extractAuthorHandle(article),
    textSnippet: extractTextSnippet(article),
  };
}

export default defineContentScript({
  // Production matches X; localhost is included so the same content script runs
  // against the locally-served timeline fixture during development. Chrome match
  // patterns ignore the port, so this covers any local dev server.
  matches: ['https://x.com/*', 'https://twitter.com/*', 'http://localhost/*'],
  async main() {
    browser.runtime.onMessage.addListener((message: ContentRequest) => {
      if (message?.type === GET_FOCUSED_TWEET_RECT) {
        return Promise.resolve(getFocusedTweetRect());
      }
    });

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
