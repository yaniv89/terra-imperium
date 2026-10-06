// src/components/battle/PeaceOfferSheet.jsx
// "They offer peace" (W13's other half): an AI enemy's peace offer (state.pendingPeaceOffer, queued
// by resolveWarProgress in src/engine/diplomacy.js) pops up on its own instead of waiting unnoticed
// in the Peoples tab: the turn cannot end until the player accepts or rejects it. The war score
// from your side, their terms (or a white peace), the truce it starts; Accept is the brass action,
// Keep fighting beside it. It can be tucked away to look at the map first. A panel on the left
// over the map, like the attack interrupt (W14).
import React, { useState } from 'react';
import { Feather, ChevronDown } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { TRUCE_DURATION_TURNS } from '../../data/actionCosts';
import { computeWarScore } from '../../engine/diplomacy';
import { Button, IconButton, Label } from '../ui/atlas';

export const describeTerm = (term, state) => {
  switch (term.type) {
    case 'cede': return `Cede ${REGIONS_DATA[term.regionId]?.name || state.regions[term.regionId]?.name || term.regionId}`;
    case 'gold': return `Pay ${Math.round(term.amount || 0)} gold`;
    case 'reparations': return 'Pay war reparations (a tenth of your gold income for 10 turns)';
    case 'humiliate': return 'Accept humiliation (you lose prestige)';
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
  const score = war ? (war.aggressor === state.playerNationId ? 1 : -1) * computeWarScore(war, state) : null;

  if (tucked) {
    return (
      <button type="button" onClick={() => setTucked(false)} data-testid="peace-offer-pill"
        className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] pl:bottom-3 fa-btn fa-btn-secondary shadow-2xl gap-2">
        <Feather className="w-4 h-4" aria-hidden="true" /> Peace offer from {from}
      </button>
    );
  }

  return (
    <div role="dialog" aria-labelledby="peace-offer-title" data-testid="peace-offer-sheet"
      className="fixed z-[60] left-[max(env(safe-area-inset-left),0.5rem)] top-[calc(var(--header-height,2.5rem)+0.375rem)] max-h-[calc(100dvh-var(--header-height,2.5rem)-0.375rem-max(env(safe-area-inset-bottom),0.5rem))] w-[min(26rem,calc(100vw-1rem-var(--rail-inset,0px)))] flex flex-col fa-panel !bg-fa-panel shadow-2xl">
      <div className="flex items-start gap-2 px-3 pt-2 pb-1.5 border-b border-fa-line">
        <Feather className="w-5 h-5 mt-1 text-fa-muted shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Label>Peace offer · end of turn paused</Label>
          <h2 id="peace-offer-title" className="fa-heading text-[18px] leading-tight">{from} {/[^s]s$/.test(from) ? 'offer' : 'offers'} peace</h2>
        </div>
        <IconButton label="Look at the map first" icon={ChevronDown} onClick={() => setTucked(true)} className="!w-9 !h-9" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
        <p className="text-[12.5px] leading-snug">
          {offer.reason === 'exhaustion'
            ? 'Both sides are worn out by the war. They propose ending it where it stands.'
            : terms.length === 0 ? 'They propose a white peace: the war ends and nobody gives anything up.' : 'They are winning and name their price for ending the war.'}
        </p>
        {score !== null && (
          <div className="flex justify-between text-[12.5px] fa-card px-2.5 py-1.5"><span>War score, from your side</span><span className={`fa-num font-semibold ${score >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{score > 0 ? '+' : ''}{score}</span></div>
        )}
        {terms.length === 0
          ? <div className="fa-card px-2.5 py-1.5 text-[12.5px]">White peace: no land, gold or concessions change hands.</div>
          : (
            <ul className="fa-card px-2.5 py-1.5 text-[12.5px] space-y-1" data-testid="peace-offer-terms">
              {terms.map((t, i) => <li key={i} className="flex gap-2"><span className="text-fa-enemy">•</span>{describeTerm(t, state)}</li>)}
            </ul>
          )}
        <div className="text-[11px] text-fa-muted">Accepting starts a {TRUCE_DURATION_TURNS} turn truce. If you refuse, the war goes on and they may ask again in a few turns.</div>
      </div>
      <div className="px-3 pt-1.5 pb-2 border-t border-fa-line grid grid-cols-2 gap-2">
        <Button onClick={() => dispatch({ type: ActionTypes.REJECT_PENDING_PEACE })} data-testid="peace-offer-reject">Keep fighting</Button>
        <Button variant="primary" hero onClick={() => dispatch({ type: ActionTypes.ACCEPT_PENDING_PEACE })} data-testid="peace-offer-accept">Accept</Button>
      </div>
    </div>
  );
};

export default PeaceOfferSheet;
