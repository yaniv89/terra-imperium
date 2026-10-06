// src/components/map/lenses.js
// Lenses (plans/civ-map-rework.md E5): one button, a strip of icons; the flat map draws a layer per
// lens from the pure models below (tested without a DOM).
//   political  the default: nothing extra
//   yields     food, production and gold on every tile the player's cities own (local zoom)
//   loyalty    a disc behind each city coloured by its loyalty (green to red)
//   threat     a red circle of THREAT_RINGS around every enemy stack at war with the player
//   supply     the tile of every own army tinted by its supply zone (home, held, wild, enemy)
//   trade      the caravan path or sea link of every trade pact, red where plundered (plunder.js)
//   settle     where a settler may found a city (the settling rule, citySpacing.js): illegal land
//              red with its reason, legal land faint green; also shown while a settler is selected
import { getTiles } from '../../data/geo/tiles';
import { airRanges } from '../../engine/airPower';
import { tileFacts, tileYields } from '../../data/tileYields';
import { ringsAround, canFoundCity } from '../../engine/world/cities';
import { settlersOf } from '../../engine/settlers';
import { settlingBarred } from '../../engine/accords';
import { getResearched } from '../../engine/nationState';
import { loyaltyOf } from '../../engine/loyalty';
import { isWarBetween } from '../../engine/diplomacy';
import { unitTile } from '../../engine/armies';
import { supplyZone, SUPPLY_LINE_RINGS } from '../../engine/supplyMeter';
import { mapEffectsFor } from '../../engine/techMapEffects';
import { getModifier } from '../../engine/modifiers/sheet';
import { THREAT_RINGS } from '../../engine/threat';
import { REBEL_OWNER_ID } from '../../data/rebellion';
import { getTradeRoute } from '../../engine/tradeRoutes';
import { plunderedRoutes } from '../../engine/plunder';
import { ringsForKm, ringsFromF75 } from '../../data/geo/gridScale';

export const LENSES = [
  { id: 'political', label: 'Political', key: '1', hint: 'Borders and cities' },
  { id: 'yields', label: 'Yields', key: '2', hint: 'Food, production and gold on your tiles' },
  { id: 'loyalty', label: 'Loyalty', key: '3', hint: 'How loyal each city is' },
  { id: 'threat', label: 'Threat', key: '4', hint: 'Enemy armies and their reach' },
  { id: 'supply', label: 'Supply', key: '5', hint: 'How far your supply lines reach, and where your armies are fed' },
  { id: 'trade', label: 'Trade', key: '6', hint: 'Your trade routes and the raiders on them' },
  { id: 'settle', label: 'Settle', key: '7', hint: 'Where your settlers may found a city' }
];
export const LENS_IDS = LENSES.map((l) => l.id);
export const ZONE_COLOUR = { home: 'rgba(34,197,94,0.45)', held: 'rgba(250,204,21,0.45)', wild: 'rgba(251,146,60,0.45)', enemy: 'rgba(239,68,68,0.5)' };

/** The yields of every tile the player's cities own: [{ tile, food, production, gold, worked }]. */
export const yieldLabels = (state) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const researched = getResearched(state, me);
  const out = [];
  Object.values(state.regions || {}).forEach((c) => {
    if (c.owner !== me || c.tile == null) return;
    const worked = new Set(c.worked || []);
    (c.tiles || [c.tile]).forEach((t) => {
      const y = tileYields(tileFacts(tiles, t, state.world?.tileState?.[t]), researched);
      out.push({ tile: t, food: y.food, production: y.production, gold: y.gold, worked: t === c.tile || worked.has(t) });
    });
  });
  return out;
};

/** Green at 100, amber at 50, red at 0. */
export const loyaltyColour = (loyalty) => `hsl(${Math.round(Math.max(0, Math.min(100, loyalty)) * 1.2)} 80% 45%)`;
export const loyaltyDiscs = (state) => Object.values(state.regions || {}).filter((c) => c.owner && c.tile != null).map((c) => ({ cityId: c.id, tile: c.tile, loyalty: loyaltyOf(c), colour: loyaltyColour(loyaltyOf(c)) }));

/** Enemy land stacks at war with the player (and rebels): [{ tile, strength, edgeTile }] with a tile THREAT_RINGS away for the circle's radius. */
/** Air bases and their reach, for the threat lens (airPower.js). */
export const airCover = (state) => airRanges(state);

export const threatStacks = (state) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const enemies = new Set((state.wars || []).filter((w) => w.active && (w.aggressor === me || w.enemy === me)).map((w) => (w.aggressor === me ? w.enemy : w.aggressor)));
  enemies.add(REBEL_OWNER_ID);
  const byTile = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (u.domain === 'naval' || u.embarkedOn || u.classId === 'settler' || !(u.strength > 0) || !enemies.has(u.ownerId)) return;
    const t = unitTile(state, u);
    if (t == null) return;
    byTile.set(t, (byTile.get(t) || 0) + u.strength);
  });
  return [...byTile].map(([tile, strength]) => {
    const rings = ringsAround(tiles, tile, THREAT_RINGS);
    const edgeTile = [...rings].find(([, d]) => d === THREAT_RINGS)?.[0] ?? tile;
    return { tile, strength, edgeTile };
  }).sort((a, b) => a.tile - b.tile);
};

/** The land beyond your border that your supply lines reach (supplyMeter.js lineReaches, seen
 * from the border out): [{ tile, colour }], at most `limit` tiles, nearest rings first. A stack
 * standing there drains at half the enemy-land rate. */
export const supplyReach = (state, { limit = 4000, rings = SUPPLY_LINE_RINGS + ringsForKm(mapEffectsFor(state, state.playerNationId).lineRings, { min: 0 }) + ringsFromF75(Math.max(0, Math.round(getModifier(state, state.playerNationId, 'national.supplyRange').total))) } = {}) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const tileOwner = state.world?.tileOwner || {};
  const own = (t) => { const c = tileOwner[t]; return c != null && state.regions[c]?.owner === me && !state.regions[c].occupiedBy; };
  let frontier = []; const seen = new Set();
  Object.keys(tileOwner).forEach((k) => { const t = Number(k); if (own(t)) { seen.add(t); frontier.push(t); } });
  const out = [];
  for (let d = 1; d <= rings && out.length < limit; d++) {
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) { if (seen.has(n) || tiles.land[n] !== 1) continue; seen.add(n); next.push(n); if (!own(n)) out.push({ tile: n, colour: d <= rings / 2 ? 'rgba(52,211,153,0.28)' : 'rgba(52,211,153,0.14)' }); }
    frontier = next;
  }
  return out.slice(0, limit);
};

/** The tiles of the player's land armies with their supply zone: [{ tile, zone, colour }]. */
export const supplyTints = (state) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const seen = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (u.ownerId !== me || u.domain === 'naval' || u.embarkedOn || u.classId === 'settler' || !(u.strength > 0)) return;
    const t = unitTile(state, u);
    if (t == null || seen.has(t)) return;
    const { zone } = supplyZone(state, tiles, u);
    seen.set(t, { tile: t, zone, colour: ZONE_COLOUR[zone] || ZONE_COLOUR.wild });
  });
  return [...seen.values()].sort((a, b) => a.tile - b.tile);
};

export const isAtWarWith = (state, a, b) => (state.wars || []).some((w) => w.active && isWarBetween(w, a, b));

/** The player's trade routes: [{ partnerId, kind, tiles, ok, plundered, plunderTile }]. A sea
 * route is drawn port to port; a cut land route shows the raider's tile. */
export const tradeLines = (state) => {
  const plunder = plunderedRoutes(state);
  return Object.values(state.nations || {}).filter((n) => !n.isPlayer && n.hasTradeAgreement && !n.isEliminated).map((n) => {
    const r = getTradeRoute(state, n.id);
    const p = plunder.find((x) => x.partnerId === n.id) || null;
    const tiles = r.ok ? (r.kind === 'land' ? r.tiles : r.regions.map((id) => state.regions[id]?.tile).filter((t) => t != null)) : [];
    return { partnerId: n.id, name: n.name, kind: r.ok ? r.kind : null, ok: r.ok, tiles, plundered: !!p, plunderTile: p?.tile ?? null, reason: r.ok ? null : r.reason };
  });
};

/** The settle lens (plans/settle-rules.md R6): every land tile within SETTLE_LENS_KM of `from`
 * (default: the player's settlers, else the player's cities) as [{ tile, ok, reason, colour }].
 * A tile is legal when the settling rule allows a city there (cities.canFoundCity: land, no ice,
 * not another nation's land, clear of every city) and no accord bars it; the reason names the
 * blocking city or the owning nation ("Too close to Jerusalem.", "Belongs to Egypt."). */
export const SETTLE_LENS_KM = 612;
export const SETTLE_COLOUR = { ok: 'rgba(52,211,153,0.22)', no: 'rgba(239,68,68,0.4)' };
export const settleTints = (state, from = null, { km = SETTLE_LENS_KM, limit = 3000 } = {}) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const tileOwner = state.world?.tileOwner || {};
  const world = { cities: state.regions || {}, tileOwner, tileState: state.world?.tileState || {} };
  const own = settlersOf(state.units || {}, me).map((u) => u.tile).filter((t) => t != null);
  const starts = from || (own.length ? own : Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null).map((c) => c.tile));
  const rings = ringsForKm(km);
  const seen = new Set();
  const out = [];
  [...new Set(starts)].sort((a, b) => a - b).forEach((s) => {
    for (const t of ringsAround(tiles, s, rings).keys()) {
      if (seen.has(t) || tiles.land[t] !== 1 || out.length >= limit) continue;
      seen.add(t);
      const owner = tileOwner[t] != null ? state.regions?.[tileOwner[t]]?.owner : null;
      let res = owner && owner !== me ? { ok: false, reason: `Belongs to ${state.nations?.[owner]?.name || owner}.` } : canFoundCity(world, tiles, t, me);
      if (res.ok && settlingBarred(state, me, t)) res = { ok: false, reason: 'You promised not to settle this close to their cities.' };
      out.push({ tile: t, ok: res.ok, reason: res.ok ? null : res.reason, colour: res.ok ? SETTLE_COLOUR.ok : SETTLE_COLOUR.no });
    }
  });
  return out.sort((a, b) => a.tile - b.tile);
};
