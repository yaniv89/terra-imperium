// src/engine/fog.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { peoplesWorld } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { HISTORICAL_EVENTS } from '../data/events';
import { migrateSave, CURRENT_SAVE_VERSION } from './saveMigrations';
import { bestSites } from './settlers';
import {
  fogOn, isExplored, hasMet, metNations, knownNationName, UNKNOWN_PEOPLE, updateFog, initFog, reviveFog,
  bitsCount, bitsHas, TileBits, TileInts, START_KNOWN_KM, mapSharingPairs, ownSightAll
} from './fog';
import { visibleTiles } from './sight';

const tiles = getTiles();
const S = peoplesWorld({ size: 'standard', seed: 7, independents: true });
const ME = S.playerNationId; // the player's people (France in the old fixture)
const getNationCapital = (id) => S.nations[id].capitalRegionId;
const capTile = (s, id) => s.regions[getNationCapital(id)]?.tile;
const unit = (id, ownerId, tile, extra = {}) => ({ id, ownerId, tile, regionId: getNationCapital(ownerId), domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { defaultMode: 'auto', autoDefend: true } });
// A people far from France that France has not met (its capital outside France's homeland).
const farAway = (s) => Object.keys(s.nations).filter((id) => id !== ME && capTile(s, id) != null && !hasMet(s, ME, id) && !isExplored(s, capTile(s, id), ME)).sort()[0];

describe('fog of war: the start', () => {
  it('is on by default; each people knows its homeland and nothing far away', () => {
    expect(fogOn(S)).toBe(true);
    const home = capTile(S, ME);
    expect(isExplored(S, home, ME)).toBe(true);
    // Every tile within START_KNOWN_KM of Paris is known.
    let ring = [home]; const near = new Set(ring);
    for (let d = 0; d < ringsForKm(START_KNOWN_KM); d++) { const n = []; ring.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!near.has(x)) { near.add(x); n.push(x); } })); ring = n; }
    near.forEach((t) => expect(isExplored(S, t, ME)).toBe(true));
    const count = bitsCount(S.fog.explored[ME]);
    expect(count).toBeGreaterThanOrEqual(near.size);
    expect(count).toBeLessThan(tiles.count / 10);
    const far = farAway(S);
    expect(far).toBeTruthy();
    expect(isExplored(S, capTile(S, far), ME)).toBe(false);
  });

  it('no people knows another at the start (majors stand farther apart than a homeland); a meeting by sight is mutual', () => {
    expect(metNations(S, ME)).toEqual([]);
    const far = farAway(S);
    expect(hasMet(S, ME, far)).toBe(false);
    expect(knownNationName(S, far)).toBe(UNKNOWN_PEOPLE);
    expect(hasMet(S, ME, ME)).toBe(true);
    const seen = updateFog({ ...S, units: { ...S.units, scout: unit('scout', ME, capTile(S, far)) } }, { onlyPlayer: true });
    expect(hasMet(seen, ME, far)).toBe(true);
    expect(hasMet(seen, far, ME)).toBe(true);
    expect(knownNationName(seen, far)).toBe(S.nations[far].name);
  });

  it('an independent city is met only by sight, never by homeland overlap (hostility.js metOnlyBySight, phase W1)', () => {
    // Turn a far people into an independent and start the fog again: it is unknown until someone sees it.
    const asIndependent = (id) => ({ ...S, nations: { ...S.nations, [id]: { ...S.nations[id], kind: 'independent' } } });
    // eslint-disable-next-line no-unused-vars
    const fresh = (s) => { const { fog, ...rest } = s; return initFog(rest); };
    const id = farAway(S);
    const s = fresh(asIndependent(id));
    expect(hasMet(s, id, ME)).toBe(false);
    // A French army at its city meets it.
    const seen = updateFog({ ...s, units: { ...s.units, scout: unit('scout', ME, capTile(s, id)) } }, { onlyPlayer: true });
    expect(hasMet(seen, ME, id)).toBe(true);
  }, 60000);

  it('the explored world option starts with everything explored and everyone met', () => {
    const open = peoplesWorld({ size: 'standard', seed: 7, independents: true, fog: false });
    expect(fogOn(open)).toBe(false);
    const far = farAway(S);
    expect(isExplored(open, capTile(open, far), ME)).toBe(true);
    expect(hasMet(open, ME, far)).toBe(true);
    expect(updateFog(open)).toBe(open);
    expect(metNations(open, ME).length).toBe(Object.keys(open.nations).length - 1);
  });
});

describe('fog of war: growing it', () => {
  it('an army that walks to a far people explores its land and makes contact both ways', () => {
    const far = farAway(S);
    const there = capTile(S, far);
    const s = updateFog({ ...S, units: { ...S.units, scout: unit('scout', ME, there) } }, { onlyPlayer: true });
    expect(isExplored(s, there, ME)).toBe(true);
    expect(hasMet(s, ME, far)).toBe(true);
    expect(hasMet(s, far, ME)).toBe(true);
    expect(s.fog.met[ME][far]).toBe(S.turnNumber);
    // The old state is untouched (copy on write).
    expect(isExplored(S, there, ME)).toBe(false);
    expect(hasMet(S, ME, far)).toBe(false);
    // Nothing new to see: the same state back.
    expect(updateFog(s, { onlyPlayer: true }).fog.explored).toBe(s.fog.explored);
  });

  it('every nation\'s explored map grows from its own sight at the end of a turn', () => {
    const sights = ownSightAll(S);
    sights.forEach((list, id) => list.forEach((t) => expect(bitsHas(S.fog.explored[id], t)).toBe(true)));
    expect(sights.size).toBeGreaterThan(10);
  });

  it('diplomacy with an unmet people is refused with a reason; with a met one it works', () => {
    const far = farAway(S);
    const seenFar = updateFog({ ...S, units: { ...S.units, scout: unit('scout', ME, capTile(S, far)) } }, { onlyPlayer: true });
    const rich = { ...S, resources: { ...S.resources, gold: 99999, adm: 999, dip: 999, mil: 999 } };
    const refused = gameReducer(rich, { type: ActionTypes.DECLARE_WAR, payload: { nationId: far } });
    expect(refused.wars.length).toBe(0);
    expect(refused.logs[refused.logs.length - 1].message).toMatch(/not met/);
    const met = far;
    const war = gameReducer({ ...rich, fog: seenFar.fog }, { type: ActionTypes.DECLARE_WAR, payload: { nationId: met } });
    expect(war.wars.some((w) => w.active && w.enemy === met)).toBe(true);
  });

  it('moving an army explores at once (the reducer refreshes the player\'s fog)', () => {
    const far = farAway(S);
    const s = gameReducer(S, { type: ActionTypes.ADD_LOG, payload: { message: 'x' } });
    expect(s.fog).toBe(S.fog);
    // A scout stands far away; any change to the player's units refreshes its sight right away.
    const withScout = { ...S, units: { ...S.units, scout: unit('scout', ME, capTile(S, far)), spare: unit('spare', ME, capTile(S, ME)) } };
    const after = gameReducer(withScout, { type: ActionTypes.DISBAND_UNIT, payload: { unitId: 'spare' } });
    expect(after.units.spare).toBeUndefined();
    expect(isExplored(after, capTile(S, far), ME)).toBe(true);
    expect(hasMet(after, ME, far)).toBe(true);
  });

  it('allies and vassals share their maps', () => {
    const far = farAway(S);
    const vassal = { ...S, nations: { ...S.nations, [far]: { ...S.nations[far], vassalOf: ME }, [ME]: { ...S.nations[ME], vassals: [far] } } };
    expect(mapSharingPairs(vassal)).toContainEqual([ME, far]);
    const shared = updateFog(vassal);
    expect(isExplored(shared, capTile(S, far), ME)).toBe(true);
    expect(isExplored(shared, capTile(S, ME), far)).toBe(true);
    const ally = { ...S, nations: { ...S.nations, [far]: { ...S.nations[far], hasMilitaryPact: true } } };
    expect(isExplored(updateFog(ally), capTile(S, far), ME)).toBe(true);
  });
});

describe('fog of war: what the player remembers', () => {
  it('keeps the last-seen picture of a city out of sight, and refreshes it in sight', () => {
    const far = farAway(S);
    const cityId = getNationCapital(far);
    const there = capTile(S, far);
    const seen = updateFog({ ...S, units: { ...S.units, scout: unit('scout', ME, there) } }, { onlyPlayer: true });
    const snap = seen.fog.seen.cities[cityId];
    expect(snap).toMatchObject({ id: cityId, owner: far, tile: there, size: S.regions[cityId].size || 1 });
    expect(seen.fog.seen.turn.ints[there]).toBe(S.turnNumber);
    expect(seen.fog.seen.cityIds[seen.fog.seen.city.ints[there] - 1]).toBe(cityId);
    // The scout leaves; the city grows: the memory keeps the old size.
    const away = { ...seen, units: S.units, regions: { ...seen.regions, [cityId]: { ...seen.regions[cityId], size: 9 } } };
    const later = updateFog(away, { onlyPlayer: true });
    expect(later.fog.seen.cities[cityId].size).toBe(snap.size);
    expect(visibleTiles(later, ME).has(there)).toBe(false);
    // Back in sight: the picture updates.
    const back = updateFog({ ...away, units: { ...S.units, scout: unit('scout', ME, there) } }, { onlyPlayer: true });
    expect(back.fog.seen.cities[cityId].size).toBe(9);
  });
});

describe('fog of war: the AI', () => {
  it('settles only land it has explored', () => {
    const egypt = capTile(S, ME);
    const sites = bestSites(S, ME, egypt, 'bronze', { rings: 30, limit: 50 });
    expect(sites.length).toBeGreaterThan(0);
    sites.forEach((x) => expect(isExplored(S, x.tile, ME)).toBe(true));
    const open = peoplesWorld({ size: 'standard', seed: 7, independents: true, fog: false });
    const openSites = bestSites(open, ME, egypt, 'bronze', { rings: 30, limit: 50 });
    expect(openSites.some((x) => !isExplored(S, x.tile, ME))).toBe(true);
  });
});

describe('fog of war: saves', () => {
  it('stores the arrays run-length encoded and loads them back exactly', () => {
    let s = quiet(S);
    s = resolveTurn(s);
    const json = JSON.stringify({ version: CURRENT_SAVE_VERSION, state: s });
    const raw = JSON.parse(json);
    expect(Array.isArray(raw.state.fog.explored[ME].rle)).toBe(true);
    expect(Array.isArray(raw.state.fog.seen.turn.rle)).toBe(true);
    // 240 explored maps and the last-seen picture stay small.
    expect(JSON.stringify(raw.state.fog).length).toBeLessThan(400000);
    const loaded = migrateSave(raw).state;
    expect(loaded.fog.explored[ME]).toBeInstanceOf(TileBits);
    expect(loaded.fog.seen.city).toBeInstanceOf(TileInts);
    Object.keys(s.fog.explored).forEach((id) => expect(loaded.fog.explored[id].bytes).toEqual(s.fog.explored[id].bytes));
    expect(loaded.fog.seen.city.ints).toEqual(s.fog.seen.city.ints);
    expect(loaded.fog.seen.turn.ints).toEqual(s.fog.seen.turn.ints);
    expect(loaded.fog.met).toEqual(s.fog.met);
    expect(loaded.fog.seen.cities).toEqual(s.fog.seen.cities);
    // A structured clone (a worker) revives too.
    const cloned = reviveFog(structuredClone(s.fog));
    expect(cloned.explored[ME].bytes).toEqual(s.fog.explored[ME].bytes);
  }, 60000);

  it('a version 10 save (no fog) gets the fog of its world as it stands', () => {
    // eslint-disable-next-line no-unused-vars
    const { fog, ...old } = JSON.parse(JSON.stringify(S));
    const loaded = migrateSave({ version: 10, state: old }).state;
    expect(fogOn(loaded)).toBe(true);
    expect(loaded.fog.explored[ME].bytes).toEqual(initFog(S).fog.explored[ME].bytes);
  }, 60000);

  it('a version 10 save runs the whole chain: phase X strips succession and the estates (10 to 11), then the fog starts (11 to 12)', () => {
    // eslint-disable-next-line no-unused-vars
    const { fog, ...old } = JSON.parse(JSON.stringify(S));
    const fr = old.nations[ME];
    old.nations = { ...old.nations, [ME]: { ...fr, heir: { name: 'Louis', claim: 50 }, estates: { clergy: { loyalty: 50 } }, crownLand: 40, ruler: { ...fr.ruler, consort: { name: 'Anne' } } } };
    old.pendingEventChains = [{ id: 'succession_crisis_2', dueTurn: 9 }];
    const loaded = migrateSave({ version: 10, state: old });
    expect(loaded.version).toBe(CURRENT_SAVE_VERSION);
    expect(CURRENT_SAVE_VERSION).toBe(14);
    ['heir', 'estates', 'crownLand'].forEach((k) => expect(loaded.state.nations[ME], k).not.toHaveProperty(k));
    expect(loaded.state.nations[ME].ruler).not.toHaveProperty('consort');
    expect(loaded.state.pendingEventChains).toEqual([]);
    expect(loaded.state.scenario.map).toEqual({ kind: 'earth' }); // 12 to 13: an old save is the real Earth
    expect(fogOn(loaded.state)).toBe(true);
    expect(loaded.state.fog.explored[ME].bytes).toEqual(initFog(S).fog.explored[ME].bytes);
    // A version 11 save (phase X, no fog) takes only the fog step.
    const v11 = migrateSave({ version: 11, state: JSON.parse(JSON.stringify(old)) });
    expect(v11.version).toBe(CURRENT_SAVE_VERSION);
    expect(fogOn(v11.state)).toBe(true);
  }, 60000);

  it('the explored world option survives a save', () => {
    const open = peoplesWorld({ size: 'standard', seed: 7, independents: true, fog: false });
    const loaded = migrateSave(JSON.parse(JSON.stringify({ version: CURRENT_SAVE_VERSION, state: open }))).state;
    expect(fogOn(loaded)).toBe(false);
  });
});

describe('fog of war: determinism', () => {
  it('two runs of the same seed explore and meet the same', () => {
    const run = () => { let s = quiet(peoplesWorld({ seed: 11, independents: true })); for (let i = 0; i < 3; i++) s = resolveTurn(s); return s; };
    const a = run(); const b = run();
    expect(JSON.stringify(a.fog)).toBe(JSON.stringify(b.fog));
  }, 60000);
});

describe('turns resolved in the worker', () => {
  it('apply only while the game still stands where the turn began', () => {
    const next = { ...S, turnNumber: S.turnNumber + 1 };
    expect(gameReducer(S, { type: ActionTypes.APPLY_TURN_RESULT, payload: { from: S, state: next } }).turnNumber).toBe(S.turnNumber + 1);
    const moved = gameReducer(S, { type: ActionTypes.ADD_LOG, payload: { message: 'meanwhile' } });
    expect(gameReducer(moved, { type: ActionTypes.APPLY_TURN_RESULT, payload: { from: S, state: next } })).toBe(moved);
  });
});