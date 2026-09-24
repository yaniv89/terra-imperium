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
import { createInitialState } from './gameReducer';

// Bump this once per milestone that changes the STATE SHAPE in a way plain backfill can't handle
// (a field is renamed, split, or needs a real formula to convert) — not for every commit. Add the
// matching numbered step to MIGRATIONS at the same time, keyed by the version it upgrades FROM.
export const CURRENT_SAVE_VERSION = 1;

// Empty today: nothing has changed the state shape since the very first save format shipped, so a
// v1 payload only ever needs `backfillDefaults`, not a semantic conversion. The very first
// shape-changing milestone (M2's AP -> ADM/DIP/MIL) adds `MIGRATIONS[1] = migrate1to2` and bumps
// CURRENT_SAVE_VERSION to 2.
const MIGRATIONS = {};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Fills any key present in `template` but MISSING (`=== undefined`) from `target`. Never
// overwrites a key `target` already has, however falsy. Recurses into plain-object values only;
// arrays and primitives are taken from `target` whole, since there's no meaningful per-element
// default for e.g. a `neighbors` array or a `promotions` list.
const deepFillMissing = (target, template) => {
  if (!isPlainObject(template)) return target === undefined ? template : target;
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
  const fresh = createInitialState({ playerNationId: state.playerNationId, gameSpeed: state.gameSpeed });
  const { regions: freshRegions, nations: freshNations, techTree: freshTechTree, ...freshTop } = fresh;

  let out = deepFillMissing(state, freshTop);

  const regions = { ...(state.regions || {}) };
  Object.keys(freshRegions).forEach((id) => {
    const freshMechanicDefaults = stripIdentity(freshRegions[id], REGION_IDENTITY_KEYS);
    regions[id] = deepFillMissing(regions[id] ?? freshRegions[id], freshMechanicDefaults);
  });
  out.regions = regions;

  const nations = { ...(state.nations || {}) };
  Object.keys(freshNations).forEach((id) => {
    const freshMechanicDefaults = stripIdentity(freshNations[id], NATION_IDENTITY_KEYS);
    nations[id] = deepFillMissing(nations[id] ?? freshNations[id], freshMechanicDefaults);
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
export const migrateSave = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const hasEnvelope = isPlainObject(payload.state);
  let version = hasEnvelope ? (payload.version ?? 1) : 1;
  let state = hasEnvelope ? payload.state : payload;

  if (!isPlainObject(state) || !state.playerNationId || !isPlainObject(state.regions) || !isPlainObject(state.nations)) {
    return null;
  }
  if (version > CURRENT_SAVE_VERSION) return null;

  while (version < CURRENT_SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null; // a gap in the chain — refuse rather than guess
    state = step(state);
    version += 1;
  }

  return { version: CURRENT_SAVE_VERSION, state: backfillDefaults(state) };
};
