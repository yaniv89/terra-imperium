// src/components/map/gl/raidShapes.js
// The independents' marks on the WebGL map (phase W4; the lists come from
// src/components/independents/raidMapModel.js): raid parties in sight with a label (raid torch
// icon when delivered, else a violet or red disc) and their dashed route to the target, a red
// warning ring and label on the tile a raid against you is heading for, an orange ring and label on
// an independent's city besieged by someone else, and a label on a city being razed. Lines, sprites
// and hits in the shapes glLayers.js and picking.js take (sceneModel.js has the same shapes); a hit
// is { kind: 'indep', id } and opens that independent's sheet.
import { getTiles } from '../../../data/geo/tiles';
import { labelArt, discArt, iconArt } from './spriteArt';
import { cssColor } from './cssColor';
import { actionIconUrl } from '../../independents/independentArt';

const WHITE = [1, 1, 1, 1];
/** Below this zoom only the parties carry a label (the rings stay): the far map stays readable. */
export const RAID_LABEL_ZOOM = 5;
const RED = '#f87171';
const VIOLET = '#9C8FD0';
const ORANGE = '#fb923c';

const pointOf = (projection, tile) => { const { lat, lon } = getTiles().latLonOf(tile); return projection([lon, lat]); };

const ring = (centre, r, style) => {
  const out = []; const n = 40;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2; const a1 = ((i + 1) / n) * Math.PI * 2;
    out.push({ ...style, a: [centre[0] + Math.cos(a0) * r, centre[1] + Math.sin(a0) * r], b: [centre[0] + Math.cos(a1) * r, centre[1] + Math.sin(a1) * r] });
  }
  return out;
};

/** The tile's radius in world units (half the distance to a neighbour's centre, a little more). */
const tileRadius = (projection, tile) => {
  const nb = getTiles().neighbors[tile]?.[0];
  const p = pointOf(projection, tile); const q = nb != null ? pointOf(projection, nb) : null;
  return p && q ? Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.75 : 0.5;
};

/**
 * { lines, sprites, hits } for `model` (raidMapModel) at zoom `k`. Labels sit above their anchor
 * at screen scale; rings are drawn at the tile's size on the ground.
 */
export const raidShapes = ({ model, projection, k, dpr }) => {
  const lines = []; const sprites = []; const hits = [];
  if (!model || !projection) return { lines, sprites, hits };
  const half = projection.scale() * Math.PI;
  const label = (text, colour, anchor, dy, id) => {
    const art = labelArt(text, { size: 10, weight: 700, fill: colour, stroke: 'rgba(15,23,42,0.92)', strokeW: 3 }, dpr);
    const offset = [0, dy - art.css.h / 2, 0, 0];
    sprites.push({ art, anchor, offset, size: [art.css.w, art.css.h], exp: [0, 0], color: WHITE });
    if (id) hits.push({ kind: 'indep', id, anchor, offset, size: [Math.max(44, art.css.w), Math.max(28, art.css.h)], exp: [0, 0], pad: 4 });
  };
  // Routes: dark under, coloured dashes over (the march line style).
  model.parties.forEach((p) => {
    if (!p.route.length) return;
    const pts = [];
    [p.tile, ...p.route].forEach((t) => {
      const q = pointOf(projection, t);
      if (!q) return;
      const prev = pts[pts.length - 1];
      pts.push([prev && q[0] - prev[0] > half ? q[0] - 2 * half : prev && q[0] - prev[0] < -half ? q[0] + 2 * half : q[0], q[1]]);
    });
    const c = cssColor(p.againstYou ? RED : VIOLET);
    for (let i = 1; i < pts.length; i++) lines.push({ a: pts[i - 1], b: pts[i], half: 2.4, exp: 0, color: [15 / 255, 23 / 255, 42 / 255, 0.55] });
    for (let i = 1; i < pts.length; i++) lines.push({ a: pts[i - 1], b: pts[i], half: 1.2, dash: 7, gap: 4, exp: 0, color: [c[0], c[1], c[2], 0.95] });
  });
  // Warning rings and their labels (left out when the party's label stands on it).
  model.warnings.forEach((w) => {
    const at = pointOf(projection, w.tile);
    if (!at) return;
    const r = Math.max(tileRadius(projection, w.tile), 11 / k); // at least 11 px on screen
    const c = cssColor(RED);
    lines.push(...ring(at, r, { half: 1.6, dash: 5, gap: 3, exp: 0, color: [c[0], c[1], c[2], 0.95] }));
    lines.push(...ring(at, r * 1.35, { half: 0.8, exp: 0, color: [c[0], c[1], c[2], 0.45] }));
    const party = model.parties.find((p) => p.id === w.id);
    const pp = party ? pointOf(projection, party.tile) : null;
    if (k < RAID_LABEL_ZOOM || (pp && Math.hypot(pp[0] - at[0], pp[1] - at[1]) * k < 60)) return;
    label(`Raid target: ${w.target}${w.eta != null ? ` · ${w.eta}t` : ''}`, '#fecaca', at, -r * k - 8, w.id);
  });
  // Parties: an icon (or disc) and a label.
  const torch = actionIconUrl('raid');
  model.parties.forEach((p) => {
    const at = pointOf(projection, p.tile);
    if (!at) return;
    const c = cssColor(p.againstYou ? RED : VIOLET);
    const icon = torch ? iconArt(torch, 16, dpr) : discArt(32);
    sprites.push({ art: icon, anchor: at, offset: [0, -18, 0, 0], size: torch ? [icon.css.w, icon.css.h] : [10, 10], exp: [0, 0], color: torch ? WHITE : [c[0], c[1], c[2], 1] });
    label(`Raid party${p.phase === 'home' ? ', going home' : p.eta != null ? ` · ${p.eta}t` : ''}`, p.againstYou ? '#fecaca' : '#e9e5fb', at, -30, p.id);
  });
  // Sieges of independents by others, and burning cities.
  model.sieges.forEach((s) => {
    const at = pointOf(projection, s.tile);
    if (!at) return;
    const c = cssColor(ORANGE);
    lines.push(...ring(at, Math.max(tileRadius(projection, s.tile) * 1.2, 14 / k), { half: 1.4, dash: 3, gap: 3, exp: 0, color: [c[0], c[1], c[2], 0.9] }));
    if (k >= RAID_LABEL_ZOOM) label(`${s.byName} besiege · ${Math.round(s.hp * 100)}%`, '#fed7aa', at, -30, s.owner);
  });
  model.burning.forEach((b) => {
    const at = pointOf(projection, b.tile);
    if (at && k >= RAID_LABEL_ZOOM) label(`Burning · ${b.size} turn${b.size === 1 ? '' : 's'} left`, '#fecaca', at, 34, null);
  });
  return { lines, sprites, hits };
};
