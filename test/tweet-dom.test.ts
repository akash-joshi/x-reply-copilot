import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { extractSignals, extractAuthorHandle } from '../lib/tweet-dom';

// Vitest runs with the project root as cwd.
const fixtureHtml = readFileSync('test/fixtures/timeline.html', 'utf8');

const { document } = new JSDOM(fixtureHtml).window;
const articles = Array.from(
  document.querySelectorAll('article[data-testid="tweet"]'),
) as Element[];
const firstTweet = articles[0];

describe('extractSignals', () => {
  it('reads signals from every tweet in the fixture without throwing', () => {
    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expect(() => extractSignals(article)).not.toThrow();
      const signals = extractSignals(article);
      for (const count of [signals.replyCount, signals.repostCount, signals.likeCount]) {
        if (count !== undefined) {
          expect(count).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(count)).toBe(true);
        }
      }
    }
  });

  it('distinguishes reply, repost and like counts from their aria-labels', () => {
    // The first fixture tweet's engagement bar reads "1 Reply", "0 reposts", "7 Likes".
    const signals = extractSignals(firstTweet);
    expect(signals.replyCount).toBe(1);
    expect(signals.repostCount).toBe(0);
    expect(signals.likeCount).toBe(7);
    expect(signals.verified).toBe(true);
  });

  it('computes age in minutes from the timestamp relative to now', () => {
    const ageMinutes = 180;
    const datetime = firstTweet.querySelector('time')!.getAttribute('datetime')!;
    const now = new Date(datetime).getTime() + ageMinutes * 60_000;

    expect(extractSignals(firstTweet, now).ageMinutes).toBeCloseTo(ageMinutes, 5);
  });
});

describe('extractAuthorHandle', () => {
  it('pulls the @handle out of the author block', () => {
    const handle = extractAuthorHandle(firstTweet);
    expect(handle).toBeTruthy();
    expect(handle).not.toContain('@');
  });
});
