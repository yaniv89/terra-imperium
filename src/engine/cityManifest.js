// src/engine/cityManifest.js
// A city's manifest from game state, and the battle damage that persists on it (plans/MASTER-PLAN.md
// phase B; sections 6.3, 6.5 and 6.8; the world plan sections 10 and 11).
//
// The manifest (src/data/townLayout.js buildTownManifest) is a pure function of the city record:
// its owner's age, the style of its land, its size tier (from its buildings), its seed (its id),
// capital, Defense tier, built buildings and the wonders on its land. So it is rebuilt on demand
// and never saved; a save stores only the city's damage, keyed by the manifest's stable ids:
//   region.cityDamage = { ruined: { [id]: turnsUntilRebuilt }, damaged: { [id]: turnsUntilRepaired } }
// (absent when the city is whole). Old saves have no field and load as whole cities.
//
// Conquest keeps half the city (6.8, decision 31). A battle reports the manifest ids it destroyed
// and damaged; what carries to the map:
//   houses     at most half the city's houses are ruined (the first destroyed, in id order); the
//              rest of the destroyed and every damaged house are only "damaged".
//   buildings  at most half the built buildings lose a tier, never more than one tier each (the
//              Defense line is the walls, never lost here); the rest are damaged.
//   size       loses the share of the houses ruined (round(size x ruined / houses)), never below
//              half the size it had (rounded up) nor below 1.
//   the rest   walls, gates, towers, landmarks, the palace, the town hall and wonders are never
//              lost: destroyed or damaged, they are "damaged" and repair (a breach is mended).
// Repairs are free: a damaged structure is whole after REPAIR_TURNS turns; a ruined house is
// rebuilt after RUIN_TURNS turns, RUIN_STEP more for each further ruin, so a city regrows its
// houses one by one. Nothing repairs while the city is under siege. When a battle ends with the
// city changing hands (the start of an occupation) half its damage, rounded up, is repaired at once.
// The same rule serves sacks, sallies and failed assaults (the defender's city).
//
// Housing (6.3): the defender's housing cap in battle is its manifest's houses that are not ruined
// plus the town hall's 20 (cityHousingCap), exposed now for the battle economy (phase R1).
import { buildTownManifest, citySeed, manifestHousing, isCivic } from '../data/townLayout';
import { townTier } from '../data/townTiers';
import { styleOfLand } from '../data/architecture';
import { getEffectiveAgeId } from '../data/ages';
import { landOf } from './world/cultureZones';

export const REPAIR_TURNS = 3;
export const RUIN_TURNS = 8;
export const RUIN_STEP = 2;
export const MAX_CARRIED_SHARE = 0.5; // of houses, of buildings; the size floor is half too

/** The age a nation's cities are built in (the close view's rule). */
export const cityAgeOf = (state, nationId) => {
  if (!nationId) return state.age;
  if (nationId === state.playerNationId) return getEffectiveAgeId(state.age, state.techAgeId);
  return getEffectiveAgeId(state.age, state.nations?.[nationId]?.tech?.ageId);
};

/** The plain inputs of a city's manifest (src/data/townLayout.js buildTownManifest). */
export const cityManifestInput = (state, cityId) => {
  const region = state.regions?.[cityId];
  if (!region) return null;
  const owner = region.owner || region.colony?.ownerId || null;
  const ageId = cityAgeOf(state, owner) || 'bronze';
  let landNation = null;
  if (region.tile != null) { try { landNation = landOf(region.tile, state.scenario?.sites); } catch { landNation = null; } }
  const tileOwner = state.world?.tileOwner || {};
  const wonders = Object.entries(state.greatProjects || {})
    .filter(([, e]) => e?.tier && e.tile != null && (e.tile === region.tile || tileOwner[e.tile] === cityId))
    .map(([projectId]) => projectId);
  return {
    cityId,
    ageId,
    tierId: region.owner ? townTier(region).id : 'small',
    style: styleOfLand(landNation || owner, ageId),
    seed: citySeed(cityId),
    capital: !!owner && state.nations?.[owner]?.capitalRegionId === cityId,
    defenseTier: region.buildings?.categories?.defense ?? -1,
    buildings: region.buildings?.categories || {},
    wonders,
    camp: !!region.outpost || (!region.owner && !!region.colony)
  };
};

/** A city's manifest, or null. */
export const cityManifestOf = (state, cityId) => {
  const input = cityManifestInput(state, cityId);
  return input ? buildTownManifest(input) : null;
};

const EMPTY = Object.freeze({ ruined: Object.freeze({}), damaged: Object.freeze({}) });
/** A city's damage: { ruined, damaged } maps of manifest id -> turns left (never null). */
export const cityDamageOf = (region) => region?.cityDamage || EMPTY;

/** The defender's housing cap in battle (master plan 6.3): unruined houses plus the town hall. */
export const cityHousingCap = (state, cityId, manifest = cityManifestOf(state, cityId)) => (manifest ? manifestHousing(manifest, cityDamageOf(state.regions[cityId]).ruined) : 0);

const clean = (dmg) => (Object.keys(dmg.ruined).length || Object.keys(dmg.damaged).length ? dmg : undefined);
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * What a battle's damage does to a city under the 50% rule (pure; no state). `manifest`: the city's
 * manifest before the battle; `prior`: its damage before; `report`: { destroyed: [id], damaged: [id] }
 * from the battle; `occupation`: the city changed hands. Returns { damage, lostBuildings:
 * [category], sizeLoss, ruinedHouses: [id], repairedAtOnce }.
 */
export const carryBattleDamage = ({ manifest, prior = EMPTY, report, size = 1, occupation = false }) => {
  const known = new Map(manifest.structures.map((s) => [s.id, s]));
  const destroyed = [...new Set((report?.destroyed || []).filter((id) => known.has(id)))].sort(byId);
  const hit = [...new Set((report?.damaged || []).filter((id) => known.has(id) && !destroyed.includes(id)))].sort(byId);
  const ruined = { ...prior.ruined };
  const damaged = { ...prior.damaged };
  const houses = manifest.structures.filter((s) => s.kind === 'house');
  const buildings = manifest.structures.filter((s) => s.kind === 'building');
  const maxRuined = Math.floor(houses.length * MAX_CARRIED_SHARE);
  const maxLost = Math.floor(buildings.length * MAX_CARRIED_SHARE);
  const alreadyRuined = houses.filter((h) => ruined[h.id]).length;
  const ruinedHouses = [];
  const lostBuildings = [];
  destroyed.forEach((id) => {
    const s = known.get(id);
    if (s.kind === 'house' && !ruined[id]) {
      if (alreadyRuined + ruinedHouses.length < maxRuined) {
        ruined[id] = RUIN_TURNS + RUIN_STEP * (alreadyRuined + ruinedHouses.length);
        ruinedHouses.push(id);
        delete damaged[id];
        return;
      }
    } else if (s.kind === 'building' && lostBuildings.length < maxLost) {
      lostBuildings.push(s.category);
      delete damaged[id];
      return;
    }
    if (!ruined[id]) damaged[id] = REPAIR_TURNS;
  });
  hit.forEach((id) => { if (!ruined[id]) damaged[id] = REPAIR_TURNS; });
  // The size follows the houses lost, never below half (rounded up), never below 1.
  const floor = Math.max(1, Math.ceil(size * MAX_CARRIED_SHARE));
  const sizeLoss = houses.length ? Math.max(0, Math.min(size - floor, Math.round((size * ruinedHouses.length) / houses.length))) : 0;
  // An occupation starts with half the damage mended (the damaged list, in id order).
  let repairedAtOnce = 0;
  if (occupation) {
    const ids = Object.keys(damaged).sort(byId);
    repairedAtOnce = Math.ceil(ids.length / 2);
    ids.slice(0, repairedAtOnce).forEach((id) => { delete damaged[id]; });
  }
  return { damage: clean({ ruined, damaged }), lostBuildings, sizeLoss, ruinedHouses, repairedAtOnce };
};

/**
 * Apply a commanded battle's city damage to the map (the reducer, after the battle's own result).
 * `report`: { destroyed, damaged } (src/battle/sim/result.js tactical.cityDamage); `manifest`: the
 * city's manifest as the battle loaded it (before the result changed the owner or buildings);
 * `occupation`: the city changed hands in this battle. Returns { state, log } (log: a plain line
 * for the player, or null).
 */
export const applyCityBattleDamage = (state, cityId, report, { manifest, occupation = false } = {}) => {
  const region = state.regions?.[cityId];
  if (!region || !manifest || (!report?.destroyed?.length && !report?.damaged?.length)) return { state, log: null };
  const out = carryBattleDamage({ manifest, prior: cityDamageOf(region), report, size: region.size || 1, occupation });
  const categories = { ...(region.buildings?.categories || {}) };
  out.lostBuildings.forEach((c) => { if ((categories[c] ?? -1) >= 0 && c !== 'defense') categories[c] -= 1; });
  const next = { ...region, cityDamage: out.damage };
  if (!out.damage) delete next.cityDamage;
  if (out.lostBuildings.length) next.buildings = { ...region.buildings, categories };
  if (out.sizeLoss > 0 && region.size != null) next.size = region.size - out.sizeLoss;
  const parts = [];
  if (out.ruinedHouses.length) parts.push(`${out.ruinedHouses.length} house${out.ruinedHouses.length > 1 ? 's' : ''} in ruins`);
  if (out.lostBuildings.length) parts.push(`${out.lostBuildings.length} building${out.lostBuildings.length > 1 ? 's' : ''} lost a tier`);
  if (out.sizeLoss > 0) parts.push(`size -${out.sizeLoss}`);
  const left = out.damage ? Object.keys(out.damage.damaged).length : 0;
  if (left) parts.push(`${left} damaged, repairing over ${REPAIR_TURNS} turns`);
  if (out.repairedAtOnce) parts.push(`${out.repairedAtOnce} repaired at once`);
  return { state: { ...state, regions: { ...state.regions, [cityId]: next } }, log: parts.length ? parts.join(', ') : null };
};

/** One turn of free repairs on a city record (resolveTurn). Returns the same record when nothing
 * changes; a besieged city does not repair. */
export const repairCityDamage = (region) => {
  const dmg = region?.cityDamage;
  if (!dmg || region.siege?.by) return region;
  const tick = (map) => {
    const out = {};
    Object.keys(map).forEach((id) => { const left = map[id] - 1; if (left > 0) out[id] = left; });
    return out;
  };
  const next = clean({ ruined: tick(dmg.ruined || {}), damaged: tick(dmg.damaged || {}) });
  const out = { ...region };
  if (next) out.cityDamage = next; else delete out.cityDamage;
  return out;
};

/** The manifest with each structure's map state: 'intact', 'damaged' or 'ruined' (the close view). */
export const manifestStates = (manifest, damage = EMPTY) => manifest.structures.map((s) => ({
  ...s,
  state: damage.ruined[s.id] ? 'ruined' : damage.damaged[s.id] ? 'damaged' : 'intact'
}));

export { isCivic };
