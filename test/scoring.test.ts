import { describe, it, expect } from 'vitest';
import { scoreTweet } from '../lib/scoring';
import { DEFAULT_SETTINGS, type TweetSignals } from '../lib/types';

const GREEN_THRESHOLD = DEFAULT_SETTINGS.scoring.greenThreshold;

// A fresh tweet from a verified account with little competition: a good reply target.
const HIGH_OPPORTUNITY: TweetSignals = {
  ageMinutes: 5,
  replyCount: 1,
  repostCount: 20,
  likeCount: 400,
  verified: true,
  hasMedia: true,
};

// An old, heavily-replied tweet from an unverified account: a poor target.
const LOW_OPPORTUNITY: TweetSignals = {
  ageMinutes: 60 * 48,
  replyCount: 5000,
  repostCount: 0,
  likeCount: 1,
  verified: false,
  hasMedia: false,
};

describe('scoreTweet', () => {
  it('rates a fresh, low-competition, verified tweet as a green opportunity', () => {
    const result = scoreTweet(HIGH_OPPORTUNITY, GREEN_THRESHOLD);
    expect(result.tier).toBe('green');
    expect(result.score).toBeGreaterThanOrEqual(GREEN_THRESHOLD);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('rates a stale, saturated, unverified tweet as red', () => {
    const result = scoreTweet(LOW_OPPORTUNITY, GREEN_THRESHOLD);
    expect(result.tier).toBe('red');
    expect(result.score).toBeLessThan(GREEN_THRESHOLD);
  });

  it('ranks the high-opportunity tweet above the low-opportunity one', () => {
    expect(scoreTweet(HIGH_OPPORTUNITY, GREEN_THRESHOLD).score).toBeGreaterThan(
      scoreTweet(LOW_OPPORTUNITY, GREEN_THRESHOLD).score,
    );
  });

  it('always returns a finite score within [0, 1]', () => {
    for (const signals of [HIGH_OPPORTUNITY, LOW_OPPORTUNITY, {}, { ageMinutes: 10 }]) {
      const { score } = scoreTweet(signals, GREEN_THRESHOLD);
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('does not throw and stays neutral when no signals are present', () => {
    expect(() => scoreTweet({}, GREEN_THRESHOLD)).not.toThrow();
    const { score } = scoreTweet({}, GREEN_THRESHOLD);
    expect(score).toBeGreaterThan(0.2);
    expect(score).toBeLessThan(0.8);
  });
});
