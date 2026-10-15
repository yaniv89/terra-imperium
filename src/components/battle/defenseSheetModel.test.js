// src/components/battle/defenseSheetModel.test.js
// W14 "You are attacked": the interrupt names the battle, lists both forces with the city's
// militia and battle housing, offers Withdraw only for a city with somewhere to fall back to, and
// the 300-a-side line splits the regiments into those that fight at once and the waves.
import { describe, it, expect } from 'vitest';
import { addCity } from '../../engine/testWorld';
import { createDefenseRecord } from '../../engine/defense';
import { getNeighborIds } from '../../data/regions';
import { defenseSheetModel } from './defenseSheetModel';
import { queuedBattleView } from '../../engine/battleQueue';
import { armyView, battleSize, oddsSource, scoutsRange, battleMinutes, wallsLabel, siegeAdvice } from './warModel';
import { getCategoryTierName } from '../../data/buildings';
import { cityManifestOf } from '../../engine/cityManifest';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 1 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

const WORLD = (() => {
  const first = addCity(peoplesWorld({ seed: 1 }), FR_ID);
  const foe = addCity(first.state, DE_ID, { near: first.cityId });
  const second = addCity(foe.state, FR_ID, { near: first.cityId });
  const border = getNeighborIds(first.cityId).includes(foe.cityId) ? foe.cityId : getNeighborIds(first.cityId).find((id) => second.state.regions[id].owner !== FR_ID);
  return { state: second.state, city: first.cityId, foe: border, agg: second.state.regions[border].owner };
})();
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 100) => ({ id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 100, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1 });

const withAttack = () => {
  const s = WORLD.state;
  const war = { id: 'war_w14', aggressor: WORLD.agg, enemy: FR_ID, active: true, startYear: s.year, startTurn: s.turnNumber, battleScore: 0 };
  const units = { g1: unit('g1', WORLD.city, FR_ID), g2: unit('g2', WORLD.city, FR_ID, 'ranged', 60), r1: unit('r1', WORLD.foe, WORLD.agg, 'cavalry', 80) };
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

  it('I011: a hopeless defence warns with the odds and what losing costs, and suggests Withdraw unless Settings chose a mode', () => {
    const { st, def } = withAttack();
    const real = queuedBattleView(st, def, 2);
    const view = { ...real, odds: { ...(real.odds || {}), undefended: false, holdChance: 0.05 } };
    const m = defenseSheetModel(st, def, { view });
    expect(m.hopeless).toBe(true);
    expect(m.warning).toMatch(/^Badly outnumbered: Auto holds only 5% of the time\./);
    expect(m.warning).not.toMatch(/—/);
    expect(m.suggested).toBe(m.withdraw?.ok ? 'withdraw' : 'command');
    const chosen = defenseSheetModel({ ...st, battleSettings: { defaultMode: 'command' } }, def, { view });
    expect(chosen.suggested).toBe('command'); // an intentional Command stays the choice
    const even = defenseSheetModel(st, def, { view: { ...view, odds: { ...view.odds, holdChance: 0.5 } } });
    expect(even.hopeless).toBe(false);
    expect(even.warning).toBeNull();
    expect(even.suggested).toBe('command');
  });

  it('offers Withdraw only with somewhere to fall back to', () => {
    const { st, def } = withAttack();
    const m = defenseSheetModel(st, def, { samples: 2 });
    expect(m.withdraw).not.toBeNull();
    if (m.withdraw.ok) expect(m.withdraw.text).toMatch(/falls back to .* \(-25 morale, -5% men\)/);
    else expect(m.withdraw.text).toBe('Nowhere to fall back to.');
  });

  // DEF-01: Command on a militia-only city opens; with nobody to command the card says why first.
  it('a militia-only city says Command is the militia alone; a city with nobody disables Command with the reason', () => {
    const { st, def } = withAttack();
    const bare = { ...st, units: { r1: st.units.r1 } };
    const m = defenseSheetModel(bare, def, { samples: 2 });
    expect(m.commandBlocked).toBeNull();
    expect(m.yours.title).toBe('Militia only');
    expect(m.command).toMatch(/^No regiment stands in .*: you command its militia alone\./);
    const manifest = cityManifestOf(bare, WORLD.city);
    const ruined = Object.fromEntries(manifest.structures.map((x) => [x.id, true]));
    const empty = { ...bare, regions: { ...bare.regions, [WORLD.city]: { ...bare.regions[WORLD.city], cityDamage: { ruined, damaged: {} } } } };
    const e = defenseSheetModel(empty, def, { samples: 2 });
    expect(e.commandBlocked).toMatch(/^No one in .* to command: no regiment, and no militia without houses\./);
    expect(e.suggested).toBe(e.hopeless && e.withdraw?.ok ? 'withdraw' : 'auto');
    expect(e.commandBlocked).not.toMatch(/—/);
  });
});

describe('warModel', () => {
  it('groups a side by kind with men and generals', () => {
    const v = armyView([unit('a', 'x', FR_ID), unit('b', 'x', FR_ID), { ...unit('c', 'x', FR_ID, 'ranged', 50), commanderId: 'g1' }, { ...unit('m', 'x', FR_ID, 'infantry', 30), militia: true }], { hiredCommanders: { g1: { name: 'Sargon', skill: 3 } } });
    expect(v.men).toBe(280);
    expect(v.regiments).toBe(4);
    expect(v.lines[0]).toMatchObject({ regiments: 2, men: 200 });
    expect(v.lines.find((l) => l.id === 'militia').men).toBe(30);
    expect(v.generals).toEqual([{ id: 'g1', name: 'Sargon', skill: 3 }]);
  });

  it('I009: one name for a city\'s walls on every screen; an open town has none', () => {
    expect(wallsLabel({ buildings: { categories: {} } })).toBe('No walls');
    expect(wallsLabel({ buildings: { categories: { defense: 0 } } })).toBe(getCategoryTierName('defense', 0));
    expect(wallsLabel(null)).toBe('No walls');
  });

  it('I213: walls and no siege engine in the army: bring them or build a workshop in the battle', () => {
    const inf = [{ classId: 'infantry', strength: 1000 }];
    expect(siegeAdvice({ wallLevel: 0, units: inf, ageId: 'classical' })).toBeNull();
    expect(siegeAdvice({ wallLevel: 2, units: [...inf, { classId: 'siege', strength: 500 }], ageId: 'classical' })).toBeNull();
    const advice = siegeAdvice({ wallLevel: 2, units: inf, ageId: 'classical' });
    expect(advice).toMatch(/^Walls: without siege engines/);
    expect(advice).toMatch(/in the battle to train them\.$/);
    expect(advice).not.toMatch(/\u2014/);
  });

  it('300 a side: the whole army on the field at once, whatever the ground (U10: no waves)', () => {
    expect(battleSize({ regiments: 3, terrain: 'plains' })).toMatchObject({ cap: 300, front: 3, heldBack: 0 });
    expect(battleSize({ regiments: 9, terrain: 'mountains' })).toMatchObject({ front: 9, heldBack: 0, text: 'All 9 regiments on the field at once.' });
    expect(battleSize({ regiments: 305 })).toMatchObject({ front: 300, heldBack: 5 });
    expect(battleSize({ regiments: 9 }).text).not.toMatch(/wave/);
    expect(battleMinutes('assault')).toBe(30);
    expect(battleMinutes('field')).toBe(15);
  });

  it('the odds source: exact for your own city and open ground, else the scouts', () => {
    const s = WORLD.state;
    expect(oddsSource(s, { defending: true }).exact).toBe(true);
    expect(oddsSource(s, { field: true }).exact).toBe(true);
    expect(oddsSource(s, { targetRegionId: WORLD.foe }).exact).toBe(false);
    expect(oddsSource({ ...s, intel: { [WORLD.agg]: s.turnNumber + 3 } }, { targetRegionId: WORLD.foe })).toMatchObject({ exact: true, label: 'Spy report' });
    expect(scoutsRange(290).text).toBe('about 2,320 to 3,480');
  });
});
