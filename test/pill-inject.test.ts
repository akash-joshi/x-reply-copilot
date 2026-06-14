import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { injectPill, PILL_CLASS } from '../lib/pills';
import { extractSignals } from '../lib/tweet-dom';
import { scoreTweet } from '../lib/scoring';
import { DEFAULT_SETTINGS } from '../lib/types';

const fixtureHtml = readFileSync('test/fixtures/timeline.html', 'utf8');
const GREEN_THRESHOLD = DEFAULT_SETTINGS.scoring.greenThreshold;
const FIXED_NOW = Date.parse('2026-06-14T18:00:00.000Z');

/** A fresh, detached copy of the first tweet so each test starts unmodified. */
function freshTweet(): Element {
  const { document } = new JSDOM(fixtureHtml).window;
  return document.querySelector('article[data-testid="tweet"]') as Element;
}

describe('injectPill', () => {
  it('injects exactly one pill into a tweet', () => {
    const article = freshTweet();
    expect(injectPill(article, GREEN_THRESHOLD, FIXED_NOW)).toBe(true);
    expect(article.querySelectorAll(`.${PILL_CLASS}`)).toHaveLength(1);
  });

  it('does not add a second pill when re-run on the same tweet', () => {
    const article = freshTweet();
    injectPill(article, GREEN_THRESHOLD, FIXED_NOW);
    expect(injectPill(article, GREEN_THRESHOLD, FIXED_NOW)).toBe(false);
    expect(article.querySelectorAll(`.${PILL_CLASS}`)).toHaveLength(1);
  });

  it('labels the pill with the tier the scorer assigns', () => {
    const article = freshTweet();
    const expectedTier = scoreTweet(extractSignals(article, FIXED_NOW), GREEN_THRESHOLD).tier;
    injectPill(article, GREEN_THRESHOLD, FIXED_NOW);
    const pill = article.querySelector(`.${PILL_CLASS}`)!;
    expect(pill.className).toContain(expectedTier);
  });
});
