// src/battle/art/fxSheets.js
// Battle effect sprite sheets (plans/ART-PRODUCTION-PLAN.md S12; plans/ART-MODELS-PLAN.md 9), in
// the map sprites' format: src/assets/fx/<id>/ holds frames <id>-0.png, <id>-1.png, ... and
// sheet.json { "frame": [w, h], "frames": n, "fps": 12, "blend": "additive" | "alpha",
// "size": 1.5 (tiles across on the battlefield), "loop": false }. The ids the battle asks for:
//   fire-small    a machine or a building catching fire
//   fire-large    a building under 30% HP (loops while it burns)
//   smoke         after explosions and fires
//   dust          cavalry contact
//   muzzle-flash  gunpowder and modern shots
//   explosion     artillery and bomb impacts
//   impact-sparks melee blows
//   debris        a squad or a structure destroyed
// Each sheet is drawn by one instanced, camera-facing quad mesh; an effect plays its frames over
// its life (or loops by time). A missing sheet keeps the code's sparks and fire (BattleRenderer).
import { InstancedMesh, PlaneGeometry, ShaderMaterial, AdditiveBlending, NormalBlending, InstancedBufferAttribute, DynamicDrawUsage, CanvasTexture, SRGBColorSpace } from 'three';

export const BATTLE_FX_IDS = ['fire-small', 'fire-large', 'smoke', 'dust', 'muzzle-flash', 'explosion', 'impact-sparks', 'debris'];

/** Index sheet.json files and frames ({ path: json }, { path: url }) as { id: { ...sheet, urls } }. */
export const indexFxSheets = (sheets, frames) => {
  const out = {};
  Object.entries(sheets).forEach(([file, sheet]) => {
    const id = file.match(/fx\/([a-z0-9-]+)\/sheet\.json$/)?.[1];
    if (id && id !== 'map') out[id] = { frame: [64, 64], frames: 1, fps: 12, blend: 'alpha', size: 1.5, loop: false, ...sheet, urls: [] };
  });
  Object.entries(frames).forEach(([file, url]) => {
    const m = file.match(/fx\/([a-z0-9-]+)\/[a-z0-9-]+-(\d+)\.png$/);
    if (m && out[m[1]]) out[m[1]].urls[Number(m[2])] = url;
  });
  Object.keys(out).forEach((id) => { out[id].urls = out[id].urls.filter(Boolean); if (!out[id].urls.length) delete out[id]; else out[id].frames = out[id].urls.length; });
  return out;
};

const SHEET_FILES = import.meta.glob('../../assets/fx/*/sheet.json', { eager: true, import: 'default' });
const FRAME_FILES = import.meta.glob('../../assets/fx/*/*.png', { eager: true, query: '?url', import: 'default' });
/** The battle's delivered effect sheets. */
export const FX_SHEETS = indexFxSheets(SHEET_FILES, FRAME_FILES);

/** The atlas of a sheet's frames as one texture (a square-ish grid): { texture, cols, rows }. */
export const loadFxAtlas = (sheet) => new Promise((resolve, reject) => {
  if (typeof document === 'undefined') { reject(new Error('no document')); return; }
  const n = sheet.urls.length; const cols = Math.ceil(Math.sqrt(n)); const rows = Math.ceil(n / cols);
  const [fw, fh] = sheet.frame;
  const canvas = document.createElement('canvas'); canvas.width = cols * fw; canvas.height = rows * fh;
  const g = canvas.getContext('2d');
  let left = n;
  sheet.urls.forEach((url, i) => {
    const img = new Image();
    img.onload = () => {
      g.drawImage(img, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh);
      if (--left === 0) { const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; resolve({ texture, cols, rows }); }
    };
    img.onerror = () => reject(new Error(`${url}: frame failed`));
    img.src = url;
  });
});

const VERT = /* glsl */`
attribute float aFrame; attribute float aAlpha;
uniform vec2 uGrid;
varying vec2 vUv; varying float vAlpha;
void main() {
  float f = floor(aFrame + 0.5);
  float cx = mod(f, uGrid.x); float cy = floor(f / uGrid.x);
  vUv = vec2((uv.x + cx) / uGrid.x, 1.0 - ((1.0 - uv.y) + cy) / uGrid.y);
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv; varying float vAlpha;
void main() {
  vec4 c = texture2D(uMap, vUv);
  float a = c.a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(c.rgb, a);
}`;

const CAP = 128;

export class FxSprites {
  /** `sheets`: the delivered sheets (FX_SHEETS); `makeAtlas`: sheet -> Promise<{ texture, cols, rows }>. */
  constructor(scene, { track = (x) => x, sheets = FX_SHEETS, makeAtlas = loadFxAtlas, ids = BATTLE_FX_IDS } = {}) {
    this.scene = scene; this.track = track; this.sheets = sheets; this.layers = {}; this.ready = [];
    ids.filter((id) => sheets[id]).forEach((id) => {
      this.ready.push(Promise.resolve().then(() => makeAtlas(sheets[id])).then((atlas) => { if (!this.disposed) this.addLayer(id, atlas); })
        .catch((e) => console.warn(`[art] fx ${id}: ${e.message}, keeping the code effects`)));
    });
  }

  addLayer(id, { texture, cols, rows }) {
    const sheet = this.sheets[id];
    const geo = this.track(new PlaneGeometry(1, 1));
    const frame = new InstancedBufferAttribute(new Float32Array(CAP), 1).setUsage(DynamicDrawUsage);
    const alpha = new InstancedBufferAttribute(new Float32Array(CAP), 1).setUsage(DynamicDrawUsage);
    geo.setAttribute('aFrame', frame); geo.setAttribute('aAlpha', alpha);
    const mat = this.track(new ShaderMaterial({
      uniforms: { uMap: { value: this.track(texture) }, uGrid: { value: [cols, rows] } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: sheet.blend === 'additive' ? AdditiveBlending : NormalBlending
    }));
    const mesh = new InstancedMesh(geo, mat, CAP);
    mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 4;
    this.scene.add(mesh);
    this.layers[id] = { mesh, frame, alpha, n: 0, sheet };
  }

  /** Whether a sheet is in and drawable now. */
  has(id) { return !!this.layers[id]; }

  begin(camBasis) { this.basis = camBasis; Object.values(this.layers).forEach((l) => { l.n = 0; }); }

  /** One sprite: `k` 0..1 through its life (or `time` seconds for a looping sheet), `scale` times the sheet's size. */
  add(id, x, y, z, { k = 0, time = null, scale = 1, alpha = 1 } = {}) {
    const l = this.layers[id];
    if (!l || l.n >= CAP) return false;
    const { sheet } = l; const b = this.basis; const s = sheet.size * scale;
    const f = time != null ? Math.floor(time * sheet.fps) % sheet.frames : Math.min(sheet.frames - 1, Math.floor(k * sheet.frames));
    const a = l.mesh.instanceMatrix.array; const o = l.n * 16;
    a[o] = b[0] * s; a[o + 1] = b[1] * s; a[o + 2] = b[2] * s; a[o + 3] = 0;
    a[o + 4] = b[4] * s; a[o + 5] = b[5] * s; a[o + 6] = b[6] * s; a[o + 7] = 0;
    a[o + 8] = b[8]; a[o + 9] = b[9]; a[o + 10] = b[10]; a[o + 11] = 0;
    a[o + 12] = x; a[o + 13] = y + s * 0.4; a[o + 14] = z; a[o + 15] = 1;
    l.frame.array[l.n] = f; l.alpha.array[l.n] = alpha;
    l.n += 1;
    return true;
  }

  end() {
    Object.values(this.layers).forEach((l) => {
      l.mesh.count = l.n; l.mesh.visible = l.n > 0;
      l.mesh.instanceMatrix.needsUpdate = true; l.frame.needsUpdate = true; l.alpha.needsUpdate = true;
    });
  }

  dispose() { this.disposed = true; Object.values(this.layers).forEach((l) => { this.scene.remove(l.mesh); l.mesh.dispose(); }); }
}
