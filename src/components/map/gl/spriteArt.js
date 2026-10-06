// src/components/map/gl/spriteArt.js
// The pictures the WebGL map's sprites show, drawn with the 2D canvas into the atlas
// (spriteAtlas.js): city badges, names, army, fleet, battle, colony, wonder and event banners,
// clusters, tile glyphs, settlers, the close view's city banners and the lens labels. Each looks
// as the old SVG and HTML map drew it (Map2DView.jsx, mapBanners.js, CityBanners.jsx, the
// .map-banner and .city-banner CSS), at the device pixel size it is shown at, so it stays sharp.
// An art descriptor is { key, w, h, draw(ctx), pending }: w and h in device pixels; `pending`
// when an icon it shows has not loaded yet (the atlas drops it and the map draws it again once
// the image is in, onImageLoad).
// Real art for the WebGL map (plans/ART-PRODUCTION-PLAN.md, batch 08, spec S4) comes through
// mapSprites.js; until it is delivered these drawings are the placeholders.
import { moraleColor, PLAYER_BANNER_COLOR } from '../mapBanners';
import { shortMen } from '../../../utils/mapMarkers';
import { getNationColor } from '../../../data/nationColors';
import { unitIconUrl, shipIconUrl, wonderIconUrl, markerIconUrl } from '../../../data/icons';
import { spriteFrameUrl } from './mapSprites';

export const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// ------------------------------------------------------------------ images
const images = new Map(); // url -> HTMLImageElement
const listeners = new Set();
/** Called whenever an image the sprites wait for has loaded. Returns the unsubscribe. */
export const onImageLoad = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** The loaded image for a URL, or null while it loads (it starts loading on the first ask). */
export const imageFor = (url) => {
  if (!url || typeof Image === 'undefined') return null;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onload = () => listeners.forEach((fn) => fn(url));
    img.onerror = () => { img.failed = true; listeners.forEach((fn) => fn(url)); };
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
};
const waiting = (url) => !!url && typeof Image !== 'undefined' && !imageFor(url) && !images.get(url)?.failed;
const drawIcon = (ctx, url, x, y, w, h) => { const img = imageFor(url); if (img) ctx.drawImage(img, x, y, w, h); return !!img; };

// ------------------------------------------------------------------ text
let measureCtx = null;
const measure = (font, text) => {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 6;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
};
const fontOf = (size, weight = 700) => `${weight} ${size}px ${FONT}`;

/**
 * A text label: the old SVG's white text with a dark outline (paint order stroke). The sprite's
 * `baseline` (CSS px from its top) lets the caller put the text's baseline where the SVG did.
 */
export const labelArt = (text, { size = 11, weight = 700, fill = '#fff', stroke = 'rgba(0,0,0,0.75)', strokeW = 2.5 } = {}, dpr = 1) => {
  const s = String(text);
  const width = measure(fontOf(size, weight), s) + strokeW + 4;
  const h = Math.ceil(size * 1.45 + strokeW);
  const baseline = Math.round(size * 1.05 + strokeW / 2);
  return {
    key: `label|${s}|${size}|${weight}|${fill}|${stroke}|${strokeW}|${dpr}`,
    w: Math.ceil(width * dpr), h: Math.ceil(h * dpr), css: { w: Math.ceil(width * dpr) / dpr, h: Math.ceil(h * dpr) / dpr, baseline },
    draw: (ctx) => {
      ctx.scale(dpr, dpr);
      ctx.font = fontOf(size, weight); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      if (stroke && strokeW > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW; ctx.strokeText(s, width / 2, baseline); }
      ctx.fillStyle = fill; ctx.fillText(s, width / 2, baseline);
    }
  };
};

// ------------------------------------------------------------------ shapes
/** A plain disc or ring, white, tinted by the sprite colour (lens discs, the selection ring). */
export const discArt = (px = 64, { ring = 0, dash = null } = {}) => ({
  key: `disc|${px}|${ring}|${dash ? dash.join(',') : ''}`, w: px, h: px, css: { w: px, h: px },
  draw: (ctx) => {
    ctx.beginPath(); ctx.arc(px / 2, px / 2, px / 2 - ring / 2 - 0.5, 0, Math.PI * 2);
    if (ring > 0) { if (dash) ctx.setLineDash(dash); ctx.strokeStyle = '#fff'; ctx.lineWidth = ring; ctx.stroke(); } else { ctx.fillStyle = '#fff'; ctx.fill(); }
  }
});

// Art resolution of a badge: the radius in device pixels, in steps so a slow zoom reuses them.
const R_STEPS = [6, 8, 10, 12, 16, 20, 24, 32, 40, 48];
export const badgeRadiusStep = (rDevice) => R_STEPS.find((s) => s >= rDevice) || R_STEPS[R_STEPS.length - 1];
/** The badge's box in units of its radius: the capital mark, arcs and the siege mark reach past the disc. */
export const BADGE_BOX_R = 1.9;

/**
 * A city badge (Map2DView's badge: a disc with the skyline of the owner's age, the capital mark,
 * outpost and siege arcs, the wall bar, the loyalty dot, a disaster mark and the size box), drawn
 * at radius `rPx` device pixels. `r0`: the badge's base radius (the stroke widths scale with it).
 */
export const badgeArt = (b, rPx) => {
  const { r0, iconUrl, capitalUrl, colour, fill, outpost, siege, walls, disloyal, disaster, size, siegeUrl } = b;
  const box = Math.ceil(rPx * BADGE_BOX_R * 2);
  const pending = waiting(iconUrl) || waiting(capitalUrl) || waiting(siegeUrl);
  const q = (v) => (v == null ? '' : Math.round(v * 20));
  return {
    key: `badge|${rPx}|${Math.round(r0 * 10)}|${iconUrl || ''}|${capitalUrl || ''}|${colour}|${fill}|${q(outpost)}|${q(siege)}|${walls ? 1 : 0}|${disloyal ? 1 : 0}|${disaster || ''}|${size ?? ''}`,
    w: box, h: box, pending,
    draw: (ctx) => {
      const r = rPx; const c = box / 2;
      const sw = (1.6 / r0) * r; // the SVG's 1.6 / sqrt(k) against a radius of r0 / sqrt(k)
      ctx.translate(c, c);
      const arc = (share, radius, stroke, width) => {
        const a = Math.max(0.02, Math.min(1, share)) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + a);
        ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
      };
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      if (outpost != null) ctx.setLineDash([(2 / r0) * r, (2 / r0) * r]);
      ctx.strokeStyle = colour; ctx.lineWidth = (2 / r0) * r; ctx.stroke();
      ctx.setLineDash([]);
      if (outpost == null && iconUrl) drawIcon(ctx, iconUrl, -r * 0.92, -r * 0.92, r * 1.84, r * 1.84);
      if (capitalUrl) drawIcon(ctx, capitalUrl, -r * 1.35, -r * 1.35, r * 0.95, r * 0.95);
      else if (b.capital) { ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill(); }
      if (outpost != null) arc(outpost, r + sw * 1.2, '#fde68a', sw);
      if (siege != null) {
        arc(siege, r + sw * 1.2, '#f97316', sw);
        // the siege marker (icons/markers/siege when delivered, else the battle mark, else crossed swords)
        const s = r * 0.95;
        if (!(siegeUrl && drawIcon(ctx, siegeUrl, -s / 2, -r - sw * 2.5 - s * 0.8, s, s))) {
          ctx.font = fontOf(r * 0.9); ctx.textAlign = 'center'; ctx.fillStyle = '#fb923c';
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = sw * 0.8; ctx.strokeText('⚔', 0, -r - sw * 2.5); ctx.fillText('⚔', 0, -r - sw * 2.5);
        }
      }
      if (walls && outpost == null) { ctx.fillStyle = '#475569'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = sw * 0.4; ctx.fillRect(-r * 0.9, r * 0.45, r * 1.8, r * 0.35); ctx.strokeRect(-r * 0.9, r * 0.45, r * 1.8, r * 0.35); }
      if (disloyal) { ctx.beginPath(); ctx.arc(r * 0.85, -r * 0.85, r * 0.38, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = sw * 0.4; ctx.stroke(); }
      if (disaster) { ctx.font = fontOf(r * 0.9, 400); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(disaster === 'flood' ? '≈' : disaster === 'fire' ? '🔥' : '☠', -r * 0.95, -r * 0.6); }
      if (size != null) {
        const x = r * 0.35; const y = r * 0.3; const w = r * 1.05; const h = r * 0.85;
        ctx.beginPath(); ctx.roundRect?.(x, y, w, h, r * 0.3); if (!ctx.roundRect) ctx.rect(x, y, w, h);
        ctx.fillStyle = '#0f172a'; ctx.fill(); ctx.strokeStyle = colour; ctx.lineWidth = sw * 0.5; ctx.stroke();
        ctx.font = fontOf(r * 0.72); ctx.textAlign = 'center'; ctx.fillStyle = '#f8fafc'; ctx.fillText(String(size), x + w / 2, r * 0.97);
      }
    }
  };
};

// ------------------------------------------------------------------ banners (mapBanners.js)
const SHIELD = 'M2 2 H24 V17 Q24 25 13 30 Q2 25 2 17 Z';
const CLASS_GLYPH = {
  infantry: 'M2 8 L8 2 M6.5 2 H8 V3.5', ranged: 'M3 2 Q8 5 3 8 M3 2 V8', cavalry: 'M2 8 L3 4 L6 3 L8 4 L7 5 L6 5 L6 8',
  siege: 'M1.5 8 H8.5 M3 8 L5 3 L7 8 M5 3 L8.5 1.5', mixed: 'M2 5 H8 M5 2 V8'
};
const BAND_PIPS = { small: 1, medium: 2, large: 3 };
const REBEL_BANNER_COLOR = '#ea580c';
const path2d = (d) => (typeof Path2D !== 'undefined' ? new Path2D(d) : null);
export const bannerColour = (m, atWar) => (m.own ? PLAYER_BANNER_COLOR : m.rebels ? REBEL_BANNER_COLOR : getNationColor(m.ownerId) || (atWar ? '#ef4444' : '#64748b'));

// Every banner is drawn in CSS pixels on a box of css w x h (plus a margin for the shadow and the
// dots that stick out), scaled by `scale` (the device pixel ratio, times 0.72 for a close tag).
const MARGIN = 6;
const bannerBox = (key, cssW, cssH, scale, pending, paint) => ({
  key: `${key}|${scale}`, w: Math.ceil((cssW + MARGIN * 2) * scale), h: Math.ceil((cssH + MARGIN * 2) * scale), pending,
  css: { w: Math.ceil((cssW + MARGIN * 2) * scale) / scale, h: Math.ceil((cssH + MARGIN * 2) * scale) / scale },
  draw: (ctx) => {
    ctx.scale(scale, scale); ctx.translate(MARGIN, MARGIN);
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 2 * scale; ctx.shadowOffsetY = 1 * scale;
    paint(ctx);
  }
});
const svgBox = (ctx, vw, vh, w, h, fn) => { const s = Math.min(w / vw, h / vh); ctx.save(); ctx.translate((w - vw * s) / 2, (h - vh * s) / 2); ctx.scale(s, s); fn(); ctx.restore(); };
const dot = (ctx, x, y) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#facc15'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#0f172a'; ctx.stroke(); };

/** An army banner (armyBannerHtml): own with the main class, soldiers and a "can move" dot; foreign with pips. */
export const armyArt = (m, atWar, scale) => {
  const fill = bannerColour(m, atWar);
  if (m.own) {
    const icon = unitIconUrl(m.mainClass);
    const label = shortMen(m.men);
    return bannerBox(`army|own|${fill}|${moraleColor(m.morale)}|${m.mainClass}|${label}|${m.canMove ? 1 : 0}|${icon ? 'i' : 'g'}`, 30, 34, scale, waiting(icon), (ctx) => {
      svgBox(ctx, 26, 32, 30, 34, () => {
        ctx.fillStyle = fill; ctx.strokeStyle = moraleColor(m.morale); ctx.lineWidth = 2.4;
        const p = path2d(SHIELD); if (p) { ctx.fill(p); ctx.shadowColor = 'transparent'; ctx.stroke(p); }
        if (!(icon && drawIcon(ctx, icon, 5.5, 13, 15, 15))) {
          ctx.save(); ctx.translate(8, 17.5); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
          const g = path2d(CLASS_GLYPH[m.mainClass] || CLASS_GLYPH.infantry); if (g) ctx.stroke(g); ctx.restore();
        }
      });
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 1; ctx.shadowOffsetY = 1;
      ctx.font = fontOf(10, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
      ctx.fillText(label, 15, 4);
      ctx.shadowColor = 'transparent';
      if (m.canMove) dot(ctx, 28.5, 1.5);
    });
  }
  const pips = BAND_PIPS[m.band] || 0;
  return bannerBox(`army|foreign|${fill}|${atWar ? 1 : 0}|${pips}`, 22, 26, scale, false, (ctx) => {
    svgBox(ctx, 26, 32, 22, 26, () => {
      ctx.fillStyle = fill; ctx.strokeStyle = atWar ? '#ef4444' : 'rgba(15,23,42,0.9)'; ctx.lineWidth = atWar ? 2.6 : 1.6;
      const p = path2d(SHIELD); if (p) { ctx.fill(p); ctx.shadowColor = 'transparent'; ctx.stroke(p); }
      ctx.fillStyle = '#f8fafc';
      if (pips) for (let i = 0; i < pips; i++) { ctx.beginPath(); ctx.arc(13 + (i - (pips - 1) / 2) * 5, 14, 1.8, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.font = fontOf(12, 800); ctx.textAlign = 'center'; ctx.fillText('?', 13, 18); }
    });
  });
};

/** A fleet (fleetBannerHtml): a round badge with the ship line, and the embarked count. */
export const fleetArt = (m, atWar, scale) => {
  const fill = bannerColour(m, atWar);
  const size = m.own ? 24 : 18;
  const icon = m.own ? shipIconUrl(m.navalLine) : null;
  return bannerBox(`fleet|${m.own ? 1 : 0}|${fill}|${atWar ? 1 : 0}|${icon || ''}|${m.own ? m.embarked || 0 : 0}|${m.own && m.canMove ? 1 : 0}`, size, size, scale, waiting(icon), (ctx) => {
    svgBox(ctx, 24, 24, size, size, () => {
      ctx.beginPath(); ctx.arc(12, 12, 10.5, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = atWar ? '#ef4444' : m.own ? '#e2e8f0' : 'rgba(15,23,42,0.9)'; ctx.lineWidth = 1.6; ctx.stroke();
      if (!(icon && drawIcon(ctx, icon, 3.5, 3.5, 17, 17))) {
        const p = path2d('M5 13 H19 L16.5 17 H7.5 Z M12 6 V13 M12 6 L16 11 H12');
        if (p) { ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 0.8; ctx.fill(p); ctx.stroke(p); }
      }
    });
    if (m.own && m.embarked) {
      ctx.beginPath(); ctx.roundRect?.(size - 7, size - 9, 13, 13, 6.5); ctx.fillStyle = '#0f172a'; ctx.fill();
      ctx.font = fontOf(9); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fde68a'; ctx.fillText(String(m.embarked), size - 0.5, size - 2.5);
    }
    if (m.own && m.canMove) dot(ctx, size - 1.5, 1.5);
  });
};

/** Last turn's battle (battleBannerHtml); a sea battle uses icons/markers/sea-battle when delivered. */
export const battleArt = (b, scale, { sea = false } = {}) => {
  const icon = (sea && markerIconUrl('sea-battle')) || markerIconUrl('battle');
  const rim = b.won ? '#22c55e' : b.outcome === 'stalemate' ? '#f59e0b' : '#f87171';
  return bannerBox(`battle|${rim}|${icon || ''}`, 22, 22, scale, waiting(icon), (ctx) => {
    svgBox(ctx, 24, 24, 22, 22, () => {
      ctx.beginPath(); ctx.arc(12, 12, 10.5, 0, Math.PI * 2); ctx.fillStyle = '#7f1d1d'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke();
      if (!(icon && drawIcon(ctx, icon, 4, 4, 16, 16))) { const p = path2d('M7 7 L17 17 M17 7 L7 17 M6 9.5 L9.5 6 M14.5 6 L18 9.5'); if (p) { ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(p); } }
    });
  });
};

/** A colony (colonyBannerHtml): a tent with a ring that fills as it grows. */
export const colonyArt = (m, scale) => {
  const fill = m.own ? PLAYER_BANNER_COLOR : getNationColor(m.ownerId) || '#64748b';
  const size = m.own ? 24 : 18;
  const done = Math.max(0, Math.min(1, (m.progress || 0) / 100));
  return bannerBox(`colony|${fill}|${size}|${Math.round(done * 20)}`, size, size, scale, false, (ctx) => {
    svgBox(ctx, 24, 24, size, size, () => {
      ctx.beginPath(); ctx.arc(12, 12, 10, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(15,23,42,0.9)'; ctx.lineWidth = 2.4; ctx.stroke();
      if (done > 0) { ctx.beginPath(); ctx.arc(12, 12, 10, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2); ctx.strokeStyle = '#4ade80'; ctx.stroke(); }
      const p = path2d('M6.5 16.5 L12 7 L17.5 16.5 Z M12 16.5 V12.5'); if (p) { ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 0.8; ctx.fill(p); ctx.stroke(p); }
    });
  });
};

/** A wonder on its tile (wonderBannerHtml): a monument on a plinth in the owner's colour, pips per tier. */
export const wonderArt = (m, scale) => {
  const fill = m.own ? PLAYER_BANNER_COLOR : getNationColor(m.ownerId) || '#64748b';
  const size = m.own ? 24 : 20;
  const icon = wonderIconUrl(m.id) || markerIconUrl('wonder');
  return bannerBox(`wonder|${fill}|${size}|${icon || ''}|${m.tier || 1}`, size, size, scale, waiting(icon), (ctx) => {
    svgBox(ctx, 24, 24, size, size, () => {
      ctx.beginPath(); ctx.roundRect?.(3, 3, 18, 18, 4); if (!ctx.roundRect) ctx.rect(3, 3, 18, 18);
      ctx.fillStyle = fill; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(15,23,42,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      if (!(icon && drawIcon(ctx, icon, 4, 3, 16, 16))) { const p = path2d('M12 5 L15.5 17.5 H8.5 Z M6.5 18 H17.5'); if (p) { ctx.fillStyle = '#fef3c7'; ctx.fill(p); } }
      [1, 2, 3].forEach((t) => { ctx.beginPath(); ctx.arc(6 + (t - 1) * 6, 21.5, 1.6, 0, Math.PI * 2); ctx.fillStyle = t <= (m.tier || 1) ? '#fde68a' : 'rgba(15,23,42,0.6)'; ctx.fill(); });
    });
  });
};

/** The open event's city (eventBannerHtml). */
export const eventArt = (scale) => {
  const icon = markerIconUrl('event');
  return bannerBox(`event|${icon || ''}`, 24, 24, scale, waiting(icon), (ctx) => {
    ctx.beginPath(); ctx.arc(12, 12, 10.5, 0, Math.PI * 2); ctx.fillStyle = '#b45309'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2; ctx.stroke();
    if (!(icon && drawIcon(ctx, icon, 4, 4, 16, 16))) { ctx.strokeStyle = '#fffbeb'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(12, 6); ctx.lineTo(12, 13.5); ctx.stroke(); ctx.beginPath(); ctx.arc(12, 17.2, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#fffbeb'; ctx.fill(); }
  });
};

/** A cluster of banners too close to tell apart (clusterBannerHtml). */
export const clusterArt = (count, own, scale) => {
  const text = String(count);
  const w = Math.max(24, measure(fontOf(11, 800), text) + 14);
  return bannerBox(`cluster|${text}|${own ? 1 : 0}`, w, 24, scale, false, (ctx) => {
    ctx.beginPath(); ctx.roundRect?.(1, 1, w - 2, 22, 11); if (!ctx.roundRect) ctx.rect(1, 1, w - 2, 22);
    ctx.fillStyle = own ? '#2563eb' : '#334155'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = own ? '#e2e8f0' : '#94a3b8'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = fontOf(11, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(text, w / 2, 12.5);
  });
};

// ------------------------------------------------------------------ tile glyphs (Map2DView glyphElements)
/** An improvement (disc with its icon or letter), a district (square, glyph) or a resource (disc with icon, or diamond). */
export const glyphArt = ({ kind, iconUrl, letter, own }, dpr) => {
  const r = 5.2; const fs = 8; const box = Math.ceil((r * 2 + 3) * dpr);
  return {
    key: `glyph|${kind}|${iconUrl || ''}|${letter || ''}|${own ? 1 : 0}|${dpr}`, w: box, h: box, pending: waiting(iconUrl), css: { w: box / dpr, h: box / dpr },
    draw: (ctx) => {
      ctx.scale(dpr, dpr); ctx.translate(box / dpr / 2, box / dpr / 2);
      if (kind === 'district') {
        ctx.beginPath(); ctx.roundRect?.(-r, -r, r * 2, r * 2, r * 0.25); if (!ctx.roundRect) ctx.rect(-r, -r, r * 2, r * 2);
        ctx.fillStyle = '#c4b5fd'; ctx.fill(); ctx.strokeStyle = '#312e81'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.font = fontOf(fs); ctx.textAlign = 'center'; ctx.fillStyle = '#1e1b4b'; ctx.fillText(letter || '', 0, fs * 0.36);
      } else if (kind === 'improvement') {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = own ? '#fef3c7' : '#e2e8f0'; ctx.fill(); ctx.strokeStyle = '#44403c'; ctx.lineWidth = 0.8; ctx.stroke();
        if (!(iconUrl && drawIcon(ctx, iconUrl, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7))) { ctx.font = fontOf(fs); ctx.textAlign = 'center'; ctx.fillStyle = '#292524'; ctx.fillText(letter || '•', 0, fs * 0.36); }
      } else if (iconUrl) {
        ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.fillStyle = 'rgba(248,250,252,0.85)'; ctx.fill(); ctx.strokeStyle = '#701a75'; ctx.lineWidth = 0.7; ctx.stroke();
        drawIcon(ctx, iconUrl, -r * 0.95, -r * 0.95, r * 1.9, r * 1.9);
      } else {
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
        ctx.fillStyle = '#f0abfc'; ctx.fill(); ctx.strokeStyle = '#701a75'; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }
  };
};

/** An icon on the ground (a wonder's silhouette), `size` CSS px. */
export const iconArt = (url, size, dpr) => {
  const px = Math.ceil(size * dpr);
  return { key: `icon|${url}|${px}`, w: px, h: px, pending: waiting(url), css: { w: px / dpr, h: px / dpr }, draw: (ctx) => { drawIcon(ctx, url, 0, 0, px, px); } };
};

/**
 * A battle on the ground (fieldBattle.js marks; AI against AI included, in sight): the
 * `map-markers/ai-battle-clash` sheet when delivered, else crossed swords on a dark disc.
 */
export const groundBattleArt = (outcome, size, dpr) => {
  const sheet = spriteFrameUrl('ai-battle-clash', 0);
  const icon = markerIconUrl('battle');
  const px = Math.ceil(size * dpr);
  return {
    key: `groundBattle|${outcome}|${px}|${sheet || ''}`, w: px, h: px, pending: waiting(sheet) || waiting(icon), css: { w: px / dpr, h: px / dpr },
    draw: (ctx) => {
      if (sheet && drawIcon(ctx, sheet, 0, 0, px, px)) return;
      ctx.beginPath(); ctx.arc(px / 2, px / 2, px * 0.3, 0, Math.PI * 2); ctx.fillStyle = outcome === 'attacker' ? 'rgba(127,29,29,0.7)' : 'rgba(30,41,59,0.7)'; ctx.fill();
      if (icon) drawIcon(ctx, icon, 0, 0, px, px);
    }
  };
};

/** A settler on its tile: the wagon on a disc in its side's colour (or the old tent), the idle ring. */
export const settlerArt = ({ own, idle, iconUrl }, rCss, dpr) => {
  const r = Math.max(2, rCss); const box = Math.ceil((r * 3.6 + 2) * dpr);
  const step = Math.round(r * dpr);
  return {
    key: `settler|${own ? 1 : 0}|${idle ? 1 : 0}|${iconUrl || ''}|${step}`, w: box, h: box, pending: waiting(iconUrl), css: { w: box / dpr, h: box / dpr },
    draw: (ctx) => {
      ctx.scale(dpr, dpr); ctx.translate(box / dpr / 2, box / dpr / 2);
      const fill = own ? '#fde68a' : '#e2e8f0'; const stroke = own ? '#92400e' : '#334155';
      if (iconUrl) {
        ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(0.8, r * 0.24); ctx.stroke();
        drawIcon(ctx, iconUrl, -r, -r, r * 2, r * 2);
      } else {
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, r * 0.8); ctx.lineTo(-r, r * 0.8); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.stroke();
      }
      if (idle) { ctx.beginPath(); ctx.setLineDash([r * 0.6, r * 0.4]); ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = Math.max(0.6, r * 0.2); ctx.stroke(); }
    }
  };
};

// ------------------------------------------------------------------ the close view's city banner (CityBanners.jsx)
/**
 * The pill under a town: a disc of the owner's colour with the size (a tent for an outpost), the
 * capital star, the name, the low loyalty and siege marks, a siege or outpost bar. `font`: 12 px,
 * 11 on a phone held sideways. Returns the art with `css.w`, `css.h`.
 */
export const cityBannerArt = (c, dpr, font = 12) => {
  const star = markerIconUrl('capital'); const siegeIcon = markerIconUrl('siege') || markerIconUrl('battle');
  const sizeText = c.outpost != null ? '⛺' : String(c.size || 1);
  const nameW = measure(fontOf(font), c.name);
  const sizeW = Math.max(20, measure(fontOf(font, 800), sizeText) + 10);
  const extras = (c.capital ? 17 : 0) + (c.disloyal ? 16 : 0) + (c.siege != null ? 17 : 0);
  const w = Math.ceil(sizeW + 6 + nameW + extras + 9 + 3);
  const h = Math.ceil(font + 8 + 3);
  const pad = 6; const cw = w + pad * 2; const ch = h + pad * 2 + 4;
  return {
    key: `cityBanner|${c.name}|${sizeText}|${c.colour}|${c.selected ? 1 : 0}|${c.capital ? 1 : 0}|${c.disloyal ? 1 : 0}|${c.siege == null ? '' : Math.round(c.siege * 20)}|${c.outpost == null ? '' : Math.round(c.outpost * 20)}|${font}|${dpr}`,
    w: Math.ceil(cw * dpr), h: Math.ceil(ch * dpr), pending: waiting(c.capital ? star : null) || waiting(c.siege != null ? siegeIcon : null),
    css: { w: Math.ceil(cw * dpr) / dpr, h: Math.ceil(ch * dpr) / dpr, pillW: w, pillH: h, pad },
    draw: (ctx) => {
      ctx.scale(dpr, dpr); ctx.translate(pad, pad);
      const pill = () => { ctx.beginPath(); ctx.roundRect?.(0.75, 0.75, w - 1.5, h - 1.5, h / 2); if (!ctx.roundRect) ctx.rect(0.75, 0.75, w - 1.5, h - 1.5); };
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      pill(); ctx.fillStyle = 'rgba(15,23,42,0.86)'; ctx.fill();
      ctx.shadowColor = 'transparent';
      // the size disc
      ctx.save(); pill(); ctx.clip();
      ctx.fillStyle = c.colour; ctx.fillRect(0, 0, sizeW, h);
      ctx.restore();
      ctx.font = fontOf(font, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#0f172a';
      ctx.fillText(sizeText, sizeW / 2, h / 2 + 0.5);
      // the name and its marks
      let x = sizeW + 6;
      if (c.capital) { if (!(star && drawIcon(ctx, star, x, h / 2 - 7, 14, 14))) { ctx.fillStyle = '#fde68a'; ctx.font = fontOf(11); ctx.textAlign = 'left'; ctx.fillText('★', x, h / 2); } x += 17; }
      ctx.font = fontOf(font); ctx.textAlign = 'left'; ctx.fillStyle = '#f8fafc'; ctx.fillText(c.name, x, h / 2 + 0.5); x += nameW + 2;
      if (c.disloyal) { ctx.beginPath(); ctx.roundRect?.(x, h / 2 - 6.5, 12, 13, 6); ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = fontOf(10); ctx.textAlign = 'center'; ctx.fillText('!', x + 6, h / 2 + 0.5); x += 16; }
      if (c.siege != null) { if (!(siegeIcon && drawIcon(ctx, siegeIcon, x, h / 2 - 7, 14, 14))) { ctx.fillStyle = '#fb923c'; ctx.font = fontOf(11); ctx.textAlign = 'left'; ctx.fillText('⚔', x, h / 2); } }
      pill(); ctx.strokeStyle = c.selected ? '#fde68a' : c.colour; ctx.lineWidth = 1.5; ctx.stroke();
      if (c.selected) { ctx.beginPath(); ctx.roundRect?.(-1.25, -1.25, w + 2.5, h + 2.5, h / 2 + 2); ctx.strokeStyle = 'rgba(253,230,138,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
      const bar = c.siege ?? c.outpost;
      if (bar != null) {
        ctx.fillStyle = 'rgba(15,23,42,0.85)'; ctx.fillRect(12, h + 2, w - 24, 3);
        ctx.fillStyle = c.siege != null ? '#f97316' : '#fde68a'; ctx.fillRect(12, h + 2, (w - 24) * Math.max(0, Math.min(1, bar)), 3);
      }
    }
  };
};
