// The placeholder status of an independent city in the city panel (phase W2; the full independent
// sheet is W4, plans/independent-cities.md 7): its grudge against you, tribute, its raid under way,
// and its mercenary market (mercenaries.js) with a 44 px hire button. Phone first: one column.
import React from 'react';
import { ActionTypes } from '../../data/types';
import { MERC_CONTRACT_TURNS } from '../../data/independents';
import { mercOffer, mercStockOf } from '../../engine/mercenaries';
import { grudgeOf } from '../../engine/grudges';

const MOOD = { calm: 'Calm', raiding: 'Raiding', besieged: 'Under threat', recovering: 'Recovering' };

const IndependentStatus = ({ state, dispatch, nation }) => {
  const me = state.playerNationId;
  const ind = nation.indep || {};
  const grudge = grudgeOf(nation, me);
  const tribute = ind.tributeFrom?.[me];
  const raid = ind.raid;
  const offer = mercOffer(state, nation.id, me);
  const sells = ['mercantile', 'raiders'].includes(ind.personality);
  const gold = state.resources?.gold || 0;
  return (
    <div className="mt-1.5 p-2 rounded bg-slate-800/60 border border-slate-600/40 text-[11px] text-slate-300 space-y-1" data-testid="independent-status">
      <div className="flex justify-between gap-2"><span>Mood</span><span className="text-slate-100">{MOOD[ind.mood] || 'Calm'}</span></div>
      <div className="flex justify-between gap-2"><span>Grudge against you</span><span className={grudge >= 40 ? 'text-red-400' : grudge > 0 ? 'text-amber-300' : 'text-slate-100'}>{grudge} / 100</span></div>
      {tribute && <div className="text-amber-200">You pay them {tribute.gold} gold a turn until turn {tribute.until}: no raids, and you may not attack them.</div>}
      {raid && raid.targetNationId === me && raid.phase === 'out' && <div className="text-red-300" data-testid="independent-raid">Their raiders are out against you.</div>}
      {sells && (
        <div className="pt-1 border-t border-slate-700/60">
          <div className="mb-1">
            Mercenaries: {mercStockOf(nation, state.turnNumber || 0)} band(s) for hire
            {offer.ok ? `, ${offer.price} gold, then ${offer.upkeep} gold a turn for ${MERC_CONTRACT_TURNS} turns.` : `. ${offer.reason}`}
          </div>
          {offer.ok && (
            <button
              type="button"
              data-testid="hire-mercenary"
              disabled={gold < offer.price}
              onClick={() => dispatch({ type: ActionTypes.HIRE_MERCENARY, payload: { independentId: nation.id } })}
              className={`w-full min-h-[44px] rounded font-semibold text-xs ${gold < offer.price ? 'bg-slate-700 text-slate-500' : 'bg-amber-700 hover:bg-amber-600 text-white'}`}
            >
              {gold < offer.price ? `Hire a band (need ${offer.price} gold)` : `Hire a band (${offer.price} gold)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default IndependentStatus;
