import { describe, it, expect } from 'vitest';
import { computeCropRect, fitWithin } from '../lib/capture';

const TWEET = { left: 100, top: 200, width: 300, height: 150 };

describe('computeCropRect', () => {
  it('maps 1:1 when the captured frame matches the viewport size', () => {
    const viewport = { width: 1280, height: 800 };
    const crop = computeCropRect(TWEET, viewport, viewport);
    expect(crop).toEqual({ sx: TWEET.left, sy: TWEET.top, sw: TWEET.width, sh: TWEET.height });
  });

  it('scales by the frame/viewport ratio for a high-DPI capture', () => {
    const scale = 2;
    const viewport = { width: 1280, height: 800 };
    const frame = { width: viewport.width * scale, height: viewport.height * scale };
    const crop = computeCropRect(TWEET, frame, viewport);
    expect(crop).toEqual({
      sx: TWEET.left * scale,
      sy: TWEET.top * scale,
      sw: TWEET.width * scale,
      sh: TWEET.height * scale,
    });
  });

  it('clamps a crop that would extend past the frame bounds', () => {
    const frame = { width: 500, height: 400 };
    const overflow = { left: 450, top: 380, width: 200, height: 200 };
    const crop = computeCropRect(overflow, frame, frame);
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(frame.width);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(frame.height);
  });

  it('never produces negative offsets for a partly off-screen tweet', () => {
    const frame = { width: 500, height: 400 };
    const offScreen = { left: -50, top: -30, width: 100, height: 80 };
    const crop = computeCropRect(offScreen, frame, frame);
    expect(crop.sx).toBe(0);
    expect(crop.sy).toBe(0);
  });
});

describe('fitWithin', () => {
  const MAX = 1024;

  it('shrinks the longest edge to the maximum, preserving aspect ratio', () => {
    expect(fitWithin(2000, 1000, MAX)).toEqual({ width: MAX, height: MAX / 2 });
  });

  it('handles a tall image by clamping its height', () => {
    expect(fitWithin(1000, 2000, MAX)).toEqual({ width: MAX / 2, height: MAX });
  });

  it('never upscales an image already within bounds', () => {
    const small = { width: 100, height: 80 };
    expect(fitWithin(small.width, small.height, MAX)).toEqual(small);
  });
});
