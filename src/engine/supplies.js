import { getOwnedRegionIds, REGIONS_DATA } from '../data/regions';
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

export const industryMetalFor = (ageId) => (ageId === 'bronze' ? 'copper' : ageId === 'modern' ? 'oil' : 'iron');

const round1 = (v) => Math.round(v * 10) / 10;

// A land unit is campaigning when it stands outside its nation's own, unoccupied provinces.
export const isCampaigning = (unit, regions) => {
  if (unit.domain === 'naval' || unit.embarkedOn) return false;
  const r = regions[unit.regionId];
  return !r || r.owner !== unit.ownerId || !!r.occupiedBy;
};

// This turn's flows for `nationId`. `resources` is the stock before the flows are applied.
// How many original provinces a region stands for (1 for an unmerged one).
const forageSize = (regionId) => 1 + (REGIONS_DATA[regionId]?.includes?.length || 0);

// Supplies the marches of `turnNumber` cost (units with marchedTurn === turnNumber).
export const marchSupplyCost = (units, regions, nationId, turnNumber) => (turnNumber == null ? 0 : Object.values(units).reduce((sum, u) => {
  if (u.ownerId !== nationId || u.marchedTurn !== turnNumber || u.domain === 'naval' || u.embarkedOn) return sum;
  const r = regions[u.regionId];
  const abroad = !r || r.owner !== nationId || !!r.occupiedBy;
  return sum + MARCH_SUPPLY_PER_UNIT * (abroad ? 2 : 1);
}, 0));

export const computeSupplyFlow = ({ regions, units, nationId, ageId, resources, turnNumber = null }) => {
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
  const campaigning = Object.values(units).filter((u) => u.ownerId === nationId && isCampaigning(u, regions)).length;
  const marching = marchSupplyCost(units, regions, nationId, turnNumber);
  const consumed = round1(campaigning * SUPPLY_PER_CAMPAIGNING_UNIT + marching);
  const produced = round1(forage + manufactured);
  const before = resources?.supplies || 0;
  const after = round1(before + produced - consumed);
  return { produced, forage, manufactured: round1(manufactured), metalId, metalUsed, consumed, campaigning, marching: round1(marching), supplies: Math.max(0, after), hungry: after < 0 };
};
