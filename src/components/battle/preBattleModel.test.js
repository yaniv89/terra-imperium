// src/components/battle/preBattleModel.test.js
// W11 Pre-battle: without intel the odds are the scouts' band and their men a range; a spy
// report makes them exact and says so; the walls and the houses; 300 a side.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getNeighborIds } from '../../data/regions';
import { atGates } from '../../engine/testWorld';
import { preBattleModel, autoText } from './preBattleModel';

const setup = () => {
  const state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  const from = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr' && getNeighborIds(id).some((n) => state.regions[n]?.owner === 'de'));
  const target = getNeighborIds(from).find((n) => state.regions[n]?.owner === 'de');
  const s = atGates({
    ...state,
    wars: [{ id: 'w', aggressor: 'fr', enemy: 'de', active: true, score: 0 }],
    resources: { ...state.resources, gold: 10000, mil: 1000 },
    units: {
      a: { id: 'a', ownerId: 'fr', regionId: from, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1 },
      d: { id: 'd', ownerId: 'de', regionId: target, domain: 'land', classId: 'infantry', strength: 300, maxStrength: 300, morale: 100, movesLeft: 1 }
    }
  }, from, target);
  return { s, from, target };
};

describe('W11 preBattleModel', () => {
  it("without intel: the scouts' band, a range of men, never exact odds", { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const m = preBattleModel(s, { fromRegionId: from, targetRegionId: target }, { samples: 20 });
    expect(m.v.ok).toBe(true);
    expect(m.chance.exact).toBe(false);
    expect(m.chance.verdict).toBe('Likely win');
    expect(m.chance.band[1] - m.chance.band[0]).toBeCloseTo(0.33, 5);
    expect(m.theirs.total).toMatch(/^about [\d,]+ to [\d,]+$/);
    expect(m.yours.men).toBe(1000);
    expect(m.walls.maxLost).toBeUndefined();
    expect(m.walls.ruleText).toBeUndefined();
    expect(m.size.cap).toBe(300);
    expect(m.command).toMatch(/300 a side/);
  });

  it('with a spy report: exact odds, named as such', { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const m = preBattleModel({ ...s, intel: { de: s.turnNumber + 3 } }, { fromRegionId: from, targetRegionId: target }, { samples: 20 });
    expect(m.chance).toMatchObject({ exact: true, source: 'Spy report' });
    expect(m.chance.win + m.chance.lose + m.chance.draw).toBeCloseTo(1, 5);
    expect(typeof m.theirs.total).toBe('number');
  });
});

describe('the two ways against a city (the 14 October rule)', () => {
  it('the card says Auto fights the garrison first and Command takes a city it wins', { timeout: 20000 }, () => {
    const { s, from, target } = setup();
    const m = preBattleModel(s, { fromRegionId: from, targetRegionId: target }, { samples: 10 });
    expect(m.cityRule).toBe('garrison');
    expect(m.auto).toMatch(/Auto fights the garrison first; the city is taken only when empty and its defences are broken/);
    expect(m.command).toMatch(/^Win the battle and the city is yours/);
    const { d, ...rest } = s.units; // eslint-disable-line no-unused-vars
    expect(preBattleModel({ ...s, units: rest }, { fromRegionId: from, targetRegionId: target }, { samples: 10 }).cityRule).toBe('attack');
  });

  it('an empty city seen up close says how far one attack brings its defences down', () => {
    const text = autoText({ knownEmpty: true, odds: { capture: 0, city: { hpBefore: 520, hpAfter: 340, maxHp: 520 } } });
    expect(text).toMatch(/520 of 520 HP down to about 340/);
    expect(text).toMatch(/needs more attacks/);
    expect(autoText({ field: true })).toMatch(/the field is yours/);
  });
});