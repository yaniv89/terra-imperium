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
import { nameNow } from '../../../i18n/names';
import { getTiles } from '../../../data/geo/tiles';
import { cityLatLon, landTilesWithin } from '../../../data/geo/cityFeatures';
import { hexSizeVsF75 } from '../../../data/geo/gridScale';
import { getNationColor } from '../../../data/nationColors';
import { isIndependent, independentPersonality } from '../../../data/independents';
import { ageOf } from '../../../engine/nationState';
import { wallsOf } from '../../../engine/sieges';
import { loyaltyOf } from '../../../engine/loyalty';
import { OUTPOST_DONE, isSettler, MAX_SETTLE_KM } from '../../../engine/settlers';
import { DISTRICTS } from '../../../engine/districts';
import { RESOURCES_ON_TILES, resourceKnown } from '../../../data/tileYields';
import { resourceIconUrl, improvementIconUrl, wonderIconUrl, markerIconUrl, unitIconUrl, cityIconUrl } from '../../../data/icons';
import { townTier } from '../closeView/townTiers';
import { WORK_KINDS } from '../closeView/landscape';
import { ARMY_SPOT, unitPx, tiltFor, TIER_SCALE } from '../closeView/scale';
import { hexTownPx } from '../closeView/cityHex';
import { markerLatLng } from '../../../utils/markerPosition';
import { clusterScreenMarkers, MARKER_OFFSET, markerItems } from '../mapBanners';
import { bannerOffsetPx } from '../CityBanners';
import { yieldLabels, loyaltyDiscs, threatStacks, supplyTints, supplyReach, tradeLines, airCover, settleTints } from '../lenses';
import { cssColor } from './cssColor';
import { cityLabelPrio } from './declutter';
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
/** The least radius (CSS px) of a city badge's tap target below the hex zoom. */
export const CITY_TAP_MIN_R = 14;
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
  const ownerAge = (owner) => (ages[owner] ||= ageOf(state, owner));
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
      // the town's scale as the close view draws it: filling its hex (cityHex.js)
      const lean = Math.sin(tiltFor(k));
      const px = hexTownPx({ projection, tiles: getTiles(), tile: city.tile, k, radius: capRadius, lean, fill: !!tier, isTown, tierScale: tier ? TIER_SCALE[tier.id] || 1 : 1 });
      const below = bannerOffsetPx(radius, px, lean);
      const owner = city.owner || city.colony?.ownerId;
      const own = owner === state.playerNationId;
      const art = cityBannerArt({
        name: nameNow('city', null, city.name), size: city.size, colour: own ? PLAYER_BAND_COLOR : getNationColor(owner) || '#94a3b8', selected: city.id === selectedRegion,
        capital: !!city.isCapital, disloyal: !!city.owner && loyaltyOf(city) <= 25, indep: independentPersonality(state.nations, owner),
        siege: city.siege ? Math.max(0, Math.min(1, city.siege.hp / Math.max(1, city.siege.maxHp))) : null,
        outpost: city.outpost ? Math.max(0, Math.min(1, (city.outpost.progress || 0) / OUTPOST_DONE)) : null,
        build: own ? builds.get(city.id) ?? null : null
      }, dpr, bannerFont);
      const oy = below + art.css.h / 2 - art.css.pad;
      names.push({ art, anchor, offset: [0, oy, 0, 0], size: [art.css.w, art.css.h], exp: [0, 0], color: WHITE, prio: cityLabelPrio(city, { selected: city.id === selectedRegion, own }) });
      hits.push({ kind: 'banner', id: city.id, anchor, offset: [0, below + art.css.pillH / 2, 0, 0], size: [art.css.pillW, art.css.pillH], exp: [0, 0], pad: [4, 9] });
      return;
    }
    const rCss = r0 * sk;
    const art = badgeArt({
      r0, colour, capital: !!city.isCapital, indep: independentPersonality(state.nations, city.owner),
      fill: city.id === selectedRegion ? '#fde68a' : city.outpost ? '#e2e8f0' : '#f8fafc',
      iconUrl: city.outpost ? null : cityIconUrl(townTier(city)?.id, ownerAge(city.owner)),
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
    // The whole badge is the target, never smaller than a fingertip while the hexes are too small
    // to pick (the strategic zoom, where a badge is a few pixels and covers several tiles), and
    // the nearest badge wins where they stand close together (playtest audit I074).
    hits.push({ kind: 'city', id: city.id, anchor, offset: [0, 0, 0, 0], size: [r0 * 2, r0 * 2], exp: [0.5, 0], round: true, pad: 2, minR: k < HEX_FROM_ZOOM ? CITY_TAP_MIN_R : 0, nearest: true });
    if (k >= CITY_DETAIL_ZOOM || (k >= NAME_EARLY_ZOOM && (city.isCapital || city.owner === state.playerNationId))) {
      // a remembered town (fog, W03) says when it was last seen
      const label = labelArt(city.ghost && city.lastSeen ? `${nameNow('city', null, city.name)} · last seen T${city.lastSeen}` : nameNow('city', null, city.name), { size: 11, weight: 700, fill: city.ghost ? '#B9B19F' : isIndependent(state.nations, city.owner) ? '#DCD5F7' : '#fff' }, dpr);
      // the baseline 2 px over the disc, as the SVG's text
      names.push({ art: label, anchor, offset: [0, -2 - label.css.baseline + label.css.h / 2, 0, -r0], size: [label.css.w, label.css.h], exp: [0, 0.5], color: fade(city.ghost ? 0.6 : 1), prio: cityLabelPrio(city, { selected: city.id === selectedRegion, own: city.owner === state.playerNationId }) });
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
    // One size at every zoom: an army's banner over its soldiers in the close view is the banner of
    // the far map (it was drawn at 72% there, so the army shrank as the map zoomed in).
    const scale = dpr;
    const art = !single ? clusterArt(c.members.length, c.members.some((m) => m.own && m.kind !== 'battle'), scale)
      : c.kind === 'event' ? eventArt(scale) : c.kind === 'wonder' ? wonderArt(c, scale) : c.kind === 'colony' ? colonyArt(c, scale)
        : c.kind === 'battle' ? battleArt(c, scale, { sea: c.tile != null && waterTile?.(c.tile) }) : c.kind === 'fleet' ? fleetArt(c, atWar.has(c.ownerId), scale) : armyArt(c, atWar.has(c.ownerId), scale);
    const cssW = art.w / dpr; const cssH = art.h / dpr;
    // `glideKey`: a lone banner that may glide in from its last tile (marchGlide.js, I070)
    sprites.push({ art, anchor: c.anchor, offset: [c.off[0], c.off[1], 0, 0], size: [cssW, cssH], exp: [0, 0], color: fade(single && !c.own ? 0.92 : 1), glideKey: single ? c.key : null });
    hits.push({ kind: single ? 'marker' : 'cluster', marker: c, anchor: c.anchor, offset: [c.off[0], c.off[1], 0, 0], size: [cssW - 12, cssH - 12], exp: [0, 0], pad: 7 });
  });
  return { sprites, hits };
};

// ------------------------------------------------------------------ the land: glyphs and roads
/** How much larger than their base size (about 13 px) the tile glyphs are drawn at zoom `k`: 1 at
 * the resource zoom, up to GLYPH_MAX_SCALE in the close view, in steps of 0.25. */
export const GLYPH_MAX_SCALE = 1.75;
export const glyphScale = (k) => Math.max(1, Math.min(GLYPH_MAX_SCALE, Math.round(Math.sqrt(k / RESOURCE_GLYPH_ZOOM) * 4) / 4));

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
  // Glyphs grow with the zoom (they were one 13 px size, lost beside the close view's towns:
  // playtest audit I099), in steps so the atlas keeps a few sizes.
  const gs = glyphScale(k);
  const gdpr = dpr * gs;
  const sized = (art) => [art.w / dpr, art.h / dpr];
  const ageId = ageOf(state, state.playerNationId);
  within.forEach((t) => {
    const e = ts[t];
    // A resource nobody knows of yet is not drawn (oil in the Bronze Age: tileYields.resourceKnown, I096).
    const resId = resources && tiles.resourceOf ? tiles.resourceOf(t) : null;
    const known = resId && resourceKnown(resId, ageId) ? resId : null;
    const nearLand = lens === 'yields' || lens === 'settle' || owner[t] != null || tiles.neighbors[t].some((n) => owner[n] != null);
    // Strategic and luxury resources from the resource zoom; the food and production ones
    // (wheat, cattle, stone: every third tile has one) from the close view, or with the yields or
    // settle view on, so the far map is not covered in them (I097).
    const res = known && nearLand && (RESOURCES_ON_TILES[known]?.kind !== 'bonus' || closeGround || lens === 'yields' || lens === 'settle') ? known : null;
    if (!e?.improvement && !e?.district && !res) return;
    const anchor = pointOf(projection, t);
    const dim = e?.pillaged ? 0.45 : 1;
    let art = null;
    if (e?.district && DISTRICTS[e.district]) art = glyphArt({ kind: 'district', letter: DISTRICTS[e.district].glyph }, gdpr);
    else if (e?.improvement && e.improvement !== 'road' && !(closeGround && WORK_KINDS.includes(e.improvement))) {
      art = glyphArt({ kind: 'improvement', iconUrl: improvementIconUrl(e.improvement), letter: IMPROVEMENT_GLYPH[e.improvement] || '•', own: owner[t] && state.regions[owner[t]]?.owner === state.playerNationId }, gdpr);
    }
    if (art) sprites.push({ art, anchor, size: sized(art), color: fade(dim) });
    if (res) {
      // beside the improvement or district that stands on it (it used to hide under them), else on the tile
      const ra = glyphArt({ kind: 'resource', iconUrl: resourceIconUrl(res) }, art ? gdpr * 0.8 : gdpr);
      const size = art ? [ra.w / dpr, ra.h / dpr] : sized(ra);
      sprites.push({ art: ra, anchor, offset: art ? [size[0] * 0.62, -size[1] * 0.5, 0, 0] : [0, 0, 0, 0], size, color: WHITE });
    }
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

export const SETTLER_MIN_R = 6;
export const SETTLER_MAX_R = 13;
/** A settler disc's radius (CSS px) at zoom k: grows to SETTLER_MAX_R, never shrinks with the zoom. */
export const settlerRadius = (k) => Math.max(SETTLER_MIN_R, Math.min(5 * Math.sqrt(k), SETTLER_MAX_R));
/** Settlers on their tiles: yours, and foreign ones in sight from zoom 2. In the close view a
 * settler whose party model is drawn (`modelled(unit)`, closeView/settlerModels.js) keeps only its
 * tap target: the 3D party stands where the disc was. */
export const settlerSprites = ({ state, projection, k, isVisible, dpr, modelled = null }) => {
  const sprites = []; const hits = [];
  const close = k >= CLOSE_ZOOM_K;
  Object.values(state.units || {}).forEach((u) => {
    if (!isSettler(u) || u.tile == null) return;
    const own = u.ownerId === state.playerNationId;
    if (!own && !(k >= 2 && isVisible(u.tile))) return;
    const anchor = pointOf(projection, u.tile);
    // One readable size from the strategic zoom to the close view (it shrank to a 6 px dot beside
    // the 3D towns: playtest audit I099). In the close view the party model takes its place.
    const rCss = settlerRadius(k);
    if (!(close && modelled?.(u))) {
      const art = settlerArt({ own, idle: own && u.target == null && !close, iconUrl: unitIconUrl('settler') }, rCss, dpr);
      sprites.push({ art, anchor, size: [art.css.w, art.css.h], color: WHITE });
    }
    hits.push({ kind: 'settler', tile: u.tile, anchor, offset: [0, 0, 0, 0], size: [rCss * 2.3, rCss * 2.3], exp: [0, 0], round: true, pad: 4 });
  });
  return { sprites, hits };
};

// ------------------------------------------------------------------ a tile pointed at
/**
 * The outline of one tile (a build row's tile, playtest audit I042): a dark under-stroke and an
 * amber line round the hex, the same width on screen at every zoom; the corners taken the short
 * way round where the tile crosses the date line.
 */
export const tileOutline = ({ projection, tile, color = '#fbbf24', half = 1.6 }) => {
  if (tile == null || tile < 0) return [];
  const corners = getTiles().polygonOf(tile);
  const pts = [];
  const w = projection.scale() * Math.PI; // half the world's width
  corners.forEach((c) => {
    const p = projection([c.lon, c.lat]);
    if (!p) return;
    const prev = pts[pts.length - 1];
    pts.push([prev && p[0] - prev[0] > w ? p[0] - 2 * w : prev && p[0] - prev[0] < -w ? p[0] + 2 * w : p[0], p[1]]);
  });
  if (pts.length < 3) return [];
  const rgb = cssColor(color);
  const ring = pts.map((a, i) => [a, pts[(i + 1) % pts.length]]);
  return [
    ...ring.map(([a, b]) => ({ a, b, half: half + 1.2, exp: 0, color: [15 / 255, 23 / 255, 42 / 255, 0.6] })),
    ...ring.map(([a, b]) => ({ a, b, half, exp: 0, color: [rgb[0], rgb[1], rgb[2], 1] }))
  ];
};

// ------------------------------------------------------------------ march routes
/** Half the width of a march line, CSS px, at every zoom. */
export const MARCH_LINE_PX = 1.3;
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
    const settlers = l.kind === 'settlers'; // settlers on their way to a site (settleRoutes.js)
    const colour = cssColor(preview || settlers ? '#fde68a' : l.halted ? '#f87171' : '#34d399');
    const faint = !preview && selectedArmy != null && l.points[0] !== selectedArmy;
    const op = faint ? 0.5 : 1;
    // A thin line of the same width on screen at every zoom (it used to grow with the zoom, to
    // 14 px in the close view, and hid the land it crossed: playtest audit I071).
    const w = settlers ? MARCH_LINE_PX * 0.85 : MARCH_LINE_PX;
    const dashed = preview || settlers;
    for (let i = 1; i < pts.length; i++) lines.push({ a: pts[i - 1], b: pts[i], half: w + 0.9, exp: 0, color: [15 / 255, 23 / 255, 42 / 255, 0.5 * op] });
    for (let i = 1; i < pts.length; i++) lines.push({ a: pts[i - 1], b: pts[i], half: w, dash: dashed ? 7 : 0, gap: dashed ? 4 : 0, exp: 0, color: [colour[0], colour[1], colour[2], op] });
    // the arrowhead: two short strokes back from the end
    const end = pts[pts.length - 1]; const prev = pts[pts.length - 2];
    const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    const ah = Math.min(5 * sk, 9) / k; // world units: at most 9 px on screen
    [2.5, -2.5].forEach((da) => lines.push({ a: end, b: [end[0] + Math.cos(ang + da) * ah, end[1] + Math.sin(ang + da) * ah], half: w, exp: 0, color: [colour[0], colour[1], colour[2], op] }));
    if (preview) l.marks.slice(0, -1).forEach((m) => { const p = pts[m.index]; if (!p) return; const d = discArt(16); sprites.push({ art: d, anchor: p, size: [5, 5], exp: [0, 0], color: [colour[0], colour[1], colour[2], 1] }); });
    if (!faint) {
      const turns = l.marks.length ? l.marks[l.marks.length - 1].turn : null;
      const text = l.halted ? 'halted' : turns != null ? `${turns} turn${turns === 1 ? '' : 's'}` : '';
      if (text) {
        const art = labelArt(text, { size: 10, weight: 700, fill: l.halted ? '#fecaca' : '#fff', stroke: 'rgba(15,23,42,0.85)', strokeW: 2.2 }, dpr);
        sprites.push({ art, anchor: end, offset: [0, -12 - art.css.baseline + art.css.h / 2, 0, 0], size: [art.css.w, art.css.h], exp: [0, 0], color: WHITE });
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

/** A ranked site's mark, CSS px across, and how far round a settler the settle mode tints. */
export const SITE_MARK_PX = 20;
export const SETTLE_MODE_KM = MAX_SETTLE_KM;
/** The lens layer: tile tints (for the territory shader), and its sprites and lines. */
export const lensShapes = ({ state, projection, k, lens, dpr, settlerTile = null, sites = null }) => {
  const out = { tints: null, sprites: [], lines: [] };
  if (!lens || lens === 'political') return out;
  const at = (t) => pointOf(projection, t);
  if (lens === 'settle' && settlerTile != null) {
    // The settle mode (settleMode.js): the land this settler can reach, and the ranked sites as
    // numbered marks that keep their size at every zoom (a ring for a sound site, a dashed ring
    // for a poor one), so the good land is found from the strategic zoom too (I088, I089).
    out.tints = settleTints(state, [settlerTile], { km: SETTLE_MODE_KM });
    const placed = [];
    (sites || []).forEach((s, i) => {
      const p = at(s.tile);
      if (!p) return;
      // far out the sites stand within a few pixels of each other: the better one keeps its mark
      // (the bar still walks through all of them)
      if (placed.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) * k < SITE_MARK_PX * 0.9)) return;
      placed.push(p);
      const c = cssColor(s.poor ? '#fbbf24' : '#fde68a');
      out.sprites.push({ art: discArt(48), anchor: p, size: [SITE_MARK_PX, SITE_MARK_PX], exp: [0, 0], color: [15 / 255, 23 / 255, 42 / 255, 0.78] });
      out.sprites.push({ art: discArt(48, { ring: 5, dash: s.poor ? [7, 5] : null }), anchor: p, size: [SITE_MARK_PX + 2, SITE_MARK_PX + 2], exp: [0, 0], color: [c[0], c[1], c[2], 1] });
      const art = labelArt(String(i + 1), { size: 11, weight: 800, fill: s.poor ? '#fbbf24' : '#fde68a', stroke: null, strokeW: 0 }, dpr);
      out.sprites.push({ art, anchor: p, offset: [0, -art.css.baseline + art.css.h / 2 + 4, 0, 0], size: [art.css.w, art.css.h], exp: [0, 0], color: WHITE });
    });
    return out;
  }
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
