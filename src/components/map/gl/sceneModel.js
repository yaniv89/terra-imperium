// src/components/map/gl/sceneModel.js
// What the WebGL map draws on top of the territories, as plain lists, from the world as the
// player knows it (fogView.js): the same rules as the old SVG map (Map2DView.jsx), its markers
// (Map2DMarkersOverlay.jsx) and the close view's banners (CityBanners.jsx).
//   sprites  { art, anchor: [x, y] world, offset: [x, y, sx, sy] CSS px (sx, sy times k^exp[1]),
//              size: [w, h] CSS px times k^exp[0], exp, color: [r, g, b, a] }
//   lines    { a, b: world points (b unwrapped next to a), half, dash, gap (CSS px times k^exp), exp, color }
//   hits     what a tap can pick: { kind, anchor, offset, size, exp, pad, ... } (picking.js)
// Built once per settled zoom and game change (the GPU moves them while the map pans), the tile
// glyphs and roads per window of the world round the view.
import { getTiles } from '../../../data/geo/tiles';
import { cityLatLon, landTilesWithin } from '../../../data/geo/cityFeatures';
import { hexSizeVsF75 } from '../../../data/geo/gridScale';
import { getNationColor } from '../../../data/nationColors';
import { getEffectiveAgeId } from '../../../data/ages';
import { getTechAgeId } from '../../../engine/nationState';
import { wallsOf } from '../../../engine/sieges';
import { loyaltyOf } from '../../../engine/loyalty';
import { OUTPOST_DONE, isSettler } from '../../../engine/settlers';
import { DISTRICTS } from '../../../engine/districts';
import { RESOURCES_ON_TILES } from '../../../data/tileYields';
import { resourceIconUrl, improvementIconUrl, wonderIconUrl, markerIconUrl, unitIconUrl, cityIconUrl } from '../../../data/icons';
import { townTier } from '../closeView/townTiers';
import { WORK_KINDS } from '../closeView/landscape';
import { ARMY_SPOT, unitPx, townUnitPx, townRoomUnits, townGapUnits, TIER_SCALE, ROOM_FILL } from '../closeView/scale';
import { cachedFootprint, townDrawRadiusKm } from '../closeView/terrainPlacement';
import { EARTH_RADIUS_KM } from '../../../data/geo/geodesic';
import { markerLatLng } from '../../../utils/markerPosition';
import { clusterScreenMarkers, MARKER_OFFSET, markerItems } from '../mapBanners';
import { bannerOffsetPx } from '../CityBanners';
import { yieldLabels, loyaltyDiscs, threatStacks, supplyTints, supplyReach, tradeLines, airCover, settleTints } from '../lenses';
import { cssColor } from './cssColor';
import {
  labelArt, discArt, badgeArt, badgeRadiusStep, BADGE_BOX_R, armyArt, fleetArt, battleArt, colonyArt, wonderArt, eventArt,
  clusterArt, glyphArt, iconArt, groundBattleArt, settlerArt, cityBannerArt, peakArt, passArt, PEAK_LIFT
} from './spriteArt';
import { ridgeSegments, mountainPeaks, passPoints, MOUNTAIN_SPRITES_FROM_K, PASS_MARK_FROM_K } from './terrainModel';
import { PLAYER_BAND_COLOR } from './territoryData';
import { cityRailModel } from '../../city/cityRailModel';

// The zoom levels of the old map (Map2DView.jsx).
export const HEX_FROM_ZOOM = 3 / hexSizeVsF75();
export const RESOURCE_GLYPH_ZOOM = 5 / hexSizeVsF75();
export const CITY_DETAIL_ZOOM = 2.5;
export const NAME_EARLY_ZOOM = 1.5;
export const CLOSE_ZOOM_K = 10 / hexSizeVsF75();
export const FOREIGN_MIN_ZOOM = 2;
const CLUSTER_RADIUS_PX = 22;
const IMPROVEMENT_GLYPH = { farm: 'F', pasture: 'P', camp: 'H', mine: 'M', quarry: 'Q', lumber_camp: 'L', fishing_boats: 'B', plantation: 'N', oil_well: 'O', fort: 'W' };
const WHITE = [1, 1, 1, 1];
const fade = (a) => [1, 1, 1, a];

const pointOf = (projection, tile) => { const { lat, lon } = getTiles().latLonOf(tile); return projection([lon, lat]); };

// ------------------------------------------------------------------ cities
/**
 * A test for world points round a settled view (`view` from mapView.viewFor): within `screens`
 * screen sizes of its centre, east-west wrapped. The labels and banners of a world of thousands of
 * cities are drawn only near the view (the atlas holds what is on screen and round it).
 */
export const nearView = (view, screens = 1.5) => {
  const hx = (view.width / view.k) * screens; const hy = (view.height / view.k) * screens;
  const cy = view.worldTop + view.height / view.k / 2;
  if (hx * 2 >= view.worldW) return (p) => Math.abs(p[1] - cy) <= hy;
  return (p) => { const dx = p[0] - view.camX; const w = dx - view.worldW * Math.round(dx / view.worldW); return Math.abs(w) <= hx && Math.abs(p[1] - cy) <= hy; };
};

/**
 * City badges and names (far and middle zoom) or, from the close zoom, the banners under the towns
 * and an invisible tap disc on each town. `k`: the settled zoom.
 */
export const citySprites = ({ state, projection, k, selectedRegion, dpr, bannerFont = 12, isTown, near = null }) => {
  const sprites = []; const names = []; const hits = [];
  const close = k >= CLOSE_ZOOM_K;
  const ages = {};
  const ageOf = (owner) => (ages[owner] ||= getEffectiveAgeId(state.age, getTechAgeId(state, owner)));
  const capitalUrl = markerIconUrl('capital');
  const siegeUrl = markerIconUrl('siege') || markerIconUrl('battle');
  const sk = Math.sqrt(k);
  // the thin production bar under your banners (W02): how far each of your cities is with its build
  const builds = close ? new Map(cityRailModel(state).map((r) => [r.id, r.buildShare])) : null;
  Object.values(state.regions).forEach((city) => {
    const ll = cityLatLon(state, city.id);
    if (!ll) return;
    const anchor = projection([ll.lng, ll.lat]);
    if (!anchor || (near && !near(anchor))) return;
    const colour = city.ghost ? '#94a3b8' : city.owner ? getNationColor(city.owner) : '#94a3b8';
    const r0 = city.isCapital ? 5 + (city.size || 1) * 0.35 : 3.5 + (city.size || 1) * 0.3;
    if (close) {
      // the town model is the city: a tap disc on it, and the banner under it (CityBanners.jsx)
      hits.push({ kind: 'city', id: city.id, anchor, offset: [0, 0, 0, 0], size: [r0 * 2, r0 * 2], exp: [0.5, 0], round: true, pad: 0 });
      if (!(city.owner || city.colony)) return;
      const tier = city.owner && !city.outpost ? townTier(city) : null;
      const radius = tier ? tier.modelRadius : 1;
      const capRadius = radius + ((city.buildings?.categories?.defense ?? -1) >= 0 ? 0.3 : 0);
      // the town's room as the close view draws it (the footprint's town radius, terrainPlacement.js)
      const fp = city.tile != null ? cachedFootprint(city.tile, state) : null;
      const roomPx = fp?.town ? (townDrawRadiusKm(fp) * projection.scale() * k) / EARTH_RADIUS_KM / ROOM_FILL
        : Math.min(townRoomUnits(projection, getTiles(), city.tile), townGapUnits(projection, getTiles(), city.tile, isTown)) * k;
      const below = bannerOffsetPx(radius, townUnitPx(k, capRadius, roomPx, tier ? TIER_SCALE[tier.id] || 1 : 1));
      const owner = city.owner || city.colony?.ownerId;
      const own = owner === state.playerNationId;
      const art = cityBannerArt({
        name: city.name, size: city.size, colour: own ? PLAYER_BAND_COLOR : getNationColor(owner) || '#94a3b8', selected: city.id === selectedRegion,
        capital: !!city.isCapital, disloyal: !!city.owner && loyaltyOf(city) <= 25,
        siege: city.siege ? Math.max(0, Math.min(1, city.siege.hp / Math.max(1, city.siege.maxHp))) : null,
        outpost: city.outpost ? Math.max(0, Math.min(1, (city.outpost.progress || 0) / OUTPOST_DONE)) : null,
        build: own ? builds.get(city.id) ?? null : null
      }, dpr, bannerFont);
      const oy = below + art.css.h / 2 - art.css.pad;
      names.push({ art, anchor, offset: [0, oy, 0, 0], size: [art.css.w, art.css.h], exp: [0, 0], color: WHITE });
      hits.push({ kind: 'banner', id: city.id, anchor, offset: [0, below + art.css.pillH / 2, 0, 0], size: [art.css.pillW, art.css.pillH], exp: [0, 0], pad: [4, 9] });
      return;
    }
    const rCss = r0 * sk;
    const art = badgeArt({
      r0, colour, capital: !!city.isCapital,
      fill: city.id === selectedRegion ? '#fde68a' : city.outpost ? '#e2e8f0' : '#f8fafc',
      iconUrl: city.outpost ? null : cityIconUrl(townTier(city)?.id, ageOf(city.owner)),
      capitalUrl: city.isCapital ? capitalUrl : null,
      outpost: city.outpost ? (city.outpost.progress || 0) / OUTPOST_DONE : null,
      siege: city.siege ? city.siege.hp / Math.max(1, city.siege.maxHp) : null,
      siegeUrl: city.siege ? siegeUrl : null,
      walls: wallsOf(city) > 0, disloyal: !!city.owner && loyaltyOf(city) <= 25,
      disaster: city.disaster?.kind || null,
      size: k >= CITY_DETAIL_ZOOM ? city.size || 1 : null
    }, badgeRadiusStep(rCss * dpr));
    const box = r0 * BADGE_BOX_R * 2;
    sprites.push({ art, anchor, offset: [0, 0, 0, 0], size: [box, box], exp: [0.5, 0], color: fade(city.ghost ? 0.6 : 1) });
    hits.push({ kind: 'city', id: city.id, anchor, offset: [0, 0, 0, 0], size: [r0 * 2, r0 * 2], exp: [0.5, 0], round: true, pad: 0 });
    if (k >= CITY_DETAIL_ZOOM || (k >= NAME_EARLY_ZOOM && (city.isCapital || city.owner === state.playerNationId))) {
      // a remembered town (fog, W03) says when it was last seen
      const label = labelArt(city.ghost && city.lastSeen ? `${city.name} · last seen T${city.lastSeen}` : city.name, { size: 11, weight: 700, fill: city.ghost ? '#B9B19F' : '#fff' }, dpr);
      // the baseline 2 px over the disc, as the SVG's text
      names.push({ art: label, anchor, offset: [0, -2 - label.css.baseline + label.css.h / 2, 0, -r0], size: [label.css.w, label.css.h], exp: [0, 0.5], color: fade(city.ghost ? 0.6 : 1) });
    }
  });
  return { sprites, names, hits };
};

// ------------------------------------------------------------------ markers (Map2DMarkersOverlay)
/** Armies, fleets, last turn's battles, colonies, wonders and the event's city, clustered at zoom k. */
export const markerSprites = ({ markers, projection, k, atWar, dpr, waterTile }) => {
  const close = k >= CLOSE_ZOOM_K;
  const items = [];
  markerItems(markers, k >= FOREIGN_MIN_ZOOM).forEach((m) => {
    const c = markerLatLng(m);
    const p = c && projection([c.lng, c.lat]);
    if (!p) return;
    const s = unitPx(k);
    const off = close && m.kind === 'army' ? [s * ARMY_SPOT.x, s * ARMY_SPOT.y - s * 2.2 - 10] : MARKER_OFFSET[m.kind] || [0, 0];
    items.push({ ...m, anchor: p, off, x: p[0] * k + off[0], y: p[1] * k + off[1] });
  });
  const sprites = []; const hits = [];
  clusterScreenMarkers(items, CLUSTER_RADIUS_PX).forEach((c) => {
    const single = c.members.length === 1;
    const tag = close && single && c.kind === 'army';
    const scale = dpr * (tag ? 0.72 : 1);
    const art = !single ? clusterArt(c.members.length, c.members.some((m) => m.own && m.kind !== 'battle'), scale)
      : c.kind === 'event' ? eventArt(scale) : c.kind === 'wonder' ? wonderArt(c, scale) : c.kind === 'colony' ? colonyArt(c, scale)
        : c.kind === 'battle' ? battleArt(c, scale, { sea: c.tile != null && waterTile?.(c.tile) }) : c.kind === 'fleet' ? fleetArt(c, atWar.has(c.ownerId), scale) : armyArt(c, atWar.has(c.ownerId), scale);
    const cssW = art.w / dpr; const cssH = art.h / dpr;
    sprites.push({ art, anchor: c.anchor, offset: [c.off[0], c.off[1], 0, 0], size: [cssW, cssH], exp: [0, 0], color: fade(single && !c.own ? 0.92 : 1) });
    hits.push({ kind: single ? 'marker' : 'cluster', marker: c, anchor: c.anchor, offset: [c.off[0], c.off[1], 0, 0], size: [cssW - 12 * (tag ? 0.72 : 1), cssH - 12 * (tag ? 0.72 : 1)], exp: [0, 0], pad: 7 });
  });
  return { sprites, hits };
};

// ------------------------------------------------------------------ the land: glyphs and roads
/**
 * Improvements, districts and resources as glyphs, and the roads, on the explored tiles of a
 * window of the world (from the hex zoom). `window`: { west, east, south, north } degrees.
 */
export const landSprites = ({ state, projection, k, window, isExplored, lens, closeGround, dpr }) => {
  const sprites = []; const lines = [];
  if (k < HEX_FROM_ZOOM || !window) return { sprites, lines };
  const tiles = getTiles();
  const ts = state.world?.tileState || {};
  const owner = state.world?.tileOwner || {};
  const resources = k >= RESOURCE_GLYPH_ZOOM;
  const centres = new Set(Object.values(state.regions).map((c) => c.tile));
  const onRoad = (t) => centres.has(t) || (!!ts[t]?.road && !ts[t]?.pillaged);
  const within = landTilesWithin(window).filter(isExplored);
  const roadTiles = new Set(within.filter(onRoad));
  const road = cssColor('#7c5a32');
  // No bridges for now: the map shows the raster's own rivers, not the grid's river edges (a deck
  // across a hex edge would stand beside the painted river, not on it). The rules keep their
  // crossings (terrainData.crossingsOf).
  roadTiles.forEach((t) => {
    const a = pointOf(projection, t);
    tiles.neighbors[t].forEach((n) => {
      if (n <= t || !roadTiles.has(n)) return;
      const b = pointOf(projection, n);
      const half = (projection.scale() * Math.PI); // half the world's width
      const bx = b[0] - a[0] > half ? b[0] - 2 * half : b[0] - a[0] < -half ? b[0] + 2 * half : b[0];
      lines.push({ a, b: [bx, b[1]], half: 0.8, exp: 0, color: [road[0], road[1], road[2], 0.85] });
    });
  });
  within.forEach((t) => {
    const e = ts[t];
    const resId = resources && tiles.resourceOf ? tiles.resourceOf(t) : null;
    const res = resId && RESOURCES_ON_TILES[resId]?.kind !== 'bonus' && (lens === 'yields' || owner[t] != null || tiles.neighbors[t].some((n) => owner[n] != null)) ? resId : null;
    if (!e?.improvement && !e?.district && !res) return;
    const anchor = pointOf(projection, t);
    const dim = e?.pillaged ? 0.45 : 1;
    let art = null;
    if (e?.district && DISTRICTS[e.district]) art = glyphArt({ kind: 'district', letter: DISTRICTS[e.district].glyph }, dpr);
    else if (e?.improvement && e.improvement !== 'road' && !(closeGround && WORK_KINDS.includes(e.improvement))) {
      art = glyphArt({ kind: 'improvement', iconUrl: improvementIconUrl(e.improvement), letter: IMPROVEMENT_GLYPH[e.improvement] || '•', own: owner[t] && state.regions[owner[t]]?.owner === state.playerNationId }, dpr);
    }
    if (art) sprites.push({ art, anchor, size: [art.css.w, art.css.h], color: fade(dim) });
    if (res && !e?.improvement && !e?.district) { const ra = glyphArt({ kind: 'resource', iconUrl: resourceIconUrl(res) }, dpr); sprites.push({ art: ra, anchor, size: [ra.css.w, ra.css.h], color: WHITE }); }
  });
  return { sprites, lines };
};

/**
 * The terrain pass's sprites (terrainModel.js): the mountain chains' peaks up to the close zoom
 * (the close view's 3D ridges take over there) and the pass marks from the region zoom. Drawn
 * under the territories, so the fog hides and greys them like the Earth. `near`: nearView.
 */
export const terrainSprites = ({ projection, k, near = null, dpr }) => {
  const sprites = [];
  if (k >= MOUNTAIN_SPRITES_FROM_K && k < CLOSE_ZOOM_K) {
    mountainPeaks(ridgeSegments(projection), k, near).forEach((p) => {
      const art = peakArt(p.variant, p.px, p.snow, dpr);
      sprites.push({ art, anchor: p.anchor, offset: [0, -art.css.h * PEAK_LIFT, 0, 0], size: [art.css.w, art.css.h], exp: [0, 0], color: WHITE });
    });
  }
  if (k >= PASS_MARK_FROM_K) {
    const px = Math.min(13, 6 + Math.sqrt(k) * 1.2);
    passPoints(projection).forEach(({ anchor }) => {
      if (near && !near(anchor)) return;
      const art = passArt(px, dpr);
      sprites.push({ art, anchor, size: [art.css.w, art.css.h], exp: [0, 0], color: WHITE });
    });
  }
  return sprites;
};

/** Wonders and the battles on the ground (in sight), from the region zoom. */
export const groundMarks = ({ state, projection, k, dpr }) => {
  const sprites = [];
  if (k < CITY_DETAIL_ZOOM) return sprites;
  Object.entries(state.world?.tileState || {}).forEach(([t, v]) => {
    if (!(v.wonder || (v.battle && v.battle.until >= state.turnNumber))) return;
    const anchor = pointOf(projection, Number(t));
    if (v.wonder) { const url = wonderIconUrl(v.wonder) || markerIconUrl('wonder'); if (url) { const art = iconArt(url, 18, dpr); sprites.push({ art, anchor, size: [art.css.w, art.css.h], color: WHITE }); } return; }
    const art = groundBattleArt(v.battle.outcome, 15, dpr);
    sprites.push({ art, anchor, size: [art.css.w, art.css.h], color: WHITE });
  });
  return sprites;
};

/** Settlers on their tiles: yours, and foreign ones in sight from zoom 2. */
export const settlerSprites = ({ state, projection, k, isVisible, dpr }) => {
  const sprites = []; const hits = [];
  const close = k >= CLOSE_ZOOM_K;
  Object.values(state.units || {}).forEach((u) => {
    if (!isSettler(u) || u.tile == null) return;
    const own = u.ownerId === state.playerNationId;
    if (!own && !(k >= 2 && isVisible(u.tile))) return;
    const anchor = pointOf(projection, u.tile);
    const rCss = close ? Math.min(5 * Math.sqrt(k), 6) : 5 * Math.sqrt(k);
    const art = settlerArt({ own, idle: own && u.target == null && !close, iconUrl: unitIconUrl('settler') }, rCss, dpr);
    sprites.push({ art, anchor, size: [art.css.w, art.css.h], color: WHITE });
    hits.push({ kind: 'settler', tile: u.tile, anchor, offset: [0, 0, 0, 0], size: [rCss * 2.3, rCss * 2.3], exp: [0, 0], round: true, pad: 4 });
  });
  return { sprites, hits };
};

// ------------------------------------------------------------------ march routes
/** The marches under way and the one being planned (MarchContext lines). */
export const marchShapes = ({ marchLines, projection, k, selectedArmy, dpr }) => {
  const lines = []; const sprites = [];
  const sk = Math.sqrt(k);
  const half = projection.scale() * Math.PI;
  (marchLines || []).forEach((l) => {
    const pts = [];
    l.points.forEach((t) => {
      const p = pointOf(projection, t);
      if (!p) return;
      const prev = pts[pts.length - 1];
      const x = prev && p[0] - prev[0] > half ? p[0] - 2 * half : prev && p[0] - prev[0] < -half ? p[0] + 2 * half : p[0];
      pts.push([x, p[1]]);
    });
    if (pts.length < 2) return;
    const preview = l.kind === 'preview';
    const colour = cssColor(preview ? '#fde68a' : l.halted ? '#f87171' : '#34d399');
    const faint = !preview && selectedArmy != null && l.points[0] !== selectedArmy;
    const op = faint ? 0.5 : 1;
    const w = 2.2; // CSS px times sqrt(k): the SVG's 2.2 / sqrt(k) world units
    for (let i = 1; i < pts.length; i++) lines.push({ a: pts[i - 1], b: pts[i], half: w * 0.9, exp: 0.5, color: [15 / 255, 23 / 255, 42 / 255, 0.55 * op] });
    for (let i = 1; i < pts.length; i++) lines.push({ a: pts[i - 1], b: pts[i], half: w * 0.45, dash: preview ? w * 3 : 0, gap: preview ? w * 2 : 0, exp: 0.5, color: [colour[0], colour[1], colour[2], op] });
    // the arrowhead: two short strokes back from the end
    const end = pts[pts.length - 1]; const prev = pts[pts.length - 2];
    const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    const ah = (5 * sk) / k; // world units
    [2.5, -2.5].forEach((da) => lines.push({ a: end, b: [end[0] + Math.cos(ang + da) * ah, end[1] + Math.sin(ang + da) * ah], half: w * 0.5, exp: 0.5, color: [colour[0], colour[1], colour[2], op] }));
    if (preview) l.marks.slice(0, -1).forEach((m) => { const p = pts[m.index]; if (!p) return; const d = discArt(16); sprites.push({ art: d, anchor: p, size: [3.2, 3.2], exp: [0.5, 0], color: [colour[0], colour[1], colour[2], 1] }); });
    if (!faint) {
      const turns = l.marks.length ? l.marks[l.marks.length - 1].turn : null;
      const text = l.halted ? 'halted' : turns != null ? `${turns} turn${turns === 1 ? '' : 's'}` : '';
      if (text) {
        const art = labelArt(text, { size: 10, weight: 700, fill: l.halted ? '#fecaca' : '#fff', stroke: 'rgba(15,23,42,0.85)', strokeW: 2.2 }, dpr);
        sprites.push({ art, anchor: end, offset: [0, -art.css.baseline + art.css.h / 2, 0, -9], size: [art.css.w, art.css.h], exp: [0, 0.5], color: WHITE });
      }
    }
  });
  return { lines, sprites };
};

// ------------------------------------------------------------------ lenses (lenses.js)
const circleLines = (centre, rWorld, style) => {
  const out = []; const n = 48;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2; const a1 = ((i + 1) / n) * Math.PI * 2;
    out.push({ ...style, a: [centre[0] + Math.cos(a0) * rWorld, centre[1] + Math.sin(a0) * rWorld], b: [centre[0] + Math.cos(a1) * rWorld, centre[1] + Math.sin(a1) * rWorld] });
  }
  return out;
};

/** The lens layer: tile tints (for the territory shader), and its sprites and lines. */
export const lensShapes = ({ state, projection, k, lens, dpr, settlerTile = null }) => {
  const out = { tints: null, sprites: [], lines: [] };
  // One of your settlers selected: the settle tints round it, whatever the lens (settle-rules R6).
  if (settlerTile != null && (!lens || lens === 'political')) return { ...out, tints: settleTints(state, [settlerTile]) };
  if (!lens || lens === 'political') return out;
  const at = (t) => pointOf(projection, t);
  if (lens === 'yields') {
    if (k < HEX_FROM_ZOOM) return out;
    yieldLabels(state).forEach((y) => {
      const art = labelArt(`${y.food}·${y.production}·${y.gold}`, { size: 9, weight: 700, fill: y.worked ? '#fef3c7' : '#cbd5e1', strokeW: 2 }, dpr);
      out.sprites.push({ art, anchor: at(y.tile), offset: [0, -art.css.baseline + art.css.h / 2, 0, 0], size: [art.css.w, art.css.h], color: WHITE });
    });
  } else if (lens === 'loyalty') {
    loyaltyDiscs(state).forEach((d) => {
      const c = cssColor(d.colour);
      out.sprites.push({ art: discArt(64), anchor: at(d.tile), size: [28, 28], exp: [0.5, 0], color: [c[0], c[1], c[2], 0.45] });
    });
  } else if (lens === 'threat') {
    airCover(state).forEach((a) => {
      const p = at(a.tile); const e = at(a.edgeTile);
      const r = Math.max(6 / k, Math.hypot(e[0] - p[0], e[1] - p[1]));
      const c = cssColor(a.own ? '#60a5fa' : '#f87171');
      out.sprites.push({ art: discArt(64), anchor: p, size: [r * 2, r * 2], exp: [1, 0], color: [c[0], c[1], c[2], 0.08] });
      out.lines.push(...circleLines(p, r, { half: 0.5, dash: 6, gap: 4, color: [c[0], c[1], c[2], 1] }));
      const art = labelArt(`✈ ${a.count}`, { size: 9, weight: 700, fill: a.own ? '#60a5fa' : '#f87171', strokeW: 2 }, dpr);
      out.sprites.push({ art, anchor: p, offset: [0, -10 - art.css.baseline + art.css.h / 2, 0, 0], size: [art.css.w, art.css.h], color: WHITE });
    });
    threatStacks(state).forEach((s) => {
      const p = at(s.tile); const e = at(s.edgeTile);
      const r = Math.max(6 / k, Math.hypot(e[0] - p[0], e[1] - p[1]));
      out.sprites.push({ art: discArt(64), anchor: p, size: [r * 2, r * 2], exp: [1, 0], color: [239 / 255, 68 / 255, 68 / 255, 0.14] });
      out.lines.push(...circleLines(p, r, { half: 0.5, dash: 4, gap: 3, color: [239 / 255, 68 / 255, 68 / 255, 0.6] }));
      const art = labelArt(s.strength.toLocaleString(), { size: 10, weight: 700, fill: '#fca5a5', strokeW: 2 }, dpr);
      out.sprites.push({ art, anchor: p, offset: [0, -2 - art.css.baseline + art.css.h / 2, 0, -r], size: [art.css.w, art.css.h], exp: [0, 1], color: WHITE });
    });
  } else if (lens === 'supply') {
    out.tints = [...supplyReach(state), ...supplyTints(state)];
  } else if (lens === 'settle') {
    // Where a settler may found a city (lenses.js settleTints, settle-rules R6).
    out.tints = settleTints(state);
  } else if (lens === 'trade') {
    const half = projection.scale() * Math.PI;
    tradeLines(state).forEach((r) => {
      const colour = cssColor(r.plundered ? '#f87171' : r.kind === 'sea' ? '#38bdf8' : '#fbbf24');
      const pts = [];
      r.tiles.forEach((t) => { const p = at(t); const prev = pts[pts.length - 1]; const x = prev && p[0] - prev[0] > half ? p[0] - 2 * half : prev && p[0] - prev[0] < -half ? p[0] + 2 * half : p[0]; pts.push([x, p[1]]); });
      for (let i = 1; i < pts.length; i++) out.lines.push({ a: pts[i - 1], b: pts[i], half: 1.25, dash: r.kind === 'sea' ? 6 : 0, gap: r.kind === 'sea' ? 4 : 0, color: [colour[0], colour[1], colour[2], 0.9] });
      if (r.plunderTile != null) {
        const c = cssColor('#f87171');
        out.sprites.push({ art: discArt(64), anchor: at(r.plunderTile), size: [14, 14], exp: [0.5, 0], color: [c[0], c[1], c[2], 0.35] });
      }
    });
  }
  return out;
};
