// src/battle/art/battleTerrain.js
// The battle map's water crossings and river banks from the battle terrain kits (S11,
// src/assets/battle/terrain/; plans/ART-MODELS-PLAN.md 8.1), read off mapgen.js's tiles:
//   river-kit.glb   `bank`: one battle tile of bank (0.36 model units along model x, the water on
//                   its +Z side), placed on every edge between water and land
//   ford.glb        `ford`: stones and shallows filling one battle tile, on every FORD tile
//   bridge-<wood|stone|steel>.glb   `bridge-<material>` (+ -damaged, -destroyed for when bridges
//                   take damage), its two ends marked by the `socket-end-a` and `socket-end-b`
//                   empties: stretched between the banks over every road crossing (ROAD tiles with
//                   water on both sides), the age's material (artIndex.js bridge)
// No file: the ground shader's ford tint and the plain road stay. Placed once (and again when
// the zoom changes the kit LOD), all instanced.
import { Matrix4, Vector3 } from 'three';
import { TILE } from '../setup/mapgen';
import { CITY_TILES_PER_UNIT } from '../setup/cityBattle';
import { ART } from './artFiles';
import { loadKit, kitObject } from './kitLoader';
import { KitInstances, kitLodForZoom } from './kitInstances';

const isWet = (t) => t === TILE.WATER || t === TILE.FORD;
const hash01 = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/**
 * The crossings and banks of a battle map: { fords: [{ x, z, yaw }], banks: [{ x, z, yaw }],
 * bridges: [{ x, z, axis: 'x' | 'z', length }] } in tiles (yaw turns a piece's +Z toward the water).
 */
export const findCrossings = ({ w, h, tiles }) => {
  const fords = []; const banks = []; const bridgeTiles = new Map(); // index -> votes { x, z }
  const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? -1 : tiles[j * w + i]);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const t = tiles[j * w + i];
      if (t === TILE.FORD) fords.push({ x: i + 0.5, z: j + 0.5, yaw: Math.floor(hash01(j * w + i) * 4) * (Math.PI / 2) });
      if (isWet(t)) {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
          const n = at(i + dx, j + dz);
          if (n < 0 || isWet(n) || n === TILE.ROAD) return;
          banks.push({ x: i + 0.5 + dx * 0.5, z: j + 0.5 + dz * 0.5, yaw: Math.atan2(-dx, -dz) });
        });
      } else if (t === TILE.ROAD) {
        // water on both sides along x: the river runs along x here, the bridge spans z (and back)
        const alongX = isWet(at(i - 1, j)) && isWet(at(i + 1, j));
        const alongZ = isWet(at(i, j - 1)) && isWet(at(i, j + 1));
        if (alongX !== alongZ) bridgeTiles.set(j * w + i, alongX ? 'z' : 'x');
      }
    }
  }
  // connected bridge tiles (8 neighbours) are one bridge
  const bridges = []; const seen = new Set();
  bridgeTiles.forEach((_, start) => {
    if (seen.has(start)) return;
    const stack = [start]; const cells = []; seen.add(start);
    while (stack.length) {
      const c = stack.pop(); cells.push(c);
      const ci = c % w; const cj = Math.floor(c / w);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const n = (cj + dj) * w + ci + di;
        if (ci + di < 0 || ci + di >= w || !bridgeTiles.has(n) || seen.has(n)) continue;
        seen.add(n); stack.push(n);
      }
    }
    const votes = cells.reduce((v, c) => { v[bridgeTiles.get(c)] += 1; return v; }, { x: 0, z: 0 });
    const axis = votes.x >= votes.z ? 'x' : 'z';
    const xs = cells.map((c) => c % w); const zs = cells.map((c) => Math.floor(c / w));
    const span = axis === 'x' ? Math.max(...xs) - Math.min(...xs) : Math.max(...zs) - Math.min(...zs);
    const bridge = { x: xs.reduce((a, b) => a + b, 0) / cells.length + 0.5, z: zs.reduce((a, b) => a + b, 0) / cells.length + 0.5, axis, length: span + 2 };
    const half = bridge.length / 2;
    const ends = axis === 'x' ? [[bridge.x - half, bridge.z], [bridge.x + half, bridge.z]] : [[bridge.x, bridge.z - half], [bridge.x, bridge.z + half]];
    // Lateral water also occurs beside coastal roads and partial crossings. Both
    // rendered end sockets must land on dry cells inside the battlefield.
    if (ends.every(([x, z]) => { const t = at(Math.floor(x), Math.floor(z)); return t >= 0 && !isWet(t); })) bridges.push(bridge);
  });
  return { fords, banks, bridges };
};

/** How a bridge object spans: its local axis ('x' or 'z') and model length, from its end sockets
 * (else its longer side). */
export const bridgeSpan = (obj) => {
  const a = obj.sockets['socket-end-a']; const b = obj.sockets['socket-end-b'];
  if (a && b) {
    const dx = Math.abs(b.x - a.x); const dz = Math.abs(b.z - a.z);
    return dx >= dz ? { axis: 'x', length: Math.max(0.05, dx) } : { axis: 'z', length: Math.max(0.05, dz) };
  }
  const s = obj.box.getSize(new Vector3());
  return s.x >= s.z ? { axis: 'x', length: Math.max(0.05, s.x) } : { axis: 'z', length: Math.max(0.05, s.z) };
};
// Turn a local span axis onto a world axis (rotation about y).
const YAW = { 'x>x': 0, 'x>z': -Math.PI / 2, 'z>z': 0, 'z>x': Math.PI / 2 };

const M = new Matrix4(); const V = new Vector3();

export class BattleTerrainArt {
  /** `r`: the renderer (map, setup, scene, track, heightAt, camera). */
  constructor(r, { art = ART, load = loadKit } = {}) {
    this.r = r; this.kits = {}; this.ready = []; this.lod = -1;
    if (r.map.naval) return;
    this.found = findCrossings(r.map);
    const refs = {
      bank: this.found.banks.length ? art.terrain('river-kit') : null,
      ford: this.found.fords.length ? art.terrain('ford') : null,
      bridge: this.found.bridges.length ? art.bridge(r.setup.sides[1]?.ageId || r.setup.sides[0]?.ageId) : null
    };
    this.bridgeName = refs.bridge?.object;
    this.pieces = new KitInstances(r.scene, { track: (x) => r.track(x), tintAll: false });
    Object.entries(refs).forEach(([k, ref]) => {
      if (!ref) return;
      this.ready.push(load(ref.url).then((kit) => { if (!this.disposed) { this.kits[k] = kit; this.lod = -1; this.update(); } })
        .catch((e) => console.warn(`[art] ${e.message}: keeping the plain river and roads`)));
    });
  }

  update(zoom = this.r.camera?.zoom ?? 1) {
    if (!this.pieces || !Object.keys(this.kits).length) return;
    const lod = kitLodForZoom(zoom);
    if (lod === this.lod) return;
    this.lod = lod;
    const S = CITY_TILES_PER_UNIT; const r = this.r;
    this.pieces.begin();
    const bank = kitObject(this.kits.bank, 'bank');
    if (bank) this.found.banks.forEach((b) => this.pieces.add(bank, lod, M.makeRotationY(b.yaw).scale(V.setScalar(S)).setPosition(b.x, r.heightAt(b.x, b.z), b.z)));
    const ford = kitObject(this.kits.ford, 'ford');
    if (ford) this.found.fords.forEach((f) => this.pieces.add(ford, lod, M.makeRotationY(f.yaw).scale(V.setScalar(S)).setPosition(f.x, r.heightAt(f.x, f.z), f.z)));
    const bridge = kitObject(this.kits.bridge, this.bridgeName, Object.keys(this.kits.bridge?.objects || {})[0]);
    if (bridge) {
      const span = bridgeSpan(bridge);
      this.found.bridges.forEach((b) => {
        const stretch = b.length / span.length;
        V.set(span.axis === 'x' ? stretch : S, S, span.axis === 'z' ? stretch : S);
        const half = b.length / 2;
        const ends = b.axis === 'x' ? [[b.x - half, b.z], [b.x + half, b.z]] : [[b.x, b.z - half], [b.x, b.z + half]];
        const y = Math.max(...ends.map(([x, z]) => r.heightAt(x, z)));
        this.pieces.add(bridge, lod, M.makeRotationY(YAW[`${span.axis}>${b.axis}`]).scale(V).setPosition(b.x, y, b.z));
      });
    }
    this.pieces.end();
  }

  dispose() { this.disposed = true; this.pieces?.dispose(); }
}
