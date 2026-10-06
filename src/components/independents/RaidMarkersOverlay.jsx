// src/components/independents/RaidMarkersOverlay.jsx
// The independents' marks on the flat map (phase W4, raidMapModel.js; the W15 sketch): a raid party
// in sight with its route to the target and its ETA, a warning ring on the tile a raid against you
// is heading for, sieges of independents by others in sight, and cities being razed. Screen scale
// like Map2DMarkersOverlay: positions from the d3 projection plus the pan/zoom transform. Tapping a
// party, a ring or a siege opens the independent's sheet.
//
// The WebGL map (phase A2, origin/claude/phase-a2-webgl-map) draws the same raidMapModel lists as
// sprites and lines (its gl/sceneModel.js markerSprites and marchShapes are the pattern): parties ->
// an army sprite with the raid-torch icon, routes -> dashed lines, warnings -> a ring sprite,
// sieges and burning -> marker icons. Only this file is the SVG renderer.
import React, { useMemo } from 'react';
import { Flame, Castle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { getTiles } from '../../data/geo/tiles';
import { raidMapModel, raidMapEmpty } from './raidMapModel';
import { openIndependent } from './independentEvents';
import { actionIconUrl } from './independentArt';

const EDGE = 40;
const RED = '#f87171';
const VIOLET = '#9C8FD0';

const RaidMarkersOverlay = ({ projection, transform, width, height }) => {
  const { state } = useGame();
  const m = useMemo(() => raidMapModel(state),
    // What the marks read: units (parties, sight), nations (raids), regions (sieges, razing, sight), the turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.units, state.nations, state.regions, state.world, state.turnNumber, state.playerNationId]);
  const placed = useMemo(() => {
    if (!projection || raidMapEmpty(m)) return null;
    const tiles = getTiles();
    const at = (tile) => {
      const { lat, lon } = tiles.latLonOf(tile);
      const p = projection([lon, lat]);
      return p ? [p[0] * transform.k + transform.x, p[1] * transform.k + transform.y] : null;
    };
    const radius = (tile, xy) => {
      const nb = tiles.neighbors[tile]?.[0];
      const q = nb != null ? at(nb) : null;
      return q ? Math.max(9, Math.hypot(q[0] - xy[0], q[1] - xy[1]) * 0.7) : 12;
    };
    const inView = (xy) => xy && xy[0] > -EDGE && xy[1] > -EDGE && xy[0] < width + EDGE && xy[1] < height + EDGE;
    const routes = m.parties.filter((p) => p.route.length).map((p) => {
      const pts = [p.tile, ...p.route].map(at).filter(Boolean);
      return { id: p.id, d: pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '), againstYou: p.againstYou };
    });
    const parties = m.parties.map((p) => ({ ...p, xy: at(p.tile) })).filter((p) => inView(p.xy));
    // The target's label is left out when its party's chip stands right over it (zoomed out).
    const warnings = m.warnings.map((w) => { const xy = at(w.tile); return { ...w, xy, r: xy ? radius(w.tile, xy) : 0 }; }).filter((w) => inView(w.xy))
      .map((w) => ({ ...w, label: !parties.some((p) => p.id === w.id && Math.hypot(p.xy[0] - w.xy[0], p.xy[1] - w.xy[1]) < 60) }));
    const sieges = m.sieges.map((s) => ({ ...s, xy: at(s.tile) })).filter((s) => inView(s.xy));
    const burning = m.burning.map((b) => ({ ...b, xy: at(b.tile) })).filter((b) => inView(b.xy));
    return { routes, parties, warnings, sieges, burning };
  }, [m, projection, transform, width, height]);
  if (!placed) return null;
  const torch = actionIconUrl('raid');
  const chip = 'absolute pointer-events-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight whitespace-nowrap shadow-lg border';
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[6]" data-testid="raid-markers">
      <svg className="absolute inset-0" width={width} height={height} aria-hidden="true">
        {placed.routes.map((r) => <path key={r.id} d={r.d} fill="none" stroke={r.againstYou ? RED : VIOLET} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" opacity={0.9} data-raid-route={r.id} />)}
        {placed.warnings.map((w) => (
          <g key={`${w.id}-${w.tile}`} data-raid-warning={w.tile}>
            <circle cx={w.xy[0]} cy={w.xy[1]} r={w.r} fill="rgba(248,113,113,0.12)" stroke={RED} strokeWidth={2} strokeDasharray="4 3" />
            <circle cx={w.xy[0]} cy={w.xy[1]} r={w.r + 5} fill="none" stroke={RED} strokeWidth={1.2} opacity={0.6} className="animate-pulse" />
          </g>
        ))}
        {placed.sieges.map((s) => <circle key={s.cityId} cx={s.xy[0]} cy={s.xy[1]} r={14} fill="none" stroke="#fb923c" strokeWidth={2} strokeDasharray="2 3" data-siege-ring={s.cityId} />)}
      </svg>
      {placed.warnings.filter((w) => w.label).map((w) => (
        <button key={`wl-${w.id}-${w.tile}`} type="button" onClick={() => openIndependent(w.id)} className={`${chip} bg-slate-950/90 border-red-400/70 text-red-200 min-h-[24px]`}
          style={{ transform: `translate(${Math.round(w.xy[0])}px, ${Math.round(w.xy[1] - w.r - 8)}px) translate(-50%, -100%)` }} data-raid-target={w.tile}
          aria-label={`Raid target: ${w.target}${w.eta != null ? `, ${w.eta} turns` : ''}`}>
          Raid target: {w.target}{w.eta != null ? ` · ${w.eta}t` : ''}
        </button>
      ))}
      {placed.parties.map((p) => (
        <button key={`p-${p.id}`} type="button" onClick={() => openIndependent(p.id)} className={`${chip} flex items-center gap-1 min-h-[28px] bg-slate-900/95 ${p.againstYou ? 'border-red-400/80 text-red-100' : 'border-[#9C8FD0]/80 text-slate-100'}`}
          style={{ transform: `translate(${Math.round(p.xy[0])}px, ${Math.round(p.xy[1] - 22)}px) translate(-50%, -100%)` }} data-raid-party={p.id}
          aria-label={`Raid party of ${p.name}, ${p.kindWord}, ${p.phase === 'home' ? 'going home' : `target ${p.target}`}${p.eta != null ? `, ${p.eta} turns` : ''}`}>
          {torch ? <img src={torch} alt="" width={12} height={12} /> : <Flame className="w-3 h-3" style={{ color: p.againstYou ? RED : VIOLET }} aria-hidden="true" />}
          <span>Raid party{p.phase === 'home' ? ', going home' : p.eta != null ? ` · ${p.eta}t` : ''}</span>
        </button>
      ))}
      {placed.sieges.map((s) => (
        <button key={`s-${s.cityId}`} type="button" onClick={() => openIndependent(s.owner)} className={`${chip} flex items-center gap-1 min-h-[24px] bg-slate-900/95 border-orange-400/70 text-orange-100`}
          style={{ transform: `translate(${Math.round(s.xy[0])}px, ${Math.round(s.xy[1] + 16)}px) translate(-50%, 0)` }} data-indep-siege={s.cityId}
          aria-label={`${s.byName} besiege ${s.name}, walls ${Math.round(s.hp * 100)}%`}>
          <Castle className="w-3 h-3" aria-hidden="true" />{s.byName} besiege · {Math.round(s.hp * 100)}%
        </button>
      ))}
      {placed.burning.map((b) => (
        <span key={`b-${b.cityId}`} className={`${chip} flex items-center gap-1 bg-slate-900/95 border-red-500/70 text-red-200`}
          style={{ transform: `translate(${Math.round(b.xy[0])}px, ${Math.round(b.xy[1] + 16)}px) translate(-50%, 0)` }} data-burning={b.cityId}>
          <Flame className="w-3 h-3" aria-hidden="true" />Burning · {b.size} turn{b.size === 1 ? '' : 's'} left
        </span>
      ))}
    </div>
  );
};

export default RaidMarkersOverlay;
