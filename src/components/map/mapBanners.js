// src/components/map/mapBanners.js
// How an army, a fleet or a battle looks on the map (plan §4a/4b). One HTML string per marker, so
// the flat map (a React overlay) and the globe (react-globe.gl's htmlElementsData, plain DOM) draw
// exactly the same banners. Every string is built from numbers and fixed ids, never from player
// text. The CSS lives in index.css (.map-banner*).
import { getNationColor } from '../../data/nationColors';
import { shortMen } from '../../utils/mapMarkers';

export const PLAYER_BANNER_COLOR = '#2563eb';
const REBEL_BANNER_COLOR = '#ea580c';

// Morale ring: green when fresh, through amber, to red when about to break.
export const moraleColor = (m) => (m >= 70 ? '#22c55e' : m >= 40 ? '#f59e0b' : '#ef4444');

const CLASS_GLYPH = {
  // Tiny 10x10 vector glyphs drawn under the soldier count.
  infantry: '<path d="M2 8 L8 2 M6.5 2 H8 V3.5" />',
  ranged: '<path d="M3 2 Q8 5 3 8 M3 2 V8" />',
  cavalry: '<path d="M2 8 L3 4 L6 3 L8 4 L7 5 L6 5 L6 8" />',
  siege: '<path d="M1.5 8 H8.5 M3 8 L5 3 L7 8 M5 3 L8.5 1.5" />',
  mixed: '<path d="M2 5 H8 M5 2 V8" />'
};

const bannerColor = (m, atWar) => (m.own ? PLAYER_BANNER_COLOR : m.rebels ? REBEL_BANNER_COLOR : getNationColor(m.ownerId) || (atWar ? '#ef4444' : '#64748b'));

const shield = (fill, stroke, strokeWidth) => `<path d="M2 2 H24 V17 Q24 25 13 30 Q2 25 2 17 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;

const BAND_PIPS = { small: 1, medium: 2, large: 3 };

// An army banner. `atWar`: the owner is at war with the player (a red rim on foreign banners).
export const armyBannerHtml = (m, { atWar = false } = {}) => {
  const fill = bannerColor(m, atWar);
  if (m.own) {
    const label = shortMen(m.men);
    return `<svg class="map-banner-svg" width="30" height="34" viewBox="0 0 26 32" aria-hidden="true">${shield(fill, moraleColor(m.morale), 2.4)}`
      + `<g transform="translate(8 17.5)" fill="none" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round">${CLASS_GLYPH[m.mainClass] || CLASS_GLYPH.infantry}</g></svg>`
      + `<span class="map-banner-label">${label}</span>`
      + (m.canMove ? '<span class="map-banner-dot" title="Can still move"></span>' : '');
  }
  const pips = BAND_PIPS[m.band] || 0;
  const inner = pips
    ? Array.from({ length: pips }, (_, i) => `<circle cx="${13 + (i - (pips - 1) / 2) * 5}" cy="14" r="1.8" fill="#f8fafc" />`).join('')
    : '<text x="13" y="18" text-anchor="middle" font-size="12" font-weight="800" fill="#f8fafc">?</text>';
  return `<svg class="map-banner-svg" width="22" height="26" viewBox="0 0 26 32" aria-hidden="true">${shield(fill, atWar ? '#ef4444' : 'rgba(15,23,42,0.9)', atWar ? 2.6 : 1.6)}${inner}</svg>`;
};

// A fleet: a round badge with a hull, and how many land units ride on it.
export const fleetBannerHtml = (m, { atWar = false } = {}) => {
  const fill = bannerColor(m, atWar);
  const size = m.own ? 24 : 18;
  return `<svg class="map-banner-svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">`
    + `<circle cx="12" cy="12" r="10.5" fill="${fill}" stroke="${atWar ? '#ef4444' : m.own ? '#e2e8f0' : 'rgba(15,23,42,0.9)'}" stroke-width="1.6" />`
    + '<path d="M5 13 H19 L16.5 17 H7.5 Z M12 6 V13 M12 6 L16 11 H12" fill="#f8fafc" stroke="#f8fafc" stroke-width="0.8" stroke-linejoin="round" /></svg>'
    + (m.own && m.embarked ? `<span class="map-banner-badge">${m.embarked}</span>` : '')
    + (m.own && m.canMove ? '<span class="map-banner-dot"></span>' : '');
};

// Last turn's battle: crossed swords, green rim if the player won, red if not.
export const battleBannerHtml = (b) => `<svg class="map-banner-svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">`
  + `<circle cx="12" cy="12" r="10.5" fill="#7f1d1d" stroke="${b.won ? '#22c55e' : b.outcome === 'stalemate' ? '#f59e0b' : '#f87171'}" stroke-width="2" />`
  + '<path d="M7 7 L17 17 M17 7 L7 17 M6 9.5 L9.5 6 M14.5 6 L18 9.5" stroke="#f8fafc" stroke-width="2" stroke-linecap="round" fill="none" /></svg>';

// A cluster: several banners that would overlap at this zoom.
export const clusterBannerHtml = (count, own) => `<span class="map-banner-cluster${own ? ' own' : ''}">${count}</span>`;

// Screen offsets so an army, a fleet and a battle in the same province do not cover each other.
export const MARKER_OFFSET = { army: [0, -14], fleet: [16, 4], battle: [-16, 2] };

// Greedy screen-space clustering: markers closer than `radius` px join the first one placed.
// `items` = [{ key, x, y, own, ... }] in priority order (own first). Returns
// [{ ...lead, members: [items] }].
export const clusterScreenMarkers = (items, radius) => {
  const out = [];
  const r2 = radius * radius;
  items.forEach((it) => {
    const near = out.find((c) => (c.x - it.x) ** 2 + (c.y - it.y) ** 2 < r2);
    if (near) near.members.push(it);
    else out.push({ ...it, members: [it] });
  });
  return out;
};

// The banner HTML for any placed marker (`kind` = army | fleet | battle), shared by both maps.
export const markerHtml = (m, atWar) => (m.kind === 'battle' ? battleBannerHtml(m)
  : m.kind === 'fleet' ? fleetBannerHtml(m, { atWar }) : armyBannerHtml(m, { atWar }));

// Flatten a getMapMarkers() result into one list, own markers first. `showForeign` false keeps only
// your own armies and fleets plus battles (the zoomed-out level of detail).
export const markerItems = (markers, showForeign) => {
  const out = [];
  const add = (list, kind, own) => list.forEach((m) => { if (kind === 'battle' || m.own === own) out.push({ ...m, own: kind === 'battle' ? true : m.own, kind, key: `${kind}:${m.id}` }); });
  add(markers.armies, 'army', true);
  add(markers.fleets, 'fleet', true);
  add(markers.battles, 'battle', true);
  if (showForeign) { add(markers.armies, 'army', false); add(markers.fleets, 'fleet', false); }
  return out;
};

// A plain DOM banner for the globe (react-globe.gl positions the outer, zero-size anchor at the
// province; the button sits at the marker kind's offset from it).
export const createMarkerElement = (item, atWar, onActivate) => {
  const anchor = document.createElement('div');
  anchor.className = 'map-banner-anchor';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `map-banner${item.own ? '' : ' foreign'}`;
  const [ox, oy] = MARKER_OFFSET[item.kind] || [0, 0];
  btn.style.transform = `translate(${ox}px, ${oy}px) translate(-50%, -50%)`;
  btn.dataset.marker = item.kind;
  btn.dataset.regionId = item.regionId;
  btn.innerHTML = item.kind === 'cluster' ? clusterBannerHtml(item.count, item.ownCluster) : markerHtml(item, atWar);
  btn.addEventListener('click', (e) => { e.stopPropagation(); onActivate(item); });
  // Keep a press on a banner from starting a globe drag.
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  anchor.appendChild(btn);
  return anchor;
};

// Globe clustering: banners closer than `radiusDeg` (great-circle degrees, roughly) become one
// numbered cluster item. On the globe a screen pixel is about altitude / 7.3 degrees at the centre,
// so radiusDeg = 3 x altitude keeps 26 px banners apart.
export const clusterGlobeItems = (items, radiusDeg) => {
  const placed = clusterScreenMarkers(items.map((m) => ({ ...m, x: m.lng * Math.cos((m.lat * Math.PI) / 180), y: m.lat })), radiusDeg);
  return placed.map((c) => (c.members.length === 1 ? c.members[0] : {
    key: `cluster:${c.members.map((m) => m.key).join(',')}`,
    kind: 'cluster', count: c.members.length, own: true,
    ownCluster: c.members.some((m) => m.own && m.kind !== 'battle'),
    lat: c.lat, lng: c.lng, regionId: c.regionId
  }));
};
