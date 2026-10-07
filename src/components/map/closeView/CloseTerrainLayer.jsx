// src/components/map/closeView/CloseTerrainLayer.jsx
// The ground under the close view (plans/playtest-1.md P1.3): from CLOSE_ZOOM_K up, the flat map's
// SVG stops drawing its raster pictures and turns transparent, and this canvas draws the land and
// sea under it, through terrainShader.js, so coasts and rivers stay sharp lines and the ground
// gets detail at any zoom. Territories, borders, lenses, routes and badges still draw over it in
// the SVG, and the models canvas (CloseViewLayer) sits on top of everything.
// One quad per level-5 raster tile on screen (the same pyramid as the mid zoom), over one quad of
// the whole-world picture that covers the land while a tile is still loading. Textures are kept
// for the last TILE_CACHE tiles seen. It draws only when something changed: no frame loop.
// `onReady(true)` once the world picture is in, so the SVG pictures hide only when the ground is
// really there (and never when WebGL is missing).
import React, { useEffect, useRef } from 'react';
import {
  WebGLRenderer, Scene, OrthographicCamera, Mesh, PlaneGeometry, ShaderMaterial, TextureLoader, LinearFilter,
  ClampToEdgeWrapping, Vector2, Vector4
} from 'three';
import { TERRAIN_VERTEX, TERRAIN_FRAGMENT, pxPerKm, closeGroundSetup } from './terrainShader';
import { visibleRasterTiles, rasterTileUrl, RASTER_MAX_Z, RASTER_TILE } from '../../../data/geo/rasterTiles';

const TILE_CACHE = 96;

const GROUND = closeGroundSetup(); // ground material sets as detail, where delivered (terrainShader.js)
const makeMaterial = (texture, size, geo) => new ShaderMaterial({
  vertexShader: TERRAIN_VERTEX,
  fragmentShader: TERRAIN_FRAGMENT,
  defines: { ...GROUND.defines },
  uniforms: {
    ...GROUND.uniforms,
    uMap: { value: texture },
    uSize: { value: new Vector2(size[0], size[1]) },
    uGeo: { value: new Vector4(geo[0], geo[1], geo[2], geo[3]) },
    uPxPerKm: { value: 1 }
  },
  depthTest: false,
  depthWrite: false
});

const prepare = (texture) => {
  texture.magFilter = LinearFilter; texture.minFilter = LinearFilter; texture.generateMipmaps = false;
  texture.wrapS = ClampToEdgeWrapping; texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};

const CloseTerrainLayer = ({ rasterRect, worldUrl, worldSize, transform, width, height, active, onReady }) => {
  const canvasRef = useRef(null);
  const three = useRef(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const viewRef = useRef(null);

  // One renderer for the life of the map.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'low-power' });
    } catch {
      return undefined; // no WebGL: the SVG keeps its pictures
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor('#0f172a', 1);
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 1, 0, -1, -10, 10);
    const quad = new PlaneGeometry(1, 1).translate(0.5, -0.5, 0); // top-left corner at the origin
    const loader = new TextureLoader();
    const t = { renderer, scene, camera, quad, loader, tiles: new Map(), world: null, dirty: true, disposed: false };
    three.current = t;
    let raf = 0;
    t.request = () => {
      t.dirty = true;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (t.disposed || !t.dirty) return;
        t.layout?.();
        renderer.render(scene, camera);
        t.dirty = false;
      });
    };
    return () => {
      t.disposed = true;
      if (raf) cancelAnimationFrame(raf);
      t.tiles.forEach((e) => { e.texture?.dispose(); e.mesh?.material.dispose(); });
      if (t.world) { t.world.texture.dispose(); t.world.mesh.material.dispose(); }
      quad.dispose();
      renderer.dispose();
      three.current = null;
      onReadyRef.current?.(false);
    };
  }, []);

  // The whole-world picture under the tiles.
  useEffect(() => {
    const t = three.current;
    if (!t || !worldUrl || t.world?.url === worldUrl) return;
    t.loader.load(worldUrl, (texture) => {
      if (t.disposed) { texture.dispose(); return; }
      prepare(texture);
      if (t.world) { t.scene.remove(t.world.mesh); t.world.texture.dispose(); t.world.mesh.material.dispose(); }
      const mesh = new Mesh(t.quad, makeMaterial(texture, [worldSize, worldSize / 2], [-180, 90, 360, 180]));
      mesh.renderOrder = 0; mesh.frustumCulled = false;
      t.scene.add(mesh);
      t.world = { url: worldUrl, texture, mesh };
      t.request();
      onReadyRef.current?.(true);
    }, undefined, () => onReadyRef.current?.(false));
  }, [worldUrl, worldSize]);

  // Lay out the quads for the current view.
  viewRef.current = { rasterRect, transform, width, height, active };
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    t.layout = () => {
      const v = viewRef.current;
      if (!v.active || !v.rasterRect || v.width <= 0 || v.height <= 0) return;
      const { k, x: tx, y: ty } = v.transform;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      t.renderer.setSize(v.width, v.height, false);
      t.camera.left = 0; t.camera.right = v.width; t.camera.top = 0; t.camera.bottom = -v.height;
      t.camera.updateProjectionMatrix();
      const perKm = pxPerKm(v.rasterRect.width, k, dpr);
      const place = (mesh, rect) => {
        mesh.position.set(rect.x * k + tx, -(rect.y * k + ty), 0);
        mesh.scale.set(rect.width * k, rect.height * k, 1);
        mesh.material.uniforms.uPxPerKm.value = perKm;
      };
      if (t.world) place(t.world.mesh, v.rasterRect);
      const list = visibleRasterTiles({ raster: v.rasterRect, transform: v.transform, width: v.width, height: v.height, forceZ: RASTER_MAX_Z, margin: 0 });
      const cols = 2 ** (RASTER_MAX_Z + 1); const rows = 2 ** RASTER_MAX_Z;
      const wanted = new Set();
      list.forEach((tile) => {
        wanted.add(tile.key);
        let e = t.tiles.get(tile.key);
        if (!e) {
          e = { key: tile.key, mesh: null, texture: null, used: 0 };
          t.tiles.set(tile.key, e);
          t.loader.load(rasterTileUrl(tile.z, tile.x, tile.y), (texture) => {
            if (t.disposed || !t.tiles.has(tile.key)) { texture.dispose(); return; }
            prepare(texture);
            e.texture = texture;
            e.mesh = new Mesh(t.quad, makeMaterial(texture, [RASTER_TILE, RASTER_TILE], [-180 + (tile.x * 360) / cols, 90 - (tile.y * 180) / rows, 360 / cols, 180 / rows]));
            e.mesh.renderOrder = 1; e.mesh.frustumCulled = false;
            e.rect = tile.rect;
            t.scene.add(e.mesh);
            t.request();
          }, undefined, () => {});
        }
        e.used = performance.now();
        if (e.mesh) { e.mesh.visible = true; place(e.mesh, tile.rect); }
      });
      t.tiles.forEach((e, key) => { if (!wanted.has(key) && e.mesh) e.mesh.visible = false; });
      // Forget the tiles seen longest ago.
      if (t.tiles.size > TILE_CACHE) {
        [...t.tiles.values()].filter((e) => !wanted.has(e.key)).sort((a, b) => a.used - b.used)
          .slice(0, t.tiles.size - TILE_CACHE)
          .forEach((e) => {
            if (e.mesh) { t.scene.remove(e.mesh); e.mesh.material.dispose(); }
            e.texture?.dispose();
            t.tiles.delete(e.key);
          });
      }
    };
  }, []);

  useEffect(() => { if (active) three.current?.request(); }, [active, rasterRect, transform, width, height]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="close-terrain"
      className="absolute inset-0 pointer-events-none"
      style={{ width, height, visibility: active ? 'visible' : 'hidden' }}
    />
  );
};

export default CloseTerrainLayer;
