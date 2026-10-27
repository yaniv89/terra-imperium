// scripts/art/town-size-check.test.mjs
import { describe, it, expect } from 'vitest';
import { townSizeReport, townFiles } from './town-size-check.mjs';

const MB = 1024 * 1024;

describe('town size budget (KTD16)', () => {
  it('fails over budget', () => {
    expect(townSizeReport([{ name: 'future-town-big-a.glb', bytes: 3 * MB }]).problems).toHaveLength(1);
    expect(townSizeReport(Array.from({ length: 40 }, (_, i) => ({ name: `stone-town-${i}.glb`, bytes: 1.9 * MB }))).problems[0]).toMatch(/^stone towns/);
    expect(townSizeReport([{ name: 'kingdoms-town-big-a.glb', bytes: 900 * MB }]).problems).toEqual(['towns total 900.0 MB (max 850)']);
  });

  it('holds for the shipped towns', () => {
    expect(townSizeReport(townFiles()).problems).toEqual([]);
  });
});
