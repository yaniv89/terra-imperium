// src/battle/render/cityLayer.js
// The real city on the battlefield (plans/MASTER-PLAN.md phase B; src/battle/setup/cityBattle.js):
// the very town model the close view shows (the manifest's townKey), placed on the keep with the
// battle's documented transform (2.75 tiles per model unit, turned so the gate faces west), its
// ruined houses cut out and damaged ones darkened by the shared shader (closeView/townDamage.js),
// rubble where a structure fell, and the wall ring as targetable segments.
// Kept apart from BattleRenderer.js (which only creates it and calls update) so the renderer's
// performance work stays separate.
// PLACEHOLDERS and the art that replaces them (plans/ART-PRODUCTION-PLAN.md batch M03):
//   wall segments and the gate posts (plain boxes in the age's stone) -> src/assets/battle/city/
//     walls-<age>.glb (wall-straight, wall-corner, tower, gate-open, gate-closed, each -damaged and
//     -breached), the `battle-city/<age>/wall-kit` items;
//   the rubble mound (closeView/townDamage.js ruinMound) -> src/assets/battle/city/ruins-<age>.glb
//     (rubble-s, -m, -l, beams, scorch), the `battle-city/<age>/ruin-library` items;
//   the darkened house (damaged) and the cut-out house (ruined) -> src/assets/battle/city/
//     <age>-<theme>-houses-damage.glb (<name>-damaged, <name>-ruined), the
//     `battle-city/bronze/<theme>/houses-damage` items;
//   the palace and wonder boxes -> the shared file's palace and the wonder models (and the 15
//     wonder ruins, batch M28);
//   boxes for every house while the town file loads, or when the age and size has none.
import { InstancedMesh, MeshLambertMaterial, BoxGeometry, Object3D, Color, Group } from 'three';
import { Q } from '../sim/constants';
import { townUrlByName, loadTownAsset, instanceTownAsset, showLod } from '../../components/map/closeView/townAssets';
import { enableTownDamage, setTownDamage, syncTownDamage, moundGeometry } from '../../components/map/closeView/townDamage';

const PASSIVE_KINDS = new Set(['house', 'landmark', 'palace', 'wonder']);
/** The structure kinds this layer draws (BattleRenderer leaves them out). */
export const CITY_KINDS = new Set([...PASSIVE_KINDS, 'wall', 'gate']);
const STONE = { bronze: '#b39a72', classical: '#cfc6b0', kingdoms: '#9b968c', gunpowder: '#958b80', modern: '#8f9194' };
const tmp = new Object3D();
const tint = new Color();

export class CityLayer {
  constructor(r) {
    this.r = r; // the BattleRenderer: scene, setup, map, track(), heightAt()
    this.city = r.setup.city;
    this.items = []; // [{ index, s }] the city structures by sim index
    this.last = new Map();
  }

  build() {
    if (!this.city || this.r.map.naval) return;
    const { setup, map } = this.r;
    setup.structures.forEach((s, index) => { if (CITY_KINDS.has(s.kind)) this.items.push({ index, s }); });
    const stone = STONE[this.city.ageId] || STONE.kingdoms;
    const box = this.r.track(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const mk = (n, color) => {
      const m = new InstancedMesh(box, this.r.track(new MeshLambertMaterial({ color })), Math.max(1, n));
      m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      this.r.scene.add(m);
      return m;
    };
    this.walls = mk(this.items.filter((i) => i.s.kind === 'wall' || i.s.kind === 'gate').length * 2, stone);
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
    const url = townUrlByName(this.city.townKey);
    if (url) {
      loadTownAsset(url).then((model) => {
        if (this.disposed) return;
        const inst = instanceTownAsset(model, setup.sides[1].color);
        showLod(inst, 0);
        inst.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        enableTownDamage(inst).forEach((m) => this.r.track(m));
        this.root.add(inst);
        this.town = inst;
        syncTownDamage(inst);
        this.last.clear(); // redraw the damage on the model
      }).catch((e) => { console.warn('town model failed, the battle keeps the placeholder houses:', e.message); });
    }
  }

  // Each frame: only structures whose state changed are redrawn.
  update(view) {
    if (!this.items.length) return;
    let changed = false;
    this.items.forEach(({ index }) => {
      const v = view.structures[index];
      const key = !v.alive ? 2 : v.hp < v.maxHp * 0.7 ? 1 : 0;
      if (this.last.get(index) !== key) { this.last.set(index, key); changed = true; }
    });
    if (!changed) return;
    let nw = 0; let nb = 0; let nr = 0;
    const ruined = []; const damaged = [];
    const at = (s) => { const x = s.x / Q; const z = s.y / Q; return [x, this.r.heightAt(x, z), z]; };
    this.items.forEach(({ index, s }) => {
      const state = this.last.get(index);
      const [x, y, z] = at(s);
      if (state === 2) {
        tmp.position.set(x, y, z); tmp.rotation.set(0, 0, 0);
        tmp.scale.set(Math.max(0.8, s.w), Math.max(1, Math.min(s.w, s.d) * 1.4), Math.max(0.8, s.d)); tmp.updateMatrix();
        this.rubble.setMatrixAt(nr++, tmp.matrix);
        if (s.model) ruined.push(s.model);
        return;
      }
      if (state === 1 && s.model) damaged.push(s.model);
      if (s.kind === 'wall' || s.kind === 'gate') {
        // along the ring: the segment's long side is across the line to the keep
        const yaw = Math.atan2(z - (this.r.map.keep.y + 0.5), x - (this.r.map.keep.x + 0.5));
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
      // houses and landmarks come from the town model once it is in; the palace and wonders stay boxes
      if (this.town && (s.kind === 'house' || s.kind === 'landmark')) return;
      tmp.position.set(x, y, z); tmp.rotation.set(0, 0, 0);
      tmp.scale.set(s.w * 0.9, Math.max(0.6, s.h), s.d * 0.9); tmp.updateMatrix();
      this.blocks.setMatrixAt(nb, tmp.matrix);
      this.blocks.setColorAt(nb++, tint.set(s.kind === 'palace' || s.kind === 'wonder' ? '#e7d9a8' : '#ffffff').multiplyScalar(state === 1 ? 0.55 : 1));
    });
    [[this.walls, nw], [this.blocks, nb], [this.rubble, nr]].forEach(([m, n]) => {
      m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    if (this.town) setTownDamage(this.town, ruined.map(([mx, mz, w, d]) => ({ x: mx, z: mz, w, d })), damaged.map(([mx, mz, w, d]) => ({ x: mx, z: mz, w, d })));
  }

  dispose() {
    this.disposed = true;
    if (this.root) this.r.scene.remove(this.root);
  }
}

