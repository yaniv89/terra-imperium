// src/components/map/settleSiteModel.js
// What the tile sheet says about a site for a city (W04, plans/UI-DESIGN.md: "green and red hexes
// with the reason on tap, Found City here / Go and found"): the centre's yields, the facts that
// make it good (river, coast, resource, hills), how many tiles it would claim, the nearest city
// with its distance in km, and, when the settling rule blocks it, the reason with the numbers
// ("Too close to Uruk: 2 tiles (163 km), needs 4": the rule counts tiles, about 306 km). Pure.
import { getTiles } from '../../data/geo/tiles';
import { distanceKm } from '../../data/geo/geodesic';
import { foundingDisk } from '../../data/geo/gridScale';
import { CITY_SPACING_KM, citySpacingRings } from '../../data/geo/citySpacing';
import { ringsAround } from '../../engine/world/cities';
import { tileFacts, tileYields } from '../../data/tileYields';
import { getResearched } from '../../engine/nationState';
import { canSettle, scoreSite } from '../../engine/settlers';
import { isExplored } from '../../engine/fog';

export const settleSiteModel = (state, tile, ageId) => {
  const tiles = getTiles();
  if (tile == null || !tiles.land[tile]) return null;
  const me = state.playerNationId;
  const facts = tileFacts(tiles, tile, state.world?.tileState?.[tile]);
  const yields = tileYields(facts, getResearched(state, me));
  const can = canSettle(state, tile, me, ageId);
  const tileOwner = state.world?.tileOwner || {};
  let nearest = null;
  Object.values(state.regions || {}).forEach((c) => {
    // only towns the player has seen (fog): an unseen city is never named
    if (c.tile == null || c.tile === tile || !isExplored(state, c.tile)) return;
    const km = Math.round(distanceKm(tiles.centres[tile], tiles.centres[c.tile]));
    if (!nearest || km < nearest.km) nearest = { id: c.id, name: c.name, km, mine: c.owner === me };
  });
  const claims = foundingDisk(tiles, tile).filter((t) => tiles.land[t] && tileOwner[t] == null).length;
  const lines = [];
  if (facts.river) lines.push({ id: 'river', text: 'River tile: fresh water, the city grows faster' });
  if (facts.coastal) lines.push({ id: 'coast', text: 'On the coast: a harbour and ships later' });
  if (facts.resource) lines.push({ id: 'resource', text: `Resource here: ${facts.resource}` });
  if (facts.relief === 'hills') lines.push({ id: 'hills', text: 'On hills: easier to defend' });
  lines.push({ id: 'claims', text: `Claims ${claims} tile${claims === 1 ? '' : 's'} when founded` });
  if (nearest) lines.push({ id: 'nearest', text: `Nearest city ${nearest.name}, ${nearest.km} km` });
  // The blocking reason with its numbers (the spacing rule is CITY_SPACING_KM between centres).
  let reason = can.ok ? null : can.reason;
  const tooClose = reason && /^Too close to (.+)\.$/.exec(reason);
  if (tooClose) {
    const by = Object.values(state.regions || {}).find((c) => c.name === tooClose[1] && c.tile != null);
    // the rule counts tiles (rings between centres); the km is the honest distance beside it
    const need = citySpacingRings(tiles);
    const ring = by ? ringsAround(tiles, tile, need).get(by.tile) : null;
    const km = by ? Math.round(distanceKm(tiles.centres[tile], tiles.centres[by.tile])) : null;
    const who = by && isExplored(state, by.tile) ? tooClose[1] : 'a city you have not seen';
    reason = ring == null ? reason.replace(/\.$/, '') : `Too close to ${who}: ${ring} tile${ring === 1 ? '' : 's'} (${km} km), needs ${need}`;
  } else if (reason) reason = reason.replace(/\.$/, '');
  return {
    ok: can.ok,
    reason,
    score: can.ok ? scoreSite(state, tile) : null,
    yields: { food: yields.food, production: yields.production, gold: yields.gold },
    lines,
    claims,
    nearest,
    spacingKm: CITY_SPACING_KM,
    spacingRings: citySpacingRings(tiles)
  };
};
