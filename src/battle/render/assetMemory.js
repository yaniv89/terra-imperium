// src/battle/render/assetMemory.js
// What the model files cost in memory, and how it is kept within a phone's means (the iPhone crash
// hunt: iOS kills a page that goes over its memory limit, the home-screen app reloads it, and after
// a few such reloads Safari shows "A problem repeatedly occurred").
// Every town, building and battle kit file carries three 2048 x 2048 maps (colour, normal, ORM):
// about 64 MB decoded per file, and the close view and the battles load dozens of files. So:
//   - textureCap(): the largest texture side a device keeps. 2048 on a desktop, 1024 on a touch
//     device (a phone or tablet: a quarter of the memory; at a phone's model sizes on screen the
//     difference does not show). The maps are scaled down once at load (capSceneTextures) and the
//     decoded full-size ImageBitmap is closed (three.js never closes one: they are not collected).
//   - on a touch device the CPU copy of each map goes once it is on the GPU (releaseAfterUpload):
//     a 64 px stand-in stays, so a texture uploaded again (a context restored, a file dropped
//     while still drawn) comes back blurred, never black.
//   - createAssetLru(): the loaded files by their decoded bytes. Past the budget the files not
//     used for a while are dropped: geometry, materials and textures disposed, bitmaps closed,
//     and the caches built on them (kits, town objects) told to forget them.
// Pure helpers here; gltfUnitLoader.js (loadGltf) uses them.

/** The largest texture side to keep: 1024 on touch devices (phones, tablets), 2048 elsewhere. */
export const textureCap = (win = typeof window !== 'undefined' ? window : null) => {
  try {
    if (win?.matchMedia?.('(pointer: coarse)').matches) return 1024;
  } catch { /* no media queries: a desktop */ }
  return 2048;
};

/** The decoded bytes budget for model files: 160 MB on touch devices, 640 MB elsewhere. */
export const assetBudget = (cap = textureCap()) => (cap <= 1024 ? 160 : 640) * 1048576;

const texturesOf = (scene) => {
  const out = new Set();
  scene?.traverse?.((o) => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (!m) return;
      Object.keys(m).forEach((k) => { const v = m[k]; if (v && v.isTexture) out.add(v); });
    });
  });
  return out;
};
const materialsOf = (scene) => {
  const out = new Set();
  scene?.traverse?.((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && out.add(m)); });
  return out;
};
const sizeOf = (img) => ({ w: img?.width || img?.naturalWidth || 0, h: img?.height || img?.naturalHeight || 0 });
const closeImage = (img) => { try { if (typeof img?.close === 'function') img.close(); } catch { /* already closed */ } };

export const STAND_IN_PX = 64;
/** After its first upload, swap a texture's full image for a STAND_IN_PX copy and free the full one. */
export const releaseAfterUpload = (tex, makeCanvas = defaultCanvas) => {
  const before = tex.onUpdate;
  tex.onUpdate = (t) => {
    t.onUpdate = before || null;
    before?.(t);
    const img = t.image;
    const { w, h } = sizeOf(img);
    if (!w || !h || Math.max(w, h) <= STAND_IN_PX) return;
    const s = STAND_IN_PX / Math.max(w, h);
    const small = makeCanvas?.(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
    const ctx = small?.getContext?.('2d');
    if (!ctx) return;
    try { ctx.drawImage(img, 0, 0, small.width, small.height); } catch { return; }
    t.image = small; // (no needsUpdate: the GPU keeps the full one)
    closeImage(img);
    if (img && typeof img.getContext === 'function') { img.width = 0; img.height = 0; } // a canvas: its pixels go
  };
};

/**
 * Scale every texture of a loaded glTF scene down to at most `cap` pixels a side (aspect kept),
 * drawn through a 2D canvas (`makeCanvas(w, h)`), and close the decoded full-size bitmap.
 * `release`: the CPU copy goes once uploaded (releaseAfterUpload).
 * Returns the decoded bytes the scene holds afterwards (GPU with mipmaps, plus the CPU copy unless released).
 */
export const capSceneTextures = (scene, cap, makeCanvas = defaultCanvas, { release = false } = {}) => {
  let bytes = 0;
  texturesOf(scene).forEach((tex) => { bytes += capTexture(tex, cap, makeCanvas, { release }); });
  return Math.round(bytes);
};
/** One texture to at most `cap` a side (capSceneTextures); returns its decoded bytes. */
export const capTexture = (tex, cap, makeCanvas = defaultCanvas, { release = false } = {}) => {
  const img = tex.image;
  const { w, h } = sizeOf(img);
  if (!w || !h) return 0;
  let nw = w; let nh = h;
  if (Math.max(w, h) > cap) {
    const s = cap / Math.max(w, h);
    nw = Math.max(1, Math.round(w * s)); nh = Math.max(1, Math.round(h * s));
    const canvas = makeCanvas?.(nw, nh);
    const ctx = canvas?.getContext?.('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, nw, nh);
      closeImage(img);
      tex.image = canvas;
      tex.needsUpdate = true;
    } else { nw = w; nh = h; }
  }
  if (release) releaseAfterUpload(tex, makeCanvas);
  return nw * nh * 4 * ((release ? 0 : 1) + 4 / 3);
};
function defaultCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/** Free a loaded glTF: geometry, materials and textures disposed, bitmaps closed. */
export const disposeGltf = (gltf) => {
  const scene = gltf?.scene;
  if (!scene) return;
  const textures = texturesOf(scene);
  const materials = materialsOf(scene);
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
  materials.forEach((m) => m.dispose?.());
  textures.forEach((t) => { t.dispose?.(); closeImage(t.image); });
};

/**
 * The loaded files, newest use last. `touch(key)` on every use; `add(key, value, bytes)` when a
 * file is in; `trim()` drops the least recently used files over `budget` bytes that were not used
 * in the last `keepMs` (a file a battle or the close view is drawing right now stays), calling
 * `onEvict(key, value)` for each.
 */
export const createAssetLru = ({ budget, keepMs = 15000, now = () => Date.now(), onEvict = () => {} } = {}) => {
  const entries = new Map(); // key -> { value, bytes, used }
  let total = 0;
  const lru = {
    get size() { return entries.size; },
    get bytes() { return total; },
    has: (key) => entries.has(key),
    touch(key) { const e = entries.get(key); if (e) { e.used = now(); entries.delete(key); entries.set(key, e); } },
    add(key, value, bytes = 0) {
      const old = entries.get(key); if (old) total -= old.bytes;
      entries.delete(key);
      entries.set(key, { value, bytes, used: now() });
      total += bytes;
    },
    remove(key) { const e = entries.get(key); if (!e) return; entries.delete(key); total -= e.bytes; onEvict(key, e.value); },
    /** Drop old files until within `limit` (default: the budget). Returns the keys dropped. */
    trim(limit = budget, { force = false } = {}) {
      const dropped = [];
      const t = now();
      for (const [key, e] of [...entries]) {
        if (total <= limit) break;
        if (!force && t - e.used < keepMs) continue;
        lru.remove(key);
        dropped.push(key);
      }
      return dropped;
    },
    /** Drop every file (a lost WebGL context, a battle's end on a phone). */
    clear() { [...entries.keys()].forEach((k) => lru.remove(k)); }
  };
  return lru;
};
