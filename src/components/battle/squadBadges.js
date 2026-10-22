// src/components/battle/squadBadges.js
// Playtest 6: at the default and wider zooms a soldier is a few pixels tall, and a squad standing in
// a wood or among houses is hidden under the canopy or the roofs. A small flag over every squad then
// says whose it is, how much of it is left, and (a bright rim) that it is swinging. The models keep
// their world size at every zoom; only these flags are screen sized. Drawn over the battlefield, moved
// by the render loop; one 2D canvas, because hundreds of DOM flags cost frames on a phone.
import { TILE } from '../../battle/setup/mapgen';

/** Flags show at this camera zoom and wider (1 is the default view); closer in the soldiers read alone. */
export const BADGE_MAX_ZOOM = 1;
const COVER = new Set([TILE.FOREST, TILE.BUILDING]);
const YOU = '#60a5fa'; const ENEMY = '#f87171';

/** The flags to draw: [{ x, z, side, share, striking, selected }] in tiles. Pure. */
export const badgesFor = (prev, cur, alpha, { zoom, playerSide, map, selected }) => {
  if (!cur) return [];
  const wide = zoom <= BADGE_MAX_ZOOM;
  const out = [];
  cur.squads.forEach((q) => {
    if (!q.alive || !q.onField || q.fled || q.classId === 'worker' || (q.side !== playerSide && q.visible === false)) return;
    const p = prev?.squads?.[q.idx];
    const useP = p && p.alive && p.onField;
    const x = (useP ? p.x + (q.x - p.x) * alpha : q.x) / 256; const z = (useP ? p.y + (q.y - p.y) * alpha : q.y) / 256;
    const under = map && COVER.has(map.tiles?.[Math.floor(z) * map.w + Math.floor(x)]);
    if (!wide && !under) return;
    out.push({ x, z, side: q.side === playerSide ? 'you' : 'them', share: Math.max(0, Math.min(1, q.strength / Math.max(1, q.maxStrength))), striking: !!q.striking, selected: !!selected?.has(q.idx) });
  });
  return out;
};

const MAX_FLAGS = 150; // a battle of hundreds of squads stays readable and cheap: yours first

/** Draw this frame's flags on `cv` (a 2D canvas over the battlefield). */
export const updateSquadBadges = (cv, renderer, list) => {
  if (!cv || !renderer) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(renderer.width * dpr); const h = Math.round(renderer.height * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d'); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, renderer.width, renderer.height);
  const flags = list.length > MAX_FLAGS ? [...list.filter((b) => b.side === 'you'), ...list.filter((b) => b.side !== 'you')].slice(0, MAX_FLAGS) : list;
  flags.forEach((b) => {
    const sp = renderer.worldToScreen(b.x, b.z, 1.6);
    const c = b.side === 'you' ? YOU : ENEMY;
    const x = Math.round(sp.x) - 13; const y = Math.round(sp.y) - 9;
    ctx.fillStyle = 'rgba(15,23,32,.88)'; ctx.fillRect(x, y, 26, 9);
    ctx.fillStyle = c; ctx.fillRect(x + 1.5, y + 1.5, 23 * b.share, 6);
    ctx.lineWidth = b.selected ? 2.5 : 1.5;
    ctx.strokeStyle = b.selected ? '#fff' : b.striking ? '#fbbf24' : c;
    ctx.strokeRect(x + 0.75, y + 0.75, 24.5, 7.5);
  });
};
