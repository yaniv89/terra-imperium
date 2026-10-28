// src/battle/input/deployPresets.js
// One-tap deployments for the deploy card (lane battle-hud-8; Total War's quick deploy, AoE IV's
// formations): each preset is a slot per squad in the player's deployment zone, sent as one
// `deploy` order per squad (orders.js: a lone squad is set down exactly where asked, clamped to the
// zone), so the sim and its replay are unchanged.
//   line   the starting line again: fighters in front, shooters, siege and support behind
//   wings  infantry in the centre, cavalry split on both ends of the front, shooters behind
//   wide   one long rank across the zone, shooters in a second rank: no blob, harder to flank
//   deployPreset(id, { squads, zone, side, map }) -> [{ idx, x, y }] in tiles (squad x, y in tiles)
import { TILE_COST } from '../setup/mapgen';

export const DEPLOY_PRESETS = ['line', 'wings', 'wide'];
const BACK = new Set(['ranged', 'siege', 'support']);
const LINE_SPACING = 3; // tiles between squads in a rank (world.js spawnSides)
const RANK_DEPTH = 2.5;
const FRONT_GAP = 2;    // tiles behind the zone's front edge

const walkable = (map, x, y) => {
  const tx = Math.floor(x); const ty = Math.floor(y);
  return tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && TILE_COST[map.tiles[ty * map.w + tx]] > 0;
};
// The nearest open ground within a few tiles (a slot on a house, a rock, the water), else the slot.
const openNear = (map, x, y, zone) => {
  for (let r = 0; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const px = x + dx; const py = y + dy;
        if (px < zone.x0 || px > zone.x1 + 1 || py < zone.y0 || py > zone.y1 + 1) continue;
        if (walkable(map, px, py)) return { x: px, y: py };
      }
    }
  }
  return { x, y };
};

/** Does this preset change anything for this army? (Wings needs cavalry.) */
export const presetFits = (id, squads) => id !== 'wings' || squads.some((q) => q.classId === 'cavalry');

export const deployPreset = (id, { squads, zone, side, map }) => {
  if (!squads.length) return [];
  // The attacker faces +x, the defender -x: the front is the zone's edge towards the enemy.
  const dir = side === 0 ? 1 : -1;
  const frontX = (side === 0 ? zone.x1 : zone.x0) + 0.5 - dir * FRONT_GAP;
  const height = zone.y1 - zone.y0;
  const midY = zone.y0 + 0.5 + height / 2;
  // The army's own middle across the field: a preset keeps the side of the field the player chose.
  const cy = Math.min(zone.y1, Math.max(zone.y0, squads.reduce((s, q) => s + q.y, 0) / squads.length));
  const centreY = id === 'wide' ? midY : cy;
  const spacing = id === 'wide' ? Math.max(LINE_SPACING, Math.min(6, height / Math.max(1, squads.length))) : LINE_SPACING;
  const perRank = Math.max(1, Math.floor(height / spacing) + 1);
  const byY = (a, b) => a.y - b.y || a.idx - b.idx; // keep each squad on its side: no criss-crossing
  const back = squads.filter((q) => BACK.has(q.classId)).sort(byY);
  let front = squads.filter((q) => !BACK.has(q.classId)).sort(byY);
  if (id === 'wings') {
    const cav = front.filter((q) => q.classId === 'cavalry');
    const foot = front.filter((q) => q.classId !== 'cavalry');
    const half = Math.ceil(cav.length / 2);
    front = [...cav.slice(0, half), ...foot, ...cav.slice(half)];
  }
  const out = [];
  const place = (rank, x0) => {
    const ranks = Math.ceil(rank.length / perRank);
    rank.forEach((q, i) => {
      const r = Math.floor(i / perRank);
      const inRank = Math.min(perRank, rank.length - r * perRank);
      const x = x0 - dir * r * RANK_DEPTH;
      const y = centreY + ((i % perRank) - (inRank - 1) / 2) * spacing;
      const cx = Math.max(zone.x0 + 0.5, Math.min(zone.x1 + 0.5, x));
      const yy = Math.max(zone.y0 + 0.5, Math.min(zone.y1 + 0.5, y));
      out.push({ idx: q.idx, ...openNear(map, cx, yy, zone) });
    });
    return ranks;
  };
  const frontRanks = front.length ? place(front, frontX) : 0;
  place(back, frontX - dir * (frontRanks * RANK_DEPTH + (front.length ? 1 : 0)));
  return out;
};
