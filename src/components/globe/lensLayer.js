// src/components/globe/lensLayer.js
// The lenses on the globe (plans/civ-map-rework.md E5): the same models the flat map draws
// (src/components/map/lenses.js), painted into the globe's political canvas (politicalTexture.js)
// in its equirectangular layout. Tile fills use the hex cell polygon; discs, rings, routes and
// labels use the tile centre. Sizes scale with the canvas width so they read the same at any
// raster size. Pure apart from the canvas calls, so a fake context can count them in tests.
import { geoPath } from 'd3-geo';
import { getTiles } from '../../data/geo/tiles';
import { cellFeature } from '../../data/geo/tileGeometry';
import { yieldLabels, loyaltyDiscs, threatStacks, supplyTints, supplyReach, estateTints, tradeLines, airCover, settleTints } from '../map/lenses';

const pointOf = (tiles, projection, id) => {
  const ll = tiles.latLonOf(id);
  const lat = ll.lat ?? ll[0]; const lon = ll.lon ?? ll.lng ?? ll[1];
  return projection([lon, lat]);
};

/** Paints `lens` over the political canvas; nothing for the political lens. */
export const drawLensLayer = (ctx, { state, lens, projection, width }) => {
  if (!lens || lens === 'political') return 0;
  const tiles = getTiles();
  const path = geoPath(projection, ctx);
  const px = width / 2048; // one "unit" at a 2048 wide raster
  const at = (id) => pointOf(tiles, projection, id);
  const fillTile = (id, colour) => { ctx.fillStyle = colour; ctx.beginPath(); path(cellFeature(tiles, id)); ctx.fill(); };
  let drawn = 0;
  ctx.save();
  ctx.lineJoin = 'round';
  if (lens === 'yields') {
    ctx.font = `700 ${Math.max(6, 7 * px)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(1, 2 * px); ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    yieldLabels(state).forEach((y) => {
      const [x, yy] = at(y.tile);
      const text = `${y.food}·${y.production}·${y.gold}`;
      ctx.fillStyle = y.worked ? '#fef3c7' : '#cbd5e1';
      ctx.strokeText(text, x, yy); ctx.fillText(text, x, yy); drawn++;
    });
  } else if (lens === 'loyalty') {
    loyaltyDiscs(state).forEach((d) => {
      const [x, y] = at(d.tile);
      ctx.globalAlpha = 0.45; ctx.fillStyle = d.colour; ctx.beginPath(); ctx.arc(x, y, Math.max(4, 9 * px), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = d.colour; ctx.lineWidth = Math.max(1, px); ctx.stroke(); drawn++;
    });
  } else if (lens === 'threat') {
    airCover(state).forEach((a) => {
      const [x, y] = at(a.tile); const [ex, ey] = at(a.edgeTile);
      const r = Math.max(4 * px, Math.hypot(ex - x, ey - y)); const c = a.own ? '#60a5fa' : '#f87171';
      ctx.globalAlpha = 0.08; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, px); ctx.setLineDash([5 * px, 3 * px]); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `700 ${Math.max(6, 7 * px)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = c; ctx.fillText(`✈ ${a.count}`, x, y - 8 * px); drawn++;
    });
    threatStacks(state).forEach((s) => {
      const [x, y] = at(s.tile); const [ex, ey] = at(s.edgeTile);
      const r = Math.max(4 * px, Math.hypot(ex - x, ey - y));
      ctx.globalAlpha = 0.2; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(1, 1.5 * px); ctx.setLineDash([4 * px, 3 * px]); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `700 ${Math.max(6, 7 * px)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fecaca'; ctx.fillText(String(s.strength), x, y); drawn++;
    });
  } else if (lens === 'supply') {
    supplyReach(state, { limit: 2500 }).forEach((t) => { fillTile(t.tile, t.colour); drawn++; });
    supplyTints(state).forEach((t) => { fillTile(t.tile, t.colour); drawn++; });
  } else if (lens === 'estates') {
    ctx.font = `700 ${Math.max(6, 7 * px)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    estateTints(state).forEach((t) => {
      fillTile(t.tile, t.colour);
      const [x, y] = at(t.tile); ctx.fillStyle = '#fff7ed'; ctx.fillText(t.crest, x, y); drawn++;
    });
  } else if (lens === 'settle') {
    settleTints(state).forEach((t) => { fillTile(t.tile, t.colour); drawn++; });
  } else if (lens === 'trade') {
    tradeLines(state).forEach((r) => {
      if (!r.tiles.length) return;
      ctx.strokeStyle = r.plundered ? '#ef4444' : '#fbbf24';
      ctx.lineWidth = Math.max(1, 1.5 * px); ctx.setLineDash(r.kind === 'sea' ? [6 * px, 4 * px] : []);
      ctx.beginPath();
      r.tiles.forEach((t, i) => { const [x, y] = at(t); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
      if (r.plunderTile != null) { const [x, y] = at(r.plunderTile); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, y, Math.max(3, 4 * px), 0, Math.PI * 2); ctx.fill(); }
      drawn++;
    });
  }
  ctx.restore();
  return drawn;
};
