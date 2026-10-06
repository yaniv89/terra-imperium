// src/components/panels/DiplomacyPanel.jsx
// Diplomacy tab: a browsable relations view of all 240 nations, plus per-nation actions — Declare
// War (with casus belli), Fabricate Claim, Sue for Peace, Trade Agreement, Military Alliance,
// Gift/Bribe, Espionage — against src/engine/diplomacy.js's war-goal engine, plus one empire-wide
// action with no chosen target, Cultural Export (Modern age soft power). Plan §M12 adds Rivals,
// Royal Marriage, Break Alliance, Insult, Diplomats (Improve Relations), and the Vassal lifecycle
// (Vassalize/Annex/Release) — see gameReducer.js's own header on that group for what's real vs.
// deferred (Call to Arms/Guarantee Independence need multi-party wars, M13 territory).
//
// Plan feedback: each nation card used to render up to ~10 action buttons unconditionally, which
// overcrowded a list of up to 240 cards. NationCard now shows 1-2 primary actions inline and hides
// the rest behind a per-card "More" toggle.

import React, { useMemo, useState } from 'react';
import { Search, HeartHandshake, Sparkles, Unlock, Ban
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import {
  ACTION_COSTS, CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION
} from '../../data/actionCosts';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { isIndependentNation } from '../../data/independents';
import { hasMet } from '../../engine/fog';
import { getNationCapital } from '../../data/regions';
import { getEffectiveAgeId } from '../../data/ages';
import { canAfford, formatNumber } from '../../utils/helpers';
import { ActionButton } from '../ui';

// Plan feedback ("I don't understand why I can't start a war, I have plenty of resources"): the
// player was reading the top-bar Gold total and assuming that meant "affordable," when most
// diplomacy actions are actually gated on ADM/DIP/MIL power (separate, far scarcer pools —
// src/components/ui/ResourceBar.jsx's adm/dip/mil badges) rather than gold. `formatCost` puts the
// real price directly in the button label (matching the pattern "Sue for Peace (200g)"/"Annex (…
// DIP)" already used below), and `describeShortfall` turns a failed dispatchIfAffordable into a
// specific reason instead of a generic "Not enough resources" — both readable without a hover
// tooltip, which mobile touch has no equivalent of.
import NationCard from './NationCard';

const RESOURCE_SHORT_LABEL = { gold: 'g', dip: 'DIP', adm: 'ADM', mil: 'MIL' };
const describeShortfall = (resources, costs) => Object.entries(costs)
  .filter(([key, amount]) => (resources[key] || 0) < amount)
  .map(([key, amount]) => `${formatNumber(amount)}${RESOURCE_SHORT_LABEL[key] || key} (have ${formatNumber(resources[key] || 0)})`)
  .join(', ');

// Diplomacy actions that travel visibly between the player's capital and the target nation's.

// Deliberately never sets the native `disabled` attribute: a real disabled button swallows every
// click/tap with zero feedback, which is exactly what made every gated diplomacy action look
// "broken" on mobile (no hover tooltip to explain why, and no tap ever reaches onClick). `looksDisabled`
// is styling only — onClick still fires, and callers are expected to explain the block via addLog
// (dispatchIfAffordable already does for cost; a few callers add their own reason on top).
const IconButton = ({ icon: Icon, label, onClick, disabled: looksDisabled, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] ${
      looksDisabled ? 'bg-slate-800 text-slate-500' : 'bg-slate-700/80 hover:bg-slate-600 text-slate-200'
    }`}
  >
    <Icon size={11} />
    {label}
  </button>
);


const DiplomacyPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const [search, setSearch] = useState('');

  const handleCulturalExport = () => {
    if (!canAfford(state.resources, ACTION_COSTS.culturalExport)) return addLog(`Not enough resources — need ${describeShortfall(state.resources, ACTION_COSTS.culturalExport)}`, 'action');
    triggerEffect('cultural_export', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.CULTURAL_EXPORT });
  };
  const handleDeclareIndependence = () => {
    triggerEffect('declare_independence', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.DECLARE_INDEPENDENCE, payload: {} });
  };
  const isModernAge = getEffectiveAgeId(state.age, state.techAgeId) === 'modern';
  const playerNation = state.nations[state.playerNationId];

  // Sort nations: at war (with the player — n.isAtWar alone just means "in a war with someone",
  // which two AI nations fighting each other would also set) first, then by hostility, so the
  // ones that matter surface first; the search box is for finding one specific nation among all
  // 240.
  const sortedNations = useMemo(() => {
    return Object.values(state.nations)
      .filter(n => !n.isPlayer && !isIndependentNation(n)) // independents make no treaties (W1); their own list comes with W4
      // Only peoples you have met (engine/fog.js), and anyone at war with you.
      .filter(n => hasMet(state, state.playerNationId, n.id) || isAtWarWithPlayer(state, n.id))
      .filter(n => !search.trim() || n.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        const aAtWar = isAtWarWithPlayer(state, a.id);
        const bAtWar = isAtWarWithPlayer(state, b.id);
        if (aAtWar !== bAtWar) return aAtWar ? -1 : 1;
        return b.hostility - a.hostility;
      });
  }, [state, search]);

  const unmetCount = useMemo(() => Object.values(state.nations).filter((n) => !n.isPlayer && !n.isEliminated && !hasMet(state, state.playerNationId, n.id)).length, [state]);
  const pendingPeaceOffer = state.pendingPeaceOffer;
  const pendingPeaceOfferNation = pendingPeaceOffer ? state.nations[pendingPeaceOffer.from] : null;

  return (
    <div className="space-y-2">
      {pendingPeaceOffer && (
        // Plan §M13: resolveWarProgress blocks further turns until this is accepted or rejected
        // (see resolveTurn.js's own guard) — a minimal, functional prompt; the full peace-deal
        // screen with a term-by-term acceptance ledger is M20's UI/UX Paradox layer.
        <div className="p-2 rounded bg-amber-900/40 border border-amber-600/50 flex items-center justify-between gap-2">
          <div className="text-xs text-amber-200">
            <span className="font-semibold">{pendingPeaceOfferNation?.name || pendingPeaceOffer.from}</span> offers peace
            {pendingPeaceOffer.terms.length === 0 ? ' (white peace).' : ` (${pendingPeaceOffer.terms.length} term${pendingPeaceOffer.terms.length > 1 ? 's' : ''}, including ceded territory).`}
          </div>
          <div className="flex gap-1 shrink-0">
            <IconButton icon={HeartHandshake} label="Accept" onClick={() => dispatch({ type: ActionTypes.ACCEPT_PENDING_PEACE })} />
            <IconButton icon={Ban} label="Reject" onClick={() => dispatch({ type: ActionTypes.REJECT_PENDING_PEACE })} />
          </div>
        </div>
      )}
      {state.pendingDemand && state.nations[state.pendingDemand.from] && (
        <div className="p-2 rounded bg-red-900/30 border border-red-600/50 flex items-center justify-between gap-2" data-testid="pending-demand">
          <div className="text-xs text-red-200">
            <span className="font-semibold">{state.nations[state.pendingDemand.from].name}</span> {state.pendingDemand.kind === 'city' ? `demands ${state.pendingDemand.cityName || 'a city'}` : state.pendingDemand.kind === 'stopSettling' ? 'demands that you found no city near theirs for 50 turns' : `demands ${state.pendingDemand.amount} gold in tribute`} (answer by turn {state.pendingDemand.until}; a refusal hands them a casus belli).
          </div>
          <div className="flex gap-1 shrink-0">
            <IconButton icon={HeartHandshake} label={state.pendingDemand.kind === 'tribute' ? 'Pay' : state.pendingDemand.kind === 'city' ? 'Yield' : 'Promise'} onClick={() => dispatch({ type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } })} />
            <IconButton icon={Ban} label="Refuse" onClick={() => dispatch({ type: ActionTypes.ANSWER_DEMAND, payload: { accept: false } })} />
          </div>
        </div>
      )}
      {playerNation?.vassalOf && (
        // Plan §M12/§M15: a vassal's own path out of subjection — liberty desire rises the
        // stronger the vassal grows relative to its overlord (resolveTurn.js), and clears the
        // way for a war whose OWN win condition (not a peace deal) frees them outright.
        <ActionButton
          icon={Unlock}
          label="Declare Independence"
          description={`Liberty Desire ${Math.round(playerNation.libertyDesire || 0)}/100 from ${state.nations[playerNation.vassalOf]?.name || playerNation.vassalOf} — needs 50 to declare`}
          costs={ACTION_COSTS.declareIndependence}
          onClick={handleDeclareIndependence}
          disabled={playerNation.isAtWar || (playerNation.libertyDesire || 0) < 50}
          size="small"
        />
      )}
      {isModernAge && (
        <ActionButton
          icon={Sparkles}
          label="Cultural Export"
          description={`Soft power abroad: -${CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION} hostility with every nation, +${CULTURAL_EXPORT_INFLUENCE_GAIN} Cultural Influence (${formatNumber(playerNation?.culturalInfluence || 0)} so far)`}
          costs={ACTION_COSTS.culturalExport}
          onClick={handleCulturalExport}
          disabled={!canAfford(state.resources, ACTION_COSTS.culturalExport)}
          size="small"
        />
      )}
      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nations..."
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600">
        {sortedNations.map(nation => <NationCard key={nation.id} nation={nation} />)}
      </div>
      {unmetCount > 0 && (
        <p className="text-[11px] text-slate-400 px-1" data-testid="unmet-count">
          {unmetCount} {unmetCount === 1 ? 'people has' : 'peoples have'} not been met yet. Explore with armies, settlers and ships: diplomacy opens once you see their land.
        </p>
      )}

      <div className="mt-3 p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-red-400 font-bold">{sortedNations.filter(n => isAtWarWithPlayer(state, n.id)).length}</div>
            <div className="text-slate-500">At War</div>
          </div>
          <div>
            <div className="text-green-400 font-bold">{sortedNations.filter(n => n.hasPeaceTreaty).length}</div>
            <div className="text-slate-500">Peace</div>
          </div>
          <div>
            <div className="text-blue-400 font-bold">{sortedNations.filter(n => n.hasTradeAgreement).length}</div>
            <div className="text-slate-500">Trade</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiplomacyPanel;
