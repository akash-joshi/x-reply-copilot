import type { TweetSignals } from './types';

/** Parse a count from an engagement button's aria-label, e.g. "7 Likes. Like" -> 7. */
function parseCount(label: string | null | undefined): number | undefined {
  if (!label) return undefined;
  const match = label.match(/([\d,.]+)\s*(K|M)?/i);
  if (!match) return undefined;
  let value = parseFloat(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return undefined;
  const suffix = match[2]?.toUpperCase();
  if (suffix === 'K') value *= 1_000;
  else if (suffix === 'M') value *= 1_000_000;
  return Math.round(value);
}

function countFromButton(article: Element, testid: string): number | undefined {
  const button = article.querySelector(`[data-testid="${testid}"]`);
  return parseCount(button?.getAttribute('aria-label'));
}

/**
 * Extract scoring signals from a tweet article. Every getter is optional and
 * returns undefined rather than throwing, so X markup changes degrade gracefully.
 * `now` is injectable for deterministic age calculation in tests.
 */
export function extractSignals(article: Element, now: number = Date.now()): TweetSignals {
  const signals: TweetSignals = {};

  const datetime = article.querySelector('time[datetime]')?.getAttribute('datetime');
  if (datetime) {
    const posted = new Date(datetime).getTime();
    if (Number.isFinite(posted)) {
      signals.ageMinutes = Math.max(0, (now - posted) / 60_000);
    }
  }

  const replyCount = countFromButton(article, 'reply');
  if (replyCount !== undefined) signals.replyCount = replyCount;
  const repostCount = countFromButton(article, 'retweet');
  if (repostCount !== undefined) signals.repostCount = repostCount;
  const likeCount = countFromButton(article, 'like');
  if (likeCount !== undefined) signals.likeCount = likeCount;

  signals.verified = Boolean(
    article.querySelector('svg[aria-label="Verified account"], [data-testid="icon-verified"]'),
  );
  signals.hasMedia = Boolean(
    article.querySelector(
      '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="card.wrapper"]',
    ),
  );

  return signals;
}

/** The author's @handle without the leading @, if present. */
export function extractAuthorHandle(article: Element): string | undefined {
  const text = article.querySelector('[data-testid="User-Name"]')?.textContent ?? '';
  const match = text.match(/@(\w+)/);
  return match ? match[1] : undefined;
}

/** A short plain-text excerpt of the tweet body, for logging and fallbacks. */
export function extractTextSnippet(article: Element, maxLength = 120): string | undefined {
  const text = article.querySelector('[data-testid="tweetText"]')?.textContent?.trim();
  return text ? text.slice(0, maxLength) : undefined;
}
