// src/components/map/settleSiteModel.js
// What the tile sheet says about a site for a city (W04, plans/UI-DESIGN.md: "green and red hexes
// with the reason on tap, Found City here / Go and found"): the tile's yields and what the CENTRE
// of a city there would yield (the city rules give a centre at least 2 food, 1 production and
// 1 gold, so a "0, 0, 0" desert tile is not the whole story), the facts that make it good (river,
// coast, a resource the age knows, hills), how many tiles it would claim, the nearest city with its
// distance in tiles and km, the name the city would take, how long it stays an outpost, a warning
// when the land cannot feed growth or builds very slowly (never a ban: the player may want the
// place), and, when the settling rule blocks it, the reason with the numbers ("Too close to Uruk:
// 2 tiles (163 km), needs 4"). The rule counts TILES between centres, one less across water
// (citySpacing.js); `spacingRule` says so in words, so "277 km" beside a "306 km" rule is no puzzle
// (playtest audit I054, I056, I091, I094, I096). Pure.
import { getTiles } from '../../data/geo/tiles';
import { distanceKm } from '../../data/geo/geodesic';
import { foundingDisk, kmPerRing } from '../../data/geo/gridScale';
import { CITY_SPACING_KM, citySpacingRings, sameLandmass } from '../../data/geo/citySpacing';
import { ringsAround } from '../../engine/world/cities';
import { tileFacts, tileYields, resourceKnown } from '../../data/tileYields';
import { getResearched } from '../../engine/nationState';
import { settleKey } from '../../engine/stonePhase';
import { canSettle, bandsOf, canFoundVillage, siteQualityParts, siteRatingOf, bestSites, siteOutlook, outpostTurns, MAX_SETTLE_RINGS } from '../../engine/settlers';
import { pickCityName } from '../../engine/cityNames';
import { isExplored } from '../../engine/fog';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { reasonText } from '../../i18n/messageText';
import { tileResourceName } from '../../i18n/gameText';

// (read when asked, so the text follows the language)
export const SITE_WARNING_TEXT = Object.defineProperties({}, {
  food: { enumerable: true, get: () => t('st.warnFood') },
  production: { enumerable: true, get: () => t('st.warnProduction') }
});

/** The settling rule in words, from the grid's own numbers: { rings, waterRings, tileKm, text }. */
export const spacingRule = (tiles = getTiles()) => {
  const rings = citySpacingRings(tiles);
  const tileKm = Math.round(kmPerRing(tiles));
  // `rings` steps over hexes cover between rings x 0.866 (zigzag) and rings x 1 (straight) tiles of ground
  const lo = Math.round((rings * tileKm * 0.866) / 5) * 5; const hi = Math.round((rings * tileKm) / 5) * 5;
  return {
    rings, waterRings: rings - 1, tileKm, loKm: lo, hiKm: hi,
    short: t('st.ruleShort', { rings, water: rings - 1 }),
    text: t('st.ruleText', { rings, water: rings - 1, lo, hi })
  };
};

// The best site quality in the player's reach (from the capital), once per world object.
const reachBestCache = new WeakMap();
const bestQualityInReach = (state, ageId) => {
  const world = state.world || {};
  const hit = reachBestCache.get(world);
  if (hit && hit.regions === state.regions) return hit.best;
  const cap = state.regions?.[state.nations?.[state.playerNationId]?.capitalRegionId];
  let best = null;
  if (cap?.tile != null) {
    const sites = bestSites(state, state.playerNationId, cap.tile, ageId, { rings: MAX_SETTLE_RINGS, limit: 400 });
    best = sites.reduce((m, x) => Math.max(m, x.quality), 0) || null;
  }
  reachBestCache.set(world, { regions: state.regions, best });
  return best;
};

/** The "why" of a site's rating from the parts of its quality: "Neighbours +2.3, river +2". */
export const siteWhyText = (parts) => {
  const f = (v) => '⁦+' + Math.round(v * 10) / 10 + '⁩'; // isolated so a Hebrew line keeps the plus on the left of the number
  const bits = [];
  if (parts.here > 0) bits.push(t('mx.tile.why.here', { v: f(parts.here) }));
  if (parts.neighbours > 0) bits.push(t('mx.tile.why.neighbours', { v: f(parts.neighbours) }));
  if (parts.resource) bits.push(t('mx.tile.why.resource', { v: f(parts.resource) }));
  if (parts.river) bits.push(t('mx.tile.why.river', { v: f(parts.river) }));
  if (parts.coast) bits.push(t('mx.tile.why.coast', { v: f(parts.coast) }));
  return bits.join(', ');
};

export const settleSiteModel = (state, tile, ageId) => {
  const tiles = getTiles();
  if (tile == null || !tiles.land[tile]) return null;
  const me = state.playerNationId;
  const facts = tileFacts(tiles, tile, state.world?.tileState?.[tile]);
  const yields = tileYields(facts, getResearched(state, me));
  // A Stone Age band founds its first village at once, within its range (settlers.js, U23).
  const band = bandsOf(state.units, me)[0];
  const can = band ? canFoundVillage(state, band, tile) : canSettle(state, tile, me, ageId);
  const tileOwner = state.world?.tileOwner || {};
  const need = citySpacingRings(tiles);
  const near = ringsAround(tiles, tile, need + 3);
  let nearest = null;
  Object.values(state.regions || {}).forEach((c) => {
    // only towns the player has seen (fog): an unseen city is never named
    if (c.tile == null || c.tile === tile || !isExplored(state, c.tile)) return;
    const km = Math.round(distanceKm(tiles.centres[tile], tiles.centres[c.tile]));
    if (!nearest || km < nearest.km) nearest = { id: c.id, name: c.name, km, mine: c.owner === me, tile: c.tile };
  });
  if (nearest) { nearest.rings = near.get(nearest.tile) ?? null; nearest.overWater = !sameLandmass(tiles, tile, nearest.tile); }
  const claims = foundingDisk(tiles, tile).filter((t) => tiles.land[t] && tileOwner[t] == null).length;
  const resource = facts.resource && resourceKnown(facts.resource, ageId, getResearched(state, me)) ? facts.resource : null;
  const outlook = siteOutlook(state, tile, me);
  const free = tileOwner[tile] == null;
  const lines = [];
  const parts = siteQualityParts(state, tile);
  if (facts.river) lines.push({ id: 'river', text: t('st.river') });
  if (facts.coastal) lines.push({ id: 'coast', text: t('st.coast') });
  if (resource) lines.push({ id: 'resource', text: t('st.resource', { name: tileResourceName(resource) }) });
  if (facts.relief === 'hills') lines.push({ id: 'hills', text: t('st.hills') });
  lines.push({ id: 'claims', text: t('st.claims', { count: claims }) });
  if (nearest) lines.push({ id: 'nearest', text: t('st.nearest', { name: nameNow('city', null, nearest.name), far: nearest.rings != null ? t('st.nearestRings', { count: nearest.rings, km: nearest.km }) : t('st.nearestKm', { km: nearest.km }), water: nearest.overWater ? t('st.acrossWater') : '' }) });
  // The blocking reason with its numbers (the spacing rule is CITY_SPACING_KM between centres).
  let reason = can.ok ? null : reasonText(can);
  const tooCloseName = !can.ok && can.reasonMsg?.key === 'm.world.reasonTooClose' ? can.reasonMsg.vars?.city?.en : null;
  const tooClose = tooCloseName ? [null, tooCloseName] : null;
  if (tooClose) {
    const by = Object.values(state.regions || {}).find((c) => c.name === tooClose[1] && c.tile != null);
    // the rule counts tiles (rings between centres); the km is the honest distance beside it
    const ring = by ? ringsAround(tiles, tile, need).get(by.tile) : null;
    const km = by ? Math.round(distanceKm(tiles.centres[tile], tiles.centres[by.tile])) : null;
    const who = by && isExplored(state, by.tile) ? nameNow('city', null, tooClose[1]) : t('st.unseenCity');
    reason = ring == null ? reason.replace(/\.$/, '') : t('st.tooClose', { who, rings: ring, km, need });
  } else if (reason) reason = reason.replace(/\.$/, '');
  // What founding here would start (only for land nobody owns: a site).
  const stage = free && !band ? outpostTurns(state, tile, ageId) : null;
  const cityName = band?.band.home === tile ? band.band.name : free ? pickCityName(state.regions, tiles, tile, me) : null;
  if (can.ok && cityName) lines.push({ id: 'name', text: t(settleKey(state, me, 'st.named'), { name: nameNow('city', null, cityName) }) });
  if (can.ok && stage) lines.push({ id: 'outpost', text: t('st.outpost', { count: stage }) });
  return {
    ok: can.ok,
    reason,
    tooClose: !!tooClose,
    score: can.ok ? parts.total : null,
    rating: can.ok ? siteRatingOf(parts.total, bestQualityInReach(state, ageId)) : null,
    ratingParts: can.ok ? parts : null,
    why: can.ok ? siteWhyText(parts) : '',
    yields: { food: yields.food, production: yields.production, gold: yields.gold },
    centre: outlook?.centre || null,
    foodSurplus: outlook?.foodSurplus ?? null,
    // a warning never blocks: it is shown above the action on a legal site
    warnings: can.ok && outlook ? outlook.warnings.map((id) => ({ id, text: SITE_WARNING_TEXT[id] })) : [],
    resource,
    cityName,
    outpostTurns: stage,
    lines,
    claims,
    nearest,
    spacingKm: CITY_SPACING_KM,
    spacingRings: need,
    spacing: spacingRule(tiles)
  };
};
