// src/components/map/closeView/CloseViewLayer.jsx
// The close view of the old SVG flat map (plan §4f): from CLOSE_ZOOM_K up, towns, landmarks,
// wonders, works, trees and armies as three.js models (closeViewScene.js) on a transparent canvas
// over the SVG provinces. The WebGL map (gl/GLMapView.jsx) draws the same scene in its own canvas.
// The camera is orthographic in screen pixels, so a model sits exactly over its province as the
// map pans. Loaded lazily: three.js only arrives the first time the player zooms this close.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WebGLRenderer, Scene, OrthographicCamera } from 'three';
import { useGame } from '../../../context/GameContext';
import { useFogView } from '../useFogView';
import { getMapMarkers } from '../../../utils/mapMarkers';
import { RIG_TIME } from '../../../battle/render/soldierFactory';
import { loadGroundData } from './groundBlend';
import { worldRasterUrl } from '../../../data/geo/worldRaster';
import { createCloseScene, closeTowns } from './closeViewScene';

const CloseViewLayer = ({ projection, transform, width, height, active, land = null }) => {
  // Towns, works and trees as the player knows them (fogView.js); the armies from the real state
  // (getMapMarkers applies sight itself).
  const { state: gameState } = useGame();
  const fog = useFogView();
  const { state } = fog;
  const canvasRef = useRef(null);
  const three = useRef(null);
  const [assetsTick, setAssetsTick] = useState(0); // bumps when an artist model file finishes loading
  // The land mask and the world picture's colours (groundBlend.js), once the coastline is in.
  const ground = useRef(null);
  useEffect(() => {
    if (!active || !land || ground.current) return;
    loadGroundData(land, worldRasterUrl(2048)).then((d) => { ground.current = d; setAssetsTick((n) => n + 1); });
  }, [active, land]);

  // One renderer for the life of the map.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return undefined; // no WebGL: the banners stay, nothing else breaks
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 1, 0, -1, -6000, 6000);
    const close = createCloseScene(scene, scene, { onAssets: () => setAssetsTick((n) => n + 1) });
    three.current = { renderer, scene, camera, close, dirty: true };
    if (import.meta.env.DEV) window.__closeView = Object.assign(close.state, { renderer }); // for browser checks (scripts/art/improvement-shots.mjs)
    return () => {
      close.dispose();
      renderer.dispose();
      three.current = null;
    };
  }, []);

  const markers = useMemo(() => getMapMarkers(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.units, gameState.regions, gameState.nations, gameState.intel, gameState.battleReports, gameState.turnNumber, gameState.playerNationId]);
  const towns = useMemo(() => closeTowns(state), [state]);

  // Lay the scene out whenever the view or the game changes.
  useEffect(() => {
    const t = three.current;
    if (!t || !active || !projection || width <= 0 || height <= 0) return;
    t.renderer.setSize(width, height, false);
    t.camera.left = 0; t.camera.right = width; t.camera.top = 0; t.camera.bottom = -height;
    t.camera.updateProjectionMatrix();
    const proj = { fwd: (lon, lat) => projection([lon, lat]), inv: (x, y) => projection.invert([x, y]) };
    t.close.layout({ projection, proj, transform, width, height, state, fog, towns, markers, ground: ground.current });
    t.dirty = true;
    t.requestDraw?.();
  }, [active, projection, transform, width, height, state, fog, towns, markers, assetsTick]);

  // Draw on demand (plans/rts-world-review.md 6.3): one frame after a change, and every frame only
  // while soldiers walk; no animation loop runs while nothing moves (saves the battery).
  useEffect(() => {
    const t = three.current;
    if (!active || !t) return undefined;
    let raf = 0;
    const draw = (now) => {
      raf = 0;
      if (!three.current) return;
      RIG_TIME.value = now / 1000;
      t.renderer.render(t.scene, t.camera);
      t.dirty = false;
      if (t.close.moving()) raf = requestAnimationFrame(draw);
    };
    t.requestDraw = () => { if (!raf) raf = requestAnimationFrame(draw); };
    if (t.dirty || t.close.moving()) t.requestDraw();
    return () => { cancelAnimationFrame(raf); t.requestDraw = null; };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="close-view"
      className="absolute inset-0 pointer-events-none transition-opacity duration-300"
      style={{ width, height, opacity: active ? 1 : 0 }}
    />
  );
};

export default CloseViewLayer;
