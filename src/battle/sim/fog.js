// src/battle/sim/fog.js
// Fog of war (Tactical Battles plan §8.7). Each side has its own grid: 0 = never seen,
// 1 = explored (terrain known, units not), 2 = visible now. Squads see a disc around them;
// the defender also sees all of its own territory (home ground); structures are landmarks and are
// always known. Espionage intel on the defender (src/engine/intel.js) gives the attacker a scouting
// report: the whole map explored and every defender visible for the first seconds of the battle.
// Ambushed squads stay hidden even inside sight until they attack or enemy cavalry comes close.
import { Q } from './constants';
import { cavalryOf } from './squadLists';

// A disc of radius r as one run per row: half[dy + r] = the largest dx with dx^2 + dy^2 <= r^2.
const disc = new Map();
const discHalfWidths = (r) => {
  if (disc.has(r)) return disc.get(r);
  const out = new Int32Array(2 * r + 1);
  for (let dy = -r; dy <= r; dy++) { let dx = 0; while ((dx + 1) * (dx + 1) + dy * dy <= r * r) dx += 1; out[dy + r] = dx; }
  disc.set(r, out);
  return out;
};

export const FOG_EVERY = 5;
export const INTEL_REVEAL_TICKS = 200;
const AMBUSH_SPOT_RADIUS = 3 * Q;

export const initFog = (w) => {
  const n = w.map.w * w.map.h;
  w.fog = [new Uint8Array(n), new Uint8Array(n)];
  w.revealUntil = [w.setup.modifiers.intel?.attackerSeesDefender ? INTEL_REVEAL_TICKS : -1, -1];
  // The defender knows every inch of its own land; the attacker only knows what intel told it.
  if (w.setup.modifiers.intel?.attackerSeesDefender) w.fog[0].fill(1);
  w.fog[1].fill(1);
};

const stamp = (w, grid, x, y, radiusTiles) => {
  const { w: mw, h: mh } = w.map;
  const tx = Math.floor(x / Q); const ty = Math.floor(y / Q);
  if (radiusTiles < 0) return;
  const half = discHalfWidths(radiusTiles);
  for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
    const py = ty + dy;
    if (py < 0 || py >= mh) continue;
    const hw = half[dy + radiusTiles];
    const x0 = Math.max(0, tx - hw); const x1 = Math.min(mw - 1, tx + hw);
    if (x0 <= x1) grid.fill(2, py * mw + x0, py * mw + x1 + 1);
  }
};

export const updateFog = (w) => {
  if (w.tick % FOG_EVERY !== 0 || !w.fog) return;
  [0, 1].forEach((side) => {
    const grid = w.fog[side];
    if (w.revealUntil[side] > w.tick) { grid.fill(2); return; }
    for (let i = 0; i < grid.length; i++) if (grid[i] === 2) grid[i] = 1;
    w.squads.forEach((q) => {
      if (q.side !== side || !q.alive || !q.onField || q.fled) return;
      stamp(w, grid, q.x, q.y, q.stats.sight + (q.stats.flying ? 2 : 0));
    });
    if (side === 1) {
      // city houses and wall segments see nothing (the keep, towers and buildings do)
      w.structures.forEach((s) => { if (s.alive && !s.passive && s.kind !== 'wall' && s.kind !== 'gate') stamp(w, grid, s.x, s.y, s.kind === 'keep' ? Math.floor(w.setup.territoryRadius / Q) : 8); });
    }
    w.points.forEach((p) => { if (p.owner === side) stamp(w, grid, p.x, p.y, 6); });
  });
};

export const isTileVisibleTo = (w, side, x, y) => {
  if (!w.fog) return true;
  const tx = Math.max(0, Math.min(w.map.w - 1, Math.floor(x / Q)));
  const ty = Math.max(0, Math.min(w.map.h - 1, Math.floor(y / Q)));
  return w.fog[side][ty * w.map.w + tx] === 2;
};

// Is enemy squad `q` hidden by an ambush from `side`? (Enemy cavalry close by spots it.)
export const isAmbushHidden = (w, q, side) => {
  if (!(q.hiddenUntil > w.tick)) return false;
  return !cavalryOf(w).some((o) => o.side === side && o.alive && o.onField && !o.fled
    && (o.x - q.x) * (o.x - q.x) + (o.y - q.y) * (o.y - q.y) <= AMBUSH_SPOT_RADIUS * AMBUSH_SPOT_RADIUS);
};

// Can `side` see squad `q` right now?
export const canSeeSquad = (w, side, q) => {
  if (q.side === side) return true;
  if (q.inside >= 0) return false; // garrisoned: out of sight inside its building
  if ((q.revealedUntil || -1) > w.tick) return true; // it just shot at us
  if (isAmbushHidden(w, q, side)) return false;
  return isTileVisibleTo(w, side, q.x, q.y);
};
