// src/battle/render/ownerMarks.js
// Whose building is it (playtest audit CB20, I209: "friendly and enemy buildings look the same").
// Every standing battle building gets a ground mark round its footprint in its side's colour, and
// the mark's SHAPE tells the sides apart without colour: the player's own buildings a closed
// square frame, the enemy's four corner brackets (a target's crosshair). Two instanced decals, two
// draw calls for every building on the field; drawn under the building, so it shows round its edge.
import { DataTexture, RGBAFormat, LinearFilter, InstancedMesh, MeshBasicMaterial, PlaneGeometry, Color } from 'three';

/**
 * A square frame alpha texture (green channel). `brackets`: only the corners, each arm `arm` of the
 * half side long. `inner`..`outer`: the band, 1 = the quad's edge (Chebyshev distance).
 */
export const frameAlpha = (u, v, { inner = 0.8, outer = 0.97, brackets = false, arm = 0.42 } = {}) => {
  const ax = Math.abs(u); const ay = Math.abs(v); const r = Math.max(ax, ay);
  if (r < inner || r > outer) return 0;
  if (!brackets) return 1;
  // a corner arm: within `arm` of a corner along the edge the point lies on
  const along = ax >= ay ? ay : ax;
  return along >= 1 - arm ? 1 : 0;
};

export const makeFrameDecal = ({ size = 64, ...opts } = {}) => {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = frameAlpha((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1, opts);
      const o = (y * size + x) * 4;
      data[o] = 255; data[o + 1] = Math.round(a * 255); data[o + 2] = 255; data[o + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
};

/** Which mark a building of `side` takes for the player on `playerSide`: 'own' or 'enemy'. */
export const ownerMarkKind = (side, playerSide) => (side === playerSide ? 'own' : 'enemy');

const tmpColor = new Color();

export class OwnerMarks {
  /** `r`: the renderer ({ scene, track, heightAt }); `capacity`: marks per kind. */
  constructor(r, capacity = 512) {
    this.r = r;
    this.sideColors = (r.setup?.sides || []).map((sd) => new Color(sd.color || '#ffffff'));
    const make = (brackets, opacity) => {
      const mat = r.track(new MeshBasicMaterial({ color: '#ffffff', alphaMap: r.track(makeFrameDecal(brackets ? { brackets: true, inner: 0.78 } : { inner: 0.84 })), transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false }));
      const m = new InstancedMesh(r.track(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat, capacity);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 1;
      m.setColorAt(0, tmpColor.set('#ffffff'));
      r.scene.add(m);
      return m;
    };
    this.meshes = { own: make(false, 0.85), enemy: make(true, 0.95) };
    this.n = { own: 0, enemy: 0 };
  }

  begin() { this.n.own = 0; this.n.enemy = 0; }

  /** A mark round a footprint `size` tiles across, centred at (x, z); `color` a three Color. */
  add(kind, x, z, size, color) {
    const m = this.meshes[kind]; const k = this.n[kind];
    if (k >= m.instanceMatrix.count) return;
    const s = size + 0.6;
    const a = m.instanceMatrix.array; const o = k * 16;
    a[o] = s; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
    a[o + 4] = 0; a[o + 5] = 1; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = s; a[o + 11] = 0;
    a[o + 12] = x; a[o + 13] = this.r.heightAt(x, z) + 0.06; a[o + 14] = z; a[o + 15] = 1;
    m.setColorAt(k, color);
    this.n[kind] = k + 1;
  }

  /** The mark of a building of battle side `side` (the player's side is `r.playerSide`). */
  mark(side, x, z, size) {
    const c = this.sideColors[side];
    if (c) this.add(ownerMarkKind(side, this.r.playerSide ?? 0), x, z, size, c);
  }

  end() {
    Object.entries(this.meshes).forEach(([kind, m]) => {
      m.count = this.n[kind]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }
}
