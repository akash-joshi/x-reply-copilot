import type { TweetSignals } from './types';

export type Tier = 'green' | 'red';

export interface TweetScore {
  /** Viral-reply-potential score in [0, 1]. */
  score: number;
  tier: Tier;
  /** Human-readable reasons for the score, shown in the pill tooltip. */
  reasons: string[];
}

/** Neutral value used when a signal is missing, so absence neither helps nor hurts. */
const NEUTRAL = 0.5;

const WEIGHTS = {
  freshness: 0.4,
  openness: 0.35, // inverse of reply saturation
  authority: 0.25,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Newer tweets score higher. Half-life of one hour. */
function freshnessScore(ageMinutes: number): number {
  return clamp01(0.5 ** (ageMinutes / 60));
}

/** Fewer existing replies means more room for a reply to stand out. Log-dampened. */
function opennessScore(replyCount: number): number {
  return clamp01(1 / (1 + Math.log10(1 + Math.max(0, replyCount))));
}

/** Verified status and engagement reach indicate the reply will be seen. */
function authorityScore(signals: TweetSignals): number {
  const verifiedComponent = signals.verified ? 1 : 0.4;
  const engagement = (signals.likeCount ?? 0) + (signals.repostCount ?? 0);
  const reach = clamp01(Math.log10(1 + engagement) / 4); // ~10k engagement saturates
  return clamp01(0.5 * verifiedComponent + 0.5 * reach);
}

export function scoreTweet(signals: TweetSignals, greenThreshold: number): TweetScore {
  const freshness = signals.ageMinutes === undefined ? NEUTRAL : freshnessScore(signals.ageMinutes);
  const openness = signals.replyCount === undefined ? NEUTRAL : opennessScore(signals.replyCount);
  const authority =
    signals.verified === undefined && signals.likeCount === undefined && signals.repostCount === undefined
      ? NEUTRAL
      : authorityScore(signals);

  const score = clamp01(
    WEIGHTS.freshness * freshness + WEIGHTS.openness * openness + WEIGHTS.authority * authority,
  );

  const reasons: string[] = [];
  if (signals.ageMinutes !== undefined && freshness >= 0.5) {
    reasons.push(`Fresh (${Math.round(signals.ageMinutes)}m old)`);
  }
  if (signals.replyCount !== undefined && openness >= 0.5) {
    reasons.push(`Low reply count (${signals.replyCount})`);
  }
  if (signals.verified) {
    reasons.push('Verified author');
  }
  if (authority >= 0.5 && !signals.verified) {
    reasons.push('High engagement');
  }
  if (reasons.length === 0) {
    reasons.push('Limited reply opportunity');
  }

  return { score, tier: score >= greenThreshold ? 'green' : 'red', reasons };
}
