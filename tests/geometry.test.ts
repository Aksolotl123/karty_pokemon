import { describe, expect, it } from 'vitest';
import { CARD_ASPECT, cardGuide, coverTransform, dHash, hashSimilarity, regionRect } from '../src/lib/geometry';

describe('cardGuide', () => {
  it('ma proporcje karty i mieści się w widocznym obszarze', () => {
    const g = cardGuide(1920, 1080);
    expect(g.w / g.h).toBeCloseTo(CARD_ASPECT);
    expect(g.h).toBeCloseTo(1080 * 0.82);
    expect(g.x + g.w / 2).toBeCloseTo(960);
  });
  it('wąski widoczny obszar ogranicza szerokość', () => {
    const g = cardGuide(1080, 1920, 600, 1920);
    expect(g.w).toBeCloseTo(600 * 0.82);
  });
});

describe('coverTransform', () => {
  it('wypełnia element i centruje', () => {
    const t = coverTransform(400, 800, 1920, 1080);
    expect(t.scale).toBeCloseTo(800 / 1080);
    expect(t.offsetY).toBeCloseTo(0);
    expect(t.offsetX).toBeLessThan(0);
  });
});

describe('regionRect', () => {
  it('przycina do granic obrazu', () => {
    const r = regionRect({ x: 0, y: 0, w: 100, h: 100 }, { x: -0.1, y: 0.9, w: 1.2, h: 0.2 }, 100, 100);
    expect(r).toEqual({ x: 0, y: 90, w: 100, h: 10 });
  });
});

describe('dHash', () => {
  it('identyczne obrazy → 1, odwrócone gradienty → 0', () => {
    const up = [0, 1, 2, 0, 1, 2]; // 2×2 bity z obrazka 3×2
    const down = [2, 1, 0, 2, 1, 0];
    expect(hashSimilarity(dHash(up, 2, 2), dHash(up, 2, 2))).toBe(1);
    expect(hashSimilarity(dHash(up, 2, 2), dHash(down, 2, 2))).toBe(0);
    expect(hashSimilarity(new Uint8Array(0), new Uint8Array(0))).toBe(0);
  });
});
