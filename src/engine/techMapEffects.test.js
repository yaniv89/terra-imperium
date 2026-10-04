// src/engine/techMapEffects.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { TECH_TREE } from '../data/techTree';
import { TECH_MAP_EFFECTS } from '../data/techMapEffects';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { IMPROVEMENTS } from '../data/tileYields';
import { UNIT_CLASSES } from '../data/unitClasses';
import { mapEffectsOf, mapEffectsFor, mapEffectLabel } from './techMapEffects';
import { visibleTiles } from './sight';
import { fleetPace, fleetAge, seaPassable, NAVAL_KM_BY_AGE } from './fleets';
import { ringsForKm } from '../data/geo/gridScale';
import { tileStepCost, TILE_COST_MOUNTAINS } from './armies';
import { claimCandidates, tileCultureCost, BORDER_KM_BY_AGE } from './world/cities';
import { claimRange, CLAIM_RANGE_KM } from './claims';
import { stackCap } from './supplyMeter';

const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
const withTechs = (ids) => ({ ...S, techTree: { ...S.techTree, ...Object.fromEntries(ids.map((id) => [id, { ...S.techTree[id], researched: true }])) } });

describe('tech map effects', () => {
  it('every tech changes something on the map: a map effect, an income effect, or an unlock', () => {
    const unlocks = new Set();
    Object.values(BUILDING_CATEGORIES).forEach((cat) => cat.tiers.forEach((t) => { if (t.requiresTech) unlocks.add(t.requiresTech); }));
    Object.values(IMPROVEMENTS).forEach((imp) => { if (imp.requiresTech) unlocks.add(imp.requiresTech); Object.keys(imp.upgrades || {}).forEach((t) => unlocks.add(t)); });
    Object.values(UNIT_CLASSES).forEach((u) => { if (u.requiresTech) unlocks.add(u.requiresTech); });
    const idle = Object.values(TECH_TREE).filter((t) => !TECH_MAP_EFFECTS[t.id] && !Object.keys(t.effects || {}).length && !unlocks.has(t.id)).map((t) => t.id);
    expect(idle).toEqual([]);
    Object.keys(TECH_MAP_EFFECTS).forEach((id) => { expect(TECH_TREE[id]).toBeDefined(); expect(mapEffectLabel(id)).toBeTruthy(); });
  });

  it('sums the researched techs and is memoised on the list', () => {
    const list = ['science_optics', 'military_bronze_casting', 'science_natural_philosophy'];
    const fx = mapEffectsOf(list);
    expect(fx.sight).toBe(204); // km: two rings at frequency 75
    expect(fx.mountainCost).toBe(-1);
    expect(mapEffectsOf(list)).toBe(fx);
    expect(mapEffectsOf([]).sight).toBe(0);
  });

  it('sight, fleets, movement, borders, claims and stacks read the effects', () => {
    const tiles = getTiles();
    const seen = visibleTiles(S, 'fr').size;
    const far = withTechs(['science_optics', 'military_bronze_casting']);
    expect(visibleTiles(far, 'fr').size).toBeGreaterThan(seen);
    expect(mapEffectsFor(far, 'fr').sight).toBe(204);
    const fleet = { id: 'f', ownerId: 'fr', domain: 'naval', classId: 'naval', regionId: getNationCapital('fr') };
    expect(fleetPace(withTechs(['science_early_astronomy']), fleet)).toBe(ringsForKm(NAVAL_KM_BY_AGE[fleetAge(S, 'fr')] + 102));
    expect(fleetPace(withTechs(['science_early_astronomy']), fleet)).toBeGreaterThan(fleetPace(S, fleet));
    const ocean = Array.from({ length: tiles.count }, (_, i) => i).find((t) => tiles.terrainOf(t) === 'ocean');
    expect(seaPassable(tiles, ocean, 'bronze')).toBe(false);
    expect(seaPassable(tiles, ocean, 'bronze', true)).toBe(true);
    const mountain = Array.from({ length: tiles.count }, (_, i) => i).find((t) => tiles.land[t] === 1 && tiles.reliefOf(t) === 'mountains');
    expect(tileStepCost(S, tiles, null, mountain, 'wild', [])).toBe(TILE_COST_MOUNTAINS);
    expect(tileStepCost(S, tiles, null, mountain, 'wild', ['science_natural_philosophy'])).toBe(TILE_COST_MOUNTAINS - 1);
    const cap = S.regions[getNationCapital('fr')];
    const world = { cities: S.regions, tileOwner: S.world.tileOwner, tileState: S.world.tileState };
    const wide = claimCandidates({ ...cap, tiles: [cap.tile] }, tiles, world, { ageId: 'bronze', researched: ['governance_provincial_administration'] });
    wide.forEach((c) => expect(c.ring).toBeLessThanOrEqual(ringsForKm(BORDER_KM_BY_AGE.bronze + 102)));
    expect(tileCultureCost(cap, 2, -0.1)).toBeLessThan(tileCultureCost(cap, 2));
    expect(claimRange(withTechs(['governance_scribal_bureaucracy']), 'fr')).toBe(ringsForKm(CLAIM_RANGE_KM + 102));
    expect(stackCap(tiles, cap.tile, 2)).toBe(stackCap(tiles, cap.tile) + 2);
  });
  it('Mechanized Warfare moves land armies two tiles further a turn, not settlers or aircraft (plan D5b)', async () => {
    const { movePoints, stackPace, MOVE_POINTS, MOVE_KM } = await import('./armies');
    const plusMech = ringsForKm(MOVE_KM.infantry + 204); // two rings' km at frequency 75
    const mech = ['military_mechanized_warfare'];
    const inf = { classId: 'infantry', domain: 'land' }; const settler = { classId: 'settler', domain: 'land' }; const jet = { classId: 'air', domain: 'land' };
    expect(movePoints(inf)).toBe(MOVE_POINTS.infantry);
    expect(movePoints(inf, mech)).toBe(plusMech);
    expect(plusMech).toBeGreaterThanOrEqual(MOVE_POINTS.infantry + 2);
    expect(movePoints(settler, mech)).toBe(MOVE_POINTS.settler);
    expect(movePoints(jet, mech)).toBe(MOVE_POINTS.air);
    expect(stackPace([inf, { classId: 'cavalry', domain: 'land' }], mech)).toBe(plusMech);
    const { mapEffectsOf } = await import('./techMapEffects');
    expect(mapEffectsOf(['infrastructure_highway_systems'])).toMatchObject({ mountainCost: -2, hillsCost: -1 });
  });
});
