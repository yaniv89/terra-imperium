import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { cityManifestOf, cityHousingCap } from '../../engine/cityManifest';
import { cityDefenseModel, engageTarget } from './cityDefenseModel';
import { getTiles } from '../../data/geo/tiles';
import { rivalOf } from '../../engine/testWorld';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const cap = base.nations[base.playerNationId].capitalRegionId;

describe('the city sheet Defense tab (W05)', () => {
  it('explains the battle housing line by line and adds up to the cap', () => {
    const m = cityDefenseModel(base, cap);
    const manifest = cityManifestOf(base, cap);
    expect(m.housing).toBe(cityHousingCap(base, cap, manifest));
    expect(m.lines.map((l) => l.id)).toEqual(['houses', 'townhall']);
    expect(m.lines.reduce((s, l) => s + l.value, 0)).toBe(m.housing);
    expect(m.alert).toBeNull();
  });

  it('counts ruined houses out and says when the damage is repaired', () => {
    const manifest = cityManifestOf(base, cap);
    const [h0, h1] = manifest.structures.filter((s) => s.kind === 'house');
    const s = { ...base, regions: { ...base.regions, [cap]: { ...base.regions[cap], cityDamage: { ruined: { [h0.id]: 5, [h1.id]: 7 }, damaged: { townhall: 2 } } } } };
    const m = cityDefenseModel(s, cap);
    expect(m.lines.find((l) => l.id === 'ruined')).toMatchObject({ value: -(h0.housing + h1.housing) });
    expect(m.lines.reduce((sum, l) => sum + l.value, 0)).toBe(m.housing);
    expect(m.alert).toMatchObject({ ruined: 2, damaged: 1, rebuiltIn: 7, repairedIn: 2, paused: false });
    expect(m.alert.text).toBe('2 houses ruined, rebuilt in 7 turns; 1 damaged, repaired in 2 turns');
    const sieged = { ...s, regions: { ...s.regions, [cap]: { ...s.regions[cap], siege: { by: 'elam', hp: 10, maxHp: 20 } } } };
    expect(cityDefenseModel(sieged, cap).alert.text).toMatch(/paused: under siege/);
  });

  it('Engage: a besieged city with a garrison opens the attack card on the weakest besieging stack; without one it says why', () => {
    const me = base.playerNationId; const foe = rivalOf(base, 0); const city = base.regions[cap];
    const tiles = getTiles();
    const [t1, t2] = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1);
    const u = (id, ownerId, tile, strength) => ({ id, ownerId, regionId: ownerId === me ? cap : null, tile, domain: 'land', classId: 'infantry', strength, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [] });
    const s = { ...base,
      wars: [{ id: 'w', aggressor: foe, enemy: me, active: true, startYear: base.year, battleScore: 0 }],
      regions: { ...base.regions, [cap]: { ...city, siege: { by: foe, hp: 50, maxHp: 100 } } },
      units: { g: u('g', me, city.tile, 800), big: u('big', foe, t1, 900), small: u('small', foe, t2, 300) } };
    expect(engageTarget(s, cap)).toEqual({ tile: t2, men: expect.any(String), ok: true, reason: null });
    expect(cityDefenseModel(s, cap).engage.tile).toBe(t2);
    const alone = { ...s, units: { big: s.units.big, small: s.units.small } };
    expect(engageTarget(alone, cap)).toMatchObject({ ok: false, reason: expect.any(String) });
    expect(engageTarget(base, cap)).toBeNull(); // no siege
  });

  it('Coming for this city: an army marching on it and a raid party, with the nearest army to send (lead: actionable warnings)', () => {
    const me = base.playerNationId; const foe = rivalOf(base, 0); const city = base.regions[cap];
    const tiles = getTiles();
    const near = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1);
    const far = tiles.neighbors[near[0]].find((t) => t !== city.tile && tiles.land[t] === 1 && !near.includes(t));
    const indep = Object.keys(base.nations).find((id) => base.nations[id].indep) || 'indep_x';
    const u = (id, ownerId, tile, extra = {}) => ({ id, ownerId, tile, domain: 'land', classId: 'infantry', strength: 500, maxStrength: 1000, morale: 100, ...extra });
    const s = { ...base,
      nations: { ...base.nations, [indep]: { ...(base.nations[indep] || { id: indep, name: 'Raiders', indep: {} }), kind: 'independent', indep: { ...(base.nations[indep]?.indep || {}), raid: { phase: 'out', targetNationId: me, targetCityId: cap, targetTile: city.tile, route: [near[1]] } } } },
      units: { m1: u('m1', foe, far, { route: [near[0], city.tile] }), r1: u('r1', indep, near[1], { raidOf: indep }), mine: u('mine', me, far) } };
    const c = cityDefenseModel(s, cap).coming;
    expect(c.list.map((x) => x.kind).sort()).toEqual(['army', 'raid']);
    expect(c.list.find((x) => x.kind === 'army')).toMatchObject({ nationId: foe, tiles: 2 });
    expect(c.armyTile).toBe(far);
    expect(cityDefenseModel(base, cap).coming).toBeNull();
  });
});
