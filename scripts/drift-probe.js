// X DOM drift probe.
//
// Paste into the DevTools console on a live x.com timeline to check whether the
// selectors in lib/tweet-dom.ts still resolve against current production markup.
// It reads the DOM only — no scrolling, no synthetic events, no network — and
// logs, per tweet, which signals were found. If counts are mostly "missing", X
// has changed its markup and the selectors (and test/fixtures/timeline.html) need
// refreshing. Keep the selectors here in sync with lib/tweet-dom.ts.
(() => {
  const parseCount = (label) => {
    if (!label) return undefined;
    const match = label.match(/([\d,.]+)\s*(K|M)?/i);
    if (!match) return undefined;
    let value = parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) return undefined;
    const suffix = (match[2] || '').toUpperCase();
    if (suffix === 'K') value *= 1e3;
    else if (suffix === 'M') value *= 1e6;
    return Math.round(value);
  };

  const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
  const resolved = { time: 0, reply: 0, retweet: 0, like: 0, handle: 0, verified: 0 };

  const rows = articles.map((article) => {
    const countFor = (testid) =>
      parseCount(article.querySelector(`[data-testid="${testid}"]`)?.getAttribute('aria-label'));
    const datetime = article.querySelector('time[datetime]')?.getAttribute('datetime');
    const handle = (article.querySelector('[data-testid="User-Name"]')?.textContent || '').match(/@(\w+)/)?.[1];
    const verified = !!article.querySelector('svg[aria-label="Verified account"], [data-testid="icon-verified"]');

    const row = { handle, datetime, reply: countFor('reply'), retweet: countFor('retweet'), like: countFor('like'), verified };
    if (datetime) resolved.time++;
    if (row.reply !== undefined) resolved.reply++;
    if (row.retweet !== undefined) resolved.retweet++;
    if (row.like !== undefined) resolved.like++;
    if (handle) resolved.handle++;
    if (verified) resolved.verified++;
    return row;
  });

  const total = articles.length;
  console.log(`Drift probe: ${total} tweets in DOM`);
  console.table(resolved);
  console.log(`Resolved per signal (out of ${total}):`, resolved);
  console.table(rows);
  if (total === 0) console.warn('No tweet articles found — the article selector itself has drifted.');
})();
