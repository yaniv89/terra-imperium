// src/components/battle/defenseSheetModel.test.js
// W14 "You are attacked": the interrupt names the battle, lists both forces with the city's
// militia and battle housing, offers Withdraw only for a city with somewhere to fall back to, and
// the 300-a-side line splits the regiments into those that fight at once and the waves.
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { addCity } from '../../engine/testWorld';
import { createDefenseRecord } from '../../engine/defense';
import { getNeighborIds } from '../../data/regions';
import { defenseSheetModel } from './defenseSheetModel';
import { armyView, battleSize, oddsSource, scoutsRange, battleMinutes } from './warModel';

const WORLD = (() => {
  const first = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 1 }), 'fr');
  const foe = addCity(first.state, 'de', { near: first.cityId });
  const second = addCity(foe.state, 'fr', { near: first.cityId });
  const border = getNeighborIds(first.cityId).includes(foe.cityId) ? foe.cityId : getNeighborIds(first.cityId).find((id) => second.state.regions[id].owner !== 'fr');
  return { state: second.state, city: first.cityId, foe: border, agg: second.state.regions[border].owner };
})();
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 100) => ({ id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 100, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1 });

const withAttack = () => {
  const s = WORLD.state;
  const war = { id: 'war_w14', aggressor: WORLD.agg, enemy: 'fr', active: true, startYear: s.year, startTurn: s.turnNumber, battleScore: 0 };
  const units = { g1: unit('g1', WORLD.city, 'fr'), g2: unit('g2', WORLD.city, 'fr', 'ranged', 60), r1: unit('r1', WORLD.foe, WORLD.agg, 'cavalry', 80) };
  const st = { ...s, units, wars: [...s.wars, war] };
  const def = createDefenseRecord(st, { war, regionId: WORLD.city, aggressorShare: 0.5, seed: 7, index: 1 });
  return { st: { ...st, pendingDefenses: [def] }, def };
};

describe('W14 defenseSheetModel', () => {
  it('names the battle and both forces, with the militia and the battle housing', () => {
    const { st, def } = withAttack();
    const m = defenseSheetModel(st, def, { samples: 4 });
    expect(m.city).toBe(true);
    expect(m.name).toMatch(/Siege of|Battle of|Assault on/);
    expect(m.theirs.men).toBeGreaterThan(0);
    expect(m.yours.men).toBeGreaterThanOrEqual(160); // garrison 160 plus the militia
    expect(m.yours.men).toBe(160 + m.yours.militia);
    expect(m.walls.housing).toBeGreaterThan(0);
    expect(m.odds.hold).toBeGreaterThanOrEqual(0);
    expect(m.odds.hold).toBeLessThanOrEqual(1);
    expect(m.command).toMatch(/300 a side/);
    expect(m.auto).toMatch(/Auto holds \d+% of the time/);
  });

  it('offers Withdraw only with somewhere to fall back to', () => {
    const { st, def } = withAttack();
    const m = defenseSheetModel(st, def, { samples: 2 });
    expect(m.withdraw).not.toBeNull();
    if (m.withdraw.ok) expect(m.withdraw.text).toMatch(/falls back to .* \(-25 morale, -5% men\)/);
    else expect(m.withdraw.text).toBe('Nowhere to fall back to.');
  });
});

describe('warModel', () => {
  it('groups a side by kind with men and generals', () => {
    const v = armyView([unit('a', 'x', 'fr'), unit('b', 'x', 'fr'), { ...unit('c', 'x', 'fr', 'ranged', 50), commanderId: 'g1' }, { ...unit('m', 'x', 'fr', 'infantry', 30), militia: true }], { hiredCommanders: { g1: { name: 'Sargon', skill: 3 } } });
    expect(v.men).toBe(280);
    expect(v.regiments).toBe(4);
    expect(v.lines[0]).toMatchObject({ regiments: 2, men: 200 });
    expect(v.lines.find((l) => l.id === 'militia').men).toBe(30);
    expect(v.generals).toEqual([{ id: 'g1', name: 'Sargon', skill: 3 }]);
  });

  it('300 a side: the front by the ground, the rest as waves', () => {
    expect(battleSize({ regiments: 3, terrain: 'plains' })).toMatchObject({ cap: 300, front: 3, waves: 0 });
    expect(battleSize({ regiments: 9, terrain: 'mountains' })).toMatchObject({ front: 3, waves: 6 });
    expect(battleMinutes('assault')).toBe(30);
    expect(battleMinutes('field')).toBe(15);
  });

  it('the odds source: exact for your own city and open ground, else the scouts', () => {
    const s = WORLD.state;
    expect(oddsSource(s, { defending: true }).exact).toBe(true);
    expect(oddsSource(s, { field: true }).exact).toBe(true);
    expect(oddsSource(s, { targetRegionId: WORLD.foe }).exact).toBe(false);
    expect(oddsSource({ ...s, intel: { [WORLD.agg]: s.turnNumber + 3 } }, { targetRegionId: WORLD.foe })).toMatchObject({ exact: true, label: 'Spy report' });
    expect(scoutsRange(290).text).toBe('about 230 to 350');
  });
});
