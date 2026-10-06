// The placeholder status of an independent city in the city panel (phases W2 and W3; the full
// independent sheet is W4, plans/independent-cities.md 7): its grudge against you, tribute, its raid
// under way, its mercenary market (mercenaries.js), and since W3 its attitude to you with the
// reasons (the joining measure, indepPolicy.js) and the actions of the plan's section 5: gift gold,
// ask it to join, demand tribute, trade (mercantile). Every button is 44 px; phone first: one column
// of text, buttons two to a row.
import React from 'react';
import { ActionTypes } from '../../data/types';
import { MERC_CONTRACT_TURNS, GIFT_GOLD, JOIN_OPINION, JOIN_TURNS, JOIN_STRENGTH_OPINION, JOIN_STRENGTH_RATIO, tradeGoldOf } from '../../data/independents';
import { mercOffer, mercStockOf } from '../../engine/mercenaries';
import { grudgeOf } from '../../engine/grudges';
import { attitudeOf, mayJoin } from '../../engine/indepPolicy';
import { opinionReasons } from '../../engine/opinion';

const MOOD = { calm: 'Calm', raiding: 'Raiding', besieged: 'Under threat', recovering: 'Recovering' };

const Btn = ({ testId, onClick, disabled = false, tone = 'slate', children }) => (
  <button
    type="button"
    data-testid={testId}
    disabled={disabled}
    onClick={onClick}
    className={`min-h-[44px] px-2 rounded font-semibold text-xs ${disabled ? 'bg-slate-700 text-slate-500' : tone === 'amber' ? 'bg-amber-700 hover:bg-amber-600 text-white' : tone === 'emerald' ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-100'}`}
  >
    {children}
  </button>
);

const IndependentStatus = ({ state, dispatch, nation }) => {
  const me = state.playerNationId;
  const ind = nation.indep || {};
  const grudge = grudgeOf(nation, me);
  const tribute = ind.tributeFrom?.[me];
  const paysMe = ind.tributeTo?.[me];
  const trades = ind.tradeWith?.[me] != null;
  const raid = ind.raid;
  const offer = mercOffer(state, nation.id, me);
  const sells = ['mercantile', 'raiders'].includes(ind.personality);
  const gold = state.resources?.gold || 0;
  const attitude = attitudeOf(state, nation.id, me);
  const reasons = opinionReasons(state, nation.id, me).filter((r) => r.id !== 'baseline' && r.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 4);
  const joinable = mayJoin(nation);
  const send = (type) => dispatch({ type, payload: { independentId: nation.id } });
  return (
    <div className="mt-1.5 p-2 rounded bg-slate-800/60 border border-slate-600/40 text-[11px] text-slate-300 space-y-1" data-testid="independent-status">
      <div className="flex justify-between gap-2"><span>Mood</span><span className="text-slate-100">{MOOD[ind.mood] || 'Calm'}</span></div>
      <div className="flex justify-between gap-2"><span>Grudge against you</span><span className={grudge >= 40 ? 'text-red-400' : grudge > 0 ? 'text-amber-300' : 'text-slate-100'}>{grudge} / 100</span></div>
      <div className="flex justify-between gap-2" data-testid="independent-attitude"><span>Attitude to you</span><span className={attitude >= JOIN_STRENGTH_OPINION ? 'text-emerald-300' : attitude < 0 ? 'text-red-400' : 'text-slate-100'}>{attitude}</span></div>
      {reasons.length > 0 && <div className="text-slate-400">{reasons.map((r) => `${r.label} ${r.value > 0 ? '+' : ''}${r.value}`).join(', ')}</div>}
      <div className="text-slate-400">
        {joinable
          ? `They would join you at attitude ${JOIN_OPINION} held ${JOIN_TURNS} turns, or at ${JOIN_STRENGTH_OPINION} if your army is ${JOIN_STRENGTH_RATIO} times theirs.`
          : ind.personality === 'fortress' ? 'A fortress people never joins anyone peacefully.' : 'Raiders keep their freedom: they never join peacefully.'}
      </div>
      {tribute && <div className="text-amber-200">You pay them {tribute.gold} gold a turn until turn {tribute.until}: no raids, and you may not attack them.</div>}
      {paysMe && <div className="text-emerald-300">They pay you {paysMe.gold} gold a turn until turn {paysMe.until}: a truce both ways.</div>}
      {trades && <div className="text-emerald-300">You trade with them: {tradeGoldOf(state.age)} gold a turn each way.</div>}
      {raid && raid.targetNationId === me && raid.phase === 'out' && <div className="text-red-300" data-testid="independent-raid">Their raiders are out against you.</div>}
      <div className="grid grid-cols-2 gap-1 pt-1">
        <Btn testId="gift-independent" tone="amber" disabled={gold < GIFT_GOLD} onClick={() => send(ActionTypes.GIFT_INDEPENDENT)}>Gift {GIFT_GOLD} gold</Btn>
        {joinable && <Btn testId="propose-joining" tone="emerald" onClick={() => send(ActionTypes.PROPOSE_JOINING)}>Ask them to join</Btn>}
        {!paysMe && !tribute && <Btn testId="demand-tribute" onClick={() => send(ActionTypes.DEMAND_INDEPENDENT_TRIBUTE)}>Demand tribute</Btn>}
        {ind.personality === 'mercantile' && !trades && <Btn testId="propose-trade" onClick={() => send(ActionTypes.PROPOSE_INDEPENDENT_TRADE)}>Offer trade</Btn>}
      </div>
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
