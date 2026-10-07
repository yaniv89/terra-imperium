// src/battle/render/cityLayer.js
// The real city on the battlefield (plans/MASTER-PLAN.md phase B; src/battle/setup/cityBattle.js):
// the very town model the close view shows (the manifest's townKey), placed on the keep with the
// battle's documented transform (2.75 tiles per model unit, turned so the gate faces west), its
// ruined houses cut out and damaged ones darkened by the shared shader (closeView/townDamage.js),
// rubble where a structure fell, and the wall ring as targetable segments.
// Kept apart from BattleRenderer.js (which only creates it and calls update) so the renderer's
// performance work stays separate.
// ART (plans/ART-MODELS-PLAN.md 6, battle/art/cityArt.js; each wired, the placeholder stays
// without a file):
//   wall segments, the gate and the ring's towers -> src/assets/battle/city/walls-<age>.glb
//     (wall-straight stretched along the segment, gate-open, tower; -damaged under 70% HP,
//     -breached when down); placeholder: boxes in the age's stone and the renderer's towers;
//   rubble where a structure fell -> src/assets/battle/city/ruins-<age>.glb (rubble-s, -m, -l by
//     size); placeholder: the code mound (closeView/townDamage.js moundGeometry);
//   damaged and ruined houses -> src/assets/battle/city/<age>-<theme>-houses-damage.glb
//     (<house>-damaged, <house>-ruined, the theme along styleChain, then <age>-houses-damage.glb):
//     the house is cut out of the town file and the piece stands in its place; placeholder: the
//     shader darkening (damaged) and the cut-out with a mound (ruined);
//   the palace -> the shared file's palace (the city's theme), damaged and ruined from
//     src/assets/battle/city/palace-damage-<age>[-<theme>].glb; placeholder: a box;
//   the civic hall (the keep, the objective) -> civic-<age>[-<theme>].glb (keep, -damaged, -ruined);
//   wonders -> the map's own wonder model (src/assets/map/wonders/<id>.glb, its highest tier; an
//     object `ruin` when the file has one), rubble when it falls; placeholder: a box;
//   decorative props (wells, carts, stalls ...) -> props-<age>.glb, placed by battle/art/battleProps.js;
//   boxes for every house while the town file loads, or when the age and size has none.
import { InstancedMesh, MeshLambertMaterial, BoxGeometry, Object3D, Color, Group, Matrix4, Vector3 } from 'three';
import { Q } from '../sim/constants';
import { ART } from '../art/artFiles';
import { loadKit, kitObject } from '../art/kitLoader';
import { structureState, structurePiece, palaceName, structureMatrix } from '../art/structureArt';
import { KitInstances, kitLodForZoom } from '../art/kitInstances';
import { houseTypes, pickHouse, pickRubble, wallPiece, pieceLength, wonderPiece } from '../art/cityArt';
import { wonderAssetUrl } from '../../components/map/closeView/wonderAssets';
import { townUrlByName, loadTownAsset, instanceTownAsset, showLod, sharedAssetUrls } from '../../components/map/closeView/townAssets';
import { enableTownDamage, setTownDamage, syncTownDamage, moundGeometry, enableGroundClear, setGroundClear, fileGroundClear } from '../../components/map/closeView/townDamage';

const PASSIVE_KINDS = new Set(['house', 'landmark', 'palace', 'wonder']);
/** The structure kinds this layer draws (BattleRenderer leaves them out). */
export const CITY_KINDS = new Set([...PASSIVE_KINDS, 'wall', 'gate']);
const STONE = { bronze: '#b39a72', classical: '#cfc6b0', kingdoms: '#9b968c', gunpowder: '#958b80', modern: '#8f9194' };
const tmp = new Object3D();
const tint = new Color();
const M = new Matrix4(); const V = new Vector3();

export class CityLayer {
  /** `art`, `load`: the art index and kit loader (tests pass their own). */
  constructor(r, { art = ART, load = loadKit, shared = sharedAssetUrls, wonderUrl = wonderAssetUrl } = {}) {
    this.r = r; // the BattleRenderer: scene, setup, map, track(), heightAt()
    this.art = art; this.loadKit = load; this.sharedUrls = shared; this.wonderUrl = wonderUrl; this.palaceKits = [];
    this.wonderKits = {}; // projectId -> the wonder's map model read as a kit
    this.kits = {}; // walls, ruins, houses: loaded kit files
    this.ready = [];
    this.city = r.setup.city;
    this.items = []; // [{ index, s }] the city structures by sim index
    this.last = new Map();
  }

  build() {
    if (!this.city || this.r.map.naval) return;
    const { setup, map } = this.r;
    setup.structures.forEach((s, index) => { if (CITY_KINDS.has(s.kind) || s.kind === 'tower' || s.kind === 'keep') this.items.push({ index, s }); });
    const stone = STONE[this.city.ageId] || STONE.kingdoms;
    const box = this.r.track(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const mk = (n, color) => {
      const m = new InstancedMesh(box, this.r.track(new MeshLambertMaterial({ color })), Math.max(1, n));
      m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      this.r.scene.add(m);
      return m;
    };
    this.walls = mk(this.items.filter((i) => i.s.kind === 'wall' || i.s.kind === 'gate').length * 2 + this.items.filter((i) => i.s.kind === 'tower').length, stone);
    this.blocks = mk(this.items.filter((i) => PASSIVE_KINDS.has(i.s.kind)).length, '#d8cdb5');
    this.rubble = new InstancedMesh(moundGeometry(), this.r.track(new MeshLambertMaterial({ color: '#8b8073' })), Math.max(1, this.items.length));
    Object.assign(this.rubble, { count: 0, castShadow: true, receiveShadow: true, frustumCulled: false });
    this.r.scene.add(this.rubble);
    // The town model itself, on the keep: town space -> battle tiles (cityBattle.js).
    const S = this.city.scale;
    this.root = new Group();
    this.root.position.set(map.keep.x + 0.5, this.r.heightAt(map.keep.x + 0.5, map.keep.y + 0.5), map.keep.y + 0.5);
    this.root.rotation.y = -Math.PI / 2;
    this.root.scale.setScalar(S);
    this.r.scene.add(this.root);
    // The age's wall kit, ruin library and the theme's damaged houses, when their files exist.
    this.pieces = new KitInstances(this.r.scene, { track: (x) => this.r.track(x) });
    this.housePieces = new KitInstances(this.root, { track: (x) => this.r.track(x) });
    const hasPalace = this.items.some(({ s }) => s.kind === 'palace');
    const refs = { walls: this.art.walls(this.city.ageId), ruins: this.art.ruins(this.city.ageId), houses: this.art.housesDamage(this.city.ageId, this.city.style),
      civic: this.art.civic(this.city.ageId, this.city.style),
      palaceDamage: hasPalace ? this.art.palaceDamage(this.city.ageId, this.city.style) : null };
    if (hasPalace) this.sharedUrls(this.city.ageId, this.city.style).forEach((url, i) => {
      this.ready.push(this.loadKit(url).then((kit) => {
        if (this.disposed) return;
        this.palaceKits[i] = kit; this.last.clear();
      }).catch((e) => console.warn(`[art] ${e.message}: keeping the palace placeholder`)));
    });
    new Set(this.items.filter(({ s }) => s.kind === 'wonder' && s.projectId).map(({ s }) => s.projectId)).forEach((id) => {
      const wurl = this.wonderUrl(id);
      if (!wurl) return;
      this.ready.push(this.loadKit(wurl).then((kit) => {
        if (this.disposed) return;
        this.wonderKits[id] = kit; this.last.clear();
      }).catch((e) => console.warn(`[art] ${e.message}: keeping the wonder placeholder`)));
    });
    Object.entries(refs).forEach(([k, ref]) => {
      if (!ref) return;
      this.ready.push(this.loadKit(ref.url).then((kit) => {
        if (this.disposed) return;
        this.kits[k] = kit;
        if (k === 'houses') this.houseTypes = houseTypes(kit);
        this.last.clear(); // redraw with the art
      }).catch((e) => console.warn(`[art] ${e.message}: the city keeps its placeholders`)));
    });
    const url = townUrlByName(this.city.townKey);
    if (url) {
      loadTownAsset(url).then((model) => {
        if (this.disposed) return;
        const inst = instanceTownAsset(model, setup.sides[1].color);
        showLod(inst, 0);
        inst.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        enableTownDamage(inst).forEach((m) => this.r.track(m));
        // the ground under the houses the town hall replaced, and under the landmarks the art moved
        // off the square, loses their baked footprints
        enableGroundClear(inst).forEach((m) => this.r.track(m));
        setGroundClear(inst, [...fileGroundClear(inst), ...this.items.filter(({ s }) => s.underHall && s.model).map(({ s: { model: [x, z, w, d] } }) => ({ x, z, w, d }))]);
        this.root.add(inst);
        this.town = inst;
        syncTownDamage(inst);
        this.last.clear(); // redraw the damage on the model
      }).catch((e) => { console.warn('town model failed, the battle keeps the placeholder houses:', e.message); });
    }
  }

  // Each frame: only structures whose state changed (or the zoom's kit LOD) are redrawn.
  update(view) {
    if (!this.items.length) return;
    let changed = false;
    const lod = kitLodForZoom(this.r.camera?.zoom ?? 1);
    if (lod !== this.lod) { this.lod = lod; changed = true; }
    this.items.forEach(({ index }) => {
      const v = view.structures[index];
      const key = structureState(v);
      if (this.last.get(index) !== key) { this.last.set(index, key); changed = true; }
    });
    if (!changed) return;
    let nw = 0; let nb = 0; let nr = 0;
    // the town model's houses under the town hall are always cut out (cityBattle.js underHall)
    const ruined = this.items.filter(({ s }) => s.underHall && s.model).map(({ s }) => s.model); const damaged = [];
    const { walls: wallKit, ruins: ruinKit, houses: houseKit } = this.kits;
    const S = this.city.scale;
    const team = tint.set(this.r.setup.sides[1].color).clone();
    this.pieces.begin(); this.housePieces.begin();
    const at = (s) => { const x = s.x / Q; const z = s.y / Q; return [x, this.r.heightAt(x, z), z]; };
    // a house's kit piece in the town's model space (this.root), the house cut out of the town file
    const housePiece = (s, state) => {
      if (!houseKit || s.kind !== 'house' || !s.model) return false;
      const [mx, mz, w, d] = s.model;
      const p = pickHouse(houseKit, w, d, state, this.houseTypes);
      if (!p) return false;
      this.housePieces.add(p.obj, lod, M.makeRotationY(p.yaw).scale(V.set(p.lx, 1, p.lz)).setPosition(mx, 0, mz), team);
      ruined.push(s.model);
      return true;
    };
    // A capital places its palace on the objective: one central building serves both footprints.
    const keep = this.items.find(({ s }) => s.kind === 'keep');
    const central = keep && this.items.find(({ s }) => s.kind === 'palace'
      && Math.abs(s.x - keep.s.x) / Q < ((s.w || 3) + (keep.s.w || 3)) / 2
      && Math.abs(s.y - keep.s.y) / Q < ((s.d || 3) + (keep.s.d || 3)) / 2);
    const centralArt = central && this.palaceKits.some((kit) => kitObject(kit, palaceName(central.s, this.city)));
    this.items.forEach(({ index, s }) => {
      let state = this.last.get(index);
      if (s.underHall) return; // drawn by the hall itself
      if (centralArt && index === keep.index) {
        const group = this.r.structureMeshes?.get(s.id);
        if (group) group.visible = false; // its objective HP bar is drawn independently
        return;
      }
      if (centralArt && index === central.index) state = Math.max(state, this.last.get(keep.index));
      const [x, y, z] = at(s);
      if (s.kind === 'keep' || s.kind === 'palace') {
        const name = s.kind === 'keep' ? 'keep' : palaceName(s, this.city);
        const intact = s.kind === 'keep' ? kitObject(this.kits.civic, name)
          : this.palaceKits.map((kit) => kitObject(kit, name)).find(Boolean);
        const piece = s.kind === 'keep' ? structurePiece(this.kits.civic, name, state)
          : state === 0 ? intact : structurePiece(this.kits.palaceDamage, name, state) || (state === 1 ? intact : null);
        const group = s.kind === 'keep' ? this.r.structureMeshes?.get(s.id) : null;
        if (group) group.visible = !(piece && intact) && state !== 2;
        if (piece && intact) {
          // the town hall at its drawn size (cityBattle.js hallSize); a capital's palace on the
          // keep stands at least that large, as the city's main building
          const own = Math.max(s.w || 0, s.d || 0) || 3;
          const fit = s.kind === 'keep' ? s.hall || own : central && index === central.index ? Math.max(own, keep.s.hall || 0) : own;
          const m = structureMatrix(intact, fit, x, y, z);
          if (s.kind === 'keep' && s.hallLift > 1) m.multiply(M.makeScale(1, s.hallLift, 1));
          this.pieces.add(piece, lod, m, team);
          return;
        }
        // Missing art preserves the keep's own model, or the palace box/mound below.
        if (s.kind === 'keep' && state !== 2) return;
      }
      if (s.kind === 'wonder') {
        const w = wonderPiece(this.wonderKits[s.projectId], state);
        if (w) {
          this.pieces.add(w.piece, lod, structureMatrix(w.intact, Math.max(s.w || 0, s.d || 0) || 4, x, y, z), team);
          return;
        }
      }
      const ring = s.kind === 'wall' || s.kind === 'gate' || s.kind === 'tower';
      // along the ring: the segment's long side is across the line to the keep
      const yaw = Math.atan2(z - (this.r.map.keep.y + 0.5), x - (this.r.map.keep.x + 0.5));
      const piece = ring && wallKit ? wallPiece(wallKit, s.kind, state) : null;
      if (s.kind === 'tower') {
        // the renderer's own tower stands until the kit has one
        const g = this.r.structureMeshes?.get(s.id);
        if (g) g.visible = !piece;
        if (piece) this.pieces.add(piece, lod, M.makeRotationY(Math.PI / 2 - yaw).scale(V.setScalar(S)).setPosition(x, y, z), team);
        return;
      }
      if (piece) {
        // the piece runs along model x with its outer face to +Z: turned to face away from the keep
        const len = Math.max(s.w, s.d);
        this.pieces.add(piece, lod, M.makeRotationY(Math.PI / 2 - yaw).scale(V.set(len / pieceLength(piece), S, S)).setPosition(x, y, z), team);
        return;
      }
      if (state === 2) {
        if (housePiece(s, 'ruined')) return;
        const rubble = pickRubble(ruinKit, Math.max(s.w, s.d) / S);
        if (rubble) {
          this.pieces.add(rubble.obj, lod, M.makeRotationY((index * 2.39996) % 6.283).scale(V.setScalar(S * rubble.scale)).setPosition(x, y, z));
          if (s.model) ruined.push(s.model);
          return;
        }
        tmp.position.set(x, y, z); tmp.rotation.set(0, 0, 0);
        tmp.scale.set(Math.max(0.8, s.w), Math.max(1, Math.min(s.w, s.d) * 1.4), Math.max(0.8, s.d)); tmp.updateMatrix();
        this.rubble.setMatrixAt(nr++, tmp.matrix);
        if (s.model) ruined.push(s.model);
        return;
      }
      if (state === 1 && housePiece(s, 'damaged')) return;
      if (state === 1 && s.model) damaged.push(s.model);
      if (s.kind === 'wall' || s.kind === 'gate') {
        const len = Math.max(s.w, s.d); const thick = Math.max(0.5, Math.min(s.w, s.d));
        const parts = s.kind === 'gate' ? [[-len / 2 + 0.3, 0.6], [len / 2 - 0.3, 0.6]] : [[0, len]];
        parts.forEach(([off, l]) => {
          tmp.position.set(x - Math.sin(yaw) * off, y, z + Math.cos(yaw) * off);
          tmp.rotation.set(0, -yaw, 0);
          tmp.scale.set(thick, s.kind === 'gate' ? 1.6 : 1.1, l); tmp.updateMatrix();
          this.walls.setMatrixAt(nw, tmp.matrix);
          this.walls.setColorAt(nw++, tint.set('#ffffff').multiplyScalar(state === 1 ? 0.6 : 1));
        });
        return;
      }
      // Houses/landmarks come from the town; missing palace art and wonders keep their boxes.
      if (this.town && (s.kind === 'house' || s.kind === 'landmark')) return;
      tmp.position.set(x, y, z); tmp.rotation.set(0, 0, 0);
      tmp.scale.set(s.w * 0.9, Math.max(0.6, s.h), s.d * 0.9); tmp.updateMatrix();
      this.blocks.setMatrixAt(nb, tmp.matrix);
      this.blocks.setColorAt(nb++, tint.set(s.kind === 'palace' || s.kind === 'wonder' ? '#e7d9a8' : '#ffffff').multiplyScalar(state === 1 ? 0.55 : 1));
    });
    this.pieces.end(); this.housePieces.end();
    [[this.walls, nw], [this.blocks, nb], [this.rubble, nr]].forEach(([m, n]) => {
      m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    if (this.town) setTownDamage(this.town, ruined.map(([mx, mz, w, d]) => ({ x: mx, z: mz, w, d })), damaged.map(([mx, mz, w, d]) => ({ x: mx, z: mz, w, d })));
  }

  dispose() {
    this.disposed = true;
    this.pieces?.dispose(); this.housePieces?.dispose();
    if (this.root) this.r.scene.remove(this.root);
  }
}

