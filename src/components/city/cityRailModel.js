// src/components/city/cityRailModel.js
// The desktop city list rail (plans/civ-map-rework.md E2): every city of the player at a glance,
// biggest first: size, growth in N turns, what it builds and in how many turns, and the flags that
// want a look (nothing queued, restless, besieged, starving, an outpost). The pace is the city's
// live yields and the turns are the queue's own (src/engine/cityEconomy.js growthView, queueView):
// the same numbers the city sheet shows, never last turn's mirror (playtest audits I052, where a
// new city's row said "Settlers in 2800 t"). The allocation behind them is memoised. Pure.
import { unitName as unitDisplayName } from '../../i18n/gameText';
import { buildingTierName, wonderName, improvementName, navalLineLabel } from '../../i18n/gameText';
import { getTiles } from '../../data/geo/tiles';
import { FIRST_AGE_ID } from '../../data/ages';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { IMPROVEMENTS } from '../../data/tileYields';
import { GREAT_PROJECTS } from '../../data/greatProjects';
import { NAVAL_LINES } from '../../data/navalLines';
import { cityLive, growthView, queueView } from '../../engine/cityEconomy';
import { templateName } from './cityBuildModel';
import { UNREST_PROMPT } from '../ui/nextPromptModel';
import { t as tNow } from '../../i18n/core';
import { ageOf } from '../../engine/nationState';

export const RAIL_STORAGE_KEY = 'terra-imperium-city-rail-collapsed';

/** A short name for a build item. */
export const shortItemLabel = (item, tiles = getTiles(), ageId = FIRST_AGE_ID) => {
  if (!item) return null;
  if (item.kind === 'unit' && item.explorer) return tNow('cy.scouts');
  if (item.kind === 'unit') return item.classId === 'naval' ? navalLineLabel(item.navalLine || 'warship', NAVAL_LINES[item.navalLine || 'warship']?.label || tNow('cy.ship')) : unitDisplayName(ageId, item.classId);
  if (item.kind === 'building') return buildingTierName(item.category, item.tier, BUILDING_CATEGORIES[item.category]?.tiers[item.tier]?.name);
  if (item.kind === 'improvement') return `${improvementName(item.improvement, IMPROVEMENTS[item.improvement]?.name)} (${tiles.names?.[item.tile] || tNow('cy.tile')})`;
  if (item.kind === 'settler') return tNow('cy.settlers');
  if (item.kind === 'wonder') return wonderName(item.projectId, GREAT_PROJECTS[item.projectId]?.name);
  if (item.kind === 'army') return templateName(item.templateId, item.name) || tNow('cy.army');
  return item.kind;
};

export const cityRailModel = (state) => {
  const me = state.playerNationId;
  const tiles = getTiles();
  const ageId = ageOf(state, state.playerNationId);
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null);
  const capital = state.nations?.[me]?.capitalRegionId;
  return mine.map((c) => {
    const live = cityLive(state, c.id);
    const growth = growthView(state, c.id, live);
    const growthTurns = growth.turns;
    const item = c.production?.current || null;
    const first = item ? queueView(state, c.id, live)[0] : null;
    const cost = first ? first.cost : 0;
    // An army order shows the turns to its next unit, as its label names that unit.
    const buildTurns = first ? first.pieceTurns ?? first.turns : null;
    return {
      id: c.id, name: c.name, size: c.size, capital: c.id === capital, outpost: !!c.outpost,
      growthTurns, starving: growth.state === 'starving',
      building: shortItemLabel(item, tiles, ageId), buildTurns, idle: !item && !c.outpost,
      // the thin production bar under the city (W02): how far the current item is
      buildShare: item && cost > 0 ? Math.min(1, (c.production?.progress || 0) / cost) : null,
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
