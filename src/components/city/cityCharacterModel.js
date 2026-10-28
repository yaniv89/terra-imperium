// src/components/city/cityCharacterModel.js
// What makes one city unlike the next, and why the advisor wants a build (lane cities-8; round 2
// playtests: "cities feel the same", "why build one thing over another"). Civ VI and Humankind give
// each city a face through its districts; here the face is the building line it has raised highest
// (a Granary town, a Forge town), else what its land yields most. Pure; every number is the engine's.
//   cityCharacter(state, cityId, live)  { id, title, why }
//   advisorWhy(state, cityId, item)     one line: why the advisor picked this item, or null
import { getTiles } from '../../data/geo/tiles';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { buildingTierName } from '../../i18n/gameText';
import { t as tNow } from '../../i18n/core';
import { cityLive } from '../../engine/cityEconomy';
import { buildingEffect, improvementEffect } from '../../engine/cityEffects';
import { bestSites } from '../../engine/settlers';
import { nationCounts } from '../../engine/aiProduction';
import { tileBearing } from './cityBuildModel';

// Ties between lines of the same tier go to the line listed first.
const LINE_ORDER = ['science', 'industry', 'economy', 'culture', 'food', 'naval', 'military', 'defense', 'logistics', 'energy'];

export const cityCharacter = (state, cityId, live = cityLive(state, cityId)) => {
  const city = live?.city;
  if (!city || city.outpost || city.tile == null) return null;
  const cats = city.buildings?.categories || {};
  const lead = LINE_ORDER.filter((c) => (cats[c] ?? -1) >= 0).sort((a, b) => cats[b] - cats[a])[0];
  if (lead) {
    const tier = cats[lead];
    return { id: lead, title: tNow(`cy.char.${lead}`), why: buildingTierName(lead, tier, BUILDING_CATEGORIES[lead]?.tiers[tier]?.name) };
  }
  const raw = live.yields?.raw || {};
  const tiles = getTiles();
  const best = ['food', 'production', 'gold'].sort((a, b) => (raw[b] || 0) - (raw[a] || 0))[0];
  const id = best === 'food' && tiles.coastal[city.tile] === 1 ? 'coast' : best;
  return { id: `land_${id}`, title: tNow(`cy.char.land_${id}`), why: tNow('cy.char.landWhy', { food: raw.food || 0, production: raw.production || 0, gold: raw.gold || 0 }) };
};

export const advisorWhy = (state, cityId, item) => {
  const city = state.regions?.[cityId];
  if (!city || !item) return null;
  if (item.kind === 'settler') {
    const live = cityLive(state, cityId);
    const site = bestSites(state, city.owner, city.tile, live.ctx.ageId, { limit: 1 })[0];
    return site ? tNow('cy.why.settler', { where: tileBearing(getTiles(), city.tile, site.tile).text }) : tNow('cy.why.settlerAny');
  }
  if (item.kind === 'building') return tNow('cy.why.building', { effect: buildingEffect(state, cityId, item.category, item.tier)?.text || '' });
  if (item.kind === 'improvement') return tNow('cy.why.improvement', { effect: improvementEffect(state, cityId, item)?.text || '' });
  if (item.kind === 'unit' || item.kind === 'army') {
    const units = nationCounts(state)[city.owner]?.landUnits || 0;
    const cities = Object.values(state.regions).filter((c) => c.owner === city.owner && !c.outpost).length;
    return tNow('cy.why.unit', { units, cities });
  }
  if (item.kind === 'wonder') return tNow('cy.why.wonder');
  return null;
};
