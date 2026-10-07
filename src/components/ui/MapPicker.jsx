// src/components/ui/MapPicker.jsx
// The start screen's Map block (W01 map options, plans/UI-DESIGN.md; plans/MAP-VARIATIONS-PLAN.md
// 7.1): Real Earth or a Generated world. For a generated world: a preview thumbnail drawn from the
// real generator in its worker (debounced; the older job is ignored), the map code, New map, the
// land share, the continents and the climate. A first, plain version in the Field Atlas look; the
// "More" sheet (rainfall, pasting a map code) and the shapes come with MV5.
import React, { useEffect, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { Label } from './atlas';
import { DEFAULT_PARAMS, GENERATOR_VERSION, LAND_RANGE, CLIMATES, mapCode, normalizeSpec } from '../../worldgen/spec';
import { newWorldSeed as newMapSeed } from './seeds';

const CLIMATE_LABEL = { cold: 'Cold', temperate: 'Temperate', hot: 'Hot' };
const CONTINENT_CHOICES = [0, 1, 2, 3, 4, 5, 6, 7];

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
            <button type="button" className="fa-chip" data-testid="new-map" onClick={() => onChange(normalizeSpec({ ...value, seed: newMapSeed() }))}>
              <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />New map
            </button>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="w-20 shrink-0">Land {params.land}%</span>
            <input type="range" min={LAND_RANGE[0]} max={LAND_RANGE[1]} step={1} value={params.land} aria-label="Land share"
              onChange={(e) => setParam('land', Number(e.target.value))} className="flex-1 accent-[#ECE5D3] min-h-[32px]" data-testid="map-land" />
          </label>
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Continents">
            <span className="text-[13px] w-20 shrink-0">Continents</span>
            {CONTINENT_CHOICES.map((c) => (
              <button key={c} type="button" className="fa-chip !px-2" aria-pressed={params.continents === c} onClick={() => setParam('continents', c)}>{c === 0 ? 'Auto' : c}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Climate">
            <span className="text-[13px] w-20 shrink-0">Climate</span>
            {CLIMATES.map((c) => (
              <button key={c} type="button" className="fa-chip" aria-pressed={params.climate === c} onClick={() => setParam('climate', c)}>{CLIMATE_LABEL[c]}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPicker;
