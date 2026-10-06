// src/data/groundMaterials.js
// Ground materials (plans/ART-PRODUCTION-PLAN.md S10, plans/ART-MODELS-PLAN.md 8.1): tileable
// 1024 px sets in src/assets/terrain/<id>/ (README.md there), read with import.meta.glob:
//   color.webp  base colour with the ambient occlusion baked in (sRGB)
//   normal.png  tangent-space normal map
//   orm.png     R occlusion, G roughness, B metalness
// Ids: grass, dry-soil, desert-sand, rock, snow, wet-soil, paving, steppe-grass. A set needs its
// color.webp to count; normal and orm are indexed for the lit ground to come (not drawn yet).
// Both ground shaders use a set as DETAIL over their own colours: the texture divided by its own
// average colour (its smallest mip), so the game's palette stays and the material adds its grain:
//   battle ground (battle/render/terrainSurface.js)  the open ground, roads, sand, rock and forest
//     floor each take a set, one repeat every BATTLE_TILE_TILES battle tiles;
//   close view (components/map/closeView/terrainShader.js)  by land class (grass, steppe, desert,
//     rock, wetland, snow), one repeat every CLOSE_TILE_KM, fading in as it grows on screen.
// No files: neither shader compiles the detail in (the same programs as before).
import { DataTexture, RGBAFormat, RepeatWrapping, SRGBColorSpace, LinearMipmapLinearFilter, TextureLoader } from 'three';

export const GROUND_MATERIAL_IDS = ['grass', 'dry-soil', 'desert-sand', 'rock', 'snow', 'wet-soil', 'paving', 'steppe-grass'];
// A set and the sets standing in for it while it is missing.
export const GROUND_FALLBACK = { 'steppe-grass': 'grass', 'dry-soil': 'desert-sand', paving: 'rock', 'wet-soil': 'dry-soil', snow: null };
export const BATTLE_TILE_TILES = 4; // battle tiles per repeat (14 m)
export const CLOSE_TILE_KM = 0.6;   // km per repeat in the close view

/** Index { path: url } as { id: { color, normal, orm } } (sets with a color only). */
export const indexGroundMaterials = (files) => {
  const out = {};
  Object.entries(files).forEach(([path, url]) => {
    const m = path.match(/terrain\/([a-z0-9-]+)\/(color|normal|orm)\.(webp|png)$/);
    if (m) (out[m[1]] ||= {})[m[2]] = url;
  });
  Object.keys(out).forEach((id) => { if (!out[id].color) delete out[id]; });
  return out;
};
const FILES = import.meta.glob('../assets/terrain/*/*.{webp,png}', { query: '?url', import: 'default', eager: true });
export const GROUND_MATERIALS = indexGroundMaterials(FILES);

/** The set for an id along its fallback chain, or null. */
export const groundMaterial = (id, index = GROUND_MATERIALS) => {
  for (let k = id, n = 0; k && n < 6; k = GROUND_FALLBACK[k], n++) if (index[k]) return { id: k, ...index[k] };
  return null;
};

// The battle ground's layers by battle terrain: the open ground's set, then roads, sand, rock, forest floor.
const BATTLE_BASE = { arctic: 'snow', desert: 'desert-sand', plains: 'steppe-grass', urban: 'grass' };
/** { base, road, sand, rock, forest } -> a set or null each, for a battle terrain. */
export const battleGroundSets = (terrain, { urban = false, index = GROUND_MATERIALS } = {}) => ({
  base: groundMaterial(BATTLE_BASE[terrain] || 'grass', index),
  road: groundMaterial(urban || terrain === 'urban' ? 'paving' : 'dry-soil', index),
  sand: groundMaterial(terrain === 'arctic' ? 'snow' : 'desert-sand', index),
  rock: groundMaterial('rock', index),
  forest: groundMaterial('wet-soil', index)
});
/** The close view's land classes and their sets. */
export const CLOSE_CLASSES = { Grass: 'grass', Steppe: 'steppe-grass', Desert: 'desert-sand', Rock: 'rock', Wet: 'wet-soil', Snow: 'snow' };

// ---- textures ------------------------------------------------------------------------------------
let white = null;
/** A 1x1 white texture: the detail of a set still loading (divided by itself: no change). */
export const whiteTexture = () => {
  if (!white) { white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat); white.needsUpdate = true; }
  return white;
};
const loaded = new Map(); // url -> { value } (a uniform: the white texture, then the image)
/** A uniform holding a set's colour texture: white at once, the tiling image once it loads. */
export const groundTextureUniform = (url) => {
  if (!url) return { value: whiteTexture() };
  if (!loaded.has(url)) {
    const u = { value: whiteTexture() };
    loaded.set(url, u);
    if (typeof document !== 'undefined') {
      new TextureLoader().loadAsync(url).then((t) => {
        t.wrapS = RepeatWrapping; t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace;
        t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
        u.value = t;
      }).catch((e) => console.warn(`[art] ground material ${url}: ${e.message}`));
    }
  }
  return loaded.get(url);
};

/** GLSL: a set's detail at p (texture repeats per unit of p), its average colour divided out. */
export const GROUND_DETAIL_GLSL = /* glsl */`
vec3 groundDetail(sampler2D t, vec2 p) {
  vec3 c = texture2D(t, p).rgb;
  vec3 m = textureLod(t, vec2(0.5), 12.0).rgb;
  return clamp(c / max(m, vec3(0.04)), 0.0, 2.0);
}`;
