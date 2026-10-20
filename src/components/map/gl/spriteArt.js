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
import { getLanguage } from '../../../i18n/core';
import { moraleColor, PLAYER_BANNER_COLOR } from '../mapBanners';
import { shortMen } from '../../../utils/mapMarkers';
import { getNationColor } from '../../../data/nationColors';
import { unitIconUrl, shipIconUrl, wonderIconUrl, markerIconUrl, iconUrl } from '../../../data/icons';
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
// Hebrew (phase H4b): the canvas draws with Heebo first, which the Hebrew stylesheet loads on the first
// switch (i18n/index.js). A sprite drawn before the font arrives keeps the fallback, and its key says so,
// so it is drawn again with Heebo (as the display font below).
const HEBREW = /[\u0590-\u05FF]/;
const hebrewOn = () => getLanguage() === 'he';
const hebrewFontReady = () => {
  try {
    if (typeof document === 'undefined' || !document.fonts) return true;
    document.fonts.load('700 12px Heebo', '\u05D0').catch(() => {});
    return document.fonts.check('700 12px Heebo', '\u05D0');
  } catch { return true; }
};
const stackOf = () => (hebrewOn() ? `Heebo, ${FONT}` : FONT);
const fontOf = (size, weight = 700) => `${weight} ${size}px ${stackOf()}`;

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
    key: `label|${s}|${size}|${weight}|${fill}|${stroke}|${strokeW}|${dpr}${HEBREW.test(s) ? `|he${hebrewFontReady() ? 1 : 0}` : ''}`,
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

// ------------------------------------------------------------------ terrain (phase F)
// The mountain chains' peaks up to the close zoom (terrainModel.mountainPeaks) and the pass mark.
// Placeholders for the `map-terrain/mountain-ridges` kit (ART-PRODUCTION-PLAN batch 14, spec S11),
// which will arrive as src/assets/map/terrain/mountain-ridges.glb for the close view; these flat
// pictures stay the far and regional look. A peak is lit from the north-west like the raster's
// hillshade, its base on the ridge line (the sprite is offset up by PEAK_LIFT of its height).
const PEAK_SHAPES = [
  [[0, 1], [0.32, 0.28], [0.44, 0.42], [0.58, 0.08], [1, 1]],
  [[0, 1], [0.46, 0.04], [0.62, 0.36], [0.74, 0.24], [1, 1]],
  [[0, 1], [0.28, 0.4], [0.4, 0.3], [0.54, 0.12], [0.8, 0.5], [1, 1]]
];
export const PEAK_LIFT = 0.38;
/** A peak `cssPx` wide (in 2 px steps), variant 0 to 2, with a snow cap or not. */
export const peakArt = (variant, cssPx, snow, dpr) => {
  const wCss = Math.max(4, Math.round(cssPx / 2) * 2); const hCss = Math.round(wCss * 0.72);
  const w = Math.ceil(wCss * dpr) + 2; const h = Math.ceil(hCss * dpr) + 2;
  const shape = PEAK_SHAPES[variant % PEAK_SHAPES.length];
  return {
    key: `peak|${variant % PEAK_SHAPES.length}|${wCss}|${snow ? 1 : 0}|${dpr}`, w, h, css: { w: w / dpr, h: h / dpr },
    draw: (ctx) => {
      const X = (u) => 1 + u * (w - 2); const Y = (v) => 1 + v * (h - 2);
      const top = shape.reduce((m, p) => (p[1] < m[1] ? p : m), shape[0]);
      const outline = () => { ctx.beginPath(); shape.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v)))); ctx.closePath(); };
      // the shaded east face, then the lit west face up to the summit's fall line
      outline(); ctx.fillStyle = '#6f5f4c'; ctx.fill();
      ctx.save(); outline(); ctx.clip();
      ctx.beginPath(); ctx.moveTo(X(0), Y(1)); shape.slice(1).forEach(([u, v]) => { if (u <= top[0]) ctx.lineTo(X(u), Y(v)); });
      ctx.lineTo(X(top[0] + 0.1), Y(1)); ctx.closePath(); ctx.fillStyle = '#b9a586'; ctx.fill();
      if (snow) { ctx.fillStyle = 'rgba(248,250,252,0.95)'; ctx.fillRect(0, 0, w, Y(top[1] + 0.3)); }
      ctx.restore();
      outline(); ctx.strokeStyle = 'rgba(48,38,28,0.85)'; ctx.lineWidth = Math.max(0.8, dpr * 0.7); ctx.lineJoin = 'round'; ctx.stroke();
    }
  };
};
/** The mark on a mountain pass: two facing arcs (a saddle) on a pale halo, `cssPx` across. */
export const passArt = (cssPx, dpr) => {
  const px = Math.ceil(cssPx * dpr);
  return {
    key: `pass|${px}`, w: px, h: px, css: { w: px / dpr, h: px / dpr },
    draw: (ctx) => {
      const c = px / 2;
      ctx.beginPath(); ctx.arc(c, c, c - 0.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(254,243,199,0.8)'; ctx.fill();
      ctx.strokeStyle = '#3f2d1d'; ctx.lineWidth = Math.max(1, px * 0.12); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(c - px * 0.62, c, px * 0.42, -0.75, 0.75); ctx.stroke();
      ctx.beginPath(); ctx.arc(c + px * 0.62, c, px * 0.42, Math.PI - 0.75, Math.PI + 0.75); ctx.stroke();
    }
  };
};

// Art resolution of a badge: the radius in device pixels, in steps so a slow zoom reuses them.
const R_STEPS = [6, 8, 10, 12, 16, 20, 24, 32, 40, 48];
export const badgeRadiusStep = (rDevice) => R_STEPS.find((s) => s >= rDevice) || R_STEPS[R_STEPS.length - 1];
/** The badge's box in units of its radius: the capital mark, arcs and the siege mark reach past the disc. */
export const BADGE_BOX_R = 1.9;
/** An independent city's badge: the diamond's points, in units of the disc's radius, and its colour. */
export const INDEP_DIAMOND_R = 1.55;
export const INDEP_BADGE_COLOUR = '#9C8FD0';
/** The independent's shield on the far map: half its width, in units of the disc's radius. */
export const INDEP_SHIELD_R = 1.3;
/** The shield of an independent's personality, or null (a major's city, or no art: the diamond). */
export const independentShieldUrl = (personality) => (personality ? iconUrl('independents', typeof personality === 'string' ? personality : 'tribal') : null);
/** The independent city banner's frame (a swallow-tailed ribbon, drawn in three slices), or null. */
export const independentBannerUrl = () => iconUrl('independents', 'banner-frame');

/**
 * A city badge (Map2DView's badge: a disc with the skyline of the owner's age, the capital mark,
 * outpost and siege arcs, the wall bar, the loyalty dot, a disaster mark and the size box), drawn
 * at radius `rPx` device pixels. `r0`: the badge's base radius (the stroke widths scale with it).
 */
export const badgeArt = (b, rPx) => {
  const { r0, capitalUrl, colour, fill, outpost, siege, walls, disloyal, disaster, size, siegeUrl } = b;
  // An independent city: its personality's shield (src/assets/icons/independents) in place of the
  // disc and the skyline, a shape and an emblem of its own (I082); the violet diamond while it loads.
  const shield = independentShieldUrl(b.indep);
  const iconUrl = shield ? null : b.iconUrl;
  const box = Math.ceil(rPx * BADGE_BOX_R * 2);
  const pending = waiting(iconUrl) || waiting(capitalUrl) || waiting(siegeUrl) || waiting(shield);
  const q = (v) => (v == null ? '' : Math.round(v * 20));
  return {
    key: `badge|${rPx}|${Math.round(r0 * 10)}|${iconUrl || ''}|${capitalUrl || ''}|${colour}|${fill}|${b.indep ? `i${b.indep}` : ''}|${q(outpost)}|${q(siege)}|${walls ? 1 : 0}|${disloyal ? 1 : 0}|${disaster || ''}|${size ?? ''}`,
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
      // An independent city: a violet diamond behind the disc, its four points showing past it
      // (a shape of its own, not only a colour: playtest audit I082).
      const shielded = !!shield && drawIcon(ctx, shield, -r * INDEP_SHIELD_R, -r * INDEP_SHIELD_R * 1.04, r * INDEP_SHIELD_R * 2, r * INDEP_SHIELD_R * 2);
      if (b.indep && !shielded) {
        const d = r * INDEP_DIAMOND_R;
        ctx.beginPath(); ctx.moveTo(0, -d); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.lineTo(-d, 0); ctx.closePath();
        ctx.fillStyle = INDEP_BADGE_COLOUR; ctx.fill(); ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = sw * 0.5; ctx.stroke();
      }
      if (!shielded) {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        if (outpost != null) ctx.setLineDash([(2 / r0) * r, (2 / r0) * r]);
        ctx.strokeStyle = colour; ctx.lineWidth = (2 / r0) * r; ctx.stroke();
        ctx.setLineDash([]);
      }
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
    const stacked = m.count > 1 ? m.count : 0; // units on the tile: one flag shows them all (a small count)
    return bannerBox(`army|own|${fill}|${moraleColor(m.morale)}|${m.mainClass}|${label}|${m.canMove ? 1 : 0}|${icon ? 'i' : 'g'}|${stacked}`, 30, 34, scale, waiting(icon), (ctx) => {
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
      if (stacked) {
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(3.5, 30.5, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.font = fontOf(8, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f8fafc';
        ctx.fillText(String(Math.min(stacked, 99)), 3.5, 31);
      }
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
// The display font of the Field Atlas look (plans/UI-DESIGN.md), used once it has loaded: a sprite
// drawn before keeps the fallback, and its key says so, so it is redrawn with the real font later.
const DISPLAY_FONT = '"Spectral SC", Georgia, serif';
const MONO_FONT = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const displayReady = (size) => { try { return typeof document !== 'undefined' && !!document.fonts?.check(`700 ${size}px "Spectral SC"`); } catch { return false; } };

/**
 * The pill under a town (W02, Field Atlas): a disc of the owner's colour with the size (a tent for
 * an outpost), the capital star, the name in Spectral SC, the low loyalty and siege marks, and a
 * thin bar under it: the siege, the outpost's growth, or (your cities) the production of what it
 * builds (`c.build`, 0 to 1). `font`: 12 px, 11 on a phone held sideways. Returns the art with
 * `css.w`, `css.h`.
 */
export const cityBannerArt = (c, dpr, font = 12) => {
  const star = markerIconUrl('capital'); const siegeIcon = markerIconUrl('siege') || markerIconUrl('battle');
  const sizeText = c.outpost != null ? '⛺' : String(c.size || 1);
  const display = displayReady(font + 1);
  const heb = HEBREW.test(c.name);
  const nameFont = heb ? `700 ${font + 1}px Heebo, ${FONT}` : display ? `700 ${font + 1}px ${DISPLAY_FONT}` : fontOf(font);
  const sizeFont = display ? `600 ${font - 1}px ${MONO_FONT}` : fontOf(font - 1, 800);
  const nameW = measure(nameFont, c.name);
  const disc = font + 6;
  const extras = (c.capital ? 17 : 0) + (c.disloyal ? 16 : 0) + (c.siege != null ? 17 : 0);
  const h = Math.ceil(font + 12);
  // An independent city: the swallow-tailed frame (src/assets/icons/independents/banner-frame.svg)
  // in place of the pill, its personality's shield in place of the size disc, the size on the
  // shield's foot; the tails take `tail` px at each end. The diamond pill while they load.
  const shield = independentShieldUrl(c.indep); const frame = c.indep ? independentBannerUrl() : null;
  const framed = !!(shield && frame && imageFor(shield) && imageFor(frame));
  const tail = framed ? Math.round(h * 0.42) : 0;
  const w = Math.ceil(3 + disc + 6 + nameW + extras + 9) + tail * 2;
  const bar = c.siege ?? c.outpost ?? c.build ?? null;
  const pad = 6; const cw = w + pad * 2; const ch = h + pad * 2 + 5;
  const q = (v) => (v == null ? '' : Math.round(v * 20));
  return {
    key: `cityBanner|${c.name}|${heb ? `he${hebrewFontReady() ? 1 : 0}|` : ''}${sizeText}|${c.colour}|${c.indep ? `i${c.indep}${framed ? 'f' : ''}` : ''}${c.selected ? 1 : 0}|${c.capital ? 1 : 0}|${c.disloyal ? 1 : 0}|${q(c.siege)}|${q(c.outpost)}|${q(c.build)}|${font}|${display ? 1 : 0}|${dpr}`,
    w: Math.ceil(cw * dpr), h: Math.ceil(ch * dpr), pending: waiting(c.capital ? star : null) || waiting(c.siege != null ? siegeIcon : null) || waiting(shield) || waiting(frame),
    css: { w: Math.ceil(cw * dpr) / dpr, h: Math.ceil(ch * dpr) / dpr, pillW: w, pillH: h, pad },
    draw: (ctx) => {
      ctx.scale(dpr, dpr); ctx.translate(pad, pad);
      const pill = (x = 0.5, y = 0.5, pw = w - 1, ph = h - 1) => { ctx.beginPath(); ctx.roundRect?.(x, y, pw, ph, ph / 2); if (!ctx.roundRect) ctx.rect(x, y, pw, ph); };
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      if (framed) {
        // the ribbon in three slices: the tails at their own shape, the middle stretched
        const img = imageFor(frame); const cap = (h * 48) / 64;
        ctx.drawImage(img, 0, 0, 48, 64, 0, 0, cap, h);
        ctx.drawImage(img, 208, 0, 48, 64, w - cap, 0, cap, h);
        ctx.drawImage(img, 56, 0, 144, 64, cap - 1, 0, w - 2 * cap + 2, h); // over both joins, so no seam shows
      } else { pill(); ctx.fillStyle = 'rgba(26,33,43,0.92)'; ctx.fill(); }
      ctx.shadowColor = 'transparent';
      if (framed) {
        // the personality's shield, a little taller than the ribbon, the size on its foot
        const sh = h + 6; const sx = tail + 3 + disc / 2;
        drawIcon(ctx, shield, sx - sh / 2, -3, sh, sh);
        ctx.beginPath(); ctx.arc(sx + sh * 0.3, h - 1, font * 0.42, 0, Math.PI * 2); ctx.fillStyle = '#10141A'; ctx.fill(); ctx.strokeStyle = '#CDB27A'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = fontOf(Math.round(font * 0.62), 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ECE5D3';
        ctx.fillText(sizeText, sx + sh * 0.3, h - 0.5);
      } else {
        // the size disc; a diamond for an independent city (a shape, not only a colour: I082)
        ctx.beginPath();
        if (c.indep) { const cx = 3 + disc / 2; const hd = disc / 2 + 1; ctx.moveTo(cx, h / 2 - hd); ctx.lineTo(cx + hd, h / 2); ctx.lineTo(cx, h / 2 + hd); ctx.lineTo(cx - hd, h / 2); ctx.closePath(); } else ctx.arc(3 + disc / 2, h / 2, disc / 2, 0, Math.PI * 2);
        ctx.fillStyle = c.colour; ctx.fill();
        ctx.font = sizeFont; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#10141A';
        ctx.fillText(sizeText, 3 + disc / 2, h / 2 + 0.5);
      }
      // the name and its marks
      let x = tail + 3 + disc + 6;
      ctx.font = nameFont; ctx.textAlign = 'left'; ctx.fillStyle = '#ECE5D3'; ctx.fillText(c.name, x, h / 2 + 0.5); x += nameW + 3;
      if (c.capital) { if (!(star && drawIcon(ctx, star, x, h / 2 - 7, 14, 14))) { ctx.fillStyle = '#ECE5D3'; ctx.font = fontOf(11); ctx.textAlign = 'left'; ctx.fillText('★', x, h / 2); } x += 17; }
      if (c.disloyal) { ctx.beginPath(); ctx.roundRect?.(x, h / 2 - 6.5, 12, 13, 6); ctx.fillStyle = '#E5604D'; ctx.fill(); ctx.fillStyle = '#10141A'; ctx.font = fontOf(10); ctx.textAlign = 'center'; ctx.fillText('!', x + 6, h / 2 + 0.5); x += 16; }
      if (c.siege != null) { if (!(siegeIcon && drawIcon(ctx, siegeIcon, x, h / 2 - 7, 14, 14))) { ctx.fillStyle = '#EE8A3A'; ctx.font = fontOf(11); ctx.textAlign = 'left'; ctx.fillText('⚔', x, h / 2); } }
      if (!framed) { pill(); ctx.strokeStyle = c.colour; ctx.lineWidth = 1; ctx.stroke(); }
      // selected: a 2 px light outline (selection is never brass)
      if (c.selected) { pill(-1.5, -1.5, w + 3, h + 3); ctx.strokeStyle = '#ECE5D3'; ctx.lineWidth = 2; ctx.stroke(); }
      if (bar != null) {
        const bw = Math.min(56, w - 16); const bx = (w - bw) / 2;
        ctx.beginPath(); ctx.roundRect?.(bx, h + 3, bw, 3, 1.5); if (!ctx.roundRect) ctx.rect(bx, h + 3, bw, 3); ctx.fillStyle = '#33404F'; ctx.fill();
        ctx.beginPath(); ctx.roundRect?.(bx, h + 3, Math.max(1.5, bw * Math.max(0, Math.min(1, bar))), 3, 1.5); if (!ctx.roundRect) ctx.rect(bx, h + 3, bw * bar, 3);
        ctx.fillStyle = c.siege != null ? '#EE8A3A' : c.outpost != null ? '#ECE5D3' : '#CDB27A'; ctx.fill();
      }
    }
  };
};
