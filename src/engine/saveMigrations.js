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
export const CURRENT_SAVE_VERSION = 2;

// M2 replaced the single `resources.actionPoints` pool (and the separate `diplomacyPoints`
// currency) with three power pools, `adm`/`dip`/`mil` — plain backfill can't invent this
// conversion since it only fills keys that are MISSING, and it would otherwise hand a v1 save
// fresh-game defaults (3 each) for a currency the player may have banked a large amount of.
// Old base was 5/turn banked to a 2x cap (10); new base is 3/turn per pool banked to 2x (6) — the
// ratio 3/5 carries a banked balance over proportionally rather than resetting it to the new
// base. diplomacyPoints folds into dip on top, 1:1, matching how the two currencies now share one
// pool going forward.
const migrate1to2 = (state) => {
  // eslint-disable-next-line no-unused-vars -- destructured only to omit it from restResources; the new maxAdm/maxDip/maxMil below replace it
  const { actionPoints, maxActionPoints, diplomacyPoints, ...restResources } = state.resources || {};
  const perPool = Math.max(0, Math.round((actionPoints || 0) * 3 / 5));
  return {
    ...state,
    resources: {
      ...restResources,
      adm: perPool,
      mil: perPool,
      dip: perPool + (diplomacyPoints || 0),
      maxAdm: perPool,
      maxMil: perPool,
      maxDip: perPool
    }
  };
};

const MIGRATIONS = { 1: migrate1to2 };

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
