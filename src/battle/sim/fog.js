// src/battle/sim/fog.js
// Fog of war (Tactical Battles plan §8.7). Each side has its own grid: 0 = never seen,
// 1 = explored (terrain known, units not), 2 = visible now. Squads see a disc around them;
// the defender also sees all of its own territory (home ground); structures are landmarks and are
// always known. Espionage intel on the defender (src/engine/intel.js) gives the attacker a scouting
// report: the whole map explored and every defender visible for the first seconds of the battle.
// Ambushed squads stay hidden even inside sight until they attack or enemy cavalry comes close.
import { Q } from './constants';

const disc = new Map();
const discOffsets = (r) => {
  if (disc.has(r)) return disc.get(r);
  const out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) out.push([dx, dy]);
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
  discOffsets(radiusTiles).forEach(([dx, dy]) => {
    const px = tx + dx; const py = ty + dy;
    if (px >= 0 && py >= 0 && px < mw && py < mh) grid[py * mw + px] = 2;
  });
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
      w.structures.forEach((s) => { if (s.alive) stamp(w, grid, s.x, s.y, s.kind === 'keep' ? Math.floor(w.setup.territoryRadius / Q) : 8); });
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
  return !w.squads.some((o) => o.side === side && o.alive && o.onField && !o.fled && o.classId === 'cavalry'
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
