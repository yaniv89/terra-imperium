// src/components/city/cityRailModel.js
// The desktop city list rail (plans/civ-map-rework.md E2): every city of the player at a glance,
// biggest first: size, growth in N turns, what it builds and in how many turns, and the flags that
// want a look (nothing queued, restless, besieged, starving, an outpost). Last turn's yields
// (`lastYields`) give the pace, so the list costs one pass, not an allocation per city. Pure.
import { unitDisplayName } from '../../data/unitNames';
import { getTiles } from '../../data/geo/tiles';
import { getEffectiveAgeId, speedCostMult, FIRST_AGE_ID } from '../../data/ages';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { IMPROVEMENTS } from '../../data/tileYields';
import { GREAT_PROJECTS } from '../../data/greatProjects';
import { NAVAL_LINES } from '../../data/navalLines';
import { growthThreshold, productionCost, MAX_SIZE } from '../../engine/world/cities';
import { UNREST_PROMPT } from '../ui/nextPrompt';

export const RAIL_STORAGE_KEY = 'terra-imperium-city-rail-collapsed';

/** A short name for a build item. */
export const shortItemLabel = (item, tiles = getTiles(), ageId = FIRST_AGE_ID) => {
  if (!item) return null;
  if (item.kind === 'unit') return item.classId === 'naval' ? NAVAL_LINES[item.navalLine || 'warship']?.label || 'Ship' : unitDisplayName(ageId, item.classId);
  if (item.kind === 'building') return BUILDING_CATEGORIES[item.category]?.tiers[item.tier]?.name || item.category;
  if (item.kind === 'improvement') return `${IMPROVEMENTS[item.improvement]?.name || item.improvement} (${tiles.names?.[item.tile] || 'tile'})`;
  if (item.kind === 'settler') return 'Settlers';
  if (item.kind === 'wonder') return GREAT_PROJECTS[item.projectId]?.name || item.projectId;
  if (item.kind === 'army') return item.name || 'Army';
  return item.kind;
};

export const cityRailModel = (state) => {
  const me = state.playerNationId;
  const tiles = getTiles();
  const ageId = getEffectiveAgeId(state.age, state.techAgeId);
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null);
  const costCtx = { ageId, citiesOwned: mine.length, speedMult: speedCostMult(state.gameSpeed, ageId) };
  const capital = state.nations?.[me]?.capitalRegionId;
  return mine.map((c) => {
    const food = c.lastYields?.food ?? 0; const production = c.lastYields?.production ?? 0;
    const growthTurns = c.outpost ? null : food > 0 && c.size < MAX_SIZE ? Math.max(1, Math.ceil(Math.max(0, growthThreshold(c.size, speedCostMult(state.gameSpeed, ageId)) - (c.food || 0)) / food)) : null;
    const item = c.production?.current || null;
    const buildTurns = item ? Math.max(1, Math.ceil(Math.max(0, productionCost(item, costCtx) - (c.production?.progress || 0)) / Math.max(0.1, production))) : null;
    return {
      id: c.id, name: c.name, size: c.size, capital: c.id === capital, outpost: !!c.outpost,
      growthTurns, starving: food < 0,
      building: shortItemLabel(item, tiles, ageId), buildTurns, idle: !item && !c.outpost,
      unrest: Math.round(c.unrest || 0), restless: (c.unrest || 0) >= UNREST_PROMPT,
      besieged: !!c.siege || !!c.underInvasion,
      loyalty: c.loyalty
    };
  }).sort((a, b) => (b.capital - a.capital) || (b.size - a.size) || (a.name < b.name ? -1 : 1));
};

/** The header's per-turn strip: gold net, science, manpower, supplies. */
export const perTurnStrip = (state, { income, expenses, net }, yields) => [
  { id: 'gold', label: 'Gold', value: Math.round(net), title: `Income +${Math.round(income.gold || 0)}, upkeep -${Math.round(Object.values(expenses).reduce((s, v) => s + v, 0))}` },
  { id: 'science', label: 'Science', value: Math.round((yields.techPoints || 0) * 10) / 10, title: 'Science a turn' },
  { id: 'manpower', label: 'Manpower', value: Math.round((yields.hr || 0) * 10) / 10, title: 'Manpower a turn' },
  { id: 'supplies', label: 'Supplies', value: Math.round((yields.supplies || 0) * 10) / 10, title: 'Supplies a turn' }
].filter((row) => row.id === 'gold' || row.value !== 0);
