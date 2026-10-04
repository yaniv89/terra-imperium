// src/engine/wonders.js
// Wonders as tiles (plans/civ-map-rework.md, C9.2; workstream 11). A great project is built from
// a city's production queue (`{ kind: 'wonder', projectId, tier, tile }`), not bought with gold:
// tier 1 takes a tile of the city's border that fits the project's TILE RULE (the Pyramids on
// desert, the Hanging Gardens on a river, the Great Wall on hills, the Lighthouse on the coast;
// WONDER_TILE_RULES) and costs WONDER_PRODUCTION_PER_TURN x the tier's turns; a later tier is
// built on the same tile by the city that holds it. On completion the tile carries `wonder`
// (tileState), `state.greatProjects[projectId] = { regionId, tier, tile }` as before (the
// modifiers and the owner derive from the site city), and the owner gains the tier's prestige.
// The city rules of greatProjects.js (a capital, a building) still gate who may start one. A
// national wonder (a project with a `homeland`) also takes its tile on that country's land. Pure.
import { getTiles } from '../data/geo/tiles';
import { tileFacts } from '../data/tileYields';
import { getAgeIndex } from '../data/ages';
import { GREAT_PROJECTS, GREAT_PROJECT_TIER_COST, meetsSiteRule } from '../data/greatProjects';

export const WONDER_PRODUCTION_PER_TURN = 25;
export const WONDER_TILE_RULES = {
  desert: { label: 'desert', ok: (f) => f.terrain === 'desert' },
  river: { label: 'a river', ok: (f) => !!f.river },
  hills: { label: 'hills', ok: (f) => f.relief === 'hills' },
  coastal: { label: 'the coast', ok: (f) => !!f.coastal },
  flat: { label: 'flat land', ok: (f) => f.relief === 'flat' },
  any: { label: 'any land', ok: () => true }
};
export const WONDER_TILE_RULE = {
  great_pyramids: 'desert', hanging_gardens: 'river', great_wall: 'hills', great_library: 'any', colosseum: 'flat', lighthouse: 'coastal',
  grand_bazaar: 'any', great_cathedral: 'any', forbidden_city: 'flat', royal_observatory: 'hills', arsenal: 'coastal', palace_of_versailles: 'flat',
  space_program: 'flat', international_exchange: 'any', atomic_research_center: 'any',
  solomons_temple: 'hills', masada: 'desert'
};

export const wonderTileRule = (projectId) => WONDER_TILE_RULES[WONDER_TILE_RULE[projectId] || 'any'];
export const wonderCost = (tier) => (GREAT_PROJECT_TIER_COST[tier - 1]?.turns || 4) * WONDER_PRODUCTION_PER_TURN;

/** The tiles of the city's border a tier-1 wonder could take, best first (the centre never). */
export const wonderSites = (state, city, projectId) => {
  const tiles = getTiles();
  const rule = wonderTileRule(projectId);
  const homeland = GREAT_PROJECTS[projectId]?.homeland;
  const tileState = state.world?.tileState || {};
  return (city.tiles || []).filter((t) => t !== city.tile && tiles.land[t] === 1 && !tileState[t]?.wonder && (!homeland || tiles.countryOf(t) === homeland) && rule.ok(tileFacts(tiles, t, tileState[t]))).sort((a, b) => a - b);
};

/** Can `city` queue tier `tier` of `projectId` now? { ok, reason, tile }. */
export const canQueueWonder = (state, city, projectId, tier = 1, nationId = state.playerNationId) => {
  const project = GREAT_PROJECTS[projectId];
  if (!project || !city) return { ok: false, reason: 'No such wonder.' };
  if (!city.owner || city.owner !== nationId) return { ok: false, reason: 'Not your city.' };
  if (getAgeIndex(project.ageId) > getAgeIndex(state.age)) return { ok: false, reason: `Needs the ${project.ageId} age.` };
  const queued = [city.production?.current, ...(city.production?.queue || [])].some((i) => i?.kind === 'wonder' && i.projectId === projectId);
  if (queued) return { ok: false, reason: 'Already in the queue.' };
  const entry = state.greatProjects?.[projectId];
  if (tier === 1) {
    if (entry) return { ok: false, reason: 'Already built elsewhere.' };
    if (!meetsSiteRule(project, city, city.id)) return { ok: false, reason: project.homeland ? `Only a city on ${project.homelandLabel || 'its homeland'} can build it.` : 'The city does not meet its rule.' };
    const sites = wonderSites(state, city, projectId);
    if (!sites.length) return { ok: false, reason: `Needs ${wonderTileRule(projectId).label}${project.homeland ? ` on ${project.homelandLabel || 'its homeland'}` : ''} in the city's border.` };
    return { ok: true, tile: sites[0] };
  }
  if (!entry || entry.regionId !== city.id) return { ok: false, reason: 'Not built here.' };
  if (entry.tier !== tier - 1) return { ok: false, reason: 'Tiers are built in order.' };
  if (tier > 3) return { ok: false, reason: 'At its last tier.' };
  return { ok: true, tile: entry.tile ?? null };
};

/** The production item for a wonder tier on `tile`. */
export const wonderItem = (projectId, tier, tile) => ({ kind: 'wonder', projectId, tier, tile, cost: wonderCost(tier) });

/** The wonders a city may start or raise now: [{ projectId, tier, tile, name }]. `nationId` is
 * the builder (the player by default; AI cities pass their owner, aiProduction.js). */
export const wonderOptions = (state, city, nationId = state.playerNationId) => Object.keys(GREAT_PROJECTS).flatMap((projectId) => {
  const entry = state.greatProjects?.[projectId];
  const tier = entry ? entry.tier + 1 : 1;
  const can = canQueueWonder(state, city, projectId, tier, nationId);
  return can.ok ? [{ projectId, tier, tile: can.tile, name: GREAT_PROJECTS[projectId].name }] : [];
});
