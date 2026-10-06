// src/battle/art/structureArt.js
// One-off structures dressed from a kit file (few copies, so plain meshes, not instances): the
// fort a fortified place's keep stands in (src/assets/battle/city/fort-<age>.glb, falling back to
// the map's own fort improvement, src/assets/map/improvements/fort-<age>[-<style>].glb, so map and
// battle show the same fort). The renderer's procedural group stays until the file is in; then
// its parts hide and the kit object takes its place, fitted to `fitTiles` across, its materials
// cloned (the renderer greys a destroyed structure's materials) with Team in the side's colour.
import { Group, Mesh, Color } from 'three';
import { loadKit, kitObject, objectSize, isTeamMaterial } from './kitLoader';
import { ART } from './artFiles';
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
