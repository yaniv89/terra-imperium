// src/battle/art/vegetationProps.js
// The battlefield's trees, rocks and grass from the battle's vegetation kit (S9:
// src/assets/battle/nature/vegetation-<kit>.glb, objects tree-s, tree-m, tree-l, stump, felled,
// bush, rock-s, rock-m, grass-tuft). BattleRenderer places the procedural props in instanced
// chunks; once the kit is in, every chunk of a kind keeps its instances (positions, turns, sizes,
// shades) and takes the kit object's geometry and materials at true scale. The kit's LOD follows
// the zoom (LOD0 only close up: a forest is thousands of trees). No kit file: nothing changes.
import { ART } from './artFiles';
import { loadKit, kitObject } from './kitLoader';
import { vegetationKitFor } from './vegetation';
import { CITY_TILES_PER_UNIT } from '../setup/cityBattle';

/** Which kit objects stand in for each procedural prop, first found wins. */
export const PROP_OBJECTS = { pine: ['tree-l', 'tree-m'], oak: ['tree-m', 'tree-l', 'tree-s'], rock: ['rock-m', 'rock-s'], tuft: ['grass-tuft', 'bush'] };
/** The vegetation LOD for a battle zoom: the full trees only when close. */
export const vegetationLodForZoom = (zoom) => (zoom >= 2 ? 0 : zoom >= 0.9 ? 1 : 2);

export class VegetationProps {
  constructor(r, meshes, { ref = ART.vegetation(vegetationKitFor(r.setup)), load = loadKit } = {}) {
    this.r = r; this.meshes = meshes; this.lod = -1; this.kinds = null;
    if (!ref || !Object.keys(meshes).length) return;
    this.ready = load(ref.url).then((kit) => { if (!this.disposed) this.setKit(kit); })
      .catch((e) => console.warn(`[art] ${e.message}: keeping the procedural trees`));
  }

  setKit(kit) {
    const S = CITY_TILES_PER_UNIT;
    this.kinds = {};
    Object.entries(this.meshes).forEach(([kind, list]) => {
      const obj = kitObject(kit, PROP_OBJECTS[kind] || []);
      if (!obj) return;
      // one scaled copy per LOD bundle (the kit's own geometry is shared with other users)
      const levels = obj.lods.map((b) => ({ geometry: this.r.track(b.geometry.clone().scale(S, S, S)), material: b.materials.length === 1 ? b.materials[0] : b.materials }));
      this.kinds[kind] = { list, levels };
    });
    this.lod = -1;
    this.update(this.r.camera?.zoom ?? 1);
  }

  update(zoom) {
    if (!this.kinds) return;
    const lod = vegetationLodForZoom(zoom);
    if (lod === this.lod) return;
    this.lod = lod;
    Object.values(this.kinds).forEach(({ list, levels }) => {
      const l = levels[lod] || levels[0];
      list.forEach((m) => { m.geometry = l.geometry; m.material = l.material; m.computeBoundingSphere(); m.computeBoundingBox(); });
    });
  }

  dispose() { this.disposed = true; }
}
