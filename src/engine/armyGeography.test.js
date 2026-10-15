// src/engine/armyGeography.test.js
// Playtest audit lane L2 (CB03): where an army is against where it is based, recruits, the supply
// forecast, the long-starve warning, Hold and the idle list.
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { whereLabel, locationOf, isStationedIn, unitsStationedIn, fieldUnitsOf, canReinforce, nearestCityTo } from './unitLocation';
import { armyStatus, idleArmyTiles, setHold } from './standingOrders';
import { applySupplyMeter, supplyChange, supplyReport, LONG_STARVE_TURNS, SUPPLY_ENEMY_LOSS, STARVE_STRENGTH } from './supplyMeter';
import { auditGameState, auditWarnings } from './stateAudit';
import { besiegedCityOf, siegeOrders } from './sieges';
import { nextPrompts } from '../components/ui/nextPromptModel';
import { armySheetModel } from '../components/map/armySheetModel';
import { peoplesWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3 });
const IN_ID = PEOPLES_WORLD.playerNationId;
const PK_ID = rivalOf(PEOPLES_WORLD, 0);
const US_ID = rivalOf(PEOPLES_WORLD, 1);

const tiles = getTiles();
const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = (() => { const s = quiet(peoplesWorld({ seed: 3 })); return { ...s, units: {}, research: { ...s.research, auto: true } }; })();
const IN = getNationCapital(IN_ID);
const PK = getNationCapital(PK_ID);
const US = getNationCapital(US_ID);
const unit = (id, regionId, extra = {}) => ({ id, ownerId: IN_ID, regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s, enemy) => ({ ...s, wars: [...s.wars, { id: `w-${enemy}`, aggressor: IN_ID, enemy, active: true, startYear: s.year, battleScore: 0 }], nations: { ...s.nations, [IN_ID]: { ...s.nations[IN_ID], isAtWar: true }, [enemy]: { ...s.nations[enemy], isAtWar: true } } });
// The nearest free land tile to `from` (no city owns it), by rings.
const freeNear = (from, min = 1) => {
  let f = [from]; const seen = new Set(f);
  for (let d = 1; d < 12; d++) {
    const n = []; f.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!seen.has(x)) { seen.add(x); n.push(x); } }));
    const hit = d >= min ? n.sort((a, b) => a - b).find((t) => tiles.land[t] === 1 && !S.world.tileOwner[t] && tiles.terrainOf(t) !== 'snow') : null;
    if (hit != null) return hit;
    f = n;
  }
  return null;
};
const FIELD = freeNear(S.regions[IN].tile, 2);

describe('where an army is, and where it is based (I058, I059)', () => {
  const s = withUnits(S, [unit('home', IN), unit('field', IN, { tile: FIELD })]);

  it('the tile is the place; the base is only the base', () => {
    expect(locationOf(s, s.units.home)).toMatchObject({ tile: S.regions[IN].tile, cityId: IN, onCentre: true, baseId: IN, atBase: true });
    expect(locationOf(s, s.units.field)).toMatchObject({ tile: FIELD, cityId: null, baseId: IN, atBase: false });
    expect(whereLabel(s, S.regions[IN].tile)).toMatchObject({ kind: 'city', text: `at ${S.regions[IN].name}` });
    const w = whereLabel(s, FIELD);
    expect(['near', 'named', 'wild']).toContain(w.kind);
    if (w.kind === 'near') expect(w.text).toBe(`near ${s.regions[nearestCityTo(s, FIELD)].name}`);
    const land = S.regions[IN].tiles.find((t) => t !== S.regions[IN].tile && !tiles.names?.[t]);
    if (land != null) expect(whereLabel(s, land).text).toBe(`in the land of ${S.regions[IN].name}`);
  });

  it('a city lists only the units that stand in it; the others are its field units', () => {
    expect(isStationedIn(s, s.units.home, IN)).toBe(true);
    expect(isStationedIn(s, s.units.field, IN)).toBe(false);
    expect(unitsStationedIn(s, IN).map((u) => u.id)).toEqual(['home']);
    expect(fieldUnitsOf(s, IN, IN_ID).map((u) => u.id)).toEqual(['field']);
  });

  it('the army sheet names the place the stack stands on, and its base only when it is away', () => {
    const away = armySheetModel(s, FIELD);
    expect(away.where).toBe(whereLabel(s, FIELD).text);
    expect(away.where).not.toBe(`at ${S.regions[IN].name}`);
    expect(away.atBase).toBe(false);
    expect(away.base).toBe(S.regions[IN].name);
    const here = armySheetModel(s, S.regions[IN].tile);
    expect(here.where).toBe(`at ${S.regions[IN].name}`);
    expect(here.atBase).toBe(true);
  });

  it('recruits reach a unit that stands on its own land, never a field army through its base', () => {
    expect(canReinforce(s, s.units.home)).toBe(true);
    expect(canReinforce(s, s.units.field)).toBe(false);
    const hurt = withUnits({ ...S, resources: { ...S.resources, hr: 5000, supplies: 5000 } }, [unit('home', IN, { strength: 500 }), unit('field', IN, { tile: FIELD, strength: 500, supply: 100 })]);
    const next = resolveTurn(hurt);
    expect(next).not.toBe(hurt);
    expect(next.units.home.strength).toBeGreaterThan(500);
    expect(next.units.field.strength).toBe(500); // in Sinai, based at Men-nefer: no recruits
    expect(auditGameState(next)).toEqual([]);
  });
});

describe('supply: the forecast is the turn (I004, I005)', () => {
  const war = atWar(S, US_ID);
  const deep = S.regions[US].tile;

  it('the report shows the change the turn applies, perks and modifiers included', () => {
    const forager = unit('f', US, { tile: deep, supply: 60, promotions: ['forager'] });
    const st = withUnits(war, [forager]);
    const report = supplyReport(st, forager, { attritionMult: 0.8 });
    expect(report.delta).toBe(-SUPPLY_ENEMY_LOSS);
    expect(report.change).toBe(Math.round(-SUPPLY_ENEMY_LOSS * 0.8 * 0.5));
    expect(supplyChange(st, tiles, forager, { attritionMult: 0.8, stackSize: 1 }).change).toBe(report.change);
    const units = { ...st.units };
    applySupplyMeter(st, units, { attritionMultFor: () => 0.8 });
    expect(units.f.supply).toBe(60 + report.change);
    expect(report.turnsLeft).toBe(Math.ceil(60 / -report.change));
    expect(report.text).toMatch(new RegExp(`^Supply 60/100, ${report.change} a turn \\(${report.turnsLeft} turns until it starves\\)`));
  });

  it('an empty meter says starving, and the unit loses strength every turn it stays there', () => {
    const u = unit('s', US, { tile: deep, supply: 0, strength: 627 });
    const st = withUnits(war, [u]);
    const report = supplyReport(st, u);
    expect(report.starving).toBe(true);
    expect(report.turnsLeft).toBe(null);
    expect(report.text).toMatch(/^Supply 0\/100: starving\. The stack loses 5% of its strength and 10 morale every turn/);
    expect(armySheetModel(st, deep).zoneText).toBe(armySheetModel(st, deep).supplyReport.text);
    const units = { ...st.units };
    let strength = 627;
    for (let i = 1; i <= LONG_STARVE_TURNS; i++) {
      applySupplyMeter({ ...st, units }, units);
      strength = Math.floor(strength * (1 - STARVE_STRENGTH));
      expect(units.s.strength).toBe(strength);
      expect(units.s.starvedTurns).toBe(i);
    }
    // A long run at zero is flagged, apart from the hard invariants.
    const long = { ...st, units };
    expect(auditWarnings(long)).toEqual([expect.objectContaining({ code: 'long_zero_supply', path: 'units.s.starvedTurns' })]);
    expect(auditGameState(long).filter((i) => i.code === 'long_zero_supply')).toEqual([]);
    expect(auditWarnings({ ...st, units: { s: { ...units.s, starvedTurns: LONG_STARVE_TURNS - 1 } } })).toEqual([]);
    // Home land feeds it again and the count starts over.
    const back = { ...units, s: { ...units.s, tile: S.regions[IN].tile, regionId: IN } };
    applySupplyMeter({ ...st, units: back }, back);
    expect(back.s.starvedTurns).toBe(0);
    expect(back.s.supply).toBeGreaterThan(0);
  });

  it('a fed unit never gets the counter (its record is untouched by it)', () => {
    const units = { a: unit('a', IN, { supply: 80 }) };
    applySupplyMeter({ ...S, units }, units);
    expect('starvedTurns' in units.a).toBe(false);
  });

  it('through a whole turn: a unit at zero supply starves and takes no recruits', () => {
    const st = withUnits({ ...war, resources: { ...war.resources, hr: 5000, supplies: 5000 } }, [unit('s', IN, { tile: deep, supply: 0, strength: 627 })]);
    const next = resolveTurn(st);
    expect(next).not.toBe(st);
    expect(next.units.s.strength).toBe(Math.floor(627 * (1 - STARVE_STRENGTH)));
    expect(next.units.s.starvedTurns).toBe(1);
    expect(nextPrompts(next).find((p) => p.kind === 'supply')?.label).toMatch(/starving/);
  });
});

describe('Hold, sieges and the idle list (I061, I062, I130)', () => {
  const idle = withUnits(S, [unit('a', IN, { tile: FIELD })]);

  it('an army in the field with a move left is idle; a garrison, a marching, a spent or a holding one is not', () => {
    expect(armyStatus(idle, idle.units.a)).toBe('idle');
    expect(idleArmyTiles(idle)).toEqual([FIELD]);
    expect(nextPrompts(idle).filter((p) => p.kind === 'army').map((p) => p.tile)).toEqual([FIELD]);
    expect(armyStatus(idle, unit('g', IN))).toBe('garrison');
    expect(armyStatus(idle, { ...idle.units.a, movesLeft: 0 })).toBe('spent');
    expect(armyStatus(idle, { ...idle.units.a, route: [1, 2] })).toBe('marching');
    expect(armyStatus(idle, { ...idle.units.a, hold: true })).toBe('holding');
  });

  it('SET_HOLD takes the stack off the idle list until it is lifted or the army is told to march', () => {
    const held = gameReducer(idle, { type: ActionTypes.SET_HOLD, payload: { unitIds: ['a'] } });
    expect(held.units.a.hold).toBe(true);
    expect(idleArmyTiles(held)).toEqual([]);
    expect(nextPrompts(held).some((p) => p.kind === 'army')).toBe(false);
    expect(armySheetModel(held, FIELD)).toMatchObject({ holding: true, status: 'holding', canHold: true });
    expect(gameReducer(held, { type: ActionTypes.SET_HOLD, payload: { unitIds: ['a'] } })).toBe(held); // no change, same state
    // Through a turn the order stays.
    const next = resolveTurn(held);
    expect(next.units.a.hold).toBe(true);
    expect(idleArmyTiles(next)).toEqual([]);
    const lifted = gameReducer(held, { type: ActionTypes.SET_HOLD, payload: { unitIds: ['a'], hold: false } });
    expect(idleArmyTiles(lifted)).toEqual([FIELD]);
    const marching = gameReducer(held, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: IN, toRegionId: IN, unitIds: ['a'] } });
    expect(marching.units.a.route?.length).toBeGreaterThan(0);
    expect(marching.units.a.hold).toBe(false);
    // Old saves have no flag: it reads as off. Nobody else's units can be held.
    expect(setHold(idle, ['nobody'])).toBe(null);
    expect(setHold(withUnits(S, [unit('x', PK, { ownerId: PK_ID })]), ['x'])).toBe(null);
  });

  it('a besieging army is not idle: at war the army beside the city besieges it', () => {
    const gate = tiles.neighbors[S.regions[PK].tile].find((t) => tiles.land[t] === 1);
    const peace = withUnits(S, [unit('a', IN, { tile: gate })]);
    expect(besiegedCityOf(peace, peace.units.a)).toBe(null);
    const war = atWar(peace, PK_ID);
    expect(besiegedCityOf(war, war.units.a)).toBe(PK);
    expect(armyStatus(war, war.units.a)).toBe('besieging');
    expect(idleArmyTiles(war)).toEqual([]);
    expect(siegeOrders(war, gate, [war.units.a])).toEqual([]); // a war needs no order
  });

  it('beside an independent\'s city nothing is besieged without the Lay siege order', () => {
    const gate = tiles.neighbors[S.regions[PK].tile].find((t) => tiles.land[t] === 1);
    const indep = { ...S, nations: { ...S.nations, [PK_ID]: { ...S.nations[PK_ID], kind: 'independent', indep: {} } } };
    const st = withUnits(indep, [unit('a', IN, { tile: gate })]);
    expect(besiegedCityOf(st, st.units.a)).toBe(null);
    expect(armyStatus(st, st.units.a)).toBe('idle');
    expect(siegeOrders(st, gate, [st.units.a])).toEqual([{ regionId: PK, name: S.regions[PK].name, on: false }]);
    const turn = resolveTurn(st);
    expect(turn.regions[PK].siege ?? null).toBe(null); // parked beside it: no siege on its own
    const laid = gameReducer(st, { type: ActionTypes.SET_SIEGE, payload: { unitIds: ['a'], cityId: PK } });
    expect(laid.units.a.siegeOf).toBe(PK);
    expect(armyStatus(laid, laid.units.a)).toBe('besieging');
    expect(siegeOrders(laid, gate, [laid.units.a])[0].on).toBe(true);
    expect(resolveTurn(laid).regions[PK].siege?.by).toBe(IN_ID);
    // Refused with a reason from a tile that is not beside the city.
    const far = gameReducer(withUnits(indep, [unit('a', IN)]), { type: ActionTypes.SET_SIEGE, payload: { unitIds: ['a'], cityId: PK } });
    expect(far.units.a.siegeOf ?? null).toBe(null);
    expect(far.logs[far.logs.length - 1].message).toMatch(/needs an army on a tile beside/);
  });
});
