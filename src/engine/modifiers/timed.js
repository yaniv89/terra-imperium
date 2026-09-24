// src/engine/modifiers/timed.js
// Plan §A.2: timed modifier storage + expiry. Nation-scoped entries live on `nation.modifiers[]`
// (read by src/engine/modifiers/sources.js's staticSources); region-scoped entries live in a
// SPARSE top-level map, `state.regionModifiers = { [regionId]: Entry[] }`, so the ~4,482 region
// objects don't each carry an empty array for a feature most regions never use.
//
// Nothing in the game creates an entry yet — this is pure infrastructure landing ahead of the
// first real caller (M4's stability effects, M9's estate privileges, M13's reparations,
// M17's event modifiers, ...), each of which only needs to call addNationModifier/
// addRegionModifier and push the result through applyEventEffects-style state updates; none of
// them need to touch resolveTurn.js's turn loop again, since expireModifiers is already wired in.
let nextModifierId = 1;
export const _resetModifierIdForTests = () => { nextModifierId = 1; };

const makeEntry = ({ sourceType, sourceId, label, mods, duration, turnNumber }) => ({
  id: `mod_${nextModifierId++}`,
  sourceType,
  sourceId,
  label,
  mods,
  expiresTurn: turnNumber + duration
});

export const addNationModifier = (nation, entry) => ({
  ...nation,
  modifiers: [...(nation.modifiers || []), makeEntry(entry)]
});

export const addRegionModifier = (regionModifiers, regionId, entry) => ({
  ...regionModifiers,
  [regionId]: [...(regionModifiers?.[regionId] || []), makeEntry(entry)]
});

// Drops every expired entry (expiresTurn <= newTurnNumber) from every nation's modifiers[] and
// from the sparse regionModifiers map. Returns the SAME references when nothing expired, so a
// turn with no timed modifiers anywhere costs one pass over already-empty arrays, not a rebuild.
export const expireNationModifiers = (nations, newTurnNumber) => {
  let changed = false;
  const next = { ...nations };
  Object.entries(nations).forEach(([id, nation]) => {
    if (!nation.modifiers?.length) return;
    const kept = nation.modifiers.filter((m) => m.expiresTurn > newTurnNumber);
    if (kept.length !== nation.modifiers.length) {
      next[id] = { ...nation, modifiers: kept };
      changed = true;
    }
  });
  return changed ? next : nations;
};

export const expireRegionModifiers = (regionModifiers, newTurnNumber) => {
  if (!regionModifiers) return regionModifiers;
  let changed = false;
  const next = { ...regionModifiers };
  Object.entries(regionModifiers).forEach(([regionId, entries]) => {
    const kept = entries.filter((m) => m.expiresTurn > newTurnNumber);
    if (kept.length !== entries.length) {
      changed = true;
      if (kept.length === 0) delete next[regionId];
      else next[regionId] = kept;
    }
  });
  return changed ? next : regionModifiers;
};
