// src/components/battle/PeaceOfferSheet.jsx
// "They offer peace" — an AI enemy's peace offer (state.pendingPeaceOffer, queued by
// resolveWarProgress in src/engine/diplomacy.js) pops up on its own instead of waiting unnoticed in
// the Diplomacy panel: the turn can't end until the player accepts or rejects it, so the player
// always gets the say on whether their war ends. It can be tucked away to look at the map first.
// A bottom sheet on phones, a centred card on desktop.
import React, { useState } from 'react';
import { HeartHandshake, Ban, ChevronDown, Feather } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';

const describeTerm = (term, state) => {
  switch (term.type) {
    case 'cede': return `Cede ${REGIONS_DATA[term.regionId]?.name || state.regions[term.regionId]?.name || term.regionId}`;
    case 'gold': return `Pay ${Math.round(term.amount || 0)} gold`;
    case 'reparations': return 'Pay war reparations';
    case 'humiliate': return 'Accept humiliation (prestige loss)';
    case 'vassalize': return 'Become their vassal';
    default: return term.type;
  }
};

const PeaceOfferSheet = () => {
  const { state, dispatch } = useGame();
  const [tucked, setTucked] = useState(false);
  const offer = state.pendingPeaceOffer;
  // Battles and assaults come first; the offer waits behind them.
  if (!offer || state.pendingBattle || state.pendingDefenses?.length) return null;
  const from = state.nations[offer.from]?.name || offer.from;
  const war = (state.wars || []).find((w) => w.id === offer.warId);
  const terms = offer.terms || [];

  if (tucked) {
    return (
      <button type="button" onClick={() => setTucked(false)} className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-bold shadow-2xl animate-pulse flex items-center gap-2" data-testid="peace-offer-pill">
        <Feather className="w-4 h-4" /> Peace offer from {from}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" data-testid="peace-offer-sheet">
      <div className="w-full sm:max-w-md max-h-[85vh] flex flex-col bg-slate-900 border border-amber-500/60 rounded-t-2xl sm:rounded-2xl text-slate-200 shadow-2xl">
        <div className="p-4 pb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2"><Feather className="w-5 h-5 text-amber-300" /> {from} offers peace</div>
            <div className="text-xs text-slate-400">
              {offer.reason === 'exhaustion'
                ? 'Both nations are exhausted by the war. They propose ending it where it stands.'
                : terms.length === 0 ? 'They propose a white peace: the war ends and nobody gives anything up.' : 'They are winning and name their price for ending the war.'}
              {war && typeof war.score === 'number' && <> War score: <span className={war.score === 0 ? 'text-slate-300' : ''}>{Math.round(war.aggressor === state.playerNationId ? war.score : -war.score)}</span> for you.</>}
            </div>
          </div>
          <button type="button" onClick={() => setTucked(true)} className="p-2 -m-2 text-slate-400" aria-label="Look at the map first"><ChevronDown className="w-5 h-5" /></button>
        </div>
        <div className="px-4 overflow-y-auto">
          {terms.length === 0
            ? <div className="rounded-lg bg-slate-800/70 border border-slate-700 p-3 text-sm">White peace: no land, gold or concessions change hands.</div>
            : (
              <ul className="rounded-lg bg-slate-800/70 border border-slate-700 p-3 text-sm space-y-1 list-disc list-inside" data-testid="peace-offer-terms">
                {terms.map((t, i) => <li key={i}>{describeTerm(t, state)}</li>)}
              </ul>
            )}
          <div className="text-[11px] text-slate-500 mt-2">Accepting starts a truce. If you reject, the war goes on and they may ask again in a few turns.</div>
        </div>
        <div className="p-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] grid grid-cols-2 gap-2">
          <button type="button" onClick={() => dispatch({ type: ActionTypes.ACCEPT_PENDING_PEACE })} className="min-h-[48px] rounded-lg bg-emerald-600/90 border border-emerald-400 flex items-center justify-center gap-2 text-sm font-semibold text-white" data-testid="peace-offer-accept">
            <HeartHandshake className="w-4 h-4" /> Accept
          </button>
          <button type="button" onClick={() => dispatch({ type: ActionTypes.REJECT_PENDING_PEACE })} className="min-h-[48px] rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center gap-2 text-sm font-semibold text-slate-200" data-testid="peace-offer-reject">
            <Ban className="w-4 h-4" /> Keep fighting
          </button>
        </div>
      </div>
    </div>
  );
};

export default PeaceOfferSheet;
