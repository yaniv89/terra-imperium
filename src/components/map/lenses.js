// src/components/map/lenses.js
// Lenses (plans/civ-map-rework.md E5): one button, a strip of icons; the flat map draws a layer per
// lens from the pure models below (tested without a DOM).
//   political  the default: nothing extra
//   yields     food, production and gold on every tile the player's cities own (local zoom)
//   loyalty    a disc behind each city coloured by its loyalty (green to red)
//   threat     a red circle of THREAT_RINGS around every enemy stack at war with the player
//   supply     the tile of every own army tinted by its supply zone (home, held, wild, enemy)
import { getTiles } from '../../data/geo/tiles';
import { tileFacts, tileYields } from '../../data/tileYields';
import { ringsAround } from '../../engine/world/cities';
import { getResearched } from '../../engine/nationState';
import { loyaltyOf } from '../../engine/loyalty';
import { isWarBetween } from '../../engine/diplomacy';
import { unitTile } from '../../engine/armies';
import { supplyZone } from '../../engine/supplyMeter';
import { THREAT_RINGS } from '../../engine/threat';
import { REBEL_OWNER_ID } from '../../data/rebellion';

export const LENSES = [
  { id: 'political', label: 'Political', key: '1', hint: 'Borders and cities' },
  { id: 'yields', label: 'Yields', key: '2', hint: 'Food, production and gold on your tiles' },
  { id: 'loyalty', label: 'Loyalty', key: '3', hint: 'How loyal each city is' },
  { id: 'threat', label: 'Threat', key: '4', hint: 'Enemy armies and their reach' },
  { id: 'supply', label: 'Supply', key: '5', hint: 'Where your armies are fed' }
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
