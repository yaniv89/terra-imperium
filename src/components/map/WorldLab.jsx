// src/components/map/WorldLab.jsx
// `/?worldLab` (plans/MAP-VARIATIONS-PLAN.md 4.4 and 8.4): the world generator in its worker, in
// this browser, for a list of seeds (`&seeds=1,2,3`, `&land=30`, `&continents=0`, `&climate=`):
// each world's hash, generation time, quality report and a flat-colour debug picture. A quick
// cross-engine check on a real phone (the hash must match the Node golden hashes) and the
// source of the generated-world screenshots. Results are on window.__worldLab for browser tests.
// Debug only: generated worlds ship with the painted look (MV4).
import React, { useEffect, useRef, useState } from 'react';
import { generateInWorker, earthGrid } from '../../worldgen/worldLoader';
import { decodeTiles } from '../../data/geo/tilesCodec';
import { tilesFromRaw } from '../../data/geo/tiles';
import { worldPreviewRgba } from '../../worldgen/preview';
import { mapCode, normalizeSpec } from '../../worldgen/spec';

const params = new URLSearchParams(window.location.search);
const SEEDS = (params.get('seeds') || '1,2,3').split(',').map(Number).filter((n) => Number.isFinite(n));
const PARAMS = { land: Number(params.get('land') || 30), continents: Number(params.get('continents') || 0), climate: params.get('climate') || 'temperate', rainfall: params.get('rainfall') || 'normal' };
const BIG = params.has('big');
// `&inline`: generate on the page's own thread (a CPU-throttled benchmark reaches only this thread).
const INLINE = params.has('inline');

const WorldCard = ({ result }) => {
  const canvas = useRef(null);
  useEffect(() => {
    if (!result?.tiles || !canvas.current) return;
    const W = canvas.current.width; const H = canvas.current.height;
    canvas.current.getContext('2d').putImageData(new ImageData(worldPreviewRgba(result.tiles, W, H), W, H), 0, 0);
  }, [result]);
  const r = result.report || {};
  return (
    <figure className="fa-panel p-2 flex flex-col gap-1 min-w-0" data-testid="world-card" data-seed={result.seed} data-hash={result.hash || ''}>
      <canvas ref={canvas} width={BIG ? 1024 : 512} height={BIG ? 512 : 256} className="rounded mx-auto" style={{ aspectRatio: '2 / 1', width: '100%', maxWidth: BIG ? 'calc((100dvh - 96px) * 2)' : undefined }} />
      <figcaption className="text-[12px] leading-snug">
        <span className="fa-num">{mapCode(result.spec)}</span> · hash <span className="fa-num" data-testid="world-hash">{result.hash || '...'}</span>
        {result.ms != null && <> · {Math.round(result.ms)} ms</>}
        {result.report && <> · {r.continents} continents, mountains {Math.round(r.mountainShare * 100)}%, rivers on {Math.round(r.riverShare * 100)}% of land, starts spread {Math.round((r.startSpread || 0) * 100)}%</>}
        {result.error && <span className="text-fa-danger"> {result.error}</span>}
      </figcaption>
    </figure>
  );
};

const WorldLab = () => {
  const [results, setResults] = useState(() => SEEDS.map((seed) => ({ seed, spec: normalizeSpec({ kind: 'generated', seed, params: PARAMS }) })));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const grid = await earthGrid();
      const out = [];
      for (const seed of SEEDS) {
        const spec = normalizeSpec({ kind: 'generated', seed, params: PARAMS });
        const t0 = performance.now();
        try {
          const pkg = INLINE
            ? await import('../../worldgen/worldPackage').then(({ buildWorldPackage }) => { const t = performance.now(); const p = buildWorldPackage(spec, grid, { coast: true }); p.ms = performance.now() - t; return p; })
            : await generateInWorker(spec, grid, { coast: true });
          const ms = pkg.ms ?? performance.now() - t0; // measured inside the worker
          const tiles = tilesFromRaw(decodeTiles(pkg.tiles));
          out.push({ seed, spec, hash: pkg.worldHash, ms, report: pkg.report, tiles, landFeatures: pkg.land?.length || 0 });
        } catch (e) {
          out.push({ seed, spec, error: String(e?.message || e) });
        }
        if (cancelled) return;
        setResults((prev) => prev.map((p) => out.find((o) => o.seed === p.seed) || p));
      }
      window.__worldLab = out.map(({ tiles, ...rest }) => rest); // eslint-disable-line no-unused-vars
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="min-h-[100dvh] bg-fa-ink text-fa-text p-3 flex flex-col gap-3" data-testid="world-lab">
      <h1 className="fa-heading text-[18px]">World lab <span className="text-[13px] text-fa-muted">generator v1, debug view (not the painted look)</span></h1>
      <div className={`grid gap-3 ${BIG ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {results.map((r) => <WorldCard key={r.seed} result={r} />)}
      </div>
    </div>
  );
};

export default WorldLab;
