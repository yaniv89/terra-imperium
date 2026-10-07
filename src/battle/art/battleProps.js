// src/battle/art/battleProps.js
// Decorative battlefield props (plans/ART-MODELS-PLAN.md 8.2; src/assets/battle/props/props-<age>.glb:
// fence-a, field-wall-a, well, cart, haystack, crate, barrel, market-stall, standard, campfire,
// shrine, road-marker). They change nothing in the battle: no tile, no HP, no sim state. Where they
// go (propPlacements, pure and seeded from the map, so the same battle always looks the same):
//   the defender's home     round the keep (or the real city's square and its gate road): a well,
//                           a cart, stalls, crates and barrels, haystacks, a shrine, and two
//                           standards in the side's colour before the keep's front (west)
//   the attacker's camp     a campfire, a standard, crates and barrels on the camp's inner side
//   roads                   a marker stone now and then beside the road
//   fields                  a few farm corners out in the open: fences, a field wall, haystacks
// Only free open ground is used: never a structure's footprint, the camp, a resource node or water.
// A prop a worker's new building covers hides (BattleProps.update). Without the file nothing shows.
import { Matrix4, Vector3, Color } from 'three';
import { ART } from './artFiles';
import { loadKit, kitObject } from './kitLoader';
import { KitInstances, kitLodForZoom } from './kitInstances';
import { TILE } from '../setup/mapgen';
import { Q } from '../sim/constants';

/** Battle tiles per prop model unit (the city's own scale, setup/cityBattle.js CITY_TILES_PER_UNIT). */
export const PROP_SCALE = 2.75;
// Ages whose props file may stand in for a later age's (a Bronze cart in a Modern battle would not).
const NO_FALLBACK = new Set(['modern']);

const hash01 = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/**
 * Where the props stand: [{ name, x, z, yaw, side }] in tiles (x east, z south as the map), side
 * 0 or 1 for the Team colour (standards), or -1. `setup`: { map, structures, economy, city, seed }.
 */
export const propPlacements = (setup) => {
  const { map } = setup;
  if (!map || map.naval || !map.tiles) return [];
  const { w, h, tiles, keep } = map;
  const seed = (setup.seed | 0) || 1;
  const blocked = new Uint8Array(w * h);
  (setup.structures || []).forEach((s) => (s.footprint || []).forEach((c) => { blocked[c] = 1; }));
  (setup.economy?.camp?.footprint || []).forEach((c) => { blocked[c] = 1; });
  (setup.economy?.nodes || []).forEach((n) => {
    const nx = Math.floor(n.x / Q); const ny = Math.floor(n.y / Q);
    for (let j = ny - 1; j <= ny + 1; j++) for (let i = nx - 1; i <= nx + 1; i++) if (i >= 0 && j >= 0 && i < w && j < h) blocked[j * w + i] = 1;
  });
  const used = [];
  const free = (x, z, kinds = [TILE.OPEN, TILE.SAND]) => {
    const i = Math.floor(x); const j = Math.floor(z);
    if (i < 1 || j < 1 || i >= w - 1 || j >= h - 1) return false;
    const c = j * w + i;
    return !blocked[c] && kinds.includes(tiles[c]) && used.every(([ux, uz]) => (ux - x) ** 2 + (uz - z) ** 2 > 1.2);
  };
  const out = [];
  const put = (name, x, z, yaw, side = -1) => { out.push({ name, x, z, yaw, side }); used.push([x, z]); };
  const yawOf = (k) => Math.round(hash01(seed * 31 + k) * 8) * (Math.PI / 4);
  // candidate tiles in a ring round (cx, cz), in a seeded order
  const ring = (cx, cz, r0, r1, salt) => {
    const list = [];
    for (let j = Math.floor(cz - r1); j <= Math.ceil(cz + r1); j++) {
      for (let i = Math.floor(cx - r1); i <= Math.ceil(cx + r1); i++) {
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
        if (d >= r0 && d <= r1) list.push([i + 0.5, j + 0.5, hash01(seed + salt * 7919 + j * w + i)]);
      }
    }
    return list.sort((a, b) => a[2] - b[2]);
  };
  const fill = (names, cands, salt) => {
    let k = 0;
    names.forEach((name, n) => {
      while (k < cands.length && !free(cands[k][0], cands[k][1])) k++;
      if (k >= cands.length) return;
      const [x, z] = cands[k++];
      put(name, x, z, yawOf(salt * 97 + n));
    });
  };

  // The defender's home. A city's houses fill its ring, so its props go into the gaps and out
  // along the gate road; an open field's keep has its yard round it.
  if (keep) {
    const kx = keep.x + 0.5; const kz = keep.y + 0.5;
    [-1.6, 1.6].forEach((dz) => { const x = kx - 3; const z = kz + dz; if (free(x, z, [TILE.OPEN, TILE.SAND, TILE.ROAD])) put('standard', x, z, -Math.PI / 2, 1); });
    const city = !!setup.city;
    const home = city
      ? ['well', 'market-stall', 'market-stall', 'cart', 'crate', 'crate', 'barrel', 'barrel', 'haystack', 'shrine', 'crate', 'barrel']
      : ['well', 'cart', 'crate', 'crate', 'barrel', 'barrel', 'haystack', 'haystack', 'shrine', 'market-stall'];
    fill(home, ring(kx, kz, city ? 2.5 : 3, city ? 14 : 8, 1), 1);
  }
  // The attacker's camp: on its side toward the field.
  const camp = setup.economy?.camp;
  if (camp) {
    const cx = camp.tx + camp.size + 0.9; const cz = camp.ty + camp.size / 2;
    if (free(cx, cz)) put('campfire', cx, cz, 0);
    if (free(cx + 0.4, cz - 2)) put('standard', cx + 0.4, cz - 2, Math.PI / 2, 0);
    fill(['crate', 'barrel', 'crate'], ring(cx, cz, 1.2, 3.5, 2), 2);
  }
  // Roads: a marker beside the road now and then, never in the town or the camp.
  let markers = 0;
  for (let j = 1; j < h - 1 && markers < 6; j++) {
    for (let i = 1; i < w - 1 && markers < 6; i++) {
      if (tiles[j * w + i] !== TILE.ROAD || hash01(seed * 13 + j * w + i) > 0.02) continue;
      if (keep && Math.hypot(i - keep.x, j - keep.y) < 12) continue;
      const side = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dz]) => free(i + 0.5 + dx * 0.8, j + 0.5 + dz * 0.8));
      if (!side) continue;
      put('road-marker', i + 0.5 + side[0] * 0.8, j + 0.5 + side[1] * 0.8, yawOf(i + j));
      markers += 1;
    }
  }
  // Farm corners: up to three, out in the open between the armies' homes.
  let farms = 0;
  const open = ring(w / 2, h / 2, 0, Math.max(w, h) / 2, 3).filter(([x, z]) => (!keep || Math.hypot(x - keep.x, z - keep.y) > 12) && x > 8);
  for (const [x, z] of open) {
    if (farms >= 3) break;
    const line = [0, 1, 2].map((k) => [x + k * 2.6, z]);
    if (!line.every(([fx, fz]) => free(fx, fz)) || !free(x + 2.6, z + 1.6) || !free(x, z + 1.6)) continue;
    line.forEach(([fx, fz], k) => put(k === 1 && farms % 2 ? 'field-wall-a' : 'fence-a', fx, fz, 0));
    put('haystack', x + 2.6, z + 1.6, yawOf(farms * 5 + 1));
    put('haystack', x, z + 1.6, yawOf(farms * 5 + 2));
    farms += 1;
  }
  return out;
};

/** The props file for a battle age, or null (none, or only an earlier age's where that would not fit). */
export const propsRef = (ageId, art = ART) => {
  const ref = art.props(ageId);
  if (!ref || (ref.ageId !== ageId && NO_FALLBACK.has(ageId))) return null;
  return ref;
};

const M = new Matrix4(); const V = new Vector3();

export class BattleProps {
  constructor(r, { art = ART, load = loadKit } = {}) {
    this.r = r; this.kit = null; this.covered = -1;
    this.list = [];
    const ref = propsRef(r.setup.sides?.[1]?.ageId || 'bronze', art);
    this.instances = new KitInstances(r.scene, { track: (x) => r.track(x) });
    this.ready = !ref ? Promise.resolve() : load(ref.url).then((kit) => {
      if (this.disposed) return;
      this.kit = kit;
      this.list = propPlacements(r.setup).filter((p) => kitObject(kit, p.name));
      this.covered = -1;
    }).catch((e) => console.warn(`[art] ${e.message}: the battle stands without props`));
  }

  update(view) {
    if (!this.kit || !this.list.length) return;
    const lod = kitLodForZoom(this.r.camera?.zoom ?? 1);
    const builds = (view?.eco?.buildings || []).filter((b) => b.alive);
    const key = builds.length * 4 + lod;
    if (key === this.covered) return;
    this.covered = key;
    const colors = (this.r.setup.sides || []).map((s) => new Color(s.color));
    this.instances.begin();
    this.list.forEach((p) => {
      if (builds.some((b) => Math.abs(b.x / Q - p.x) <= b.size / 2 + 0.6 && Math.abs(b.y / Q - p.z) <= b.size / 2 + 0.6)) return;
      const obj = kitObject(this.kit, p.name);
      M.makeRotationY(p.yaw).scale(V.setScalar(PROP_SCALE)).setPosition(p.x, this.r.heightAt(p.x, p.z), p.z);
      this.instances.add(obj, lod, M, p.side >= 0 ? colors[p.side] : null);
    });
    this.instances.end();
  }

  dispose() { this.disposed = true; this.instances.dispose(); }
}
