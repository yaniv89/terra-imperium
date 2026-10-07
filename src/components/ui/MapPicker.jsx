// src/components/ui/MapPicker.jsx
// The start screen's Map block (W01 map options, plans/UI-DESIGN.md; plans/MAP-VARIATIONS-PLAN.md
// 7.1): Real Earth or a Generated world. For a generated world: a preview thumbnail drawn from the
// real generator in its worker (debounced; the older job is ignored), the map code, New map, the
// land share, the shape and the climate; "More" opens the rest: continents, rainfall, relief and a
// field to paste a map code (a friend's world). `?map=CODE` in the address prefills it
// (StartScreen.jsx, mapFromUrl).
import React, { useEffect, useRef, useState } from 'react';
import { Shuffle, SlidersHorizontal } from 'lucide-react';
import { Label } from './atlas';
import { DEFAULT_PARAMS, GENERATOR_VERSION, LAND_RANGE, CLIMATES, RAINFALLS, RELIEFS, SHAPES, mapCode, parseMapCode, normalizeSpec } from '../../worldgen/spec';
import { newWorldSeed as newMapSeed } from './seeds';

const CLIMATE_LABEL = { cold: 'Cold', temperate: 'Temperate', hot: 'Hot' };
const CONTINENT_CHOICES = [0, 1, 2, 3, 4, 5, 6, 7];
const SHAPE_LABEL = { continents: 'Continents', pangaea: 'Pangaea', archipelago: 'Archipelago', islands: 'Islands', inland: 'Inland sea' };
const RAIN_LABEL = { dry: 'Dry', normal: 'Normal', wet: 'Wet' };
const RELIEF_LABEL = { low: 'Low', normal: 'Normal', high: 'High' };

/** The map of `?map=CODE` in the address (a shared world), else null. */
export const mapFromUrl = (search = typeof window !== 'undefined' ? window.location.search : '') => {
  try { const code = new URLSearchParams(search).get('map'); return code ? parseMapCode(code) : null; } catch { return null; }
};

// One row of chips for a parameter (scrolls sideways on a narrow phone).
const Chips = ({ label, values, names, value, onPick, testId }) => (
  <div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label={label} data-testid={testId}>
    <span className="text-[13px] w-20 shrink-0">{label}</span>
    {values.map((v) => (
      <button key={v} type="button" className="fa-chip shrink-0 !px-2" aria-pressed={value === v} onClick={() => onPick(v)}>{names[v] ?? v}</button>
    ))}
  </div>
);

// The rest of the options and the field for a map code.
const MoreOptions = ({ value, params, setParam, onChange }) => {
  const [code, setCode] = useState('');
  const parsed = code.trim() ? parseMapCode(code) : null;
  return (
    <div className="flex flex-col gap-2 border-t border-fa-line pt-2" data-testid="map-more">
      <Chips label="Continents" values={CONTINENT_CHOICES} names={{ 0: 'Auto' }} value={params.continents} onPick={(v) => setParam('continents', v)} testId="map-continents" />
      <Chips label="Rainfall" values={RAINFALLS} names={RAIN_LABEL} value={params.rainfall} onPick={(v) => setParam('rainfall', v)} testId="map-rainfall" />
      <Chips label="Relief" values={RELIEFS} names={RELIEF_LABEL} value={params.relief} onPick={(v) => setParam('relief', v)} testId="map-relief" />
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (parsed) { onChange(parsed); setCode(''); } }}>
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a map code" aria-label="Map code to use"
          className="flex-1 min-w-0 min-h-[36px] rounded border border-fa-line bg-transparent px-2 text-[13px] fa-num" data-testid="map-code-input" spellCheck={false} autoCapitalize="characters" />
        <button type="submit" className="fa-chip" disabled={!parsed} data-testid="map-code-use">Use</button>
      </form>
      {code.trim() && !parsed && <div className="text-[12px] text-fa-muted">That is not a map code (they look like {mapCode(value)}).</div>}
    </div>
  );
};

/** A new generated spec with the default parameters and a fresh map seed. */
export const newGeneratedSpec = (params = DEFAULT_PARAMS) => normalizeSpec({ kind: 'generated', generatorVersion: GENERATOR_VERSION, seed: newMapSeed(), params });

// The preview: the generator in its worker, then the flat-colour picture (worldgen/preview.js).
const Preview = ({ spec }) => {
  const canvas = useRef(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    let cancelled = false;
    setStatus('Building the map...');
    const timer = setTimeout(async () => {
      try {
        const [{ generateInWorker, earthGrid }, { decodeTiles }, { tilesFromRaw }, { worldPreviewRgba }] = await Promise.all([
          import('../../worldgen/worldLoader'), import('../../data/geo/tilesCodec'), import('../../data/geo/tiles'), import('../../worldgen/preview')
        ]);
        const grid = await earthGrid();
        if (cancelled) return;
        const pkg = await generateInWorker(spec, grid, { coast: false, onProgress: (f) => { if (!cancelled) setStatus(`Building the map... ${Math.round(f * 100)}%`); } });
        if (cancelled || !canvas.current) return;
        const tiles = tilesFromRaw(decodeTiles(pkg.tiles));
        const W = 256; const H = 128;
        const img = new ImageData(worldPreviewRgba(tiles, W, H, { rivers: false }), W, H);
        canvas.current.getContext('2d').putImageData(img, 0, 0);
        const r = pkg.report;
        setStatus(`${r.continents} continents, ${Math.round(r.mountainShare * 100)}% mountains`);
      } catch (e) {
        if (!cancelled) setStatus('The preview could not be built here.');
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [spec]);
  return (
    <div className="flex flex-col gap-1">
      <canvas ref={canvas} width={256} height={128} className="w-full rounded border border-fa-line bg-fa-ink" style={{ aspectRatio: '2 / 1', imageRendering: 'pixelated' }} data-testid="map-preview" aria-label="Map preview" />
      <div className="text-[12px] text-fa-muted leading-snug" data-testid="map-preview-status">{status}</div>
    </div>
  );
};

// Generated worlds ship with the full painted look (plan open question 5); until MV4 is done the
// option shows in dev builds, with `?generatedWorlds` once, or when this page already runs one.
export const generatedWorldsEnabled = () => {
  try {
    if (import.meta.env?.DEV) return true;
    if (new URLSearchParams(window.location.search).has('generatedWorlds')) localStorage.setItem('terra-imperium-generated-worlds', '1');
    return localStorage.getItem('terra-imperium-generated-worlds') === '1';
  } catch { return false; }
};

const MapPicker = ({ value, onChange }) => {
  const [more, setMore] = useState(false);
  if (!generatedWorldsEnabled() && value?.kind !== 'generated') return null;
  const generated = value?.kind === 'generated';
  const params = generated ? value.params : DEFAULT_PARAMS;
  const setParam = (key, v) => onChange(normalizeSpec({ ...value, params: { ...params, [key]: v } }));
  return (
    <div className="flex flex-col gap-2" data-testid="map-picker">
      <Label>Map</Label>
      <div role="radiogroup" aria-label="Map" className="grid grid-cols-2 gap-2">
        {[{ id: 'earth', name: 'Real Earth', blurb: 'Peoples at their real homes' }, { id: 'generated', name: 'Generated world', blurb: 'A new planet from a seed' }].map((m) => {
          const on = (m.id === 'generated') === generated;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on} data-testid={`map-${m.id}`}
              onClick={() => onChange(m.id === 'earth' ? { kind: 'earth' } : (generated ? value : newGeneratedSpec()))}
              className="fa-option min-h-[48px] px-2.5 py-1.5 text-left">
              <span className="block font-semibold text-[14px] leading-tight">{m.name}</span>
              <span className="block text-[11px] text-fa-muted leading-tight">{m.blurb}</span>
            </button>
          );
        })}
      </div>
      {generated && (
        <div className="fa-panel p-2.5 flex flex-col gap-2" data-testid="generated-options">
          <Preview spec={value} />
          <div className="flex items-center gap-2">
            <code className="fa-num text-[12px] truncate flex-1" data-testid="map-code" title="Map code: the same code gives the same world">{mapCode(value)}</code>
            <button type="button" className="fa-chip" data-testid="new-map" onClick={() => onChange(normalizeSpec({ ...value, generatorVersion: GENERATOR_VERSION, seed: newMapSeed() }))}>
              <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />New map
            </button>
            <button type="button" className="fa-chip" data-testid="map-more-toggle" aria-expanded={more} onClick={() => setMore((m) => !m)}>
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />More
            </button>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="w-20 shrink-0">Land {params.land}%</span>
            <input type="range" min={LAND_RANGE[0]} max={LAND_RANGE[1]} step={1} value={params.land} aria-label="Land share"
              onChange={(e) => setParam('land', Number(e.target.value))} className="flex-1 accent-[#ECE5D3] min-h-[32px]" data-testid="map-land" />
          </label>
          <Chips label="Shape" values={SHAPES} names={SHAPE_LABEL} value={params.shape} onPick={(v) => setParam('shape', v)} testId="map-shape" />
          <Chips label="Climate" values={CLIMATES} names={CLIMATE_LABEL} value={params.climate} onPick={(v) => setParam('climate', v)} testId="map-climate" />
          {more && <MoreOptions value={value} params={params} setParam={setParam} onChange={onChange} />}
        </div>
      )}
    </div>
  );
};

export default MapPicker;
