// src/battle/art/kitInstances.js
// Every copy of a kit piece (kitLoader.js) drawn by one InstancedMesh per piece and LOD, written
// fresh each frame like the greyboxes they replace: begin(), add(...) per copy, end(). A piece's
// Team material takes the per-copy colour (the side's colour); its other materials (Town, Ground)
// ignore it, unless `tintAll` (trees and rocks take a per-copy shade). Meshes grow when a frame
// asks for more copies than they hold, and hide when nothing uses them (no empty draw calls).
import { InstancedMesh, Color, ShaderChunk } from 'three';

const WHITE = new Color('#ffffff');
const patched = new Map(); // material uuid -> clone that ignores the instance colour
// The colour chunk without the instance colour, for the materials that keep their own colours.
const NO_INSTANCE_COLOR = ShaderChunk.color_vertex.replace(/#ifdef USE_INSTANCING_COLOR[\s\S]*?#endif/, '');
/** A copy of `m` that ignores instanceColor (the Town and Ground parts of a piece). */
export const ignoreInstanceColor = (m) => {
  if (!patched.has(m.uuid)) {
    const c = m.clone();
    c.onBeforeCompile = (shader) => { shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', NO_INSTANCE_COLOR); };
    c.customProgramCacheKey = () => 'kit-no-instance-color';
    patched.set(m.uuid, c);
  }
  return patched.get(m.uuid);
};

export class KitInstances {
  /** `parent`: the scene or group; `track`: the renderer's disposal list. */
  constructor(parent, { track = (x) => x, castShadow = true, receiveShadow = true, tintAll = false, initial = 16 } = {}) {
    Object.assign(this, { parent, track, castShadow, receiveShadow, tintAll, initial });
    this.meshes = new Map(); // bundle -> { mesh, n }
  }

  meshFor(bundle, need) {
    let e = this.meshes.get(bundle);
    if (e && e.mesh.instanceMatrix.count >= need) return e;
    const cap = Math.max(this.initial, need, e ? e.mesh.instanceMatrix.count * 2 : 0);
    const mats = bundle.materials.map((m, i) => (this.tintAll || bundle.team[i] ? m : ignoreInstanceColor(m)));
    const mesh = new InstancedMesh(bundle.geometry, mats.length === 1 ? mats[0] : mats, cap);
    mesh.setColorAt(0, WHITE);
    mesh.frustumCulled = false; mesh.castShadow = this.castShadow; mesh.receiveShadow = this.receiveShadow;
    if (e) {
      mesh.instanceMatrix.array.set(e.mesh.instanceMatrix.array.subarray(0, e.n * 16));
      mesh.instanceColor.array.set(e.mesh.instanceColor.array.subarray(0, e.n * 3));
      this.parent.remove(e.mesh); e.mesh.dispose();
    } else this.track(mesh);
    this.parent.add(mesh);
    const next = { mesh, n: e ? e.n : 0 };
    this.meshes.set(bundle, next);
    return next;
  }

  begin() { this.meshes.forEach((e) => { e.n = 0; }); }

  /** One copy of `obj` (a kit object) at `lod` (0..2) with `matrix` (a Matrix4) and `color`
   * (a Color for the Team parts, or null for white). */
  add(obj, lod, matrix, color = null) {
    const bundle = obj?.lods[Math.max(0, Math.min(2, lod))] || obj?.lods[0];
    if (!bundle) return;
    const prev = this.meshes.get(bundle);
    const e = this.meshFor(bundle, (prev ? prev.n : 0) + 1);
    e.mesh.setMatrixAt(e.n, matrix);
    e.mesh.setColorAt(e.n, color || WHITE);
    e.n += 1;
  }

  end() {
    this.meshes.forEach(({ mesh, n }) => {
      mesh.count = n; mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  /** How many copies are drawn now, and the draw calls they cost (for tests and the perf overlay). */
  stats() {
    let copies = 0; let draws = 0;
    this.meshes.forEach(({ mesh, n }) => { if (n) { copies += n; draws += Math.max(1, mesh.geometry.groups.length); } });
    return { copies, draws };
  }

  dispose() { this.meshes.forEach(({ mesh }) => { this.parent.remove(mesh); mesh.dispose(); }); this.meshes.clear(); }
}
