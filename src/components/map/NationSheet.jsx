// src/components/map/NationSheet.jsx
// The nation sheet (plans/civ-map-rework.md E4): the nation at a glance, your standing with it,
// and the Diplomacy tab's own actions (NationCard). Bottom sheet on a phone, a docked card on
// desktop, like the army sheet. Opened by selectNation (marchEvents.js).
import React, { useMemo, useEffect } from 'react';
import { X, Flag } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { nationSheetModel } from './nationSheetModel';
import NationCard from '../panels/NationCard';

const TONE = { good: 'text-emerald-300', bad: 'text-red-300', neutral: 'text-amber-200' };

const NationSheet = ({ nationId, onClose, onSelectRegion }) => {
  const { state, dispatch } = useGame();
  // The guided start's "meet a neighbour" step is done once a foreign nation's sheet is open.
  const guided = !!state.tutorial && !state.tutorial.done?.meet;
  useEffect(() => { if (guided && nationId && nationId !== state.playerNationId) dispatch({ type: ActionTypes.MARK_TUTORIAL_STEP, payload: { stepId: 'meet' } }); }, [guided, nationId, state.playerNationId, dispatch]);
  const isMobile = useIsMobile();
  const m = useMemo(() => nationSheetModel(state, nationId), [state, nationId]);
  if (!m) return null;
  const body = (
    <>
      <div className="flex justify-between items-start border-b border-slate-700 pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flag className="w-4 h-4 text-sky-300 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white truncate text-sm">{m.name}{m.eliminated ? ' (fallen)' : ''}</div>
            <div className="text-slate-500 text-[10px]">{m.government}{m.ruler ? ` · ${m.ruler}` : ''} · {m.cities} cit{m.cities === 1 ? 'y' : 'ies'}{m.capital ? <> · capital <button type="button" onClick={() => onSelectRegion?.(m.capitalId)} className="underline">{m.capital}</button></> : null}</div>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>
      </div>
      <div className="text-[11px] text-slate-300 mb-2 space-y-0.5" data-testid="nation-standing">
        <div>Their army is <span className="text-white">{m.strength.word}</span> ({m.strength.theirs.toLocaleString()} against your {m.strength.mine.toLocaleString()}).</div>
        {m.relations.length > 0 && <div className="flex flex-wrap gap-x-2">{m.relations.map((r) => <span key={r.id} className={TONE[r.tone]}>{r.label}</span>)}</div>}
        {(m.claims.mine || m.claims.theirs) ? <div>{m.claims.mine ? `You hold ${m.claims.mine} claim${m.claims.mine === 1 ? '' : 's'} on their cities. ` : ''}{m.claims.theirs ? `They hold ${m.claims.theirs} claim${m.claims.theirs === 1 ? '' : 's'} on yours.` : ''}</div> : null}
        {m.wonders.length > 0 && <div className="text-yellow-200">Wonders: {m.wonders.join(', ')}</div>}
        <div>Opinion of you <span className={m.opinion >= 20 ? 'text-emerald-300' : m.opinion <= -40 ? 'text-red-300' : 'text-orange-300'}>{m.opinion > 0 ? '+' : ''}{m.opinion}</span>: {m.reasons.map((r) => `${r.label} ${r.value > 0 ? '+' : ''}${r.value}`).join(' · ')}</div>
      </div>
      <NationCard nation={state.nations[nationId]} />
    </>
  );
  if (isMobile) {
    return <div className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto bg-slate-900 border-t border-slate-700 rounded-t-2xl p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs shadow-2xl sheet-panel" data-testid="nation-sheet">{body}</div>;
  }
  return <div className="absolute top-[calc(var(--header-height,4.5rem)+0.5rem)] left-2 z-20 bg-slate-900 p-3 rounded-lg text-xs w-[340px] max-w-[calc(100vw-1rem)] border border-slate-700 shadow-xl max-h-[calc(100dvh-var(--header-height,4.5rem)-1.5rem)] overflow-y-auto" data-testid="nation-sheet">{body}</div>;
};

export default NationSheet;
