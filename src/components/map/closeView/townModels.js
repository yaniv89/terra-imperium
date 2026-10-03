// src/components/map/closeView/townModels.js
// The town standing in a province in the close view (plan §4f, user request: "few or no
// buildings, small town; some buildings, medium town; a lot, big town"). Built in code from simple
// solids, one merged, vertex-coloured geometry per town, so a screen of towns is a few dozen draw
// calls. Deterministic: the houses' places come from the region id, so a town never shuffles.
//   Size        by the province's buildings (every category's tier + 1, plus mines): TOWN_TIERS.
//   Walls       a palisade (Bronze Age) or a stone ring when the province has a Defense building.
//   Capital     a palace in the middle.
//   Age         the colours and shapes follow the age: mud brick and thatch, white walls and
//               terracotta, timber and slate, brick, concrete and glass towers.
// Units: one house is about 1 wide; the town is about TOWN_RADIUS[tier] x 2 across; y is up.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Color, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIRST_AGE_ID, isAgeAtLeast, isAgeBefore } from '../../../data/ages';

export const TOWN_TIERS = [
  { id: 'small', minBuildings: 0, houses: 5, radius: 1.7 },
  { id: 'medium', minBuildings: 4, houses: 11, radius: 2.6 },
  { id: 'big', minBuildings: 10, houses: 22, radius: 3.6 }
];

export const AGE_STYLE = {
  bronze: { wall: '#c9a46c', roof: '#a8834a', flatRoofs: true, stone: '#a88a5c', accent: '#7c5a32' },
  classical: { wall: '#ece6d6', roof: '#b5532f', flatRoofs: false, stone: '#d8d2c0', accent: '#8a3b22' },
  kingdoms: { wall: '#d9cfb6', roof: '#5b4636', flatRoofs: false, stone: '#8f8f8a', accent: '#3f4b5c' },
  gunpowder: { wall: '#b4664a', roof: '#5e4334', flatRoofs: false, stone: '#9a8f86', accent: '#3b3f46' },
  modern: { wall: '#c3c6cc', roof: '#4b5563', flatRoofs: true, stone: '#9ca3af', accent: '#60a5fa' }
};

// How many buildings a province has: each built category counts its tier + 1, each mine 1.
export const countBuildings = (region) => {
  const cats = region?.buildings?.categories || {};
  const fromCats = Object.values(cats).reduce((sum, t) => sum + (t >= 0 ? t + 1 : 0), 0);
  const mines = Object.values(region?.buildings?.extraction || {}).filter(Boolean).length;
  return fromCats + mines;
};

export const townTier = (region) => {
  const n = countBuildings(region);
  return [...TOWN_TIERS].reverse().find((t) => n >= t.minBuildings);
};

// A small seeded generator (mulberry32) from the region id.
const seeded = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

const tmpColor = new Color();
// Give a geometry one vertex colour, drop uvs (every part must share the same attributes to merge).
export const paint = (geo, hex, shade = 1) => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  tmpColor.set(hex).multiplyScalar(shade);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = tmpColor.r; colors[i * 3 + 1] = tmpColor.g; colors[i * 3 + 2] = tmpColor.b; }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
};

const house = (parts, style, x, z, w, d, h, rot, shade, modern) => {
  const body = new BoxGeometry(w, h, d).rotateY(rot).translate(x, h / 2, z);
  parts.push(paint(body, style.wall, shade));
  if (style.flatRoofs) {
    parts.push(paint(new BoxGeometry(w * 1.04, 0.08, d * 1.04).rotateY(rot).translate(x, h + 0.04, z), modern ? style.roof : style.accent, shade));
  } else {
    const roof = new ConeGeometry(Math.max(w, d) * 0.78, h * 0.7, 4, 1).rotateY(Math.PI / 4 + rot).translate(x, h + h * 0.35, z);
    parts.push(paint(roof, style.roof, shade));
  }
};

const tower = (parts, style, x, z, r, h) => {
  parts.push(paint(new CylinderGeometry(r, r * 1.08, h, 8).translate(x, h / 2, z), style.stone));
  parts.push(paint(new ConeGeometry(r * 1.25, r * 1.6, 8).translate(x, h + r * 0.8, z), style.roof));
};

const wallRing = (parts, style, radius, bronze) => {
  const segments = Math.max(10, Math.round(radius * 7));
  for (let i = 0; i < segments; i++) {
    if (i === 0) continue; // the gate
    const a0 = (i / segments) * Math.PI * 2; const a1 = ((i + 1) / segments) * Math.PI * 2;
    const mx = Math.cos((a0 + a1) / 2) * radius; const mz = Math.sin((a0 + a1) / 2) * radius;
    const len = 2 * radius * Math.sin(Math.PI / segments) * 1.02;
    const h = bronze ? 0.45 : 0.6;
    parts.push(paint(new BoxGeometry(len, h, bronze ? 0.1 : 0.16).rotateY(-(a0 + a1) / 2 + Math.PI / 2).translate(mx, h / 2, mz), bronze ? '#7a5a36' : style.stone));
  }
  if (!bronze) [0.25, 0.5, 0.75, 1].forEach((f) => tower(parts, style, Math.cos(f * Math.PI * 2) * radius, Math.sin(f * Math.PI * 2) * radius, 0.22, 0.95));
};

// The town geometry. `opts`: { ageId, walls, capital }. Pure and deterministic for the same input.
export const buildTownGeometry = (regionId, tierId, { ageId = FIRST_AGE_ID, walls = false, capital = false } = {}) => {
  const tier = TOWN_TIERS.find((t) => t.id === tierId) || TOWN_TIERS[0];
  const style = AGE_STYLE[ageId] || AGE_STYLE[FIRST_AGE_ID];
  const modern = isAgeAtLeast(ageId, 'modern');
  const rand = seeded(`${regionId}|${tier.id}`);
  const parts = [];
  // Fields round the town (more of them for a small one, which is mostly farmland), then a
  // packed-earth square under the houses of a medium or big town.
  const fields = tier.id === 'small' ? 5 : tier.id === 'medium' ? 4 : 3;
  for (let i = 0; i < fields; i++) {
    const a = (i / fields) * Math.PI * 2 + rand() * 0.6; const r = tier.radius + 0.55 + rand() * 0.5;
    const crop = ['#a3b84a', '#c9b458', '#7fa34a', '#b8a24a'][Math.floor(rand() * 4)];
    parts.push(paint(new BoxGeometry(0.9 + rand() * 0.5, 0.03, 0.6 + rand() * 0.4).rotateY(a).translate(Math.cos(a) * r, 0.015, Math.sin(a) * r), crop));
  }
  if (tier.id !== 'small') parts.push(paint(new CylinderGeometry(tier.radius * 0.8, tier.radius * 0.85, 0.03, 20).translate(0, 0.015, 0), '#a8956a'));
  // The middle: a well (small), a market square (medium), a keep (big); the capital's palace.
  const plaza = tier.id === 'small' ? 0.5 : 0.95;
  if (capital) {
    parts.push(paint(new BoxGeometry(1.3, 0.9, 1.0).translate(0, 0.45, 0), style.stone));
    parts.push(paint(new BoxGeometry(1.36, 0.12, 1.06).translate(0, 0.96, 0), '#d4af37'));
    tower(parts, style, -0.55, -0.4, 0.2, 1.5); tower(parts, style, 0.55, -0.4, 0.2, 1.5);
  } else if (tier.id === 'big') {
    tower(parts, style, 0, 0, 0.42, modern ? 3 : 1.6);
  } else if (tier.id === 'medium') {
    parts.push(paint(new BoxGeometry(1.1, 0.04, 1.1).translate(0, 0.08, 0), '#b9a27a'));
    [[-0.3, -0.3], [0.3, 0.25]].forEach(([x, z]) => parts.push(paint(new ConeGeometry(0.22, 0.3, 4).translate(x, 0.25, z), '#c2410c')));
  } else {
    parts.push(paint(new CylinderGeometry(0.16, 0.18, 0.18, 8).translate(0, 0.09, 0), style.stone));
  }
  // Houses on a seeded scatter, kept off the plaza and apart from each other.
  const placed = [];
  let tries = 0;
  while (placed.length < tier.houses && tries < tier.houses * 30) {
    tries += 1;
    const a = rand() * Math.PI * 2; const r = plaza + 0.35 + rand() * (tier.radius - plaza - 0.5);
    const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    const w = 0.55 + rand() * 0.4; const d = 0.5 + rand() * 0.3;
    if (placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < ((p.w + w) * 0.62) ** 2)) continue;
    placed.push({ x, z, w });
    const tall = modern && rand() < 0.35;
    const h = tall ? 1.2 + rand() * 1.6 : 0.45 + rand() * (tier.id === 'big' ? 0.5 : 0.3);
    house(parts, style, x, z, w, d, h, a + Math.PI / 2, 0.85 + rand() * 0.3, modern);
  }
  if (walls) wallRing(parts, style, tier.radius + 0.15, isAgeBefore(ageId, 'classical'));
  const geo = mergeGeometries(parts, false);
  geo.computeBoundingSphere();
  return geo;
};

// Cached by everything the look depends on.
const cache = new Map();
export const getTownGeometry = (regionId, tierId, opts = {}) => {
  const key = `${regionId}|${tierId}|${opts.ageId}|${opts.walls ? 1 : 0}|${opts.capital ? 1 : 0}`;
  let geo = cache.get(key);
  if (!geo) {
    geo = buildTownGeometry(regionId, tierId, opts);
    if (cache.size > 400) { cache.forEach((g) => g.dispose()); cache.clear(); }
    cache.set(key, geo);
  }
  return geo;
};
