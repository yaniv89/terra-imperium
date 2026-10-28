// src/components/panels/peopleWhere.js
// Where a people is, as the player knows it (playtests of 21 October: "Army: ?", no way to find
// the enemy). Pure. Cities come from the player's memory of the map (fog.js seen.cities: what its
// scouts saw, and the capitals of first contacts); armies are the ones in sight now. With fog off
// every city and army counts as known. `places` feed the camera (mapCamera.js cameraTarget, best
// first); `march` is the player's stack nearest the people's nearest known city (or army) for
// the Peoples card's "March to": { from, unitIds, target } in the shape of startMarch. `front` is
// the same places nearest the player's own cities first (an army before a city at the same
// distance): where a war with them is fought, for the war pill and "Show on map" at war.
import { fogOn } from '../../engine/fog';
import { visibleTiles } from '../../engine/sight';
import { unitTile } from '../../engine/armies';
import { isSettler, isExplorer, isBand } from '../../engine/settlers';
import { distanceKm } from '../../data/geo/geodesic';
import { getTiles } from '../../data/geo/tiles';

const fieldArmy = (u) => u.domain !== 'naval' && !u.embarkedOn && u.strength > 0 && !isSettler(u) && !isExplorer(u) && !isBand(u);

export const peopleWhere = (state, nationId) => {
  const me = state.playerNationId;
  const fog = fogOn(state);
  const memory = fog ? Object.values(state.fog.seen?.cities || {}) : Object.values(state.regions || {});
  const cities = memory.filter((c) => c.owner === nationId && c.tile != null)
    .sort((a, b) => (b.isCapital ? 1 : 0) - (a.isCapital ? 1 : 0) || (a.id < b.id ? -1 : 1));
  const sight = fog ? visibleTiles(state, me) : null;
  const byTile = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (u.ownerId !== nationId || !fieldArmy(u)) return;
    const t = unitTile(state, u);
    if (t == null || (sight && !sight.has(t))) return;
    byTile.set(t, (byTile.get(t) || 0) + u.strength);
  });
  const armies = [...byTile].sort((a, b) => a[0] - b[0]).map(([tile, strength]) => ({ tile, strength }));
  const places = [...cities.map((c) => ({ regionId: c.id, tile: c.tile })), ...armies.map((a) => ({ tile: a.tile }))];

  // The player's land stacks, by tile; the one nearest the first target marches.
  const centres = getTiles().centres;
  const targets = [...cities.map((c) => ({ city: c.id, tile: c.tile })), ...armies.map((a) => ({ tile: a.tile }))];
  const mine = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (u.ownerId !== me || !fieldArmy(u)) return;
    const t = unitTile(state, u);
    if (t != null) (mine.get(t) || mine.set(t, []).get(t)).push(u);
  });
  let march = null;
  [...mine].sort((a, b) => a[0] - b[0]).forEach(([tile, units]) => targets.forEach((g) => {
    const km = distanceKm(centres[tile], centres[g.tile]);
    if (!march || km < march.km) march = { km, from: units[0].regionId, unitIds: units.map((u) => u.id).sort(), target: g.city ?? g.tile };
  }));
  const myCities = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null);
  const near = (t) => myCities.reduce((d, c) => Math.min(d, distanceKm(centres[t], centres[c.tile])), Infinity);
  const front = places.map((p, i) => ({ p, km: near(p.tile), army: p.regionId == null ? 0 : 1, i }))
    .sort((a, b) => a.km - b.km || a.army - b.army || a.i - b.i).map((x) => x.p);
  return { cities, armies, places, front, armyStrength: armies.reduce((s, a) => s + a.strength, 0), march };
};
