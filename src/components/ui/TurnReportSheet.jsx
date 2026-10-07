// src/components/ui/TurnReportSheet.jsx
// The turn report (W10, plans/UI-DESIGN.md): after End Turn (or a fast forward) the sheet lists
// what happened, grouped (battles, raids, contacts, cities, research, news) with chips to filter
// and a place button on each line that jumps there. Quiet turns (only growth and research) skip
// it; the turn number on the top bar opens the last report again. The one brass action is
// "Play turn N", which closes it. turnReportModel.js is the pure model.
//
// The report compares the state the player last saw before the turn with the state after it:
// while the turn number stays the same the baseline follows every change (the player's own
// actions are not news), and a new game or a smaller turn number resets it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ScrollText } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GameStatus } from '../../data/types';
import { selectRegion, selectNation, focusPlace } from '../map/marchEvents';
import { openPanelTab } from '../panels/panelEvents';
import { OPEN_TURN_REPORT, setTurnReportShown } from './uiEvents';
import { turnReportModel } from './turnReportModel';
import { Button, Chip, Label, SheetHeader } from './atlas';

const DOT = { good: 'bg-fa-good', danger: 'bg-fa-danger', enemy: 'bg-fa-enemy', you: 'bg-fa-you', science: 'bg-[var(--fa-science)]', muted: 'bg-fa-muted' };

const ReportRow = ({ item, onGo }) => (
  <li className="flex items-center gap-2.5 py-1.5 min-h-[48px]" data-testid="turn-report-item" data-group={item.group}>
    <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${DOT[item.tone] || DOT.muted}`} aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-semibold leading-tight">{item.title}</div>
      {item.sub && <div className="text-[12px] text-fa-muted leading-tight">{item.sub}</div>}
    </div>
    {item.place && (
      <Button size="sm" className="shrink-0 max-w-[9rem]" onClick={() => onGo(item.place)} aria-label={`Go to ${item.place.name}`}>
        <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{item.place.name}</span>
      </Button>
    )}
  </li>
);

const TurnReportSheet = () => {
  const { state, turnPending } = useGame();
  const baseRef = useRef(state);
  const [report, setReport] = useState(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (turnPending) return;
    const base = baseRef.current;
    if (state.playerNationId !== base.playerNationId || state.turnNumber < base.turnNumber || (state.logs?.length || 0) < (base.logs?.length || 0)) {
      baseRef.current = state; setReport(null); setOpen(false); return;
    }
    if (state.turnNumber === base.turnNumber) { baseRef.current = state; return; }
    const next = turnReportModel(base, state);
    baseRef.current = state;
    setReport(next);
    setFilter('all');
    setOpen(!!next && !next.quiet && state.gameStatus === GameStatus.ACTIVE);
  }, [state, turnPending]);

  useEffect(() => {
    const onOpen = () => { if (report) { setFilter('all'); setOpen(true); } };
    window.addEventListener(OPEN_TURN_REPORT, onOpen);
    return () => window.removeEventListener(OPEN_TURN_REPORT, onOpen);
  }, [report]);

  useEffect(() => { setTurnReportShown(open); }, [open]);
  useEffect(() => () => setTurnReportShown(false), []);

  // Enter plays the next turn: it closes the report first (End Turn's own Enter must not fire).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target?.tagName || ''))) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const shown = useMemo(() => (report ? report.items.filter((i) => filter === 'all' || i.group === filter) : []), [report, filter]);
  if (!open || !report) return null;
  const close = () => setOpen(false);
  const go = (place) => {
    close();
    if (place.kind === 'city') { if (state.regions?.[place.id]) selectRegion(place.id); focusPlace([{ regionId: place.id }, { tile: place.tile }]); }
    else if (place.kind === 'nation') selectNation(place.id);
    else if (place.kind === 'tab') openPanelTab(place.id);
  };
  const groups = report.groups.filter((g) => filter === 'all' || g.id === filter);

  return (
    <div className="fixed inset-0 z-[45] bg-black/40 flex items-center justify-center p-3 pr-[calc(var(--rail-inset,0px)+0.75rem)] pt-[calc(var(--header-height,2.25rem)+0.5rem)] sheet-backdrop" onClick={close} data-testid="turn-report">
      <div role="dialog" aria-modal="true" aria-labelledby="turn-report-title" onClick={(e) => e.stopPropagation()}
        className="sheet-panel fa-sheet w-full max-w-[560px] max-h-full flex flex-col rounded-[10px] border border-fa-line shadow-2xl">
        <SheetHeader title={report.title} subtitle={`${report.year}, ${report.items.length} ${report.items.length === 1 ? 'event' : 'events'}`} onClose={close} titleId="turn-report-title" className="!pb-1.5" />
        {report.groups.length > 1 && (
          <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-none border-b border-fa-line shrink-0" role="toolbar" aria-label="Show">
            <Chip pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span className="fa-num">{report.items.length}</span></Chip>
            {report.groups.map((g) => (
              <Chip key={g.id} pressed={filter === g.id} onClick={() => setFilter(g.id)}>{g.label} <span className="fa-num">{report.counts[g.id]}</span></Chip>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-1">
          {report.items.length === 0 && <p className="py-3 text-[13px] text-fa-muted">A quiet turn: nothing to report.</p>}
          {groups.map((g) => (
            <section key={g.id} aria-label={g.label} className="pt-1.5">
              <Label>{g.label}</Label>
              <ul className="divide-y divide-fa-line/60">
                {shown.filter((i) => i.group === g.id).map((i) => <ReportRow key={i.id} item={i} onGo={go} />)}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-fa-line shrink-0">
          <span className="text-[12px] text-fa-muted flex-1 min-w-0 flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Every line stays in the Log. Quiet turns skip this sheet.</span>
          <Button variant="primary" hero onClick={close} className="shrink-0 !min-h-[46px]" data-testid="turn-report-play">Play turn {report.nextTurn}</Button>
        </div>
      </div>
    </div>
  );
};

export default TurnReportSheet;
