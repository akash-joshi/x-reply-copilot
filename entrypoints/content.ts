import { extractSignals, extractAuthorHandle } from '../lib/tweet-dom';

export default defineContentScript({
  // Production matches X; localhost is included so the same content script runs
  // against the locally-served timeline fixture during development. Chrome match
  // patterns ignore the port, so this covers any local dev server.
  matches: ['https://x.com/*', 'https://twitter.com/*', 'http://localhost/*'],
  main() {
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      console.log('[x-reply-copilot]', extractAuthorHandle(article), extractSignals(article));
    }
  },
});
