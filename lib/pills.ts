import { extractSignals } from './tweet-dom';
import { scoreTweet } from './scoring';

export const PILL_CLASS = 'xrc-pill';

/** Attribute marking an article as already scored, so re-scans are idempotent. */
const SCORED_MARKER = 'data-xrc-scored';

/**
 * Score a tweet article and inject a single green/red pill into its action bar.
 * Idempotent: returns false (and does nothing) if the article was already scored.
 * `now` is injectable for deterministic tests.
 */
export function injectPill(article: Element, greenThreshold: number, now?: number): boolean {
  if (article.hasAttribute(SCORED_MARKER)) return false;
  article.setAttribute(SCORED_MARKER, '');

  const { tier, score, reasons } = scoreTweet(extractSignals(article, now), greenThreshold);

  const pill = (article.ownerDocument ?? document).createElement('span');
  pill.className = `${PILL_CLASS} ${PILL_CLASS}--${tier}`;
  pill.textContent = tier === 'green' ? '🟢' : '🔴';
  pill.title = `${Math.round(score * 100)}% reply potential — ${reasons.join('; ')}`;
  pill.style.marginLeft = '8px';
  pill.style.cursor = 'help';
  pill.style.fontSize = '14px';

  const actionBar = article.querySelector('[role="group"]');
  (actionBar ?? article).appendChild(pill);
  return true;
}
