import { getOwnedRegionIds, REGIONS_DATA } from '../data/regions';
import { isAgeAtLeast, isAgeBefore } from '../data/ages';
// src/engine/supplies.js
// Army supplies: the production chain between raw metal and an army in the field. Supplies
// (provisions, munitions, remounts) are a stock the player builds up and campaigns spend down.
//
//   Foraging     every province the nation holds (and controls) yields SUPPLY_FORAGE_PER_REGION for
//                each of the original admin-1 provinces it contains (a balanced region is several
//                of them merged, scripts/geo/build-balanced-regions.mjs), so foraging is the
//                same as on the detailed map.
//   Industry     each Industry tier in a province (Workshop, Manufactory, Factory) converts
//                METAL_PER_INDUSTRY_TIER of the age's metal into SUPPLIES_PER_INDUSTRY_TIER:
//                copper in the Bronze Age, iron from the Classical to the Gunpowder Age, oil in
//                the Modern Age. With the metal short, it converts only what's in stock.
//   Campaigning  every land unit beyond the nation's own (unoccupied) provinces eats
//                SUPPLY_PER_CAMPAIGNING_UNIT per turn; troops at home live off the land.
//
// Run dry and the campaigning armies go hungry: no reinforcement, and HUNGER_MORALE lost each
// turn (applied in resolveTurn's morale phase). Player-only, like every metal stock: AI nations'
// economies abstract metals away (aiEconomy.js).
export const SUPPLY_FORAGE_PER_REGION = 0.2; // a 100-province realm feeds ~20 units abroad; a 5-province one, one
export const SUPPLIES_PER_INDUSTRY_TIER = 3;
export const METAL_PER_INDUSTRY_TIER = 2;
export const SUPPLY_PER_CAMPAIGNING_UNIT = 1;
export const HUNGER_MORALE = 10;
// Marching (routes.js): every land unit that marched this turn eats this much more, double abroad.
export const MARCH_SUPPLY_PER_UNIT = 0.5;

export const industryMetalFor = (ageId) => (isAgeBefore(ageId, 'classical') ? 'copper' : isAgeAtLeast(ageId, 'modern') ? 'oil' : 'iron');

const round1 = (v) => Math.round(v * 10) / 10;

// A land unit is campaigning when it stands outside its nation's own, unoccupied land: by the tile
// it stands on when the tile owner map is given (workstream 5), else by its region.
export const isCampaigning = (unit, regions, tileOwner = null) => {
  if (unit.domain === 'naval' || unit.embarkedOn) return false;
  const r = regions[tileOwner && unit.tile != null && unit.tile >= 0 ? tileOwner[unit.tile] : unit.regionId];
  return !r || r.owner !== unit.ownerId || !!r.occupiedBy;
};

// This turn's flows for `nationId`. `resources` is the stock before the flows are applied.
// How many original provinces a region stands for (1 for an unmerged one).
const forageSize = (regionId) => Math.max(1, Math.round((REGIONS_DATA[regionId]?.includes?.length || 1) / 2));

// Supplies the marches of `turnNumber` cost (units with marchedTurn === turnNumber).
/** Units grouped by owner: Map ownerId -> units. Built once per phase and passed as `ownedUnits`
 * to the per-nation helpers below, so a phase over 240 nations scans the unit map once, not 240 times. */
export const unitsByOwner = (units) => {
  const map = new Map();
  Object.values(units).forEach((u) => { const list = map.get(u.ownerId); if (list) list.push(u); else map.set(u.ownerId, [u]); });
  return map;
};
export const ownedUnitsOf = (units, nationId, ownedUnits = null) => ownedUnits || Object.values(units).filter((u) => u.ownerId === nationId);

export const marchSupplyCost = (units, regions, nationId, turnNumber, tileOwner = null, ownedUnits = null) => (turnNumber == null ? 0 : ownedUnitsOf(units, nationId, ownedUnits).reduce((sum, u) => {
  if (u.ownerId !== nationId || u.marchedTurn !== turnNumber || u.domain === 'naval' || u.embarkedOn) return sum;
  return sum + MARCH_SUPPLY_PER_UNIT * (isCampaigning(u, regions, tileOwner) ? 2 : 1);
}, 0));

export const computeSupplyFlow = ({ regions, units, nationId, ageId, resources, turnNumber = null, tileOwner = null, ownedUnits = null }) => {
  const mine = ownedUnitsOf(units, nationId, ownedUnits);
  let forage = 0; let industryTiers = 0;
  getOwnedRegionIds(regions,nationId).forEach((id) => {
    const r=regions[id];
    if (r.owner !== nationId || r.occupiedBy) return;
    forage += SUPPLY_FORAGE_PER_REGION * forageSize(id) * Math.max(0, Math.min(1, (r.control ?? 100) / 100));
    const tier = r.buildings?.categories?.industry ?? -1;
    if (tier >= 0) industryTiers += tier + 1;
  });
  const metalId = industryMetalFor(ageId);
  const metalWanted = industryTiers * METAL_PER_INDUSTRY_TIER;
  const metalUsed = Math.max(0, Math.min(metalWanted, resources?.[metalId] || 0));
  const manufactured = metalWanted > 0 ? (metalUsed / METAL_PER_INDUSTRY_TIER) * SUPPLIES_PER_INDUSTRY_TIER : 0;
  const campaigning = mine.filter((u) => u.ownerId === nationId && isCampaigning(u, regions, tileOwner)).length;
  const marching = marchSupplyCost(units, regions, nationId, turnNumber, tileOwner, mine);
  const consumed = round1(campaigning * SUPPLY_PER_CAMPAIGNING_UNIT + marching);
  const produced = round1(forage + manufactured);
  const before = resources?.supplies || 0;
  const after = round1(before + produced - consumed);
  return { produced, forage, manufactured: round1(manufactured), metalId, metalUsed, consumed, campaigning, marching: round1(marching), supplies: Math.max(0, after), hungry: after < 0 };
};
