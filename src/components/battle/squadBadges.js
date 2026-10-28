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
const LOST = '#5b1717'; const ROUTED = '#9ca3af';
const MORALE = '#efe3c2'; const SHAKEN = '#fbbf24'; const SHAKEN_AT = 0.4;
/** Ticks (20 a second) a flag flashes after its squad is hit. */
export const HIT_FLASH_TICKS = 4;
const W = 30; const H = 13; // the flag in css px: the strength bar over a thin morale strip
const G = 12; // the class glyph's box on the flag's left (art-2 lane: which unit it is, Total War's unit flags)

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
    // Combat feedback (playtest clarity 3/10): a hit flashes the flag for HIT_FLASH_TICKS (between frames too), the
    // morale strip under it, and a routed squad's flag goes grey with a white flag.
    const hitAge = (cur.tick ?? 0) - (q.lastHitTick ?? -10000) + alpha;
    out.push({
      x, z, cls: q.classId, side: q.side === playerSide ? 'you' : 'them', share: Math.max(0, Math.min(1, q.strength / Math.max(1, q.maxStrength))), striking: !!q.striking, selected: !!selected?.has(q.idx),
      morale: Math.max(0, Math.min(1, (q.morale ?? 100) / 100)), routed: !!q.routed, hit: hitAge >= 0 && hitAge < HIT_FLASH_TICKS ? 1 - hitAge / HIT_FLASH_TICKS : 0
    });
  });
  return out;
};

/** The class glyph, white strokes in a box of G x H css px at (x, y). */
const glyph = (ctx, cls, x, y) => {
  const cx = x + G / 2; const cy = y + H / 2;
  ctx.strokeStyle = '#f8fafc'; ctx.fillStyle = '#f8fafc'; ctx.lineWidth = 1.4; ctx.beginPath();
  if (cls === 'ranged') { ctx.arc(cx - 2, cy, 4.5, -1.2, 1.2); ctx.moveTo(cx - 0.4, cy - 4.2); ctx.lineTo(cx - 0.4, cy + 4.2); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 4, cy); } // a bow and arrow
  else if (cls === 'cavalry') { ctx.arc(cx, cy - 0.5, 3.6, Math.PI * 0.8, Math.PI * 2.2); } // a horseshoe
  else if (cls === 'siege') { ctx.arc(cx, cy, 3.2, 0, Math.PI * 2); ctx.fill(); } // a stone
  else if (cls === 'support') { ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); } // a cross
  else { ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5); ctx.moveTo(cx - 2.6, cy + 2.6); ctx.lineTo(cx + 2.6, cy + 2.6); } // a sword (the guard low, unlike the cross)
  ctx.stroke();
};

/**
 * Flags that would cover one another are lifted, a flag's height at a time (at most three), so a
 * packed army reads as its squads, not one smear (round 2 playtest). `rects` [{ x, y }] top-left in
 * css px, `w` x `h` each; changed in place, the lowest on screen kept where it is.
 */
export const declutterFlags = (rects, w, h) => {
  const placed = [];
  [...rects].sort((a, b) => b.y - a.y).forEach((r) => {
    for (let k = 0; k < 3 && placed.some((p) => Math.abs(p.x - r.x) < w && Math.abs(p.y - r.y) < h + 1); k++) r.y -= h + 2;
    placed.push(r);
  });
  return rects;
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
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120); // a routed flag's blink
  const at = declutterFlags(flags.map((b) => { const sp = renderer.worldToScreen(b.x, b.z, 1.6); return { x: Math.round(sp.x) - (W + G) / 2, y: Math.round(sp.y) - H }; }), W + G, H);
  flags.forEach((b, i) => {
    const c = b.routed ? ROUTED : b.side === 'you' ? YOU : ENEMY;
    ctx.fillStyle = c; ctx.fillRect(at[i].x, at[i].y, G, H);
    ctx.fillStyle = 'rgba(15,23,32,.55)'; ctx.fillRect(at[i].x, at[i].y, G, H);
    glyph(ctx, b.cls, at[i].x, at[i].y);
    const x = at[i].x + G; const y = at[i].y;
    ctx.fillStyle = 'rgba(15,23,32,.88)'; ctx.fillRect(x, y, W, H);
    // strength: the side's colour, what is gone a dark red
    ctx.fillStyle = LOST; ctx.fillRect(x + 1.5, y + 1.5, W - 3, 6);
    ctx.fillStyle = c; ctx.fillRect(x + 1.5, y + 1.5, (W - 3) * b.share, 6);
    // morale: pale parchment (no side's colour), amber when shaken, a blinking white while it runs
    ctx.fillStyle = b.routed ? `rgba(248,250,252,${0.35 + 0.65 * pulse})` : b.morale < SHAKEN_AT ? SHAKEN : MORALE;
    ctx.fillRect(x + 1.5, y + 9, (W - 3) * (b.routed ? 1 : b.morale), 2.5);
    if (b.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${0.75 * b.hit})`; ctx.fillRect(x + 1.5, y + 1.5, W - 3, H - 3); }
    ctx.lineWidth = b.selected ? 2.5 : 1.5;
    ctx.strokeStyle = b.hit > 0.5 ? '#fff' : b.selected ? '#fff' : b.routed ? `rgba(248,250,252,${0.4 + 0.6 * pulse})` : b.striking ? '#fbbf24' : c;
    ctx.strokeRect(x + 0.75, y + 0.75, W - 1.5, H - 1.5);
    if (b.routed) { // a white flag on a pole beside it: this squad is running
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - G - 4, y - 6, 1.5, H + 6);
      ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`; ctx.beginPath(); ctx.moveTo(x - G - 4, y - 6); ctx.lineTo(x - G - 13, y - 3); ctx.lineTo(x - G - 4, y); ctx.fill();
    }
  });
};
