// src/components/ui/MapCard.jsx
// The map a game is played on (plans/MAP-VARIATIONS-PLAN.md 7.2), for Settings (W12) and the nation
// overview (W17): Real Earth, or a generated world with its shape, land share, continents, climate,
// rainfall, relief, generator version and the map code with Copy (the same code gives the same
// world to anyone). In Settings also "Clear cached worlds" with the space they use on this device.
import React, { useEffect, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button, Label } from './atlas';
import { normalizeSpec, mapCode } from '../../worldgen/spec';
import { cacheInfo, cacheClear } from '../../worldgen/worldCache';

const SHAPE = { continents: 'Continents', pangaea: 'Pangaea', archipelago: 'Archipelago', islands: 'Islands', inland: 'Inland sea' };
const CLIMATE = { cold: 'Cold', temperate: 'Temperate', hot: 'Hot' };
const RAIN = { dry: 'Dry', normal: 'Normal rain', wet: 'Wet' };
const RELIEF = { low: 'Low relief', normal: 'Normal relief', high: 'High relief' };

/** The card's lines for a map descriptor (pure, for tests). */
export const mapCardModel = (map) => {
  const s = normalizeSpec(map);
  if (s.kind !== 'generated') return { title: 'Real Earth', lines: ['Peoples at their real homes'], code: null };
  const p = s.params;
  const lines = [
    `${s.generatorVersion >= 2 ? SHAPE[p.shape] : 'Continents'}, ${p.land}% land, ${p.continents ? `${p.continents} continents` : 'continents by chance'}`,
    `${CLIMATE[p.climate]}, ${RAIN[p.rainfall].toLowerCase()}${s.generatorVersion >= 2 ? `, ${RELIEF[p.relief].toLowerCase()}` : ''}`,
    `Generator version ${s.generatorVersion}`
  ];
  return { title: 'Generated world', lines, code: mapCode(s) };
};

const kb = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const MapCard = ({ map, withCache = false, className = '' }) => {
  const m = mapCardModel(map);
  const [copied, setCopied] = useState(false);
  const [cache, setCache] = useState(null); // { count, bytes } | 'cleared'
  useEffect(() => {
    if (!withCache) return undefined;
    let live = true;
    cacheInfo().then((c) => { if (live) setCache(c); });
    return () => { live = false; };
  }, [withCache]);
  const copy = async () => { try { await navigator.clipboard.writeText(m.code); setCopied(true); } catch { setCopied(false); } };
  return (
    <section className={`space-y-1 ${className}`} data-testid="map-card">
      <Label>Map</Label>
      <div className="text-[14px] font-semibold leading-tight">{m.title}</div>
      {m.lines.map((l) => <div key={l} className="text-[12px] text-fa-muted leading-snug">{l}</div>)}
      {m.code && (
        <div className="flex items-center gap-2 pt-1">
          <code className="fa-num text-[12px] truncate flex-1" data-testid="map-card-code">{m.code}</code>
          <button type="button" className="fa-chip" onClick={copy} data-testid="map-card-copy"><Copy className="w-3.5 h-3.5" aria-hidden="true" />{copied ? 'Copied' : 'Copy'}</button>
        </div>
      )}
      {withCache && (
        <div className="flex items-center justify-between gap-3 min-h-[44px] pt-1">
          <div className="min-w-0 text-[12px] text-fa-muted leading-snug">
            {cache === 'cleared' ? 'Cached worlds cleared; they are rebuilt from their codes when needed.'
              : cache ? `${cache.count} generated ${cache.count === 1 ? 'world' : 'worlds'} kept on this device (${kb(cache.bytes)}), so they open at once.` : 'Generated worlds kept on this device open at once.'}
          </div>
          <Button onClick={async () => { await cacheClear(); setCache('cleared'); }} disabled={!cache || cache === 'cleared' || !cache.count} data-testid="map-clear-cache">
            <Trash2 className="w-4 h-4" aria-hidden="true" />Clear cached worlds
          </Button>
        </div>
      )}
    </section>
  );
};

export default MapCard;
