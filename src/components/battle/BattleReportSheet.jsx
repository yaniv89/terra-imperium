// src/components/battle/BattleReportSheet.jsx
// W16 Battle reports (plans/UI-DESIGN.md; plan 6c): your last 30 battles, named ("Siege of Kish",
// "Battle of Der"), each with its result from your side, a Command or Auto tag and the losses on
// both sides, filtered by chips (All, Won, Lost, Command, Auto, Sieges, Field, Sea); the chosen
// one in full on the right: who attacked, both sides in and lost, a plain summary, the strength
// timeline (tap a point for its numbers) and every unit before and after. Show on map and View
// replay (an Auto battle's rounds, BattleReplay.jsx). Opens from the Military tab's list, a battle
// marker on the map or the replay's "Full report" (battleReportEvents.js). The list and the detail
// side by side on a phone held sideways and on the desktop; one at a time on a phone held upright.
import React, { useMemo, useState } from 'react';
import { MapPin, Play, Castle, Swords, Ship, ChevronLeft, ShieldCheck, Undo2, ArrowLeftFromLine, Footprints, Crosshair, Skull, Flag } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { formatMen, sidesFor, unitName } from './battleReportView';
import { regimentName } from '../../data/regimentNames';
import { MEN_PER_STRENGTH } from '../../engine/aftermath';
import { getEffectiveAgeId } from '../../data/ages';
import { getTechAgeId } from '../../engine/nationState';
import { Button, Chip, CloseButton } from '../ui/atlas';
import { REPORT_FILTERS, fateRows, filterReports, reportDetail, reportRow } from './battleReportsModel';
import { focusPlace } from '../map/marchEvents';
import { battlePlaces } from '../map/mapCamera';

const OURS = 'var(--fa-you)';
const THEIRS = 'var(--fa-enemy)';
const TONE = { win: 'text-fa-good', loss: 'text-fa-danger-text', draw: 'text-fa-brass' };
const GROUP_ICON = { siege: Castle, field: Swords, sea: Ship };

// Strength per round, both sides on one axis (men), with a tap crosshair: the battle's timeline.
const StrengthChart = ({ entry }) => {
  const { mine } = sidesFor(entry);
  const t = entry.timeline || [];
  const [hover, setHover] = useState(null);
  if (t.length < 2) return <div className="text-[12px] text-fa-muted">No round by round record for this battle.</div>;
  const ours = t.map((p) => (mine === 'attacker' ? p.att : p.def) * MEN_PER_STRENGTH);
  const theirs = t.map((p) => (mine === 'attacker' ? p.def : p.att) * MEN_PER_STRENGTH);
  const W = 300; const H = 92; const L = 6; const R = 44; const T = 6; const B = 16;
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
      <div className="flex items-center justify-between">
        <span className="fa-label">Strength each round</span>
        <span className="text-[11px] text-fa-muted">{hover !== null ? `${label(hover)}: yours ${formatMen(ours[hover])}, theirs ${formatMen(theirs[hover])}` : 'tap a point'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img"
        aria-label={`Strength by round: yours from ${formatMen(ours[0])} to ${formatMen(ours[ours.length - 1])}, theirs from ${formatMen(theirs[0])} to ${formatMen(theirs[theirs.length - 1])}`}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--fa-line)" strokeWidth="1" />
        <path d={path(ours)} fill="none" stroke={OURS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path(theirs)} fill="none" stroke={THEIRS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {t.map((p, i) => <circle key={i} cx={x(i)} cy={H - B} r="2.2" fill={p.pursuit ? 'var(--fa-text)' : 'var(--fa-muted)'} />)}
        <text x={W - R + 4} y={y(ours[ours.length - 1]) + 3} fontSize="9" fill="var(--fa-text)">Yours</text>
        <text x={W - R + 4} y={y(theirs[theirs.length - 1]) + (Math.abs(y(ours[ours.length - 1]) - y(theirs[theirs.length - 1])) < 10 ? 13 : 3)} fontSize="9" fill="var(--fa-text)">Theirs</text>
        <text x={L} y={H - 3} fontSize="8" fill="var(--fa-muted)">Start</text>
        <text x={W - R} y={H - 3} fontSize="8" fill="var(--fa-muted)" textAnchor="end">{t[t.length - 1].pursuit ? 'Pursuit' : `Round ${t[t.length - 1].round}`}</text>
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--fa-muted)" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx={x(hover)} cy={y(ours[hover])} r="4" fill={OURS} stroke="var(--fa-ink)" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(theirs[hover])} r="4" fill={THEIRS} stroke="var(--fa-ink)" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
};

// Each unit's fate (battleReportView.js FATE_VIEW): an icon and a colour per fate.
const FATE_ICON = { held: ShieldCheck, pulledBack: Undo2, withdrew: ArrowLeftFromLine, escaped: Footprints, runDown: Crosshair, fellFighting: Skull, broke: Flag };
const FATE_TONE = { good: 'text-fa-good', calm: 'text-fa-science', warn: 'text-fa-brass', bad: 'text-fa-danger-text' };

const SideTable = ({ title, color, rows, nation, ageId = 'bronze' }) => (
  <div className="space-y-1 min-w-0" data-testid="battle-report-units">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{title}</div>
    {rows.length === 0 && <div className="text-[11px] text-fa-muted">No troops.</div>}
    {rows.map((u) => {
      const Icon = FATE_ICON[u.fate] || Flag;
      return (
        <div key={u.id} className="flex items-start gap-1.5 min-w-0" data-fate={u.fate}>
          <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${FATE_TONE[u.tone]}`} aria-hidden="true" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex justify-between gap-2 text-[11.5px]">
              <span className="truncate">{regimentName(nation, u, unitName(u.classId, ageId, u.navalLine))}</span>
              <span className="fa-num shrink-0 text-fa-muted">{`${formatMen(u.menBefore)} → ${formatMen(u.menAfter)}`}</span>
            </div>
            <div className={`text-[11px] ${FATE_TONE[u.tone]}`}>{u.text}</div>
          </div>
        </div>
      );
    })}
  </div>
);

const Side = ({ tone, tag, name, sideIn, lost }) => (
  <div className={`rounded-[10px] border px-2.5 py-1.5 min-w-0 bg-fa-ink/50 ${tone === 'you' ? 'border-fa-you' : 'border-fa-enemy'}`}>
    <div className="flex items-baseline gap-1.5 min-w-0"><span className={`text-[11px] font-bold tracking-[0.08em] ${tone === 'you' ? 'text-fa-you' : 'text-fa-enemy'}`}>{tag}</span><span className="text-[13px] font-semibold truncate">{name}</span></div>
    <div className="fa-num text-[13px]">{formatMen(sideIn)} in, <span className="font-semibold">{formatMen(lost)}</span> lost</div>
  </div>
);

const Row = ({ row, selected, onClick }) => {
  const Icon = GROUP_ICON[row.group] || Swords;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} data-testid="battle-report-row"
      className={`w-full text-left fa-option px-2 py-1.5 min-h-[52px] flex items-center gap-2 ${selected ? 'fa-selected' : ''}`}>
      <span className="w-8 h-8 rounded-md border border-fa-line grid place-items-center shrink-0"><Icon className="w-4 h-4 text-fa-muted" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2"><span className="text-[13px] font-semibold truncate">{row.name}</span><span className={`text-[12px] font-semibold shrink-0 ${TONE[row.result.tone]}`}>{row.result.label}</span></span>
        <span className="flex items-center justify-between gap-2 text-[11px] text-fa-muted">
          <span className="truncate"><span className="fa-num">{row.when}</span> <span className="fa-chip !min-h-[18px] !px-1.5 !text-[10px] ml-1">{row.mode}</span></span>
          <span className="fa-num shrink-0">{row.losses}</span>
        </span>
      </span>
    </button>
  );
};

/**
 * `entry` the battle to show first; `reports` all of them (state.battleReports, newest first; the
 * list hides when there is only the one). `onReplay(entry)` plays an Auto battle's rounds.
 */
const BattleReportSheet = ({ entry, reports = null, onClose, onShowRegion, onReplay }) => {
  const { state } = useGame();
  const all = useMemo(() => (reports && reports.length ? reports : entry ? [entry] : []), [reports, entry]);
  const [filter, setFilter] = useState('all');
  const [pickedId, setPickedId] = useState(null);
  const [phoneDetail, setPhoneDetail] = useState(true);
  const shown = useMemo(() => filterReports(all, filter), [all, filter]);
  const current = all.find((r) => r.id === (pickedId || entry?.id)) || null;
  const ageOf = (nationId) => (nationId && nationId !== 'rebels' && state.nations?.[nationId] ? getEffectiveAgeId(state.age, getTechAgeId(state, nationId)) : state.age);
  if (!entry || !current) return null;
  const d = reportDetail(state, current);
  const { mine, theirs } = sidesFor(current);
  const many = all.length > 1;

  return (
    <div className="fixed inset-0 z-[72] bg-black/50" onClick={onClose} data-testid="battle-report">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="battle-report-title"
        className="absolute left-[max(env(safe-area-inset-left),0.5rem)] right-[calc(var(--rail-inset,0px)+0.5rem)] top-[calc(var(--header-height,2.5rem)+0.375rem)] bottom-[max(env(safe-area-inset-bottom),0.5rem)] lg:left-1/2 lg:-translate-x-1/2 lg:right-auto lg:w-[min(60rem,calc(100vw-2rem-var(--rail-inset,0px)))] lg:bottom-auto lg:max-h-[min(40rem,calc(100dvh-var(--header-height,2.5rem)-1.5rem))] fa-panel !bg-fa-panel shadow-2xl flex flex-col">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-fa-line">
          <h2 id="battle-report-title" className="fa-heading text-[19px] pl:text-[17px] leading-tight shrink-0">Battle reports</h2>
          <span className="text-[12px] text-fa-muted hidden lg:inline shrink-0">your last 30 battles are kept</span>
          {many && (
            <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto scrollbar-none justify-end" role="toolbar" aria-label="Filter">
              {REPORT_FILTERS.map((f) => <Chip key={f.id} pressed={filter === f.id} onClick={() => setFilter(f.id)} className="shrink-0">{f.label}</Chip>)}
            </div>
          )}
          {!many && <div className="flex-1" />}
          <CloseButton onClick={onClose} label="Close reports" />
        </div>

        <div className={`flex-1 min-h-0 grid ${many ? 'sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]' : ''}`}>
          {many && (
            <div className={`min-h-0 overflow-y-auto p-2 space-y-1.5 sm:border-r border-fa-line ${phoneDetail ? 'hidden sm:block' : ''}`} data-testid="battle-report-list">
              {shown.length === 0 && <div className="text-[12px] text-fa-muted p-2">No battles of this kind yet.</div>}
              {shown.map((e) => {
                const row = reportRow(state, e);
                return <Row key={e.id} row={row} selected={e.id === current.id} onClick={() => { setPickedId(e.id); setPhoneDetail(true); }} />;
              })}
            </div>
          )}

          <div className={`min-h-0 flex flex-col ${many && !phoneDetail ? 'hidden sm:flex' : ''}`}>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                {many && <button type="button" onClick={() => setPhoneDetail(false)} className="sm:hidden fa-icon-btn !w-8 !h-8" aria-label="Back to the list"><ChevronLeft className="w-4 h-4" /></button>}
                <h3 className="fa-heading text-[18px] leading-tight" data-testid="battle-name">{d.name}</h3>
                <span className={`text-[14px] font-semibold ${TONE[d.result.tone]}`}>{d.result.label}</span>
                <span className="text-[11.5px] text-fa-muted ml-auto">{d.who} · <span className="fa-num">{d.when}</span></span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Side tone="you" tag="YOURS" name={d.yours.name} sideIn={d.yours.in} lost={d.yours.lost} />
                <Side tone="enemy" tag="THEIRS" name={d.theirs.name} sideIn={d.theirs.in} lost={d.theirs.lost} />
              </div>
              <p className="text-[12.5px] leading-snug">{d.summary}</p>
              <div className="fa-card px-2.5 py-1.5"><StrengthChart entry={current} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SideTable title="Your units" color={OURS} rows={fateRows(current, mine)} nation={state.nations?.[current[`${mine}NationId`]]} ageId={ageOf(state.playerNationId)} />
                <SideTable title="Their units" color={THEIRS} rows={fateRows(current, theirs)} nation={state.nations?.[current[`${theirs}NationId`]]} ageId={ageOf(current[`${theirs}NationId`])} />
              </div>
            </div>
            <div className="px-3 py-2 border-t border-fa-line flex items-center gap-2">
              {(d.targetRegionId || current.tile != null) && (
                <Button onClick={() => { if (onShowRegion && state.regions?.[d.targetRegionId]) onShowRegion(d.targetRegionId); focusPlace(battlePlaces(current)); onClose(); }} className="shrink-0" data-testid="battle-report-show"><MapPin className="w-4 h-4" aria-hidden="true" /> Show on map</Button>
              )}
              <span className="flex-1 text-[11px] text-fa-muted leading-tight">{d.canReplay ? 'Auto battles keep their rounds.' : 'Commanded battles keep no replay yet.'}</span>
              {d.canReplay && onReplay && (
                <Button variant="primary" onClick={() => onReplay(current)} data-testid="battle-report-replay" className="shrink-0"><Play className="w-4 h-4" aria-hidden="true" /> View replay</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleReportSheet;
