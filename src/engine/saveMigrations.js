// src/engine/saveMigrations.js
// The save format had NO migration layer before this: GameContext.jsx's loadOrCreateState threw
// away any save whose version didn't match exactly, and a shallow `{...fresh, ...saved.state}`
// merge silently dropped any field nested inside a region/nation that a newer build added. Every
// milestone in the Paradox-overhaul plan adds fields to the state shape, so this has to exist
// before any of them do.
//
// Two separate concerns, kept separate on purpose:
// - `MIGRATIONS[v]` are SEMANTIC conversions (e.g. `actionPoints` -> `adm`/`dip`/`mil`) that only a
//   human can decide the right formula for — plain backfill can't invent that.
// - `backfillDefaults` is a dumb, additive-only pass that fills in any key a fresh state has but a
//   loaded one doesn't, without ever touching a key the save already set (including falsy values
//   like `0`, `false`, or `null` — those are real saved data, not "missing"). It runs on every
//   load, after any numbered migrations, so a save from a build that's only a few commits behind
//   (no migration needed yet) still gets any new field for free.
import { stampUnitAges } from './unitUpgrades';
import { createInitialState } from './gameReducer';
import { initFog, reviveFog, repairOwnMemory } from './fog';
import { keepWorldRegistry } from './world/registry';
import { AGES, AGE_ORDER, FIRST_AGE_ID, LAST_AGE_ID, getAgeIndex } from '../data/ages';
import { TECH_TREE } from '../data/techTree';
import { withAgesResearched, inResearchWindow } from './research';
import { ageOf } from './nationState';
import { displayYear } from './displayYear';
import { createRuler } from './rulers';
import { decreeCap, decreesOf } from './decrees';
import { PEOPLES } from '../data/peoples';

// Bump this once per milestone that changes the STATE SHAPE in a way plain backfill can't handle
// (a field is renamed, split, or needs a real formula to convert) — not for every commit. Add the
// matching numbered step to MIGRATIONS at the same time, keyed by the version it upgrades FROM.
// Version 7 was the tile world (plans/civ-map-rework.md, decision 5: a clean break). Version 8 is
// the frequency-75 grid: every tile id changed, so a version 7 save cannot be converted either.
// Version 9 kept every tile id and opened the real straits (plans/math/straits.md). Version 10 is
// the frequency-100 grid (plans/math/grid-f100.md): every tile id changed again, so versions 7 to 9
// cannot be converted either (a clean break, 'oldGrid'). migrateSave returns null for anything
// older and the app starts a fresh game while keeping the raw save untouched. A later land-flag
// change that keeps tile ids can repair saves with world/landChanges.js (applyLandChanges), as
// the version 8 to 9 step did. Version 11 removed succession and the noble estates (phase X,
// migrate10to11). Version 12 adds fog of war (src/engine/fog.js: explored maps, contacts, the
// last-seen picture, arrays saved run-length encoded); a save from before it loads and starts its
// fog from where its cities stand now (migrate11to12). A version 10 save runs both steps.
export const CURRENT_SAVE_VERSION = 20;
export const OLDEST_LOADABLE_SAVE_VERSION = 10;
// The first version of the tile world: older saves are the province map ('tooOld'), newer ones up
// to OLDEST_LOADABLE_SAVE_VERSION a coarser hex grid ('oldGrid').
export const FIRST_TILE_SAVE_VERSION = 7;

// v11: succession and the noble estates were removed (master plan decision 37). A nation drops its
// heir, estates, crown land and estate cooldowns; its ruler drops the consort (and the claim or
// adoption mark a ruler who was once an heir carried); the Estate Takeover and Succession War
// meters and the timed Estate Takeover penalty go. A civil war's rebels were throne pretenders and
// are now insurgents: their units' `isPretender` becomes `isInsurgent` and the provinces they hold
// change marker from 'pretenders' to 'insurgents'. A pending or open Succession Crisis chain event
// is dropped (it no longer exists, and an open event nobody can answer would stall every turn).
// A governor who used to be the heir keeps the seat.
const REMOVED_NATION_KEYS = ['heir', 'estates', 'crownLand', 'estateInteractionCooldowns'];
const REMOVED_RULER_KEYS = ['consort', 'isRegency', 'claim', 'adopted'];
const OLD_INSURGENT_MARKER = 'pretenders';
const isSuccessionChain = (id) => typeof id === 'string' && id.startsWith('succession_crisis');
const migrate10to11 = (state) => {
  const nations = {};
  Object.entries(state.nations || {}).forEach(([id, nation]) => {
    if (!isPlainObject(nation)) { nations[id] = nation; return; }
    const next = { ...nation };
    REMOVED_NATION_KEYS.forEach((k) => delete next[k]);
    if (isPlainObject(next.ruler)) {
      const ruler = { ...next.ruler };
      REMOVED_RULER_KEYS.forEach((k) => delete ruler[k]);
      next.ruler = ruler;
    }
    if (isPlainObject(next.disasters)) next.disasters = { economicCollapse: next.disasters.economicCollapse || 0, revolution: next.disasters.revolution || 0 };
    if (Array.isArray(next.modifiers)) next.modifiers = next.modifiers.filter((m) => m?.sourceId !== 'estate_takeover');
    if (isPlainObject(next.governors)) {
      next.governors = Object.fromEntries(Object.entries(next.governors).map(([seat, g]) => {
        if (!isPlainObject(g)) return [seat, g];
        // eslint-disable-next-line no-unused-vars -- destructured only to omit the old heir flag
        const { heir, ...rest } = g;
        return [seat, rest];
      }));
    }
    nations[id] = next;
  });
  const units = {};
  Object.entries(state.units || {}).forEach(([id, unit]) => {
    if (!unit?.isPretender) { units[id] = unit; return; }
    // eslint-disable-next-line no-unused-vars -- destructured only to rename the flag
    const { isPretender, ...rest } = unit;
    units[id] = { ...rest, isInsurgent: true };
  });
  const regions = {};
  Object.entries(state.regions || {}).forEach(([id, region]) => {
    regions[id] = region?.occupiedBy === OLD_INSURGENT_MARKER ? { ...region, occupiedBy: 'insurgents' } : region;
  });
  return {
    ...state,
    nations,
    units,
    regions,
    pendingEventChains: (state.pendingEventChains || []).filter((c) => !isSuccessionChain(c?.id)),
    activeEventId: isSuccessionChain(state.activeEventId) ? null : state.activeEventId
  };
};

// v12: fog of war. A save from before it gets the fog of a new game, measured from its cities
// as they stand: each people knows its homeland and its sight, nothing more.
const migrate11to12 = (state) => (state.fog ? state : initFog(state));

// v13: the world descriptor (plans/MAP-VARIATIONS-PLAN.md 3.2). Every game before it was played on
// the real Earth: its scenario says so (`scenario.map = { kind: 'earth' }`), and a generated world's
// save carries its seed, parameters, generator version and hash there instead of any map data.
const migrate12to13 = (state) => (state.scenario?.map ? state : { ...state, scenario: { ...(state.scenario || {}), map: { kind: 'earth' } } });

// v14: ages by tech (eight-ages plan U16, KTD1, KTD10). A nation's age used to be
// max(calendar, min(tech age, calendar + 1)); now it is only its research. So no nation is demoted
// on load, each first gets every tech of the ages below its old effective age, then its age is
// derived from research by the 6-of-10 rule (never below the old effective age); the calendar age
// (state.age) is dropped, the year becomes the label, and a queued or current tech outside the new
// research window leaves the queue. Era goal records and reforms are kept as they are.
const oldCalendarAge = (state) => {
  if (AGES[state.age]) return state.age;
  const year = state.year ?? AGES[FIRST_AGE_ID].startYear;
  return AGE_ORDER.find((id) => year >= AGES[id].startYear && year < AGES[id].endYear) || LAST_AGE_ID;
};
const oldEffectiveAge = (calendarId, techId) => {
  const c = getAgeIndex(calendarId);
  const t = getAgeIndex(techId);
  return AGE_ORDER[t === -1 ? c : Math.max(c, Math.min(t, c + 1))];
};
const inWindow = (ageId) => (id) => !!TECH_TREE[id] && inResearchWindow(ageId, TECH_TREE[id]);
const keepInWindow = (research, ageId) => {
  if (!research) return research;
  const ok = inWindow(ageId);
  return { ...research, current: research.current && ok(research.current) ? research.current : null, queue: (research.queue || []).filter(ok) };
};
export const migrate13to14 = (state) => {
  const calendar = oldCalendarAge(state);
  const me = state.playerNationId;
  let next = state;
  Object.keys(state.nations || {}).sort().forEach((id) => {
    const n = next.nations[id];
    if (!n || (id !== me && !n.tech)) return;
    const raw = id === me ? state.techAgeId : n.tech?.ageId;
    const before = oldEffectiveAge(calendar, AGES[raw] ? raw : calendar);
    next = withAgesResearched(next, id, before);
    // Never below the old effective age, whatever the techs of that age say.
    const derived = ageOf(next, id);
    const ageId = getAgeIndex(derived) >= getAgeIndex(before) ? derived : before;
    if (id === me) next = { ...next, techAgeId: ageId, research: keepInWindow(next.research, ageId) };
    else next = { ...next, nations: { ...next.nations, [id]: { ...next.nations[id], tech: { ...next.nations[id].tech, ageId }, research: keepInWindow(next.nations[id].research, ageId) } } };
  });
  // eslint-disable-next-line no-unused-vars -- destructured only to drop the calendar age
  const { age, ...rest } = next;
  return { ...rest, year: displayYear(rest) };
};

// v15: space and nukes are retired (eight-ages plan U21). The satellites, orbital debris, space
// missions, missile stockpiles, ABM levels, the Fusion Grid, Helium-3 and nuclear scars are dropped,
// with the Nuclear Pariah modifier; nothing is refunded.
const SPACE_STATE_KEYS = ['satellites', 'nextSatelliteSeq', 'orbitalDebrisLevel', 'spaceMissionProgress', 'completedMissions'];
const SPACE_NATION_KEYS = ['missiles', 'abmDefenseLevel', 'fusionGridActive'];
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
export const migrate14to15 = (state) => {
  const nations = Object.fromEntries(Object.entries(state.nations || {}).map(([id, n]) => {
    const next = omit(n, SPACE_NATION_KEYS);
    if (n.economy && 'helium3' in n.economy) next.economy = omit(n.economy, ['helium3']);
    if (n.modifiers) next.modifiers = n.modifiers.filter((m) => m.sourceType !== 'nuclear');
    return [id, next];
  }));
  const regions = Object.fromEntries(Object.entries(state.regions || {}).map(([id, r]) => [id, 'nuclearScarred' in r ? omit(r, ['nuclearScarred']) : r]));
  return { ...omit(state, SPACE_STATE_KEYS), nations, regions, resources: omit(state.resources || {}, ['helium3']) };
};

// v16: one ruler a game (differentiation plan U5, RULER-PLAN 7.3). Every ruler takes the fixed shape:
// the people's ruler (a legacy nation keeps its name), attributes 3/3/3/0/0/0; the house, the reign
// and the rolled traits go, with the dynasty streak; each old positive trait comes back as a virtue
// point (RULER-PLAN 7.3, U11).
const OLD_POSITIVE_TRAITS = new Set(['just', 'scholar', 'warrior', 'diplomat', 'architect', 'merchant', 'administrator', 'strategist', 'kind', 'builder', 'genius']);
export const migrate15to16 = (state) => ({
  ...state,
  nations: Object.fromEntries(Object.entries(state.nations || {}).map(([id, n]) => [id, n.ruler
    ? { ...omit(n, ['sameDynastyStreak']), ruler: { ...createRuler(id), name: PEOPLES[id]?.ruler?.name || n.ruler.name, bonusVirtuePoints: (n.ruler.traits || []).filter((t) => OLD_POSITIVE_TRAITS.has(t)).length } }
    : omit(n, ['sameDynastyStreak'])]))
});

// v17: the Stone Age is the first age (eight-ages plan U22, U27, KTD10). Every nation of an older
// save already stood in a later age, so it gets the Stone techs it never had to research; its age
// stays what it was (withAgesResearched never lowers an age).
export const migrate16to17 = (state) => Object.keys(state.nations || {}).sort().reduce((s, id) => (id === s.playerNationId || s.nations[id]?.tech ? withAgesResearched(s, id, ageOf(s, id)) : s), state);

// v18: seven building lines gain a Stone tier at index 0 (eight-ages plan U28, KTD11), so every saved
// tier of those lines moves up one: in cities, in their production orders and stored progress, and in
// the player's memory of cities seen. An unbuilt line (-1) stays unbuilt.
const STONE_TIER_LINES = new Set(['food', 'military', 'defense', 'culture', 'logistics', 'naval', 'science']);
const shiftCategories = (categories) => (categories
  ? Object.fromEntries(Object.entries(categories).map(([c, tier]) => [c, STONE_TIER_LINES.has(c) && tier >= 0 ? tier + 1 : tier]))
  : categories);
const shiftBuildings = (b) => (b?.categories ? { ...b, categories: shiftCategories(b.categories) } : b);
const shiftItem = (item) => (item?.kind === 'building' && STONE_TIER_LINES.has(item.category) ? { ...item, tier: item.tier + 1 } : item);
const shiftKey = (key) => {
  const [kind, c, tier] = key.split(':');
  return kind === 'building' && STONE_TIER_LINES.has(c) ? `building:${c}:${Number(tier) + 1}` : key;
};
const shiftProduction = (p) => (p ? {
  ...p,
  current: shiftItem(p.current),
  queue: (p.queue || []).map(shiftItem),
  ...(p.stored ? { stored: Object.fromEntries(Object.entries(p.stored).map(([k, v]) => [shiftKey(k), v])) } : {})
} : p);
export const migrate17to18 = (state) => {
  const regions = Object.fromEntries(Object.entries(state.regions || {}).map(([id, r]) => [id, {
    ...r, buildings: shiftBuildings(r.buildings), ...(r.production ? { production: shiftProduction(r.production) } : {})
  }]));
  const seen = state.fog?.seen?.cities;
  const fog = seen ? { ...state.fog, seen: { ...state.fog.seen, cities: Object.fromEntries(Object.entries(seen).map(([id, c]) => [id, { ...c, buildings: shiftBuildings(c.buildings) }])) } } : state.fog;
  return { ...state, regions, ...(fog ? { fog } : {}) };
};

// Version 19 retires the ADM/DIP/MIL pools (differentiation plan U7, KTD6): every nation's banked
// pool points become decrees, one per POOL_POINTS_PER_DECREE combined, up to the bank cap, and the
// pool fields go (the player's state.resources, an AI's nation.economy).
export const POOL_POINTS_PER_DECREE = 300;
const POOL_KEYS = new Set(['adm', 'dip', 'mil', 'maxAdm', 'maxDip', 'maxMil']);
const dropPools = (o) => (o ? Object.fromEntries(Object.entries(o).filter(([k]) => !POOL_KEYS.has(k))) : o);
export const migrate18to19 = (state) => {
  const nations = Object.fromEntries(Object.entries(state.nations || {}).map(([id, n]) => {
    const pool = (id === state.playerNationId ? state.resources : n.economy) || {};
    const earned = Math.floor(((pool.adm || 0) + (pool.dip || 0) + (pool.mil || 0)) / POOL_POINTS_PER_DECREE);
    const ruler = n.ruler && earned ? { ...n.ruler, decrees: Math.min(decreeCap(n), decreesOf(n) + earned) } : n.ruler;
    return [id, { ...n, ...(ruler ? { ruler } : {}), ...(n.economy ? { economy: dropPools(n.economy) } : {}) }];
  }));
  return { ...state, nations, resources: dropPools(state.resources) };
};

// v20: Modern splits into Modern and Information (eight-ages plan U48, U49, U62, KTD10). Ten techs
// a new Modern list (three of the old Modern techs moved up to Information), so every nation is
// granted the techs of the ages below the age it had, then its age is derived again on the new
// map: a late-Modern nation with six Information techs reaches Information, and none falls below
// the age it had (withTechsResearched never lowers it). Reforms keyed 'modern' and building tiers
// stay as they are (the Information tiers and the Energy line were appended).
export const migrate19to20 = migrate16to17;
// The Future (eight-ages plan Phase E, U76) needs no step: its techs were appended (backfillDefaults
// adds their techTree entries) and its fields are optional and read as none when missing
// (nation.automation, automationRiots, uprisingWarning, brokeWeaponsBanTurn, unit.robot,
// worldCongress.binds, research.futureTechs), so version 20 stays.

// Versions 1 to 9 are never migrated (the province map or an older grid, a clean break: OLDEST_LOADABLE_SAVE_VERSION).

const MIGRATIONS = { 10: migrate10to11, 11: migrate11to12, 12: migrate12to13, 13: migrate13to14, 14: migrate14to15, 15: migrate15to16, 16: migrate16to17, 17: migrate17to18, 18: migrate18to19, 19: migrate19to20 };

// Plain objects only: the fog's packed arrays (TileBits, TileInts) are class instances and are
// never merged key by key.
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// Fills any key present in `template` but MISSING (`=== undefined`) from `target`. Never
// overwrites a key `target` already has, however falsy. Recurses into plain-object values only;
// arrays and primitives are taken from `target` whole, since there's no meaningful per-element
// default for e.g. a `neighbors` array or a `promotions` list.
const deepFillMissing = (target, template) => {
  if (!isPlainObject(template)) return target === undefined ? template : target;
  if (target !== undefined && !isPlainObject(target)) return target;
  const out = { ...(isPlainObject(target) ? target : {}) };
  Object.keys(template).forEach((key) => {
    if (out[key] === undefined) out[key] = template[key];
    else if (isPlainObject(template[key])) out[key] = deepFillMissing(out[key], template[key]);
  });
  return out;
};

// Identity fields a region/nation's own record already carries and that a fresh template's
// defaults must NEVER override, even additively — who owns a region and who a nation actually is
// are save data, not something to backfill from a brand-new game's `startOwner`/`name`.
const stripIdentity = (freshRecord, identityKeys) => {
  const clone = { ...freshRecord };
  identityKeys.forEach((k) => delete clone[k]);
  return clone;
};

const REGION_IDENTITY_KEYS = ['id', 'owner', 'formerOwner'];
const NATION_IDENTITY_KEYS = ['id', 'name', 'color', 'isPlayer'];

// The final step on every load, run after any numbered migrations. Idempotent — migrating an
// already-current save changes nothing, since every key it would fill is already present.
export const backfillDefaults = (state) => {
  const fresh = createInitialState({ playerNationId: state.playerNationId, gameSpeed: state.gameSpeed, scenario: state.scenario?.worldSize && !state.scenario.size ? { ...state.scenario, size: state.scenario.worldSize } : state.scenario, rngSeed: state.scenario?.seed }); // a save keeps the size as worldSize
  // The fog is never backfilled from a fresh game (another world's homelands): it is revived or
  // migrated on its own (migrateSave).
  // eslint-disable-next-line no-unused-vars
  const { regions: freshRegions, nations: freshNations, techTree: freshTechTree, fog: _freshFog, ...freshTop } = fresh;

  // Units are a live collection: a missing starting army may have died or been
  // disbanded. Fresh-game entries must never resurrect it during a reload.
  let out = deepFillMissing(state, { ...freshTop, units: {} });

  // `id` is excluded from both identity-key strip lists above on purpose (see NATION_IDENTITY_KEYS/
  // REGION_IDENTITY_KEYS): it's a real, confirmed bug this diagnosed on a live save — a record's
  // own `.id` was missing entirely (predating the field's introduction to the schema), and since
  // `deepFillMissing` only ever ADDS keys the template offers, and `id` was deliberately never
  // offered (to avoid ever overwriting a record's real identity), a save missing it could never
  // self-heal on any later load, no matter how many other fields backfilled correctly. Unlike
  // owner/isPlayer/name/color, a record's `id` can never legitimately differ from the very map key
  // it's stored under, so force-setting it here is always correct, never a save-data overwrite —
  // it's the one identity field safe to unconditionally repair.
  const regions = { ...(state.regions || {}) };
  Object.keys(freshRegions).forEach((id) => {
    const freshMechanicDefaults = stripIdentity(freshRegions[id], REGION_IDENTITY_KEYS);
    regions[id] = { ...deepFillMissing(regions[id] ?? freshRegions[id], freshMechanicDefaults), id };
  });
  out.regions = regions;

  const nations = { ...(state.nations || {}) };
  Object.keys(freshNations).forEach((id) => {
    const freshMechanicDefaults = stripIdentity(freshNations[id], NATION_IDENTITY_KEYS);
    nations[id] = { ...deepFillMissing(nations[id] ?? freshNations[id], freshMechanicDefaults), id };
  });
  out.nations = nations;

  const techTree = { ...(state.techTree || {}) };
  Object.keys(freshTechTree).forEach((id) => {
    techTree[id] = deepFillMissing(techTree[id] ?? freshTechTree[id], freshTechTree[id]);
  });
  out.techTree = techTree;

  return out;
};

// Accepts the on-disk/on-the-wire save envelope `{ version, state }`, OR a bare state object (an
// older export that predates the envelope, or a raw imported file) — either shape is normalized
// here rather than pushed onto every caller. Returns `{ version: CURRENT_SAVE_VERSION, state }` on
// success, or `null` if the payload is missing, malformed, from a build newer than this one knows
// how to read, or has a gap in its migration chain. `null` means "this save can't be loaded right
// now" — callers fall back to a fresh game but must NOT delete the raw save; a future build (or a
// bug fix) may still be able to read it.
/**
 * Why `migrateSave(payload)` would refuse this save: 'tooOld' (the province map, before version
 * FIRST_TILE_SAVE_VERSION), 'oldGrid' (an older, coarser hex grid, before
 * OLDEST_LOADABLE_SAVE_VERSION: a clean break), 'tooNew' (a later build), 'corrupt' (not a save),
 * or null when it loads. Read-only; the save v7 screen (OldSaveNotice.jsx) and the import alert
 * name the reason.
 */
// The legacy 240-country world is retired (plans/legacy-world-retirement.md): a save whose scenario
// is not a peoples world is kept but not loaded.
export const isLegacyWorldSave = (state) => state?.scenario?.mode !== 'peoples';
export const saveProblem = (payload) => {
  if (!payload || typeof payload !== 'object') return 'corrupt';
  const hasEnvelope = isPlainObject(payload.state);
  const version = hasEnvelope ? (payload.version ?? 1) : 1;
  const state = hasEnvelope ? payload.state : payload;
  if (!isPlainObject(state) || !state.playerNationId || !isPlainObject(state.regions) || !isPlainObject(state.nations)) return 'corrupt';
  if (version > CURRENT_SAVE_VERSION) return 'tooNew';
  if (version < FIRST_TILE_SAVE_VERSION) return 'tooOld';
  if (version < OLDEST_LOADABLE_SAVE_VERSION) return 'oldGrid';
  if (isLegacyWorldSave(state)) return 'legacyWorld';
  for (let v = version; v < CURRENT_SAVE_VERSION; v++) if (!MIGRATIONS[v]) return 'corrupt';
  return null;
};
export const SAVE_PROBLEM_TEXT = {
  tooOld: 'This save is from the old province map. The tile world is a clean break, so it cannot be loaded here.',
  oldGrid: 'This save is from the earlier map with fewer, larger hexes. The map now has about 100,000 smaller hexes and every tile changed, so the save cannot be converted.',
  legacyWorld: 'This save is from the old world of 240 modern countries, which the game no longer plays. It cannot be loaded here.',
  tooNew: 'This save is from a newer build than this one. Update the game to load it.',
  corrupt: 'This file is not a Terra Imperium save, or it is damaged.',
  worldMismatch: 'This save is on a generated world that this build makes differently (its map hash does not match), so it cannot be loaded here.'
};

// Reading a save never repoints the running game's city registry (the fresh game backfillDefaults
// builds would sync it to another world): every caller that loads the result syncs it itself.
export const migrateSave = (payload) => keepWorldRegistry(() => migrateSavePayload(payload));
const migrateSavePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const hasEnvelope = isPlainObject(payload.state);
  let version = hasEnvelope ? (payload.version ?? 1) : 1;
  let state = hasEnvelope ? payload.state : payload;

  if (!isPlainObject(state) || !state.playerNationId || !isPlainObject(state.regions) || !isPlainObject(state.nations)) {
    return null;
  }
  if (version > CURRENT_SAVE_VERSION) return null;
  if (version < OLDEST_LOADABLE_SAVE_VERSION) return null; // the province map or an older grid: a clean break
  if (isLegacyWorldSave(state)) return null; // the retired 240-country world

  // The fog's run-length encoded arrays back to typed arrays before anything reads them.
  if (state.fog) state = { ...state, fog: reviveFog(state.fog) };
  while (version < CURRENT_SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null; // a gap in the chain — refuse rather than guess
    state = step(state);
    version += 1;
  }
  // A unit from before units kept their age (unitUpgrades.js) is of its owner's age now: no version bump.
  const filled = stampUnitAges(backfillDefaults(state));
  // A city the player lost out of sight in a save from before fog.js refreshOwnMemory (P4-C1).
  return { version: CURRENT_SAVE_VERSION, state: filled.fog ? repairOwnMemory(filled) : initFog(filled) };
};
