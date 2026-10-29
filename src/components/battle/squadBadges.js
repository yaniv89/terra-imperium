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
export const HIT_FLASH_TICKS = 7; // 0.35 s, the figures' glow (BattleRenderer HIT_FLASH_S)
const W = 30; const H = 13; // the flag in css px: the strength bar over a thin morale strip

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
      x, z, classId: q.classId, str: q.strength, max: q.maxStrength, side: q.side === playerSide ? 'you' : 'them', share: Math.max(0, Math.min(1, q.strength / Math.max(1, q.maxStrength))), striking: !!q.striking, selected: !!selected?.has(q.idx),
      morale: Math.max(0, Math.min(1, (q.morale ?? 100) / 100)), routed: !!q.routed, hit: hitAge >= 0 && hitAge < HIT_FLASH_TICKS ? 1 - hitAge / HIT_FLASH_TICKS : 0
    });
  });
  return out;
};

const MAX_FLAGS = 150; // a battle of hundreds of squads stays readable and cheap: yours first
const ICON = 13; // the class glyph's box, left of the bar

/**
 * Playtest 40650979770 step 41: zoomed out, flags piled into one blob. Flags of one side whose boxes
 * would overlap on screen merge into one, which reads the group: its strength, the weakest morale,
 * the most common class and how many squads (`n`). items: badgesFor rows with screen sx, sy. Pure.
 */
export const clusterFlags = (items, w = W + ICON, h = H) => {
  const out = [];
  items.forEach((b) => {
    const c = out.find((o) => o.side === b.side && Math.abs(o.sx - b.sx) < w * 0.85 && Math.abs(o.sy - b.sy) < h);
    if (!c) { out.push({ ...b, n: 1, classes: { [b.classId]: 1 } }); return; }
    c.sx = (c.sx * c.n + b.sx) / (c.n + 1); c.sy = (c.sy * c.n + b.sy) / (c.n + 1); c.n += 1;
    c.str = (c.str || 0) + (b.str || 0); c.max = (c.max || 0) + (b.max || 0);
    c.share = c.max > 0 ? c.str / c.max : c.share;
    c.morale = Math.min(c.morale, b.morale); c.routed = c.routed && b.routed;
    c.hit = Math.max(c.hit, b.hit); c.striking = c.striking || b.striking; c.selected = c.selected || b.selected;
    c.classes[b.classId] = (c.classes[b.classId] || 0) + 1;
    c.classId = Object.keys(c.classes).reduce((a, k) => (c.classes[k] > c.classes[a] ? k : a), c.classId);
  });
  return out;
};

/**
 * One flag per squad in a melee (battle-art-8): a fighting squad's flag that would cover one already
 * placed steps up a row, up to `rows` rows; the rest (and every flag not fighting) merge as
 * clusterFlags does. items: badgesFor rows with screen sx, sy. Pure.
 */
export const stackFlags = (items, w = W + ICON, h = H, rows = 3) => {
  const placed = []; const rest = [];
  const covers = (b, sy) => placed.some((o) => Math.abs(o.sx - b.sx) < w * 0.85 && Math.abs(o.sy - sy) < h);
  items.forEach((b) => {
    if (!b.striking && !b.hit) { rest.push(b); return; }
    for (let r = 0, sy = b.sy; r < rows; r++, sy -= h + 2) if (!covers(b, sy)) { placed.push({ ...b, sy, n: 1, classes: { [b.classId]: 1 } }); return; }
    rest.push(b);
  });
  return [...placed, ...clusterFlags(rest, w, h)];
};

// The class at a glance (NATO style, no words): infantry a cross, cavalry a slash, ranged a bow's
// chevron, siege a dot, anything else a plus.
const glyph = (ctx, classId, x, y) => {
  const s = ICON; ctx.strokeStyle = '#f8fafc'; ctx.fillStyle = '#f8fafc'; ctx.lineWidth = 1.6; ctx.beginPath();
  if (classId === 'infantry') { ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + s - 3, y + s - 3); ctx.moveTo(x + s - 3, y + 3); ctx.lineTo(x + 3, y + s - 3); }
  else if (classId === 'cavalry') { ctx.moveTo(x + 3, y + s - 3); ctx.lineTo(x + s - 3, y + 3); }
  else if (classId === 'ranged') { ctx.moveTo(x + 3, y + s - 4); ctx.lineTo(x + s / 2, y + 3.5); ctx.lineTo(x + s - 3, y + s - 4); }
  else if (classId === 'siege') { ctx.arc(x + s / 2, y + s / 2, 2.8, 0, Math.PI * 2); ctx.fill(); return; }
  else { ctx.moveTo(x + s / 2, y + 3); ctx.lineTo(x + s / 2, y + s - 3); ctx.moveTo(x + 3, y + s / 2); ctx.lineTo(x + s - 3, y + s / 2); }
  ctx.stroke();
};

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
  const shown = stackFlags(flags.map((b) => { const sp = renderer.worldToScreen(b.x, b.z, 1.6); return { ...b, sx: sp.x, sy: sp.y }; }));
  ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textBaseline = 'middle';
  shown.forEach((b) => {
    const c = b.routed ? ROUTED : b.side === 'you' ? YOU : ENEMY;
    const tag = b.n > 1 ? `×${b.n}` : '';
    const tw = tag ? Math.ceil(ctx.measureText(tag).width) + 4 : 0;
    const fw = ICON + W + tw;
    const x = Math.round(b.sx) - fw / 2; const y = Math.round(b.sy) - H;
    ctx.fillStyle = 'rgba(15,23,32,.9)'; ctx.fillRect(x, y, fw, H);
    // the class glyph on the side's colour (the shape reads without colour)
    ctx.fillStyle = c; ctx.globalAlpha = 0.55; ctx.fillRect(x + 1, y + 1, ICON - 1, H - 2); ctx.globalAlpha = 1;
    glyph(ctx, b.classId, x, y);
    const bx = x + ICON;
    // strength: the side's colour, what is gone a dark red
    ctx.fillStyle = LOST; ctx.fillRect(bx + 1.5, y + 1.5, W - 3, 6);
    ctx.fillStyle = c; ctx.fillRect(bx + 1.5, y + 1.5, (W - 3) * b.share, 6);
    // morale: pale parchment (no side's colour), amber when shaken, a blinking white while it runs
    ctx.fillStyle = b.routed ? `rgba(248,250,252,${0.35 + 0.65 * pulse})` : b.morale < SHAKEN_AT ? SHAKEN : MORALE;
    ctx.fillRect(bx + 1.5, y + 9, (W - 3) * (b.routed ? 1 : b.morale), 2.5);
    if (tag) { ctx.fillStyle = '#f8fafc'; ctx.fillText(tag, bx + W + 1, y + H / 2 + 0.5); }
    if (b.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${0.75 * b.hit})`; ctx.fillRect(x + 1.5, y + 1.5, fw - 3, H - 3); }
    ctx.lineWidth = b.selected ? 2.5 : 1.5;
    ctx.strokeStyle = b.hit > 0.5 ? '#fff' : b.selected ? '#fff' : b.routed ? `rgba(248,250,252,${0.4 + 0.6 * pulse})` : b.striking ? '#fbbf24' : c;
    ctx.strokeRect(x + 0.75, y + 0.75, fw - 1.5, H - 1.5);
    if (b.routed) { // a white flag on a pole beside it: this squad is running
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - 4, y - 6, 1.5, H + 6);
      ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`; ctx.beginPath(); ctx.moveTo(x - 4, y - 6); ctx.lineTo(x - 13, y - 3); ctx.lineTo(x - 4, y); ctx.fill();
    }
  });
};
