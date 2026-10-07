// src/components/map/gl/glLayers.js
// The layers of the WebGL map (GLMapView.jsx), each a few three.js objects in one renderer:
//   raster     the realistic Earth: the whole-world picture and the pyramid tiles on screen
//              (rasterTiles.js), drawn plain, or through the close view's terrain shader
//              (closeView/terrainShader.js) from the close zoom; copies east and west of the world
//              so the map wraps;
//   territory  one full-screen pass (territoryShader.js);
//   sprites    instanced quads from the atlas (spriteAtlas.js): badges, names, banners, glyphs;
//   lines      instanced screen-width segments: roads, march routes, trade routes, lens circles.
// Sprites and lines take a world anchor and screen-pixel offsets and sizes, so panning moves no
// vertex: only the view uniforms change. Each anchor is drawn at the copy of the world nearest the
// view's centre, which is the east-west wrap.
import {
  Mesh, PlaneGeometry, ShaderMaterial, DataTexture, RGBAFormat, RedFormat, FloatType, UnsignedByteType,
  NearestFilter, LinearFilter, LinearMipmapLinearFilter, ClampToEdgeWrapping, RepeatWrapping, TextureLoader, CanvasTexture, GLSL3,
  InstancedBufferGeometry, InstancedBufferAttribute, DynamicDrawUsage, Vector2, Vector3, Vector4, Scene, WebGLRenderTarget, Color, DoubleSide
} from 'three';
import { wrapNear } from './mapView';
import { TERRITORY_VERTEX, TERRITORY_FRAGMENT } from './territoryShader';
import { DATA_W, LOOKUP_W, LOOKUP_H } from './tileGpuData';
import { CITY_W } from './territoryData';
import { TERRAIN_VERTEX, TERRAIN_FRAGMENT, pxPerKm, closeGroundSetup } from '../closeView/terrainShader';
import { rasterTileUrl, rasterZoomFor, RASTER_MAX_Z, RASTER_TILE } from '../../../data/geo/rasterTiles';
import { loadDetailIndex, bestColourTile, coverTileUrl } from '../../../data/geo/rasterDetail';

const dataTexture = (data, w, h, format, type) => {
  const t = new DataTexture(data, w, h, format, type);
  t.minFilter = NearestFilter; t.magFilter = NearestFilter; t.generateMipmaps = false;
  t.wrapS = ClampToEdgeWrapping; t.wrapT = ClampToEdgeWrapping; t.flipY = false;
  t.needsUpdate = true;
  return t;
};

// ------------------------------------------------------------------ territory
const fogTexture = (data, w, h) => {
  const t = dataTexture(data, w, h, RGBAFormat, UnsignedByteType);
  t.minFilter = LinearFilter; t.magFilter = LinearFilter; t.wrapS = RepeatWrapping;
  return t;
};
export const createTerritoryLayer = (scene, grid) => {
  const centres = dataTexture(grid.centres, DATA_W, grid.rows, RGBAFormat, FloatType);
  const neigh = dataTexture(grid.neighbours, DATA_W, grid.neighbourRows, RGBAFormat, FloatType);
  const lookup = dataTexture(grid.lookup, LOOKUP_W, LOOKUP_H, RedFormat, FloatType);
  const empty = () => dataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
  const uniforms = {
    uCentres: { value: centres }, uNeigh: { value: neigh }, uLookup: { value: lookup },
    uTile: { value: empty() }, uCity: { value: empty() }, uFog: { value: fogTexture(new Uint8Array(4), 1, 1) }, uTint: { value: dataTexture(new Uint8Array(4), 1, 1, RGBAFormat, UnsignedByteType) },
    uView: { value: new Vector4() }, uViewport: { value: new Vector2(1, 1) }, uProj: { value: new Vector4() },
    uK: { value: 1 }, uDpr: { value: 1 }, uHex: { value: 0 }, uCityDetail: { value: 0 }, uNationHalf: { value: 0.55 },
    uSelTile: { value: -1 }, uTintOn: { value: 0 }, uFogOn: { value: 0 }
  };
  const material = new ShaderMaterial({
    glslVersion: GLSL3, vertexShader: TERRITORY_VERTEX, fragmentShader: TERRITORY_FRAGMENT, uniforms,
    transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false; mesh.renderOrder = 10;
  scene.add(mesh);
  const swap = (name, data, w, h, format, type) => {
    const old = uniforms[name].value;
    if (old.image?.width === w && old.image?.height === h && old.image.data.length === data.length) { old.image.data = data; old.needsUpdate = true; return; }
    uniforms[name].value = dataTexture(data, w, h, format, type);
    old.dispose();
  };
  const layer = {
    mesh,
    version: 0,
    setTiles: ({ data, rows }) => { swap('uTile', data, DATA_W, rows, RGBAFormat, FloatType); layer.version += 1; },
    setCities: ({ data, rows }) => { swap('uCity', data, CITY_W, rows, RGBAFormat, FloatType); layer.version += 1; },
    setTints: ({ data, rows }) => { swap('uTint', data, DATA_W, rows, RGBAFormat, UnsignedByteType); layer.version += 1; },
    // the soft fog edge (fogField.js): sampled bilinearly, wrapping east to west
    setFog: ({ data, width, height }) => {
      const old = uniforms.uFog.value;
      if (old.image?.width === width && old.image?.height === height) { old.image.data = data; old.needsUpdate = true; } else { uniforms.uFog.value = fogTexture(data, width, height); old.dispose(); }
      layer.version += 1;
    },
    update: (v, opts) => {
      uniforms.uView.value.set(v.worldLeft, v.worldTop, 1 / v.k, 0);
      uniforms.uViewport.value.set(v.width, v.height);
      uniforms.uProj.value.set(v.proj.cx, v.proj.cy, v.proj.s, 0);
      uniforms.uK.value = v.k; uniforms.uDpr.value = v.dpr;
      Object.entries(opts).forEach(([key, value]) => { uniforms[key].value = value; });
    },
    dispose: () => {
      scene.remove(mesh); mesh.geometry.dispose(); material.dispose();
      [centres, neigh, lookup, uniforms.uTile.value, uniforms.uCity.value, uniforms.uTint.value, uniforms.uFog.value].forEach((t) => t.dispose());
    }
  };
  return layer;
};

// ------------------------------------------------------------------ the territory pass, cached
// The territory shader does real work per pixel (the tile search, six edges); a phone's GPU should
// not run it every frame of a pan. Once the zoom has settled it is drawn once into a texture over
// the screen plus CACHE_MARGIN round it, and panning draws that texture as one quad until the view
// leaves it, the zoom changes or anything it shows changes (then it is drawn live, and cached again).
export const CACHE_MARGIN = 0.3;
const COMPOSITE_FRAGMENT = 'uniform sampler2D uMap; varying vec2 vUv; void main() { gl_FragColor = texture2D(uMap, vUv); }';
export const createTerritoryCache = (territory) => {
  const scene = new Scene(); // the live pass: the territory mesh alone
  scene.add(territory.mesh);
  const quadScene = new Scene();
  const target = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false });
  const material = new ShaderMaterial({ vertexShader: TERRAIN_VERTEX, fragmentShader: COMPOSITE_FRAGMENT, uniforms: { uMap: { value: target.texture } }, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false });
  const quad = new Mesh(new PlaneGeometry(1, 1).translate(0.5, -0.5, 0), material);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const clear = new Color();
  let cache = null; // { key, k, left, top, w, h }
  const fits = (v, key) => {
    if (!cache || cache.key !== key || cache.k !== v.k) return false;
    const left = wrapNear(cache.left, v.worldLeft, v.worldW);
    return v.worldLeft >= left && v.worldLeft + v.width / v.k <= left + cache.w && v.worldTop >= cache.top && v.worldTop + v.height / v.k <= cache.top + cache.h;
  };
  return {
    /** Draws the territories for view `v` (the shader's `opts`): from the cache when it fits, else live; caches when `settled`. */
    draw: (renderer, camera, v, opts, settled) => {
      const key = `${territory.version}|${JSON.stringify(opts)}|${v.width}x${v.height}@${v.dpr}`;
      if (!fits(v, key) && settled) {
        const m = CACHE_MARGIN; const w = v.width * (1 + 2 * m); const h = v.height * (1 + 2 * m);
        const pw = Math.min(4096, Math.round(w * v.dpr)); const ph = Math.min(4096, Math.round(h * v.dpr));
        const area = { ...v, worldLeft: v.worldLeft - (m * v.width) / v.k, worldTop: v.worldTop - (m * v.height) / v.k, width: w, height: h, dpr: pw / w };
        target.setSize(pw, ph);
        territory.update(area, opts);
        const before = renderer.getRenderTarget(); const alpha = renderer.getClearAlpha(); renderer.getClearColor(clear);
        renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
        renderer.render(scene, camera);
        renderer.setRenderTarget(before); renderer.setClearColor(clear, alpha);
        cache = { key, k: v.k, left: area.worldLeft, top: area.worldTop, w: w / v.k, h: h / v.k };
      }
      if (fits(v, key)) {
        quad.position.set(wrapNear(cache.left, v.worldLeft, v.worldW), -cache.top, 0);
        quad.scale.set(cache.w, cache.h, 1);
        renderer.render(quadScene, camera);
        return 'cached';
      }
      territory.update(v, opts);
      renderer.render(scene, camera);
      return 'live';
    },
    dispose: () => { target.dispose(); material.dispose(); quad.geometry.dispose(); }
  };
};

// ------------------------------------------------------------------ raster
const TILE_CACHE = 160;
// Level 6 is drawn once level 5's pixels would show this much larger than the screen's.
export const DETAIL_FROM_MAG = 1.25;
const prepare = (texture, mip) => {
  texture.magFilter = LinearFilter; texture.minFilter = mip ? LinearMipmapLinearFilter : LinearFilter; texture.generateMipmaps = !!mip;
  texture.wrapS = ClampToEdgeWrapping; texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};
// Textures pass through untouched (no colour space conversion), as the old SVG and close terrain drew them.
const plainMaterial = (texture) => new ShaderMaterial({
  vertexShader: TERRAIN_VERTEX,
  fragmentShader: 'uniform sampler2D uMap; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uMap, vUv).rgb, 1.0); }',
  uniforms: { uMap: { value: texture } }, depthTest: false, depthWrite: false
});
let noCover = null; // a 1x1 'water' texel for terrain materials without a land cover tile
const emptyCover = () => (noCover ||= dataTexture(new Uint8Array(4), 1, 1, RGBAFormat, UnsignedByteType));
const GROUND = closeGroundSetup(); // ground material sets as detail, where delivered (terrainShader.js)
const terrainMaterial = (texture, size, geo) => new ShaderMaterial({
  vertexShader: TERRAIN_VERTEX, fragmentShader: TERRAIN_FRAGMENT, defines: { ...GROUND.defines },
  uniforms: { uMap: { value: texture }, uSize: { value: new Vector2(size[0], size[1]) }, uGeo: { value: new Vector4(...geo) }, uPxPerKm: { value: 1 }, uCover: { value: emptyCover() }, uCoverOn: { value: 0 }, uRiverOff: { value: 0 }, ...GROUND.uniforms },
  depthTest: false, depthWrite: false
});
// A land cover tile (rasterDetail.js): one class byte a pixel in the red channel, read nearest.
const prepareCover = (texture) => {
  texture.magFilter = NearestFilter; texture.minFilter = NearestFilter; texture.generateMipmaps = false;
  texture.wrapS = ClampToEdgeWrapping; texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};

/**
 * The Earth. `update(view)` places the world picture's copies and the pyramid tiles for the view
 * (level by zoom, through the terrain shader from `closeK`). `onReady(true)` once the world picture
 * is in. Calls `request()` when a texture arrives.
 * Phase F: past the pyramid's level RASTER_MAX_Z the detail levels of rasterDetail.js (level 6,
 * land tiles only) stream in per view, each over its level 5 parent (bestColourTile), which is
 * drawn wherever a level 6 tile is missing (open sea, the poles) or still loading. In the close
 * view each tile also gets its land cover tile (same level and place) for the terrain shader.
 */
export const createRasterLayer = (scene, { request, onReady }) => {
  const quad = new PlaneGeometry(1, 1).translate(0.5, -0.5, 0); // top-left corner at the origin
  const loader = new TextureLoader();
  const r = { world: null, tiles: new Map(), disposed: false, detail: null, stats: { level: 0, tiles: 0, fallback: 0 } };
  loadDetailIndex().then((index) => { if (!r.disposed && index) { r.detail = index; request(); } });
  const setWorld = (url, size) => {
    if (r.world?.url === url) return;
    loader.load(url, (texture) => {
      if (r.disposed) { texture.dispose(); return; }
      prepare(texture, true);
      if (r.world) { r.world.meshes.forEach((m) => scene.remove(m)); r.world.plain.dispose(); r.world.terrain.dispose(); r.world.texture.dispose(); }
      const plain = plainMaterial(texture);
      const terrain = terrainMaterial(texture, [size, size / 2], [-180, 90, 360, 180]);
      const meshes = [-1, 0, 1].map(() => { const m = new Mesh(quad, plain); m.renderOrder = 0; m.frustumCulled = false; scene.add(m); return m; });
      r.world = { url, texture, plain, terrain, meshes };
      request(); onReady?.(true);
    }, undefined, () => onReady?.(false));
  };
  const tileEntry = (z, x, y) => {
    const key = `${z}/${x}-${y}`;
    let e = r.tiles.get(key);
    if (!e) {
      e = { key, z, x, y, texture: null, plain: null, terrain: null, cover: null, coverAsked: false, meshes: [], used: 0 };
      r.tiles.set(key, e);
      loader.load(rasterTileUrl(z, x, y), (texture) => {
        if (r.disposed || !r.tiles.has(key)) { texture.dispose(); return; }
        e.texture = prepare(texture, false);
        e.plain = plainMaterial(texture);
        const cols = 2 ** (z + 1); const rows = 2 ** z;
        e.terrain = terrainMaterial(texture, [RASTER_TILE, RASTER_TILE], [-180 + (x * 360) / cols, 90 - (y * 180) / rows, 360 / cols, 180 / rows]);
        if (e.cover) { e.terrain.uniforms.uCover.value = e.cover; e.terrain.uniforms.uCoverOn.value = 1; }
        request();
      }, undefined, () => { e.failed = true; });
    }
    return e;
  };
  // The land cover of a tile, asked for once (the close view only); no cover tile = all water.
  const coverFor = (e) => {
    if (e.coverAsked || !r.detail?.hasCover(e.z, e.x, e.y)) return;
    e.coverAsked = true;
    loader.load(coverTileUrl(e.z, e.x, e.y), (texture) => {
      if (r.disposed || !r.tiles.has(e.key)) { texture.dispose(); return; }
      e.cover = prepareCover(texture);
      if (e.terrain) { e.terrain.uniforms.uCover.value = e.cover; e.terrain.uniforms.uCoverOn.value = 1; }
      request();
    }, undefined, () => {});
  };
  const update = (v, { closeK, baseZ, worldUrl, worldSize }) => {
    setWorld(worldUrl, worldSize);
    const close = v.k >= closeK;
    const rr = v.raster; // { x, y, width, height } of the world in world units
    const perKm = pxPerKm(rr.width, v.k, v.dpr);
    if (r.world) {
      const mat = close ? r.world.terrain : r.world.plain;
      if (close) r.world.terrain.uniforms.uPxPerKm.value = perKm;
      r.world.meshes.forEach((m, i) => {
        m.material = mat;
        m.position.set(rr.x + (i - 1) * rr.width + v.copyShift, -rr.y, 0);
        m.scale.set(rr.width, rr.height, 1);
      });
    }
    // the level for this zoom (none while the world picture is as sharp): the pyramid's, then the
    // detail levels where the screen's pixels are finer than level RASTER_MAX_Z
    const need = Math.ceil(Math.log2(Math.max(1, rr.width * v.k * v.dpr) / (RASTER_TILE * 2)));
    // (a detail level only once level RASTER_MAX_Z would be magnified by DETAIL_FROM_MAG or more)
    const mag = (rr.width * v.k * v.dpr) / (RASTER_TILE * 2 ** (RASTER_MAX_Z + 1));
    const z = r.detail && need > RASTER_MAX_Z && mag >= DETAIL_FROM_MAG ? Math.min(r.detail.maxZ, need) : close ? RASTER_MAX_Z : rasterZoomFor(rr.width * v.k * v.dpr);
    const tilesOn = close || z > baseZ;
    r.tiles.forEach((e) => { e.meshes.forEach((m) => { m.visible = false; }); });
    r.stats = { level: tilesOn ? z : 0, tiles: 0, fallback: 0 };
    if (tilesOn) {
      const cols = 2 ** (z + 1); const rows = 2 ** z;
      const tw = rr.width / cols; const th = rr.height / rows;
      const x0 = Math.floor((v.worldLeft - rr.x) / tw) - 1; const x1 = Math.floor((v.worldLeft + v.width / v.k - rr.x) / tw) + 1;
      const y0 = Math.max(0, Math.floor((v.worldTop - rr.y) / th) - 1); const y1 = Math.min(rows - 1, Math.floor((v.worldTop + v.height / v.k - rr.y) / th) + 1);
      const now = performance.now();
      // one tile drawn at world copy `copy` (its own level's columns), over its parents when `order` is 2
      const draw = (e, copy, order) => {
        const zc = 2 ** (e.z + 1); const zr = 2 ** e.z;
        const w = rr.width / zc; const h = rr.height / zr;
        const slot = e.meshes.find((m) => !m.visible) || (() => { const m = new Mesh(quad, e.plain); m.frustumCulled = false; scene.add(m); e.meshes.push(m); return m; })();
        slot.renderOrder = order;
        slot.material = close ? e.terrain : e.plain;
        if (close) { e.terrain.uniforms.uPxPerKm.value = perKm; coverFor(e); }
        // a hair of overlap so no seam shows the ocean under the tiles
        slot.position.set(rr.x + (copy * zc + e.x) * w, -(rr.y + e.y * h), 0);
        slot.scale.set(w * 1.003, h * 1.003, 1);
        slot.visible = true;
        r.stats.tiles += 1;
      };
      const parents = new Set();
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const col = ((tx % cols) + cols) % cols;
          const copy = Math.floor(tx / cols);
          if (z <= RASTER_MAX_Z) {
            const e = tileEntry(z, col, ty);
            e.used = now;
            if (e.texture) draw(e, copy, 1);
            continue;
          }
          // a detail tile: itself when it exists and has loaded, else its pyramid parent
          const best = bestColourTile(r.detail, z, col, ty);
          const own = best.z === z ? tileEntry(z, col, ty) : null;
          if (own) own.used = now;
          if (own?.texture) { draw(own, copy, 2); continue; }
          // the pyramid's top level is complete: the parent always exists
          const up = z - RASTER_MAX_Z;
          const parent = tileEntry(RASTER_MAX_Z, col >> up, ty >> up);
          parent.used = now;
          const pk = `${parent.key}@${copy}`;
          if (parent.texture && !parents.has(pk)) { parents.add(pk); draw(parent, copy, 1); r.stats.fallback += 1; }
        }
      }
    }
    if (r.tiles.size > TILE_CACHE) {
      [...r.tiles.values()].filter((e) => !e.meshes.some((m) => m.visible)).sort((a, b) => a.used - b.used).slice(0, r.tiles.size - TILE_CACHE).forEach((e) => {
        e.meshes.forEach((m) => scene.remove(m));
        e.texture?.dispose(); e.plain?.dispose(); e.terrain?.dispose(); e.cover?.dispose();
        r.tiles.delete(e.key);
      });
    }
  };
  return {
    update,
    ready: () => !!r.world,
    stats: () => r.stats,
    dispose: () => {
      r.disposed = true;
      if (r.world) { r.world.meshes.forEach((m) => scene.remove(m)); r.world.plain.dispose(); r.world.terrain.dispose(); r.world.texture.dispose(); }
      r.tiles.forEach((e) => { e.meshes.forEach((m) => scene.remove(m)); e.texture?.dispose(); e.plain?.dispose(); e.terrain?.dispose(); e.cover?.dispose(); });
      quad.dispose();
    }
  };
};

// ------------------------------------------------------------------ shared view uniforms
const VIEW_GLSL = /* glsl */ `
uniform vec4 uView;     // world x, y of the screen's top left; zoom k; world width (the wrap)
uniform vec3 uScreen;   // CSS width, height, device pixel ratio
uniform float uCamX;    // the view centre's world x
float wrapX(float x) { return x + uView.w * floor((uCamX - x) / uView.w + 0.5); }
vec2 toScreen(vec2 world) { return (world - uView.xy) * uView.z; }
vec4 toClip(vec2 s) { return vec4(s.x / uScreen.x * 2.0 - 1.0, 1.0 - s.y / uScreen.y * 2.0, 0.0, 1.0); }
`;
const viewUniforms = () => ({ uView: { value: new Vector4() }, uScreen: { value: new Vector3(1, 1, 1) }, uCamX: { value: 0 } });
const setView = (u, v) => { u.uView.value.set(v.worldLeft, v.worldTop, v.k, v.worldW); u.uScreen.value.set(v.width, v.height, v.dpr); u.uCamX.value = v.camX; };

// Grows an instanced attribute set to hold `count`.
const growable = (geometry, spec, initial) => {
  const g = { capacity: 0, attrs: {} };
  g.ensure = (count) => {
    if (count <= g.capacity) return;
    const cap = Math.max(initial, 2 ** Math.ceil(Math.log2(count)));
    Object.entries(spec).forEach(([name, size]) => {
      const attr = new InstancedBufferAttribute(new Float32Array(cap * size), size).setUsage(DynamicDrawUsage);
      g.attrs[name] = attr;
      geometry.setAttribute(name, attr);
    });
    g.capacity = cap;
    // three.js caches the instance limit of the first attributes it drew (_maxInstanceCount): drop
    // it, or a layer that grew after its first frame keeps drawing only its first capacity
    geometry._maxInstanceCount = undefined;
  };
  g.ensure(initial);
  return g;
};

// ------------------------------------------------------------------ sprites
const SPRITE_VERTEX = /* glsl */ `
${VIEW_GLSL}
in vec2 aAnchor;  // world position
in vec4 aOffset;  // CSS px offset: xy fixed, zw times k^aExp.y
in vec2 aSize;    // CSS px size times k^aExp.x
in vec2 aExp;
in vec4 aUv;      // atlas rect u0, v0, u1, v1
in vec4 aColor;   // multiplier (alpha: opacity)
out vec2 vUv;
out vec4 vColor;
void main() {
  vec2 anchor = vec2(wrapX(aAnchor.x), aAnchor.y);
  float k = uView.z;
  vec2 size = aSize * pow(k, aExp.x);
  vec2 centre = toScreen(anchor) + aOffset.xy + aOffset.zw * pow(k, aExp.y);
  // whole device pixels at the top left, so text and icons stay sharp
  vec2 tl = floor((centre - size * 0.5) * uScreen.z + 0.5) / uScreen.z;
  vec2 corner = vec2(position.x + 0.5, 0.5 - position.y);
  vUv = mix(aUv.xy, aUv.zw, corner);
  vColor = aColor;
  gl_Position = toClip(tl + corner * size);
}
`;
const SPRITE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas;
in vec2 vUv;
in vec4 vColor;
out vec4 fragColor;
void main() {
  vec4 c = texture(uAtlas, vUv) * vColor;
  if (c.a < 0.004) discard;
  fragColor = c;
}
`;

/**
 * Instanced sprites from an atlas. `set(list)`: [{ anchor: [x, y], offset: [x, y, sx, sy],
 * size: [w, h], exp: [size, offset], uv: entry, color: [r, g, b, a] }].
 */
export const createSpriteLayer = (scene, atlas, renderOrder) => {
  const geometry = new InstancedBufferGeometry();
  const base = new PlaneGeometry(1, 1);
  geometry.index = base.index; geometry.setAttribute('position', base.getAttribute('position'));
  const spec = { aAnchor: 2, aOffset: 4, aSize: 2, aExp: 2, aUv: 4, aColor: 4 };
  const g = growable(geometry, spec, 256);
  const texture = new CanvasTexture(atlas.canvas);
  texture.flipY = false; texture.generateMipmaps = false; texture.minFilter = LinearFilter; texture.magFilter = LinearFilter;
  const uniforms = { ...viewUniforms(), uAtlas: { value: texture } };
  const material = new ShaderMaterial({ glslVersion: GLSL3, vertexShader: SPRITE_VERTEX, fragmentShader: SPRITE_FRAGMENT, uniforms, transparent: true, depthTest: false, depthWrite: false });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = renderOrder;
  scene.add(mesh);
  let uploaded = -1;
  return {
    mesh,
    set: (list) => {
      g.ensure(list.length);
      const a = g.attrs;
      list.forEach((s, i) => {
        a.aAnchor.array.set(s.anchor, i * 2);
        a.aOffset.array.set(s.offset || [0, 0, 0, 0], i * 4);
        a.aSize.array.set(s.size, i * 2);
        a.aExp.array.set(s.exp || [0, 0], i * 2);
        a.aUv.array.set([s.uv.u0, s.uv.v0, s.uv.u1, s.uv.v1], i * 4);
        a.aColor.array.set(s.color || [1, 1, 1, 1], i * 4);
      });
      Object.values(a).forEach((attr) => { attr.needsUpdate = true; });
      geometry.instanceCount = list.length;
      mesh.visible = list.length > 0;
    },
    update: (v) => {
      setView(uniforms, v);
      if (uploaded !== atlas.version) { texture.needsUpdate = true; uploaded = atlas.version; }
    },
    dispose: () => { scene.remove(mesh); geometry.dispose(); base.dispose(); material.dispose(); texture.dispose(); }
  };
};

// ------------------------------------------------------------------ lines
const LINE_VERTEX = /* glsl */ `
${VIEW_GLSL}
in vec2 aA;       // world start
in vec2 aB;       // world end (unwrapped next to the start)
in vec4 aStyle;   // half width, dash, gap (CSS px, times k^exp), exp
in vec4 aColor;
out float vAcross;
out float vAlong;
out float vHalf;
out vec2 vDash;
out vec4 vColor;
void main() {
  float shift = wrapX(aA.x) - aA.x;
  vec2 a = toScreen(aA + vec2(shift, 0.0)); vec2 b = toScreen(aB + vec2(shift, 0.0));
  float scale = pow(uView.z, aStyle.w);
  float hw = aStyle.x * scale;
  vec2 d = b - a; float len = max(length(d), 1e-4); vec2 dir = d / len; vec2 nrm = vec2(-dir.y, dir.x);
  float t = position.x + 0.5;            // 0 at the start, 1 at the end
  float side = position.y * 2.0;          // -1 or 1
  float ext = hw + 1.0;                   // room for the round end and the soft edge
  vec2 s = mix(a, b, t) + dir * (t * 2.0 - 1.0) * hw + nrm * side * ext;
  vAcross = side * ext; vAlong = t * len + (t * 2.0 - 1.0) * hw; vHalf = hw;
  vDash = aStyle.yz * scale; vColor = aColor;
  gl_Position = toClip(s);
}
`;
const LINE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uScreen;
in float vAcross;
in float vAlong;
in float vHalf;
in vec2 vDash;
in vec4 vColor;
out vec4 fragColor;
void main() {
  float a = clamp((vHalf - abs(vAcross)) * uScreen.z + 0.5, 0.0, 1.0);
  if (vDash.x > 0.0 && mod(vAlong, vDash.x + vDash.y) > vDash.x) discard;
  if (a <= 0.0) discard;
  fragColor = vec4(vColor.rgb, vColor.a * a);
}
`;

/** Instanced segments: `set(list)` [{ a: [x, y], b: [x, y], half, dash, gap, exp, color }]. */
export const createLineLayer = (scene, renderOrder) => {
  const geometry = new InstancedBufferGeometry();
  const base = new PlaneGeometry(1, 1);
  geometry.index = base.index; geometry.setAttribute('position', base.getAttribute('position'));
  const g = growable(geometry, { aA: 2, aB: 2, aStyle: 4, aColor: 4 }, 256);
  const uniforms = viewUniforms();
  // both sides: the quad's winding flips with the segment's direction (the screen's y points down),
  // so with back faces culled every segment drawn left to right was missing (roads, routes, rivers)
  const material = new ShaderMaterial({ glslVersion: GLSL3, vertexShader: LINE_VERTEX, fragmentShader: LINE_FRAGMENT, uniforms, transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = renderOrder;
  scene.add(mesh);
  return {
    mesh,
    set: (list) => {
      g.ensure(list.length);
      const a = g.attrs;
      list.forEach((l, i) => {
        a.aA.array.set(l.a, i * 2); a.aB.array.set(l.b, i * 2);
        a.aStyle.array.set([l.half, l.dash || 0, l.gap || 0, l.exp || 0], i * 4);
        a.aColor.array.set(l.color, i * 4);
      });
      Object.values(a).forEach((attr) => { attr.needsUpdate = true; });
      geometry.instanceCount = list.length;
      mesh.visible = list.length > 0;
    },
    update: (v) => setView(uniforms, v),
    dispose: () => { scene.remove(mesh); geometry.dispose(); base.dispose(); material.dispose(); }
  };
};
