// src/battle/render/terrainSurface.js
// The battlefield's ground: how it's coloured and how it continues past the edge of the map.
//
// Feathered tile edges. The map is a grid of tiles (grass, road, sand, rock, forest…) and the
// terrain mesh has one vertex per tile corner, so colouring vertices by tile gave roads and clearings
// hard, stair-stepped voxel edges. Instead the tile types go into a small mask texture (one texel per
// tile: R road, G sand, B rock, A forest) read per PIXEL by the ground shader, bilinearly filtered and
// sampled through a value-noise warp, then thresholded with smoothstep — roads and clearings get soft,
// irregular, natural edges at any zoom, and the vertex colours are left to the grass itself.
//
// The skirt. Past the playable bounds the land carries on: rolling ground that starts exactly at the
// map's edge heights (same vertices, same function — no seam, no cliff), eases into gentle hills, and
// is coloured by the same grass palette and the same shader (a road running off the map fades out a
// few tiles later). A coast carries on as open sea. A low horizon plane beyond, and FogExp2 haze,
// melt everything into the sky.
import { DataTexture, RGBAFormat, LinearFilter, ClampToEdgeWrapping, BufferGeometry, Float32BufferAttribute, Color } from 'three';
import { TILE } from '../setup/mapgen';
import { BATTLE_TILE_TILES, GROUND_DETAIL_GLSL } from '../../data/groundMaterials';

export const SKIRT = 40; // tiles of land beyond each edge of the map

const hash01 = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t;
export const vnoise = (x, z) => {
  const ix = Math.floor(x); const iz = Math.floor(z); const fx = x - ix; const fz = z - iz;
  const h = (a, b) => hash01(a * 7919 + b * 104729);
  const sx = fx * fx * (3 - 2 * fx); const sz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h(ix, iz), h(ix + 1, iz), sx), lerp(h(ix, iz + 1), h(ix + 1, iz + 1), sx), sz);
};
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- the tile mask ---------------------------------------------------------------------------

export const buildTileMask = (map) => {
  const { w, h, tiles } = map;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const t = tiles[i];
    data[i * 4] = t === TILE.ROAD || t === TILE.BUILDING ? 255 : 0;
    data[i * 4 + 1] = t === TILE.SAND ? 255 : 0;
    data[i * 4 + 2] = t === TILE.ROCK ? 255 : 0;
    data[i * 4 + 3] = t === TILE.FOREST ? 255 : 0;
  }
  const tex = new DataTexture(data, w, h, RGBAFormat);
  tex.magFilter = LinearFilter; tex.minFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping; tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
};

// Is any tile along the map's border water (a coast / landing sea)? Then the skirt is sea there.
const edgeTile = (map, x, z) => map.tiles[Math.max(0, Math.min(map.h - 1, Math.floor(z))) * map.w + Math.max(0, Math.min(map.w - 1, Math.floor(x)))];

// Is one side of the map a real shoreline (a landing's sea), not just a river leaving the field?
export const hasCoast = (map) => {
  const { w, h, tiles } = map;
  const share = (ids) => ids.filter((i) => tiles[i] === TILE.WATER).length / ids.length;
  const side = (n, f) => Array.from({ length: n }, (_, k) => f(k));
  return [
    side(w, (x) => x), side(w, (x) => (h - 1) * w + x), side(h, (z) => z * w), side(h, (z) => z * w + w - 1)
  ].some((ids) => share(ids) >= 0.25);
};
// Where the far horizon plane sits: just under open land, or down at the sea bed on a coast.
export const horizonLevel = (coast) => (coast ? -0.95 : -0.12);

// Height of the land beyond the map: the edge height, easing over ~12 tiles into rolling hills (or
// down to the sea bed where the edge is water), and back down to the horizon plane's level over the
// skirt's last tiles so its outer rim never shows a cliff. Inside the map it IS heightAt.
export const makeSkirtHeight = (map, heightAt, { skirt = SKIRT } = {}) => {
  const coast = hasCoast(map);
  const rimLevel = coast ? -0.4 : horizonLevel(false) + 0.02;
  return (x, z) => {
    const cx = Math.max(0, Math.min(map.w, x)); const cz = Math.max(0, Math.min(map.h, z));
    const edge = heightAt(Math.min(map.w - 0.01, cx), Math.min(map.h - 0.01, cz));
    const d = Math.hypot(x - cx, z - cz);
    if (d === 0) return edge;
    const sea = edgeTile(map, cx, cz) === TILE.WATER;
    const hills = 0.15 + (vnoise(x / 16, z / 16) - 0.35) * 2.4 + (vnoise(x / 5, z / 5) - 0.5) * 0.4;
    // On a coast the land beyond the edge recedes into the sea along a wandering shoreline; inland
    // it rolls on as hills. Water at the edge (a river, or the sea) carries on as water.
    const far = sea ? -0.9 : coast ? hills - d * 0.06 - vnoise(x / 7, z / 7) * 0.8 : Math.max(-0.1, hills);
    const land = lerp(edge, far, smoothstep(0, 12, d));
    if (coast) return Math.max(-0.95, land);
    const outer = Math.max(Math.abs(x - cx), Math.abs(z - cz)); // square rings, like the skirt's rim
    return lerp(land, rimLevel, smoothstep(skirt - 12, skirt, outer));
  };
};

// The four strips of skirt around the map, as one indexed grid-strip geometry at 1 tile per quad —
// their inner rows sit exactly on the terrain's own border vertices. `colorAt(x, z, y)` → Color.
export const buildSkirtGeometry = (map, heightFn, colorAt, skirt = SKIRT) => {
  const { w, h } = map;
  const pos = []; const col = []; const uv = []; const index = [];
  const strip = (x0, x1, z0, z1) => {
    const nx = x1 - x0; const nz = z1 - z0; const base = pos.length / 3;
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = x0 + i; const z = z0 + j; const y = heightFn(x, z);
        pos.push(x, y, z);
        const c = colorAt(x, z, y); col.push(c.r, c.g, c.b);
        uv.push(x / w, 1 - z / h); // the fog-of-war texture's mapping, clamped at the edge
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = base + j * (nx + 1) + i; const b = a + 1; const c = a + nx + 1; const d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
  };
  strip(-skirt, w + skirt, -skirt, 0); // north, full width
  strip(-skirt, w + skirt, h, h + skirt); // south, full width
  strip(-skirt, 0, 0, h); // west
  strip(w, w + skirt, 0, h); // east
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
};

// ---- the ground shader -----------------------------------------------------------------------

const NOISE_GLSL = /* glsl */`
float tHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

// Patch a Lambert/Standard material so it paints roads, sand, rock and forest floor per pixel from
// the tile mask, with noisy, feathered edges. Works for the map and its skirt alike (world XZ).
// `details` ({ base, road, sand, rock, forest }: texture uniforms, data/groundMaterials.js): the
// ground material sets over each layer as detail; a layer without one compiles without it.
export const DETAIL_LAYERS = ['base', 'road', 'sand', 'rock', 'forest'];
export const patchGroundMaterial = (material, { mask, mapW, mapH, road, sand, rock, forest, details = {} }) => {
  const uniforms = {
    uTileMask: { value: mask },
    uMapSize: { value: [mapW, mapH] },
    uRoad: { value: new Color(road) }, uSand: { value: new Color(sand) },
    uRock: { value: new Color(rock) }, uForest: { value: new Color(forest) },
    uDetailRepeat: { value: 1 / BATTLE_TILE_TILES }
  };
  const layers = DETAIL_LAYERS.filter((l) => details[l]);
  layers.forEach((l) => { uniforms[`uGd_${l}`] = details[l]; });
  const defs = layers.map((l) => `#define GD_${l.toUpperCase()}\nuniform sampler2D uGd_${l};`).join('\n');
  const detail = (l) => `d_${l} = groundDetail(uGd_${l}, p * uDetailRepeat);`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec2 vGroundXZ;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
    shader.fragmentShader = `varying vec2 vGroundXZ;
uniform sampler2D uTileMask; uniform vec2 uMapSize;
uniform vec3 uRoad; uniform vec3 uSand; uniform vec3 uRock; uniform vec3 uForest; uniform float uDetailRepeat;
${defs}
${layers.length ? GROUND_DETAIL_GLSL : ''}
${NOISE_GLSL}` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 p = vGroundXZ;
        // Warp the lookup by value noise so tile borders wander instead of running dead straight.
        vec2 warp = vec2(tNoise(p * 0.9 + 3.1), tNoise(p * 0.9 + 17.7)) - 0.5;
        vec4 m = texture2D(uTileMask, (p + warp * 0.85) / uMapSize);
        // Beyond the map, the mask (clamped at the edge) fades out over a few tiles.
        vec2 outside = max(vec2(0.0), max(-p, p - uMapSize));
        m *= 1.0 - smoothstep(0.5, 3.0, length(outside));
        float grain = tNoise(p * 3.7) * 0.6 + tNoise(p * 11.0) * 0.4;
        float edgeJitter = (grain - 0.5) * 0.28;
        float roadA = smoothstep(0.34, 0.62, m.r + edgeJitter);
        float sandA = smoothstep(0.30, 0.66, m.g + edgeJitter);
        float rockA = smoothstep(0.32, 0.68, m.b + edgeJitter);
        float forestA = smoothstep(0.20, 0.80, m.a + edgeJitter * 0.6);
        vec3 d_base = vec3(1.0); vec3 d_road = vec3(1.0); vec3 d_sand = vec3(1.0); vec3 d_rock = vec3(1.0); vec3 d_forest = vec3(1.0);
        ${layers.map(detail).join('\n')}
        vec3 g = diffuseColor.rgb * d_base;
        g = mix(g, uForest * (0.9 + 0.2 * grain) * d_forest, forestA * 0.6);
        g = mix(g, uSand * (0.92 + 0.16 * grain) * d_sand, sandA * 0.85);
        g = mix(g, uRock * (0.85 + 0.3 * grain) * d_rock, rockA * 0.85);
        // Wheel ruts: roads are a touch darker along their middle.
        g = mix(g, uRoad * (0.88 + 0.24 * grain) * (1.0 - 0.08 * smoothstep(0.75, 1.0, m.r)) * d_road, roadA * 0.9);
        diffuseColor.rgb = g;
      }`);
  };
  material.customProgramCacheKey = () => `battle-ground|${layers.join(',')}`;
  return material;
};

// Where the sun's shadow box goes: centred on what's on screen, just big enough to cover it, and
// snapped to whole shadow-map texels in the light's own frame so shadows don't shimmer as you pan.
// `corners` are the ground points under the screen's corners; returns { center, radius }.
export const fitShadowBox = (corners, target, { minRadius = 10, maxRadius = 90, quantum = 4, mapSize = 2048, right, up } = {}) => {
  let r = minRadius;
  corners.forEach((c) => { if (c) r = Math.max(r, Math.hypot(c.x - target.x, c.z - target.z) + 3); });
  const radius = Math.min(maxRadius, Math.ceil(r / quantum) * quantum);
  const texel = (2 * radius) / mapSize;
  let center = { x: target.x, y: target.y || 0, z: target.z };
  if (right && up) {
    const pr = center.x * right.x + center.y * right.y + center.z * right.z;
    const pu = center.x * up.x + center.y * up.y + center.z * up.z;
    const dr = Math.round(pr / texel) * texel - pr; const du = Math.round(pu / texel) * texel - pu;
    center = { x: center.x + right.x * dr + up.x * du, y: center.y + right.y * dr + up.y * du, z: center.z + right.z * dr + up.z * du };
  }
  return { center, radius, texel };
};
