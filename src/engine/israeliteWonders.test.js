// src/engine/israeliteWonders.test.js
// The national wonders of Israel (plans/game/israelite-wonders.md): Solomon's Temple (Bronze) and
// Masada (Classical) are built only by a city on Israel's land, on a tile of that land, and act on
// their own city: culture and loyalty, siege HP and fort level.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { tileFacts } from '../data/tileYields';
import { GREAT_PROJECTS, getGreatProjectOwner, cityWonderLines, cityWonderTotal } from '../data/greatProjects';
import { canQueueWonder, wonderOptions, wonderSites, wonderCost } from './wonders';
import { loyaltyTarget } from './loyalty';
import { siegeMaxHp } from './sieges';
import { getRegionModifier, getRegionModifierTotals } from './modifiers/sheet';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const play = (s) => { let x = s; if (x.pendingPeaceOffer) x = gameReducer(x, { type: ActionTypes.ACCEPT_PENDING_PEACE }); x = resolveTurn(x); return x.activeProceduralEvent ? { ...x, activeProceduralEvent: null } : x; };
const israel = () => quiet(createInitialState({ playerNationId: 'il', rngSeed: 3 }));
const JER = () => getNationCapital('il');

describe("Israel's national wonders: the data", () => {
  it('are sized like the other wonders of their age', () => {
    const sameAge = (ageId) => Object.values(GREAT_PROJECTS).filter((p) => p.ageId === ageId && !p.national);
    [['solomons_temple', 'bronze'], ['masada', 'classical']].forEach(([id, ageId]) => {
      const p = GREAT_PROJECTS[id];
      expect(p.ageId).toBe(ageId);
      expect(p.national).toBe(true);
      expect(p.homeland).toBe('il');
      expect(p.tiers).toHaveLength(3);
      expect(p.tiers.map((t) => t.completionPrestige)).toEqual(sameAge(ageId)[0].tiers.map((t) => t.completionPrestige));
      expect(p.description).not.toMatch(/—/); // plain English, no em dashes
    });
    // each tier is at least as strong as the one before
    ['solomons_temple', 'masada'].forEach((id) => GREAT_PROJECTS[id].tiers.reduce((prev, t) => {
      Object.entries(t.cityEffects).forEach(([k, v]) => expect(v).toBeGreaterThanOrEqual(prev?.cityEffects?.[k] || 0));
      return t;
    }, null));
  });
});

describe("Israel's national wonders: who may build them", () => {
  it("Jerusalem may raise Solomon's Temple in the Bronze Age on hills of Israel's land, and Masada waits for the Classical Age", () => {
    const s = israel();
    const jer = s.regions[JER()];
    const tiles = getTiles();
    expect(tiles.countryOf(jer.tile)).toBe('il');
    const temple = canQueueWonder(s, jer, 'solomons_temple', 1);
    expect(temple.ok).toBe(true);
    expect(tiles.countryOf(temple.tile)).toBe('il');
    expect(tileFacts(tiles, temple.tile, {}).relief).toBe('hills');
    expect(canQueueWonder(s, jer, 'masada', 1).reason).toMatch(/classical/);
    const classical = { ...s, age: 'classical' };
    const masada = canQueueWonder(classical, jer, 'masada', 1);
    expect(masada.ok).toBe(true);
    expect(tiles.countryOf(masada.tile)).toBe('il');
    expect(tileFacts(tiles, masada.tile, {}).terrain).toBe('desert');
    expect(wonderOptions(classical, jer).map((w) => w.projectId)).toEqual(expect.arrayContaining(['solomons_temple', 'masada']));
    // every site is a tile of Israel's land in the city's border
    wonderSites(s, jer, 'solomons_temple').concat(wonderSites(classical, jer, 'masada')).forEach((t) => {
      expect(jer.tiles).toContain(t);
      expect(tiles.countryOf(t)).toBe('il');
    });
  });

  it("no city off Israel's land may build them, whoever owns it; a conqueror of Jerusalem may", () => {
    const s = { ...quiet(createInitialState({ playerNationId: 'eg', rngSeed: 3 })), age: 'classical' };
    const cairo = s.regions[getNationCapital('eg')];
    expect(canQueueWonder(s, cairo, 'solomons_temple', 1).reason).toMatch(/Israel's land/);
    expect(canQueueWonder(s, cairo, 'masada', 1).reason).toMatch(/Israel's land/);
    expect(wonderOptions(s, cairo).some((w) => GREAT_PROJECTS[w.projectId].national)).toBe(false);
    // Israel itself cannot raise them in a city it holds elsewhere
    expect(canQueueWonder(s, { ...cairo, owner: 'il' }, 'masada', 1, 'il').ok).toBe(false);
    // the rule is the land: Egypt holding Jerusalem may build there
    const taken = { ...s.regions[JER()], owner: 'eg' };
    expect(canQueueWonder(s, taken, 'solomons_temple', 1).ok).toBe(true);
    // and the AI builds them as the owner of the city, never as the player
    const jer = s.regions[JER()];
    expect(canQueueWonder(s, jer, 'solomons_temple', 1).reason).toMatch(/Not your city/);
    expect(canQueueWonder(s, jer, 'solomons_temple', 1, 'il').ok).toBe(true);
  });
});

describe("Israel's national wonders: building them", () => {
  it("Solomon's Temple is built from production on its tile, gives prestige and is raised in tiers there", () => {
    let s = israel();
    const id = JER();
    const can = canQueueWonder(s, s.regions[id], 'solomons_temple', 1);
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: id, item: { kind: 'wonder', projectId: 'solomons_temple', tier: 1 } } });
    expect(s.regions[id].production.current).toMatchObject({ kind: 'wonder', projectId: 'solomons_temple', tier: 1, tile: can.tile, cost: wonderCost(1) });
    const prestige = s.nations.il.prestige || 0;
    s = { ...s, regions: { ...s.regions, [id]: { ...s.regions[id], production: { ...s.regions[id].production, progress: 10000 } } } };
    s = play(s);
    expect(s.greatProjects.solomons_temple).toEqual({ regionId: id, tier: 1, tile: can.tile });
    expect(s.world.tileState[can.tile].wonder).toBe('solomons_temple');
    expect(getGreatProjectOwner(s, 'solomons_temple')).toBe('il');
    expect(s.nations.il.prestige).toBe(prestige + 10);
    expect(s.logs.some((l) => /Solomon's Temple \(tier 1\) stands at/.test(l.message))).toBe(true);
    expect(canQueueWonder(s, s.regions[id], 'solomons_temple', 2)).toMatchObject({ ok: true, tile: can.tile });
  });
});

describe("Israel's national wonders: their effects on their own city", () => {
  it("Solomon's Temple adds culture and loyalty to its city only", () => {
    const s = israel();
    const id = JER();
    const built = { ...s, greatProjects: { solomons_temple: { regionId: id, tier: 2, tile: canQueueWonder(s, s.regions[id], 'solomons_temple', 1).tile } } };
    expect(cityWonderTotal(built.greatProjects, id, 'local.culture')).toBe(3);
    expect(cityWonderTotal(built.greatProjects, id, 'local.loyalty')).toBe(10);
    expect(cityWonderLines(built.greatProjects, 'elsewhere')).toEqual([]);
    const plain = loyaltyTarget(s, s.regions[id]);
    const raised = loyaltyTarget(built, built.regions[id]);
    expect(raised.wonder).toBe(10);
    expect(raised.total).toBe(Math.min(100, plain.total + 10));
    // culture through the turn (resolveTurn's city context)
    const without = play(s);
    const withTemple = play(built);
    expect(withTemple.regions[id].lastYields.culture).toBeCloseTo(without.regions[id].lastYields.culture + 3, 5);
    // no other city changes
    const other = Object.keys(s.regions).find((r) => r !== id && s.regions[r].owner);
    expect(withTemple.regions[other].lastYields).toEqual(without.regions[other].lastYields);
  });

  it('Masada raises its walls’ siege HP and its fort level against assaults', () => {
    const s = { ...israel(), age: 'classical' };
    const id = JER();
    const city = s.regions[id];
    const gp = (tier) => ({ masada: { regionId: id, tier, tile: canQueueWonder(s, city, 'masada', 1).tile } });
    expect(siegeMaxHp(city, gp(1))).toBe(Math.round(siegeMaxHp(city) * 1.5));
    expect(siegeMaxHp(city, gp(3))).toBe(Math.round(siegeMaxHp(city) * 2.5));
    const built = { ...s, greatProjects: gp(3) };
    const fort = getRegionModifier(built, id, 'local.fortLevel');
    expect(fort.total - getRegionModifier(s, id, 'local.fortLevel').total).toBe(6);
    expect(fort.breakdown.some((l) => l.sourceId === 'masada' && l.label === 'Masada')).toBe(true);
    expect(getRegionModifierTotals(built, id, ['local.fortLevel'])['local.fortLevel']).toBe(fort.total);
    // another city gets nothing
    const other = Object.keys(s.regions).find((r) => r !== id);
    expect(getRegionModifier(built, other, 'local.fortLevel').total).toBe(getRegionModifier(s, other, 'local.fortLevel').total);
    expect(siegeMaxHp(s.regions[other], gp(3))).toBe(siegeMaxHp(s.regions[other]));
  });
});
