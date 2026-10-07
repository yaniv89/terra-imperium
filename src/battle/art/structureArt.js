// src/battle/art/structureArt.js
// One-off structures dressed from a kit file (few copies, so plain meshes, not instances): the
// fort a fortified place's keep stands in (src/assets/battle/city/fort-<age>.glb, falling back to
// the map's own fort improvement, src/assets/map/improvements/fort-<age>[-<style>].glb, so map and
// battle show the same fort). The renderer's procedural group stays until the file is in; then
// its parts hide and the kit object takes its place, fitted to `fitTiles` across, its materials
// cloned (the renderer greys a destroyed structure's materials) with Team in the side's colour.
import { Group, Mesh, Color, Matrix4, Vector3 } from 'three';
import { loadKit, kitObject, objectSize, isTeamMaterial } from './kitLoader';
import { ART } from './artFiles';
import { KitInstances, kitLodForZoom } from './kitInstances';
import { Q } from '../sim/constants';
import { improvementModel } from '../../components/map/closeView/improvementModels';

/** The fort file for an age: the battle kit's, else the map improvement's, or null. */
export const fortRef = (ageId, style = null, art = ART, improvement = improvementModel) => {
  const own = art.fort(ageId);
  if (own) return { url: own.url, names: ['fort'] };
  const imp = improvement('fort', ageId, style);
  return imp ? { url: imp.url, names: [imp.name, 'fort'] } : null;
};

/** A plain group of the object's LOD `lod`, materials cloned, Team in `teamColor`. */
export const meshesOf = (obj, teamColor, lod = 0) => {
  const b = obj.lods[lod] || obj.lods[0];
  const mats = b.materials.map((m, i) => {
    const c = m.clone();
    if (b.team[i] || isTeamMaterial(m)) c.color = new Color(teamColor).multiplyScalar(1.3);
    return c;
  });
  const g = new Group();
  const mesh = new Mesh(b.geometry, mats.length === 1 ? mats[0] : mats);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.kitPiece = true;
  g.add(mesh);
  return g;
};

/**
 * Dress `group` with a kit object once `ref`'s file loads: hide its own children, add the object
 * fitted to `fitTiles` across. Resolves to the added group, or null (no file, no object, an error).
 */
export const dressStructure = (group, ref, { fitTiles, teamColor = '#9ca3af', load = loadKit, track = (x) => x, isLive = () => true } = {}) => {
  if (!ref) return Promise.resolve(null);
  return load(ref.url).then((kit) => {
    const obj = kitObject(kit, ref.names || []) || (kit && Object.values(kit.objects)[0]);
    if (!obj || !isLive()) return null;
    const art = meshesOf(obj, teamColor);
    art.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach(track); });
    art.scale.setScalar(fitTiles / Math.max(0.05, objectSize(obj).footprint));
    group.children.forEach((c) => { c.visible = false; });
    group.add(art);
    return art;
  }).catch((e) => { console.warn(`[art] ${e.message}: keeping the procedural model`); return null; });
};

/** Damage uses the same thresholds as city walls/houses; destroyed never draws intact art. */
export const structureState = (s) => (!s.alive ? 2 : s.hp < s.maxHp * 0.7 ? 1 : 0);
export const structurePiece = (kit, name, state) => kitObject(kit,
  state === 2 ? `${name}-ruined` : state === 1 ? [`${name}-damaged`, name] : name);

/** Explicit palace variants win; campaign manifests otherwise give the city tier. */
export const palaceName = (s, city) => {
  if ([s.name, s.modelName, s.manifestId, s.id].some((n) => /^palace-small(?:-|$)/.test(n || ''))) return 'palace-small';
  if ([s.name, s.modelName].includes('palace')) return 'palace';
  return city?.tierId === 'small' ? 'palace-small' : 'palace';
};

/** Uniform scale comes from intact art, so damage and wider rubble do not resize a building. */
export const structureMatrix = (reference, fitTiles, x, y, z, yaw = -Math.PI / 2) => {
  const scale = fitTiles / Math.max(0.05, objectSize(reference).footprint);
  return new Matrix4().makeRotationY(yaw).scale(new Vector3(scale, scale, scale)).setPosition(x, y, z);
};

/** The unfortified, non-city battle objective uses civic art too; fort dressing keeps priority. */
export class CivicStructures {
  constructor(r, { art = ART, load = loadKit } = {}) {
    this.r = r; this.art = art; this.load = load; this.entries = []; this.ready = [];
    this.instances = new KitInstances(r.scene, { track: (x) => r.track(x) });
    this.last = new Map(); this.dirty = false;
  }

  add(group, s, ageId, style = null) {
    const ref = this.art.civic(ageId, style);
    if (!ref) return;
    const entry = { group, s, kit: null }; this.entries.push(entry);
    this.ready.push(this.load(ref.url).then((kit) => {
      if (this.disposed) return;
      entry.kit = kit; this.dirty = true;
    }).catch((e) => console.warn(`[art] ${e.message}: keeping the procedural keep`)));
  }

  update(view) {
    const lod = kitLodForZoom(this.r.camera?.zoom ?? 1);
    let changed = this.dirty || lod !== this.lod;
    this.entries.forEach(({ s }) => {
      const v = view.structures.find((v) => v.id === s.id);
      const state = v ? structureState(v) : null;
      if (this.last.get(s.id) !== state) { this.last.set(s.id, state); changed = true; }
    });
    if (!changed) return;
    this.dirty = false; this.lod = lod; this.instances.begin();
    this.entries.forEach(({ group, s, kit }) => {
      const state = this.last.get(s.id);
      const piece = state === null ? null : structurePiece(kit, 'keep', state);
      const reference = kitObject(kit, 'keep');
      group.visible = !piece || !reference;
      if (!piece || !reference) return;
      const x = s.x / Q; const z = s.y / Q;
      const fit = Math.max(s.w || 0, s.d || 0) || 4.5;
      this.instances.add(piece, lod, structureMatrix(reference, fit, x, this.r.heightAt(x, z), z), new Color(this.r.setup.sides[1].color));
    });
    this.instances.end();
  }

  dispose() { this.disposed = true; this.instances.dispose(); }
}
