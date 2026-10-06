import { describe, it, expect } from 'vitest';
import { describeOutcome, sidesFor, timelineFor } from './battleReportView';

const base = { targetRegionId: 'xx-none', playerSide: 'attacker', kind: 'land', captured: false, timeline: [{ round: 0, att: 1000, def: 500 }, { round: 1, att: 800, def: 200, defBroken: true }] };

describe('battle report view', () => {
  it('reads outcomes from the player side', () => {
    expect(describeOutcome({ ...base, outcome: 'attacker', captured: true }).tone).toBe('win');
    expect(describeOutcome({ ...base, outcome: 'defender' }).tone).toBe('loss');
    expect(describeOutcome({ ...base, playerSide: 'defender', outcome: 'defender' }).tone).toBe('win');
    expect(describeOutcome({ ...base, playerSide: 'defender', outcome: 'attacker', captured: true }).text).toMatch(/lost$/);
    expect(describeOutcome({ ...base, outcome: 'stalemate' }).tone).toBe('draw');
  });

  it('puts the player first in the timeline whichever side they fought on', () => {
    expect(sidesFor({ playerSide: 'defender' })).toEqual({ mine: 'defender', theirs: 'attacker' });
    const asAttacker = timelineFor(base);
    expect(asAttacker[1]).toMatchObject({ mine: 0.8, theirs: 0.4, theirsBroken: true });
    const asDefender = timelineFor({ ...base, playerSide: 'defender' });
    expect(asDefender[1]).toMatchObject({ mine: 0.4, theirs: 0.8, mineBroken: true });
  });

  it('has nothing to play without at least two points', () => {
    expect(timelineFor({ ...base, timeline: [{ round: 0, att: 1, def: 1 }] })).toEqual([]);
    expect(timelineFor({ ...base, timeline: null })).toEqual([]);
  });
});

describe('scouts estimate', () => {
  it('turns a chance into three broad bands', async () => {
    const { scoutsEstimate } = await import('./battleReportView');
    expect(scoutsEstimate(0.9).id).toBe('likely');
    expect(scoutsEstimate(0.5).id).toBe('uncertain');
    expect(scoutsEstimate(0.1).id).toBe('unlikely');
    expect(scoutsEstimate(0).id).toBe('unlikely');
  });
});

describe('replay sampling', () => {
  it('stays on the timeline for any progress value', async () => {
    const { sample } = await import('./BattleReplay');
    const pts = timelineFor(base);
    expect(sample(pts, -0.01)).toMatchObject({ round: 0, mine: 1, theirs: 1 });
    expect(sample(pts, 0.5)).toMatchObject({ round: 0, mine: 0.9, theirs: 0.7 });
    expect(sample(pts, 1)).toMatchObject({ round: 1, mine: 0.8, theirs: 0.4 });
    expect(sample(pts, 7)).toMatchObject({ round: 1 });
    expect(sample(pts, NaN)).toMatchObject({ round: 0 });
  }, 60000); // the dynamic import pulls in GameContext and the whole engine (several seconds under load)
});
