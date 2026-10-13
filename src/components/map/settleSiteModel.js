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
import { canSettle, scoreSite, siteOutlook, outpostTurns } from '../../engine/settlers';
import { pickCityName } from '../../engine/cityNames';
import { isExplored } from '../../engine/fog';

export const SITE_WARNING_TEXT = {
  food: 'Poor land: a city here feeds its first citizens and no more. It will not grow until its land is improved or it buys better tiles.',
  production: 'Almost no production: everything this city builds will take very long.'
};

/** The settling rule in words, from the grid's own numbers: { rings, waterRings, tileKm, text }. */
export const spacingRule = (tiles = getTiles()) => {
  const rings = citySpacingRings(tiles);
  const tileKm = Math.round(kmPerRing(tiles));
  // `rings` steps over hexes cover between rings x 0.866 (zigzag) and rings x 1 (straight) tiles of ground
  const lo = Math.round((rings * tileKm * 0.866) / 5) * 5; const hi = Math.round((rings * tileKm) / 5) * 5;
  return {
    rings, waterRings: rings - 1, tileKm, loKm: lo, hiKm: hi,
    short: `Cities ${rings} tiles apart, ${rings - 1} across water`,
    text: `City centres stand at least ${rings} tiles apart on the same land, ${rings - 1} across water. The rule counts tiles, not km: ${rings} tiles is ${lo} to ${hi} km, depending on the direction.`
  };
};

export const settleSiteModel = (state, tile, ageId) => {
  const tiles = getTiles();
  if (tile == null || !tiles.land[tile]) return null;
  const me = state.playerNationId;
  const facts = tileFacts(tiles, tile, state.world?.tileState?.[tile]);
  const yields = tileYields(facts, getResearched(state, me));
  const can = canSettle(state, tile, me, ageId);
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
  const resource = facts.resource && resourceKnown(facts.resource, ageId) ? facts.resource : null;
  const outlook = siteOutlook(state, tile, me);
  const free = tileOwner[tile] == null;
  const lines = [];
  if (facts.river) lines.push({ id: 'river', text: 'River tile: fresh water, the city grows faster' });
  if (facts.coastal) lines.push({ id: 'coast', text: 'On the coast: a harbour and ships later' });
  if (resource) lines.push({ id: 'resource', text: `Resource here: ${resource}` });
  if (facts.relief === 'hills') lines.push({ id: 'hills', text: 'On hills: easier to defend' });
  lines.push({ id: 'claims', text: `Claims ${claims} tile${claims === 1 ? '' : 's'} when founded` });
  if (nearest) lines.push({ id: 'nearest', text: `Nearest city ${nearest.name}, ${nearest.rings != null ? `${nearest.rings} tile${nearest.rings === 1 ? '' : 's'} (${nearest.km} km)` : `${nearest.km} km`}${nearest.overWater ? ', across water' : ''}` });
  // The blocking reason with its numbers (the spacing rule is CITY_SPACING_KM between centres).
  let reason = can.ok ? null : can.reason;
  const tooClose = reason && /^Too close to (.+)\.$/.exec(reason);
  if (tooClose) {
    const by = Object.values(state.regions || {}).find((c) => c.name === tooClose[1] && c.tile != null);
    // the rule counts tiles (rings between centres); the km is the honest distance beside it
    const ring = by ? ringsAround(tiles, tile, need).get(by.tile) : null;
    const km = by ? Math.round(distanceKm(tiles.centres[tile], tiles.centres[by.tile])) : null;
    const who = by && isExplored(state, by.tile) ? tooClose[1] : 'a city you have not seen';
    reason = ring == null ? reason.replace(/\.$/, '') : `Too close to ${who}: ${ring} tile${ring === 1 ? '' : 's'} (${km} km), needs ${need}`;
  } else if (reason) reason = reason.replace(/\.$/, '');
  // What founding here would start (only for land nobody owns: a site).
  const stage = free ? outpostTurns(state, tile, ageId) : null;
  const cityName = free ? pickCityName(state.regions, tiles, tile, me) : null;
  if (can.ok && cityName) lines.push({ id: 'name', text: `The city will be named ${cityName}` });
  if (can.ok && stage) lines.push({ id: 'outpost', text: `Starts as an outpost: it claims its land at once, and builds and yields as a city after about ${stage} turn${stage === 1 ? '' : 's'}` });
  return {
    ok: can.ok,
    reason,
    score: can.ok ? scoreSite(state, tile) : null,
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
