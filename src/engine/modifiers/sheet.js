// src/engine/modifiers/sheet.js
// Plan §M1/§A.2: the one place every modifier total is actually summed. `staticSheet(nation)` is
// cached per nation OBJECT REFERENCE (a WeakMap) — safe because reducer/AI code never mutates a
// nation in place, it always produces a new object for any change (immutableCtx/draftCtx,
// src/engine/nationActions/ctx.js), so the same reference really does mean the same bonuses.
// `getNationSheet(state, nationId)` layers the contextual (state-dependent) sources on top and is
// cached per (state, nationId) pair for the lifetime of that one state object.
import { staticSources, contextSources } from './sources';
import { LEGACY_HOOK } from './registry';

const staticCache = new WeakMap(); // nation -> { key -> Line[] }

const groupByKey = (lines) => {
  const grouped = new Map();
  lines.forEach((line) => {
    if (!grouped.has(line.key)) grouped.set(line.key, []);
    grouped.get(line.key).push(line);
  });
  return grouped;
};

const staticSheet = (nation) => {
  let grouped = staticCache.get(nation);
  if (!grouped) {
    grouped = groupByKey(staticSources(nation));
    staticCache.set(nation, grouped);
  }
  return grouped;
};

const stateCache = new WeakMap(); // state -> Map<nationId, Sheet>

const buildSheet = (state, nationId) => {
  const nation = state.nations?.[nationId];
  const lines = [...(nation ? [].concat(...staticSheet(nation).values()) : []), ...contextSources(state, nationId)];
  const grouped = groupByKey(lines);
  return {
    get: (key) => (grouped.get(key) || []).reduce((sum, l) => sum + l.value, 0),
    explain: (key) => {
      const breakdown = grouped.get(key) || [];
      return { total: breakdown.reduce((sum, l) => sum + l.value, 0), breakdown };
    }
  };
};

export const getNationSheet = (state, nationId) => {
  let byNation = stateCache.get(state);
  if (!byNation) {
    byNation = new Map();
    stateCache.set(state, byNation);
  }
  let sheet = byNation.get(nationId);
  if (!sheet) {
    sheet = buildSheet(state, nationId);
    byNation.set(nationId, sheet);
  }
  return sheet;
};

// getModifier(state, scope, key) from the plan's own signature, specialized to nation scope since
// that's the only scope with any real sources today (region/unit scopes arrive with M5/M6/M14,
// which is when getRegionModifier below actually gets a first caller).
export const getModifier = (state, nationId, key) => getNationSheet(state, nationId).explain(key);

// Region scope (sparse, plan §A.2): nothing populates state.regionModifiers yet, so this always
// returns an empty breakdown until a later milestone (M6's buildings, M14's terrain, ...) adds a
// region-scoped source here.
export const getRegionModifier = (state, regionId, key) => {
  const entries = (state.regionModifiers?.[regionId] || []).filter((mod) => mod.mods?.[key]);
  const breakdown = entries.map((mod) => ({ key, value: mod.mods[key], sourceType: mod.sourceType || 'event', sourceId: mod.sourceId || mod.id, label: mod.label }));
  return { total: breakdown.reduce((sum, l) => sum + l.value, 0), breakdown };
};

// Drop-in replacement for the old src/utils/helpers.js `getNationBonusTotal(nation, hookKey)`:
// same nation-only signature and identical numbers (it sums exactly the sources that function
// always summed — government/policy/wonder/identity/timed nation modifiers), so every existing
// caller (nextUnrest, population.js, calcIncome, getMaxActionPoints) keeps working unchanged.
// `explainNationBonus` is the new addition: the same total, plus its breakdown, for a future
// tooltip to render.
export const explainNationBonus = (nation, hookKey) => {
  const key = LEGACY_HOOK[hookKey] || hookKey;
  const breakdown = staticSheet(nation).get(key) || [];
  return { total: breakdown.reduce((sum, l) => sum + l.value, 0), breakdown };
};

export const getNationBonusTotal = (nation, hookKey) => explainNationBonus(nation, hookKey).total;
