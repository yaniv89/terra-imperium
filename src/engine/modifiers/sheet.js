// src/engine/modifiers/sheet.js
// Plan §M1/§A.2: the one place every modifier total is actually summed. `staticSheet(nation)` is
// cached per nation OBJECT REFERENCE (a WeakMap) — safe because reducer/AI code never mutates a
// nation in place, it always produces a new object for any change (immutableCtx/draftCtx,
// src/engine/nationActions/ctx.js), so the same reference really does mean the same bonuses.
// `getNationSheet(state, nationId)` layers the contextual (state-dependent) sources on top and is
// cached per (state, nationId) pair for the lifetime of that one state object.
import { staticSources, contextSources, regionSources } from './sources';
import { cityWonderLines } from '../../data/greatProjects';
import { LEGACY_HOOK } from './registry';

const staticCache = new WeakMap(); // nation -> { key -> Line[] }
const regionStaticCache = new WeakMap(); // region -> { key -> Line[] } (plan §M6: building tiers)

const groupByKey = (lines) => {
  const grouped = new Map();
  lines.forEach((line) => {
    if (!grouped.has(line.key)) grouped.set(line.key, []);
    grouped.get(line.key).push(line);
  });
  return grouped;
};

const staticSheet = (nation) => {
  if (!nation) return new Map();
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

// Region scope: a region's own building tiers (plan §M6, cached per region object reference the
// same way staticSheet caches per nation) plus any sparse TIMED modifier (plan §A.2 — nothing
// populates state.regionModifiers yet; M14's terrain/occupation are the plan's next real source).
// The building lines depend on the region's building tiers only, so a second memo keyed on
// those tiers serves the region objects a turn rewrites (every city is a new object each turn;
// a thousand cities share a few hundred tier combinations). Bounded.
const sheetByTiers = new Map();
const SHEET_BY_TIERS_MAX = 2000;
const tiersKey = (region) => { const c = region?.buildings?.categories; if (!c) return ''; let k = ''; for (const id in c) k += `${id}:${c[id]},`; return k; };
const regionStaticSheet = (region) => {
  let grouped = regionStaticCache.get(region);
  if (!grouped) {
    const key = tiersKey(region);
    grouped = sheetByTiers.get(key);
    if (!grouped) {
      grouped = groupByKey(regionSources(region));
      if (sheetByTiers.size >= SHEET_BY_TIERS_MAX) sheetByTiers.clear();
      sheetByTiers.set(key, grouped);
    }
    regionStaticCache.set(region, grouped);
  }
  return grouped;
};

/** Several region keys from one sheet lookup: { key: total }. For the per-region income loops
 * (aiEconomy.js), which asked six times per region. */
export const getRegionModifierTotals = (state, regionId, keys) => {
  const region = state.regions?.[regionId];
  const grouped = region ? regionStaticSheet(region) : null;
  const timed = state.regionModifiers?.[regionId] || [];
  const wonder = cityWonderLines(state.greatProjects, regionId);
  const out = {};
  keys.forEach((key) => {
    let total = 0;
    if (grouped) { const lines = grouped.get(key); if (lines) for (let i = 0; i < lines.length; i++) total += lines[i].value; }
    if (wonder.length) wonder.forEach((l) => { if (l.key === key) total += l.value; });
    if (timed.length) timed.forEach((mod) => { if (mod.mods?.[key]) total += mod.mods[key]; });
    out[key] = total;
  });
  return out;
};

export const getRegionModifier = (state, regionId, key) => {
  const region = state.regions?.[regionId];
  const buildingLines = region ? (regionStaticSheet(region).get(key) || []) : [];
  const timedEntries = (state.regionModifiers?.[regionId] || []).filter((mod) => mod.mods?.[key]);
  const timedLines = timedEntries.map((mod) => ({ key, value: mod.mods[key], sourceType: mod.sourceType || 'event', sourceId: mod.sourceId || mod.id, label: mod.label }));
  const wonderLines = cityWonderLines(state.greatProjects, regionId).filter((l) => l.key === key); // its own national wonder (greatProjects.js)
  const breakdown = [...buildingLines, ...wonderLines, ...timedLines];
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
