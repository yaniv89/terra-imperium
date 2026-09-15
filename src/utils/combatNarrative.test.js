import { describe, it, expect } from 'vitest';
import { narratePlayerStorm, narrateEnemyStorm } from './combatNarrative';

describe('narratePlayerStorm (Phase 9: escalating flavor text)', () => {
  it('escalates win phrasing with the margin of victory', () => {
    const rout = narratePlayerStorm('win', { regionName: 'Gaza', ratio: 2.5 });
    const decisive = narratePlayerStorm('win', { regionName: 'Gaza', ratio: 1.5 });
    const hardFought = narratePlayerStorm('win', { regionName: 'Gaza', ratio: 1.05 });
    expect(rout).toContain('Gaza');
    expect(rout).not.toBe(decisive);
    expect(decisive).not.toBe(hardFought);
  });

  it('distinguishes a near-breakthrough stalemate from a slow one', () => {
    const near = narratePlayerStorm('stalemate', { regionName: 'Gaza', ratio: 0.99 });
    const slow = narratePlayerStorm('stalemate', { regionName: 'Gaza', ratio: 0.5 });
    expect(near).not.toBe(slow);
  });

  it('distinguishes a rout loss from an ordinary stalled offensive', () => {
    const routed = narratePlayerStorm('loss', { regionName: 'Gaza', ratio: 0.2 });
    const stalled = narratePlayerStorm('loss', { regionName: 'Gaza', ratio: 0.8 });
    expect(routed).not.toBe(stalled);
    expect(routed.toLowerCase()).toContain('rout');
  });

  it('always includes the region name', () => {
    ['win', 'stalemate', 'loss'].forEach(outcome => {
      expect(narratePlayerStorm(outcome, { regionName: 'TestRegion', ratio: 1 })).toContain('TestRegion');
    });
  });
});

describe('narrateEnemyStorm (Phase 9)', () => {
  it('capture and overrun are distinct events, each with their own ratio-scaled variant', () => {
    const captureText = narrateEnemyStorm('capture', { regionName: 'Negev', nationName: 'Egypt', ratio: 1.1 });
    const overrunText = narrateEnemyStorm('overrun', { regionName: 'Negev', nationName: 'Egypt', ratio: 1.1, damage: 25 });
    expect(captureText).not.toBe(overrunText);
    expect(captureText).toContain('Negev');
    expect(overrunText).toContain('25');
  });

  it('escalates capture phrasing on an overwhelming ratio', () => {
    const normal = narrateEnemyStorm('capture', { regionName: 'Negev', nationName: 'Egypt', ratio: 1.1 });
    const overwhelming = narrateEnemyStorm('capture', { regionName: 'Negev', nationName: 'Egypt', ratio: 3 });
    expect(normal).not.toBe(overwhelming);
  });

  it('includes the damage amount in the stalemate message', () => {
    const text = narrateEnemyStorm('stalemate', { regionName: 'Negev', nationName: 'Egypt', ratio: 0.9, damage: 10 });
    expect(text).toContain('10');
    expect(text).toContain('Negev');
  });

  it('distinguishes a routed attacker defeat from an ordinary repel', () => {
    const routed = narrateEnemyStorm('defeat', { regionName: 'Negev', nationName: 'Egypt', ratio: 0.2 });
    const repelled = narrateEnemyStorm('defeat', { regionName: 'Negev', nationName: 'Egypt', ratio: 0.8 });
    expect(routed).not.toBe(repelled);
    expect(routed.toLowerCase()).toContain('rout');
  });
});
