// src/engine/threat.js
// Threats, relief and raids for the AI's fronts (plans/civ-map-rework.md, D6; workstream 9).
//   Threat    the strength of enemy land units within THREAT_RINGS of a city's centre. A city is
//             THREATENED when it is besieged, under invasion, or the threat exceeds its garrison
//             x THREAT_DEFEND_RATIO; the AI defends threatened cities before it advances
//             (aiOperations.js).
//   Relief    a stack standing beside a besieger of an own city attacks it (a field battle,
//             fieldBattle.js) when it outweighs that besieger stack by RELIEF_RATIO.
//   Raid      a stack halted on an enemy tile with an improvement pillages it: the improvement
//             stops yielding until rebuilt (tileYields.js reads `pillaged`), the raider's nation
//             gains RAID_GOLD, and roads on the tile are cut.
// Out of the player's sight (sight.js) an AI war's city goal is decided by the dice in
// diplomacy.js resolveWarProgress; within sight the real operations above decide.
// Pure of randomness.
import { getTiles } from '../data/geo/tiles';
import { ringsAround } from './world/cities';
import { landUnitsByTile } from './sieges';
import { unitTile } from './armies';
import { lawRulesOf } from './lawRules';

export const THREAT_RINGS = 6;
export const THREAT_DEFEND_RATIO = 0.8;
export const RELIEF_RATIO = 1.2;
export const RAID_GOLD = 20;

/** Enemy land strength within THREAT_RINGS of the city. */
export const threatOf = (state, city, enemies, byTile = null) => {
  if (city.tile == null) return 0;
  const index = byTile || landUnitsByTile(state);
  let threat = 0;
  ringsAround(getTiles(), city.tile, THREAT_RINGS).forEach((d, t) => { (index.get(t) || []).forEach((u) => { if (enemies.has(u.ownerId)) threat += u.strength || 0; }); });
  return threat;
};

/** Own land strength on the city centre. */
export const garrisonStrength = (state, nationId, city, byTile = null) => {
  const index = byTile || landUnitsByTile(state);
  return (index.get(city.tile) || []).reduce((s, u) => s + (u.ownerId === nationId ? u.strength || 0 : 0), 0);
};

/** The ids of the nation's cities that need defending now, in id order. */
export const threatenedCities = (state, nationId, enemies, byTile = null) => {
  const index = byTile || landUnitsByTile(state);
  return Object.values(state.regions || {}).filter((c) => {
    if (c.owner !== nationId) return false;
    if (c.siege?.by || c.underInvasion) return true;
    const threat = threatOf(state, c, enemies, index);
    return threat > 0 && threat > garrisonStrength(state, nationId, c, index) * THREAT_DEFEND_RATIO;
  }).map((c) => c.id).sort();
};

/** The tiles beside `tile` where besiegers of `city` stand, with their strength: [{ tile, strength }], weakest first. */
export const besiegerStacksBeside = (state, tile, city, byTile = null) => {
  const tiles = getTiles();
  const index = byTile || landUnitsByTile(state);
  const ring1 = new Set(tiles.neighbors[city.tile]);
  const out = [];
  tiles.neighbors[tile].forEach((t) => {
    if (!ring1.has(t)) return;
    const strength = (index.get(t) || []).reduce((s, u) => s + (u.ownerId === city.siege?.by ? u.strength || 0 : 0), 0);
    if (strength > 0) out.push({ tile: t, strength });
  });
  return out.sort((a, b) => a.strength - b.strength || a.tile - b.tile);
};

/** Pillages the improvement on `tile` for `nationId` when it is an enemy's: returns { tileState, gold } or null. */
export const pillageTile = (state, nationId, tile, enemies) => {
  const entry = state.world?.tileState?.[tile];
  if (!(entry?.improvement || entry?.district) || entry.pillaged) return null; // an improvement or a district (districts.js)
  const cityId = state.world?.tileOwner?.[tile];
  const owner = cityId != null ? state.regions?.[cityId]?.owner : null;
  if (!owner || !enemies.has(owner)) return null;
  const gold = Math.round(RAID_GOLD * Math.max(0, 1 + (lawRulesOf(state.nations?.[nationId]).pillageGoldMult || 0))); // Chieftaincy doubles it (lawRules.js)
  return { tileState: { ...state.world.tileState, [tile]: { ...entry, pillaged: true, pillagedTurn: state.turnNumber || 0 } }, gold, cityId };
};

/** The tile a unit stands on (a land unit's tile, else its city's centre). */
export const standingTile = (state, unit) => unitTile(state, unit);
