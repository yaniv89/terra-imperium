// src/components/battle/BattleReportSheet.jsx
// One battle in full (plan §6c): the outcome, how many fell on each side, every unit before and
// after, and each side's strength round by round. Opens from the replay, the Military tab's list
// (battleReportEvents.js) and later the map's battle markers. A bottom sheet on the tablet layout,
// a side sheet on a phone held sideways (.sheet-backdrop / .sheet-panel), a centred card on desktop.
import React, { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { describeOutcome, formatMen, nationName, regionName, sidesFor, unitName } from './battleReportView';
import { MEN_PER_STRENGTH } from '../../engine/aftermath';
import { getEffectiveAgeId } from '../../data/ages';
import { getTechAgeId } from '../../engine/nationState';

const OURS = '#3B82F6';
const THEIRS = '#F97316';
const TONE = { win: 'text-emerald-300 border-emerald-500/50', loss: 'text-red-300 border-red-500/50', draw: 'text-amber-300 border-amber-500/50' };
const KIND = { land: 'Land battle', amphibious: 'Landing', naval: 'Naval battle', rebellion: 'Rebellion' };

// Strength per round, both sides on one axis (men), with a hover/tap crosshair.
const StrengthChart = ({ entry }) => {
  const { mine } = sidesFor(entry);
  const t = entry.timeline || [];
  const [hover, setHover] = useState(null);
  if (t.length < 2) return null;
  const ours = t.map((p) => (mine === 'attacker' ? p.att : p.def) * MEN_PER_STRENGTH);
  const theirs = t.map((p) => (mine === 'attacker' ? p.def : p.att) * MEN_PER_STRENGTH);
  const W = 300; const H = 110; const L = 6; const R = 50; const T = 8; const B = 18;
  const max = Math.max(1, ...ours, ...theirs);
  const x = (i) => L + (i / (t.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(t.length - 1, Math.round(((px - L) / (W - L - R)) * (t.length - 1)))));
  };
  const label = (i) => (t[i].pursuit ? 'Pursuit' : i === 0 ? 'Start' : `Round ${t[i].round}`);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Strength each round</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: OURS }} />Yours</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: THEIRS }} />Theirs</span>
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img"
          aria-label={`Strength by round: yours from ${formatMen(ours[0])} to ${formatMen(ours[ours.length - 1])}, theirs from ${formatMen(theirs[0])} to ${formatMen(theirs[theirs.length - 1])}`}>
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#334155" strokeWidth="1" />
          <line x1={L} x2={W - R} y1={y(max)} y2={y(max)} stroke="#1e293b" strokeWidth="1" />
          <path d={path(ours)} fill="none" stroke={OURS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={path(theirs)} fill="none" stroke={THEIRS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* Direct labels at the line ends (text stays in ink colours; the line carries identity). */}
          <text x={W - R + 4} y={y(ours[ours.length - 1]) + 3} fontSize="9" fill="#cbd5e1">Yours</text>
          <text x={W - R + 4} y={y(theirs[theirs.length - 1]) + (Math.abs(y(ours[ours.length - 1]) - y(theirs[theirs.length - 1])) < 10 ? 13 : 3)} fontSize="9" fill="#cbd5e1">Theirs</text>
          <text x={L} y={H - 5} fontSize="8" fill="#64748b">Start</text>
          <text x={W - R} y={H - 5} fontSize="8" fill="#64748b" textAnchor="end">{t[t.length - 1].pursuit ? 'Pursuit' : `Round ${t[t.length - 1].round}`}</text>
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx={x(hover)} cy={y(ours[hover])} r="4" fill={OURS} stroke="#0f172a" strokeWidth="2" />
              <circle cx={x(hover)} cy={y(theirs[hover])} r="4" fill={THEIRS} stroke="#0f172a" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-slate-950/95 border border-slate-700 text-[10px] text-slate-200 whitespace-nowrap pointer-events-none">
            {label(hover)}: yours {formatMen(ours[hover])} · theirs {formatMen(theirs[hover])}
          </div>
        )}
      </div>
    </div>
  );
};

const SideTable = ({ title, color, units, ageId = 'bronze' }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{title}</div>
    {units.length === 0 && <div className="text-[11px] text-slate-500">No troops.</div>}
    {units.map((u) => (
      <div key={u.id} className="flex justify-between gap-2 text-[11px] text-slate-400">
        <span className="truncate">{unitName(u.classId, ageId, u.navalLine)}{u.after <= 0 ? ' (destroyed)' : u.routed ? ' (routed)' : ''}</span>
        <span className="font-mono tabular-nums shrink-0">{formatMen(u.before * MEN_PER_STRENGTH)} → {formatMen(u.after * MEN_PER_STRENGTH)}</span>
      </div>
    ))}
  </div>
);

const LossBar = ({ fallen, total, color }) => (
  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${total ? Math.min(100, (fallen / total) * 100) : 0}%`, background: color }} /></div>
);

const BattleReportSheet = ({ entry, onClose, onShowRegion }) => {
  const { state } = useGame();
  const ageOf = (nationId) => (nationId && nationId !== 'rebels' && state.nations[nationId] ? getEffectiveAgeId(state.age, getTechAgeId(state, nationId)) : state.age);
  if (!entry) return null;
  const { mine, theirs } = sidesFor(entry);
  const result = describeOutcome(entry);
  const total = (side) => entry.sides[side].reduce((s, u) => s + u.before, 0) * MEN_PER_STRENGTH;
  const year = entry.year < 0 ? `${-entry.year} BCE` : `${entry.year} CE`;
  return (
    <div className="fixed inset-0 z-[72] bg-black/50 flex items-end sm:items-center justify-center sheet-backdrop" onClick={onClose} data-testid="battle-report">
      <div onClick={(e) => e.stopPropagation()} className="sheet-panel w-full sm:max-w-md max-h-[88dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl text-slate-200 shadow-2xl">
        <div className={`flex items-start justify-between gap-2 p-4 border-b ${TONE[result.tone]}`}>
          <div className="min-w-0">
            <div className="font-bold text-base">{result.text}</div>
            <div className="text-[11px] text-slate-400">
              {KIND[entry.kind] || 'Battle'}{entry.commanded ? ', commanded' : ', auto-resolved'} · {year}, turn {entry.turn}
              {entry.rounds ? ` · ${entry.rounds} round${entry.rounds === 1 ? '' : 's'}` : ''}{entry.terrain ? ` · ${entry.terrain}` : ''}
            </div>
            <div className="text-[11px] text-slate-400">{nationName(state, entry[`${mine}NationId`])} against {nationName(state, entry[`${theirs}NationId`])}</div>
          </div>
          <button onClick={onClose} aria-label="Close report" className="p-1 rounded hover:bg-slate-800 text-slate-400 shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <div className="text-sm">
              Fallen: <span className="font-bold text-white">{formatMen(entry.fallen[mine])}</span> of yours ·{' '}
              <span className="font-bold text-white">{formatMen(entry.fallen[theirs])}</span> of theirs
            </div>
            <LossBar fallen={entry.fallen[mine]} total={total(mine)} color={OURS} />
            <LossBar fallen={entry.fallen[theirs]} total={total(theirs)} color={THEIRS} />
            {(entry.fled[mine] > 0 || entry.fled[theirs] > 0) && (
              <div className="text-[11px] text-slate-400">Fled the field: {formatMen(entry.fled[mine])} of yours · {formatMen(entry.fled[theirs])} of theirs</div>
            )}
          </div>
          <StrengthChart entry={entry} />
          <SideTable title="Your units" color={OURS} units={entry.sides[mine]} ageId={ageOf(state.playerNationId)} />
          <SideTable title="Their units" color={THEIRS} units={entry.sides[theirs]} ageId={ageOf(entry[mine === "attacker" ? "defenderNationId" : "attackerNationId"])} />
        </div>
        {entry.targetRegionId && onShowRegion && (
          <div className="p-3 border-t border-slate-800 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button onClick={() => { onShowRegion(entry.targetRegionId); onClose(); }} className="w-full min-h-[40px] rounded-lg bg-slate-800 hover:bg-slate-700 text-sm flex items-center justify-center gap-1.5">
              <MapPin className="w-4 h-4" /> Show {regionName(entry.targetRegionId)} on the map
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BattleReportSheet;
