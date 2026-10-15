// src/components/ui/MapCard.jsx
// The map a game is played on (plans/MAP-VARIATIONS-PLAN.md 7.2), for Settings (W12) and the nation
// overview (W17): Real Earth, or a generated world with its shape, land share, continents, climate,
// rainfall, relief, generator version and the map code with Copy (the same code gives the same
// world to anyone). In Settings also "Clear cached worlds" with the space they use on this device.
import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button, Label } from './atlas';
import { normalizeSpec, mapCode } from '../../worldgen/spec';
import { cacheInfo, cacheClear } from '../../worldgen/worldCache';
import { t as tNow, formatNumber } from '../../i18n';
import { useT } from '../../i18n/useT';


/** The card's lines for a map descriptor (pure, for tests). */
export const mapCardModel = (map) => {
  const s = normalizeSpec(map);
  if (s.kind !== 'generated') return { title: tNow('start.sum.earth'), lines: [tNow('start.map.earthBlurb')], code: null };
  const p = s.params;
  const lines = [
    tNow('mapcard.shape', { shape: s.generatorVersion >= 2 ? tNow(`start.map.shape.${p.shape}`) : tNow('start.map.shape.continents'), land: p.land, continents: p.continents ? tNow('mapcard.continents', { count: p.continents }) : tNow('mapcard.byChance') }),
    tNow('mapcard.climate', { climate: tNow(`start.map.climate.${p.climate}`), rain: tNow(`mapcard.rain.${p.rainfall}`), relief: s.generatorVersion >= 2 ? tNow('mapcard.reliefPart', { relief: tNow(`mapcard.relief.${p.relief}`) }) : '' }),
    tNow('mapcard.version', { n: s.generatorVersion })
  ];
  return { title: tNow('start.sum.generated'), lines, code: mapCode(s) };
};

const kb = (bytes) => (bytes >= 1048576 ? tNow('mapcard.mb', { n: formatNumber(bytes / 1048576, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) : tNow('mapcard.kb', { n: formatNumber(Math.max(1, Math.round(bytes / 1024))) }));

// `label`: the heading (Settings already has a "Map display" section above it: playtest audit I164).
const MapCard = ({ map, withCache = false, className = '', label = null }) => {
  const { t, lang } = useT();
  const m = useMemo(() => mapCardModel(map), [map, lang]);
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
      <Label>{label || t('start.map')}</Label>
      <div className="text-[14px] font-semibold leading-tight">{m.title}</div>
      {m.lines.map((l) => <div key={l} className="text-[12px] text-fa-muted leading-snug">{l}</div>)}
      {m.code && (
        <div className="flex items-center gap-2 pt-1">
          <code className="fa-num text-[12px] truncate flex-1" data-testid="map-card-code">{m.code}</code>
          <button type="button" className="fa-chip" onClick={copy} data-testid="map-card-copy"><Copy className="w-3.5 h-3.5" aria-hidden="true" />{copied ? t('mapcard.copied') : t('mapcard.copy')}</button>
        </div>
      )}
      {withCache && (
        <div className="flex items-center justify-between gap-3 min-h-[44px] pt-1">
          <div className="min-w-0 text-[12px] text-fa-muted leading-snug">
            {cache === 'cleared' ? t('mapcard.cleared')
              : cache ? t('mapcard.kept', { count: cache.count, size: kb(cache.bytes) }) : t('mapcard.keptNone')}
          </div>
          <Button onClick={async () => { await cacheClear(); setCache('cleared'); }} disabled={!cache || cache === 'cleared' || !cache.count} data-testid="map-clear-cache">
            <Trash2 className="w-4 h-4" aria-hidden="true" />{t('mapcard.clear')}
          </Button>
        </div>
      )}
    </section>
  );
};

export default MapCard;
