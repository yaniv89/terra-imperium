// src/components/battle/BattleMinimap.jsx
// I196: the battle minimap, shown when the player turns it on (the Map button). The field turned the
// way the camera looks (minimapModel.js), the fog as the player knows it (unexplored ground dark,
// ground not in sight dimmed), your squads and buildings in blue, enemy squads only while seen and
// enemy buildings only once explored (render/view.js already leaves the rest out), and the camera's
// view as a frame. A tap or a drag on it moves the camera there.
import React, { useEffect, useMemo, useRef } from 'react';
import { t as tNow } from '../../i18n/core';
import { useT } from '../../i18n/useT';
import { Q } from '../../battle/sim/constants';
import { minimapFrame, TILE_RGB } from './minimapModel';

const YOU = '#4fa3ff'; const ENEMY = '#ff5a4f';

const BattleMinimap = ({ setup, hud, playerSide, getRenderer, onMoved, maxW = 168, maxH = 104 }) => {
  useT();
  const canvasRef = useRef(null);
  const map = setup.map;
  const frame = useMemo(() => minimapFrame(map.w, map.h, maxW, maxH), [map.w, map.h, maxW, maxH]);
  // The ground once (a tile a pixel), turned and scaled when drawn.
  const ground = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = map.w; c.height = map.h;
    const ctx = c.getContext('2d'); if (!ctx) return null;
    const img = ctx.createImageData(map.w, map.h);
    for (let i = 0; i < map.w * map.h; i++) {
      const rgb = TILE_RGB[map.tiles?.[i] ?? 0] || TILE_RGB[0];
      img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }, [map]);
  const fogRef = useRef({ src: null, canvas: null });

  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !hud) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(frame.width * dpr)) { cv.width = Math.round(frame.width * dpr); cv.height = Math.round(frame.height * dpr); }
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const r = getRenderer?.();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const [a, b, c, d, e, f] = frame.transform;
    ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
    ctx.imageSmoothingEnabled = false;
    if (ground) ctx.drawImage(ground, 0, 0);
    // The fog as the player knows it (0 never seen, 1 seen before, 2 in sight).
    const fog = r?.lastFog || hud.fog || null;
    if (fog) {
      const fr = fogRef.current;
      if (fr.src !== fog) {
        fr.src = fog;
        if (!fr.canvas) { fr.canvas = document.createElement('canvas'); fr.canvas.width = map.w; fr.canvas.height = map.h; }
        const fctx = fr.canvas.getContext('2d');
        const img = fctx.createImageData(map.w, map.h);
        for (let i = 0; i < fog.length; i++) img.data[i * 4 + 3] = fog[i] === 0 ? 225 : fog[i] === 1 ? 110 : 0;
        fctx.putImageData(img, 0, 0);
      }
      ctx.drawImage(fr.canvas, 0, 0);
    }
    // Back to minimap pixels for the marks.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // every mark has a dark edge so it reads on grass, sand and fog alike (round 2 playtest: dots hard to read)
    const dot = (x, z, color, size) => {
      const p = frame.toMini(x, z);
      ctx.fillStyle = 'rgba(8,10,16,0.85)'; ctx.fillRect(p.x - size / 2 - 1, p.y - size / 2 - 1, size + 2, size + 2);
      ctx.fillStyle = color; ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    };
    hud.structures.forEach((s, i) => {
      if (!s.alive || s.kind === 'wall' || s.kind === 'house') return;
      dot(s.x / Q, s.y / Q, i === 0 ? (playerSide === 1 ? YOU : ENEMY) : '#d6d3d1', i === 0 ? 7 : 3);
    });
    (hud.eco?.buildings || []).forEach((bd) => { if (bd.alive && !bd.proxy) dot(bd.x / Q, bd.y / Q, bd.side === playerSide ? YOU : ENEMY, 5); });
    hud.squads.forEach((q) => {
      if (!q.alive || !q.onField || q.fled) return;
      if (q.side !== playerSide && q.visible === false) return;
      dot(q.x / Q, q.y / Q, q.side === playerSide ? YOU : ENEMY, 3.5);
    });
    // The camera's view.
    if (r?.width) {
      const corners = [[0, 0], [r.width, 0], [r.width, r.height], [0, r.height]].map(([px, py]) => r.screenToGround(px, py));
      if (corners.every(Boolean)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.25;
        ctx.beginPath();
        corners.forEach((g, k) => { const p = frame.toMini(g.x, g.z); if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
        ctx.closePath(); ctx.stroke();
      }
    }
  }, [hud, frame, ground, getRenderer, playerSide, map]);

  // A tap or a drag moves the camera there (the follow stops: onMoved).
  const dragRef = useRef(false);
  const goTo = (e) => {
    const cv = canvasRef.current; const r = getRenderer?.(); if (!cv || !r) return;
    const rect = cv.getBoundingClientRect();
    const g = frame.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    r.centerOn(g.x, g.z);
    onMoved?.();
  };
  return (
    <div className="pointer-events-auto rounded-[10px] bg-fa-ink/85 border border-fa-line shadow-xl p-1" data-testid="battle-minimap">
      <canvas ref={canvasRef} style={{ width: frame.width, height: frame.height, touchAction: 'none', display: 'block' }}
        aria-label={tNow('bt.screen.minimapAria')} role="img"
        onPointerDown={(e) => { e.stopPropagation(); dragRef.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); goTo(e); }}
        onPointerMove={(e) => { if (dragRef.current) goTo(e); }}
        onPointerUp={() => { dragRef.current = false; }}
        onPointerCancel={() => { dragRef.current = false; }} />
    </div>
  );
};

export default BattleMinimap;
