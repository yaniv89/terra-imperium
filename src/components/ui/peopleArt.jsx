// src/components/ui/peopleArt.jsx
// The start screen's and the picker's art (plans/ART-PRODUCTION-PLAN.md batches 01 and 02), with
// code-drawn placeholders until each file lands. Drop a file at its path and it shows on the next
// build, no code change:
//   src/assets/ui/start/background-wide.webp, background-phone.webp     the start screen (S3)
//   src/assets/ui/start/worldsize-small.webp, -standard, -large         world size cards (S3)
//   src/assets/icons/themes/<theme>.svg                                 15 theme icons (S1)
//   src/assets/icons/regions/<region>.svg                               6 region filter icons (S1)
//   src/assets/peoples/emblems/<slug>.svg                               150 emblems (S2): one white
//                                                                       silhouette, printed in the
//                                                                       nation colour on the shield
//   src/assets/peoples/frames/shield.svg                                the shield frame (S2)
// (The art plan names public/ui/ for the S3 plates; they live under src/assets/ui/ instead so the
// build knows which exist, no request ever 404s, and the files still ship as separate hashed
// assets, never inside the JavaScript bundle.)
import React from 'react';
import { Castle, Landmark, Crown, Palmtree, Wheat, Trees, Tent, Flower2, Gem, Columns, Flower, Waves, Sailboat, Mountain, Sun } from 'lucide-react';

const urls = (glob) => Object.fromEntries(Object.entries(glob).map(([path, url]) => [path.replace(/^.*\/([^/]+)\.[a-z]+$/, '$1'), url]));
const START_ART = urls(import.meta.glob('../../assets/ui/start/*.webp', { query: '?url', import: 'default', eager: true }));
const THEME_ICONS = urls(import.meta.glob('../../assets/icons/themes/*.svg', { query: '?url', import: 'default', eager: true }));
const REGION_ICONS = urls(import.meta.glob('../../assets/icons/regions/*.svg', { query: '?url', import: 'default', eager: true }));
const EMBLEMS = urls(import.meta.glob('../../assets/peoples/emblems/*.svg', { query: '?url', import: 'default', eager: true }));
const FRAMES = urls(import.meta.glob('../../assets/peoples/frames/*.svg', { query: '?url', import: 'default', eager: true }));

/** A start screen plate ('background-wide', 'worldsize-small', ...) or null while it is missing. */
export const startArt = (id) => START_ART[id] || null;
export const regionIcon = (id) => REGION_ICONS[id] || null;

// Placeholder theme icons: one lucide glyph per theme.
const THEME_GLYPHS = {
  nile: Sun, levant: Landmark, israelite: Crown, maghreb: Palmtree, westafrica: Wheat, eastafrica: Trees,
  europe: Castle, steppe: Tent, indic: Flower2, sinic: Gem, korea: Columns, japan: Flower, monsoon: Waves,
  pacific: Sailboat, americas: Mountain
};
export const THEME_LABELS = {
  nile: 'Nile', levant: 'Levant', israelite: 'Israelite', maghreb: 'Maghreb and Sahel', westafrica: 'West Africa',
  eastafrica: 'East Africa', europe: 'Europe', steppe: 'Steppe', indic: 'South Asia', sinic: 'East Asia', korea: 'Korea',
  japan: 'Japan', monsoon: 'Monsoon', pacific: 'Pacific', americas: 'Americas'
};

export const ThemeIcon = ({ theme, className = 'w-3.5 h-3.5' }) => {
  const url = THEME_ICONS[theme];
  const label = THEME_LABELS[theme] || theme;
  if (url) return <img src={url} alt="" title={`${label} art`} className={className} />;
  const Glyph = THEME_GLYPHS[theme] || Landmark;
  return <span title={`${label} art`} className="inline-flex shrink-0"><Glyph className={`${className} text-slate-400`} aria-hidden="true" /></span>;
};

// Placeholder emblems: a seeded charge on the shield (art plan W0: "code draws a seeded emblem
// until the SVG lands"). Deterministic in the slug.
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const SHIELD = 'M2 2H22V13C22 20 17 24.5 12 26.5C7 24.5 2 20 2 13Z';
const CHARGES = [
  <circle key="c" cx="12" cy="12.5" r="4.6" />,
  <path key="s" d="M12 6.2l1.8 4.1 4.4.4-3.3 2.9 1 4.3L12 15.6l-3.9 2.3 1-4.3-3.3-2.9 4.4-.4z" />,
  <path key="v" d="M3.5 17 12 9l8.5 8v-4L12 5l-8.5 8z" />,
  <rect key="f" x="2" y="9.5" width="20" height="6" />,
  <rect key="p" x="9" y="2" width="6" height="24" />,
  <path key="l" d="M12 5.5 17 13l-5 7.5L7 13z" />,
  <path key="x" d="M4 4h3l5 6 5-6h3l-6.5 8.5L20 21h-3l-5-6-5 6H4l6.5-8.5z" />,
  <path key="m" d="M15.5 6.5a6.5 6.5 0 1 0 0 12 5 5 0 1 1 0-12z" />
];

/** The people's emblem on its shield, in the nation colour. `size` in px (the shield's width). */
export const PeopleEmblem = ({ slug, color = '#64748b', size = 20, className = '' }) => {
  const h = hash(slug || '');
  const charge = CHARGES[h % CHARGES.length];
  const light = (h >> 4) % 3 !== 0;
  const emblem = EMBLEMS[slug];
  const frame = FRAMES.shield;
  const style = { width: size, height: size * (28 / 24) };
  if (emblem) {
    return (
      <span className={`relative inline-block shrink-0 ${className}`} style={style} aria-hidden="true">
        {frame ? <img src={frame} alt="" className="absolute inset-0 w-full h-full" /> : (
          <svg viewBox="0 0 24 28" className="absolute inset-0 w-full h-full"><path d={SHIELD} fill={color} stroke="rgba(15,23,42,0.85)" strokeWidth="1.2" /></svg>
        )}
        <span className="absolute inset-[18%] bg-white" style={{ WebkitMaskImage: `url(${emblem})`, maskImage: `url(${emblem})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }} />
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 28" style={style} className={`shrink-0 ${className}`} aria-hidden="true">
      <defs><clipPath id={`shield-${slug}`}><path d={SHIELD} /></clipPath></defs>
      <path d={SHIELD} fill={color} />
      <g clipPath={`url(#shield-${slug})`} fill={light ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.7)'}>{charge}</g>
      <path d={SHIELD} fill="none" stroke="rgba(15,23,42,0.85)" strokeWidth="1.2" />
    </svg>
  );
};
