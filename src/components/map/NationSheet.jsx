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
import { UNKNOWN_PEOPLE } from '../../engine/fog';

const TONE = { good: 'text-fa-good', bad: 'text-fa-danger-text', neutral: 'text-amber-200' };

const NationSheet = ({ nationId, onClose, onSelectRegion }) => {
  const { state, dispatch } = useGame();
  // The guided start's "meet a neighbour" step is done once a foreign nation's sheet is open.
  const guided = !!state.tutorial && !state.tutorial.done?.meet;
  useEffect(() => { if (guided && nationId && nationId !== state.playerNationId) dispatch({ type: ActionTypes.MARK_TUTORIAL_STEP, payload: { stepId: 'meet' } }); }, [guided, nationId, state.playerNationId, dispatch]);
  const isMobile = useIsMobile();
  const m = useMemo(() => nationSheetModel(state, nationId), [state, nationId]);
  if (!m) return null;
  // A people not yet met (engine/fog.js): no name, no numbers, no diplomacy.
  const body = !m.met ? (
    <div className="flex justify-between items-start" data-testid="nation-unknown">
      <div className="min-w-0">
        <div className="font-bold text-fa-text text-sm">{UNKNOWN_PEOPLE}</div>
        <div className="text-fa-muted text-[11px] mt-1">You have not met this people. Send an army, settlers or ships until you see their land; diplomacy opens on contact.</div>
      </div>
      <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-fa-hover rounded text-fa-muted hover:text-fa-text shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>
    </div>
  ) : (
    <>
      <div className="flex justify-between items-start border-b border-fa-line pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flag className="w-4 h-4 text-fa-you shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-fa-text truncate text-sm">{m.name}{m.eliminated ? ' (fallen)' : ''}</div>
            <div className="text-fa-muted text-[10px]">{m.government}{m.ruler ? ` · ${m.ruler}` : ''} · {m.cities} cit{m.cities === 1 ? 'y' : 'ies'}{m.capital ? <> · capital <button type="button" onClick={() => onSelectRegion?.(m.capitalId)} className="underline">{m.capital}</button></> : null}</div>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-fa-hover rounded text-fa-muted hover:text-fa-text shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>
      </div>
      <div className="text-[11px] text-fa-text mb-2 space-y-0.5" data-testid="nation-standing">
        <div>Their army is <span className="text-fa-text">{m.strength.word}</span> ({m.strength.theirs.toLocaleString()} against your {m.strength.mine.toLocaleString()}).</div>
        {m.relations.length > 0 && <div className="flex flex-wrap gap-x-2">{m.relations.map((r) => <span key={r.id} className={TONE[r.tone]}>{r.label}</span>)}</div>}
        {(m.claims.mine || m.claims.theirs) ? <div>{m.claims.mine ? `You hold ${m.claims.mine} claim${m.claims.mine === 1 ? '' : 's'} on their cities. ` : ''}{m.claims.theirs ? `They hold ${m.claims.theirs} claim${m.claims.theirs === 1 ? '' : 's'} on yours.` : ''}</div> : null}
        {m.wonders.length > 0 && <div className="text-yellow-200">Wonders: {m.wonders.join(', ')}</div>}
      </div>
      <NationCard nation={state.nations[nationId]} hideTitle />
    </>
  );
  if (isMobile) {
    return <div className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto bg-fa-panel border-t border-fa-line rounded-t-2xl p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs shadow-2xl sheet-panel" data-testid="nation-sheet">{body}</div>;
  }
  return <div className="absolute top-[calc(var(--header-height,4.5rem)+0.5rem)] left-2 z-20 bg-fa-panel p-3 rounded-lg text-xs w-[340px] max-w-[calc(100vw-1rem)] border border-fa-line shadow-xl max-h-[calc(100dvh-var(--header-height,4.5rem)-1.5rem)] overflow-y-auto" data-testid="nation-sheet">{body}</div>;
};

export default NationSheet;
