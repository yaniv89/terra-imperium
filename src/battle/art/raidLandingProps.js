// Render-only raid goods, exits, destroyed fields and landing boats. Source state comes from
// existing snapshots; this layer never invents raider inventory or changes a battle tile.
import { Color, Matrix4, Vector3 } from 'three';
import { ART } from './artFiles';
import { loadKit, kitObject } from './kitLoader';
import { KitInstances, kitLodForZoom } from './kitInstances';
import { PROP_SCALE } from './battleProps';
import { TILE } from '../setup/mapgen';
import { Q } from '../sim/constants';

export const RAID_LANDING_IDS = ['loot-sack', 'exit-marker', 'burnt-field-overlay', 'landing-ancient', 'landing-middle', 'landing-modern'];
export const landingId = (age) => ({ bronze: 'landing-ancient', classical: 'landing-ancient', kingdoms: 'landing-middle', gunpowder: 'landing-middle', modern: 'landing-modern' })[age] || null;
export const raidLandingRef = (id, art = ART) => {
  if (!RAID_LANDING_IDS.includes(id)) return null;
  const key = `battle/props/${id}.glb`; const url = art.url(key);
  return url ? { id, key, url } : null;
};

const landAt = (map, x, z) => {
  const i = Math.floor(x); const j = Math.floor(z);
  return i >= 0 && j >= 0 && i < map.w && j < map.h && [TILE.OPEN, TILE.SAND, TILE.ROAD].includes(map.tiles?.[j * map.w + i]);
};

/** Pure placements in battle tiles. Destroyed means alive === false, not simply low HP. */
export const raidLandingPlacements = (setup, view = {}, metadata = new Map((setup.structures || []).map((s) => [s.id, s]))) => {
  const map = setup.map;
  if (!map || map.naval || !map.tiles) return [];
  const out = []; const mid = Math.floor(map.h / 2) + 0.5;
  // Real entry/fallback edges, with markers on the nearest passable land cell.
  [0, 1].forEach((side) => {
    const edge = side === 0 ? (map.attackerEdge ?? 1) : map.w - 2;
    for (let offset = 0; offset < map.h; offset++) {
      const z = mid + (offset % 2 ? -1 : 1) * Math.ceil(offset / 2);
      if (!landAt(map, edge + 0.5, z)) continue;
      out.push({ id: 'exit-marker', x: edge + 0.5, z, yaw: side === 0 ? -Math.PI / 2 : Math.PI / 2, side }); break;
    }
  });
  (view.structures || []).forEach((s) => {
    const meta = metadata.get(s.id);
    if (!meta?.loot) return;
    const x = s.x / Q; const z = s.y / Q;
    if (s.alive) out.push({ id: 'loot-sack', x, z: z + (s.radius || Q) / Q + 0.3, yaw: 0, side: -1 });
    if (meta.category === 'fields' && s.alive === false) {
      // Raid fields/stores occupy recorded tiles. Fit each patch to its own cell, so an
      // irregular footprint cannot scorch neighbouring roads, water or intact buildings.
      const cells = meta.footprint?.length ? meta.footprint : [Math.floor(z) * map.w + Math.floor(x)];
      cells.forEach((cell) => out.push({ id: 'burnt-field-overlay', x: cell % map.w + 0.5, z: Math.floor(cell / map.w) + 0.5, yaw: 0, side: -1, fieldSize: 1 }));
    }
  });
  (view.eco?.buildings || []).forEach((b) => {
    if (b.type !== 'farm' || b.alive !== false || !(b.size > 0)) return;
    out.push({ id: 'burnt-field-overlay', x: b.x / Q, z: b.y / Q, yaw: 0, side: -1, fieldSize: b.size });
  });
  const carrying = new Set(view.eco?.carrying || []);
  (view.squads || []).forEach((s) => {
    if (!carrying.has(s.idx) || !s.alive || !s.onField || s.fled || s.visible === false || s.hidden || s.inside >= 0) return;
    const a = (s.facing || 0) / 256 * Math.PI * 2;
    out.push({ id: 'loot-sack', x: s.x / Q - Math.cos(a) * 0.2, z: s.y / Q - Math.sin(a) * 0.2, yaw: Math.PI / 2 - a, side: -1, lift: 0.65 });
  });
  if (map.landing) {
    const id = landingId(setup.sides?.[0]?.ageId);
    // The shore is actual WATER -> SAND/open transition, not a hardcoded sea width.
    const row = Math.floor(mid);
    let shore = -1;
    for (let x = 1; x < map.w; x++) {
      if (map.tiles[row * map.w + x - 1] === TILE.WATER && landAt(map, x, mid)) { shore = x; break; }
    }
    if (id && shore >= 0) out.push({ id, x: shore, z: mid, yaw: Math.PI / 2, side: 0, shore: true });
  }
  return out.filter((p) => p.shore || landAt(map, p.x, p.z) || (p.id === 'burnt-field-overlay' && p.x >= 0 && p.z >= 0 && p.x < map.w && p.z < map.h && [TILE.BUILDING, TILE.RUBBLE].includes(map.tiles[Math.floor(p.z) * map.w + Math.floor(p.x)])));
};

export class RaidLandingProps {
  constructor(r, { art = ART, load = loadKit } = {}) {
    this.r = r; this.objects = new Map();
    this.metadata = new Map((r.setup.structures || []).map((s) => [s.id, s]));
    this.instances = new KitInstances(r.scene, { track: (x) => r.track(x) });
    this.colors = (r.setup.sides || []).map((s) => new Color(s.color));
    const map = r.setup.map;
    const ids = !map || map.naval ? [] : ['exit-marker'];
    // setup.economy is the actual economy configuration object (or null), not view.eco.
    const hasEconomy = !!r.setup.economy && typeof r.setup.economy === 'object';
    const hasLoot = [...this.metadata.values()].some((s) => s.loot);
    const raid = r.setup.battleType === 'raid' || r.setup.battleType === 'sack';
    if (ids.length && (hasEconomy || hasLoot || raid)) ids.push('loot-sack', 'burnt-field-overlay');
    const landing = map?.landing && landingId(r.setup.sides?.[0]?.ageId);
    if (landing) ids.push(landing);
    this.ready = Promise.all(ids.map((id) => {
      const ref = raidLandingRef(id, art);
      return !ref ? Promise.resolve() : Promise.resolve().then(() => load(ref.url)).then((kit) => {
        if (this.disposed) return;
        const obj = kitObject(kit, id);
        if (obj) this.objects.set(id, obj);
      }).catch((e) => console.warn(`[art] ${e.message}: ${id} is unavailable`));
    }));
  }

  update(view) {
    if (this.disposed || !this.objects.size) return;
    const lod = kitLodForZoom(this.r.camera?.zoom ?? 1);
    const matrix = new Matrix4(); const scale = new Vector3();
    this.instances.begin();
    raidLandingPlacements(this.r.setup, view, this.metadata).forEach((p) => {
      const obj = this.objects.get(p.id); if (!obj) return;
      let x = p.x; let z = p.z;
      scale.setScalar(PROP_SCALE);
      if (p.fieldSize > 0) scale.set(p.fieldSize / (obj.box.max.x - obj.box.min.x), PROP_SCALE, p.fieldSize / (obj.box.max.z - obj.box.min.z));
      if (p.shore) {
        const door = obj.sockets['socket-door'] || new Vector3(0, 0, obj.box.max.z);
        // Rotating +Z towards +X places the ramp socket exactly on the sand edge.
        x -= door.z * PROP_SCALE; z += door.x * PROP_SCALE;
      }
      const y = p.shore ? Math.max(0, this.r.heightAt(p.x, p.z)) : this.r.heightAt(p.x, p.z) + (p.lift || (p.id === 'burnt-field-overlay' ? 0.025 : 0));
      matrix.makeRotationY(p.yaw).scale(scale).setPosition(x, y, z);
      this.instances.add(obj, lod, matrix, p.side >= 0 ? this.colors[p.side] : null);
    });
    this.instances.end();
  }

  dispose() { this.disposed = true; this.objects.clear(); this.instances.dispose(); }
}
