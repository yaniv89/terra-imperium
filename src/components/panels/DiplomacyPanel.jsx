// src/components/panels/DiplomacyPanel.jsx
// Peoples (W07, plans/UI-DESIGN.md), the Diplomacy tab in the Field Atlas look: a wide dock with the
// peoples you met on the left (relation word, opinion bar centred on zero, war first) and the chosen
// one's card on the right (NationCard: opinion reasons, "would refuse" before trying), the unmet
// count, and above them anything waiting for an answer (a peace offer, a demand, tribute demands
// and join offers from independents). The independents' own list follows (W08).
// Originally: a browsable relations view of all 240 nations, plus per-nation actions — Declare
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
import { Search, HeartHandshake, Sparkles, Unlock, Ban } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import {
  ACTION_COSTS, CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION
} from '../../data/actionCosts';
import { getNationCapital } from '../../data/regions';
import { getEffectiveAgeId } from '../../data/ages';
import { canAfford, formatNumber } from '../../utils/helpers';
import { ActionButton } from '../ui';
import { Button } from '../ui/atlas';
import { peoplesModel, RELATION_LABEL } from './peoplesModel';

// Plan feedback ("I don't understand why I can't start a war, I have plenty of resources"): the
// player was reading the top-bar Gold total and assuming that meant "affordable," when most
// diplomacy actions are actually gated on ADM/DIP/MIL power (separate, far scarcer pools —
// src/components/ui/ResourceBar.jsx's adm/dip/mil badges) rather than gold. `formatCost` puts the
// real price directly in the button label (matching the pattern "Sue for Peace (200g)"/"Annex (…
// DIP)" already used below), and `describeShortfall` turns a failed dispatchIfAffordable into a
// specific reason instead of a generic "Not enough resources" — both readable without a hover
// tooltip, which mobile touch has no equivalent of.
import NationCard from './NationCard';
import IndependentsList from '../independents/IndependentsList';
import { openTributeDemand, openJoinOffer, openIndependent } from '../independents/independentEvents';


const RESOURCE_SHORT_LABEL = { gold: ' gold', dip: 'DIP', adm: 'ADM', mil: 'MIL' };
const describeShortfall = (resources, costs) => Object.entries(costs)
  .filter(([key, amount]) => (resources[key] || 0) < amount)
  .map(([key, amount]) => `${formatNumber(amount)}${RESOURCE_SHORT_LABEL[key] || key} (have ${formatNumber(resources[key] || 0)})`)
  .join(', ');

const RELATION_TONE = { war: 'text-fa-danger-text border-fa-danger', pact: 'text-fa-good border-fa-good/60', trade: 'text-fa-you border-fa-you/60', vassal: 'text-fa-indep border-fa-indep/60' };

const DiplomacyPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null);

  const handleCulturalExport = () => {
    if (!canAfford(state.resources, ACTION_COSTS.culturalExport)) return addLog(`Not enough resources: need ${describeShortfall(state.resources, ACTION_COSTS.culturalExport)}`, 'action');
    triggerEffect('cultural_export', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.CULTURAL_EXPORT });
    return undefined;
  };
  const handleDeclareIndependence = () => {
    triggerEffect('declare_independence', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.DECLARE_INDEPENDENCE, payload: {} });
  };
  const isModernAge = getEffectiveAgeId(state.age, state.techAgeId) === 'modern';
  const playerNation = state.nations[state.playerNationId];

  // The peoples you met (engine/fog.js) and anyone at war with you, war first, then the coldest.
  const m = useMemo(() => peoplesModel(state, search), [state, search]);
  const selectedId = picked && m.rows.some((r) => r.id === picked) ? picked : m.rows[0]?.id || null;
  const selected = selectedId ? state.nations[selectedId] : null;
  const pendingPeaceOffer = state.pendingPeaceOffer;
  const pendingPeaceOfferNation = pendingPeaceOffer ? state.nations[pendingPeaceOffer.from] : null;
  const tributes = (state.tributeDemands || []).filter((d) => state.nations[d.indepId] && !state.nations[d.indepId].isEliminated);
  const joins = (state.joinOffers || []).filter((o) => state.nations[o.indepId] && !state.nations[o.indepId].isEliminated);

  return (
    <div className="px-3 sm:px-4 pt-3 pb-4 space-y-3" data-testid="peoples-tab">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="fa-heading text-[19px]">Peoples</h2>
        <span className="fa-label" data-testid="peoples-counts">{m.counts.met} met{m.counts.war ? `, ${m.counts.war} at war` : ''}{m.counts.pact ? `, ${m.counts.pact} ${m.counts.pact === 1 ? 'pact' : 'pacts'}` : ''}</span>
      </div>

      {pendingPeaceOffer && (
        // resolveWarProgress blocks further turns until this is accepted or rejected (resolveTurn.js).
        <div className="fa-card p-2.5 flex flex-wrap items-center justify-between gap-2 border-fa-brass/60">
          <div className="text-[13px] min-w-0">
            <span className="font-semibold">{pendingPeaceOfferNation?.name || pendingPeaceOffer.from}</span> offer peace
            {pendingPeaceOffer.terms.length === 0 ? ' (white peace).' : ` (${pendingPeaceOffer.terms.length} term${pendingPeaceOffer.terms.length > 1 ? 's' : ''}, including ceded territory).`}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="primary" onClick={() => dispatch({ type: ActionTypes.ACCEPT_PENDING_PEACE })}><HeartHandshake className="w-3.5 h-3.5" aria-hidden="true" />Accept</Button>
            <Button size="sm" onClick={() => dispatch({ type: ActionTypes.REJECT_PENDING_PEACE })}><Ban className="w-3.5 h-3.5" aria-hidden="true" />Reject</Button>
          </div>
        </div>
      )}
      {state.pendingDemand && state.nations[state.pendingDemand.from] && (
        <div className="fa-card p-2.5 flex flex-wrap items-center justify-between gap-2 border-fa-danger" data-testid="pending-demand">
          <div className="text-[13px] min-w-0">
            <span className="font-semibold">{state.nations[state.pendingDemand.from].name}</span> {state.pendingDemand.kind === 'city' ? `demand ${state.pendingDemand.cityName || 'a city'}` : state.pendingDemand.kind === 'stopSettling' ? 'demand that you found no city near theirs for 50 turns' : `demand ${state.pendingDemand.amount} gold in tribute`}. <span className="text-fa-muted">Answer by turn {state.pendingDemand.until}; a refusal hands them a casus belli.</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" onClick={() => dispatch({ type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } })}>{state.pendingDemand.kind === 'tribute' ? 'Pay' : state.pendingDemand.kind === 'city' ? 'Yield' : 'Promise'}</Button>
            <Button size="sm" variant="danger" onClick={() => dispatch({ type: ActionTypes.ANSWER_DEMAND, payload: { accept: false } })}>Refuse</Button>
          </div>
        </div>
      )}
      {/* Independents' tribute demands (phase W2, raids.js; the W15 sheet, phase W4). */}
      {tributes.map((d) => (
        <div key={d.id} className="fa-card p-2.5 flex flex-wrap items-center justify-between gap-2 border-dashed border-fa-indep" data-testid="tribute-demand">
          <div className="text-[13px] min-w-0">
            <button type="button" className="font-semibold underline text-fa-indep" onClick={() => openIndependent(d.indepId)}>{state.nations[d.indepId].name}</button> demand {d.gold} gold a turn for {d.turns} turns, or they raid you. <span className="text-fa-muted">Answer by turn {d.expires}; paying also keeps you from attacking them meanwhile.</span>
          </div>
          <Button size="sm" onClick={() => openTributeDemand(d.id)} data-testid="tribute-demand-answer" className="shrink-0">Answer</Button>
        </div>
      ))}
      {/* Independents offering to join (phase W3, indepPolicy.js): accept and the city is yours, peacefully. */}
      {joins.map((o) => (
        <div key={o.id} className="fa-card p-2.5 flex flex-wrap items-center justify-between gap-2 border-fa-good/60" data-testid="join-offer">
          <div className="text-[13px] min-w-0">
            <button type="button" className="font-semibold underline text-fa-indep" onClick={() => openJoinOffer(o.id)}>{state.nations[o.indepId].name}</button> offer to join you: their city and soldiers become yours, with no aggressive expansion. <span className="text-fa-muted">Answer by turn {o.expires}.</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" onClick={() => dispatch({ type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: true } })}>Accept</Button>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: false } })}>Decline</Button>
          </div>
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] items-start">
        <div className="space-y-2 min-w-0">
          <div className="relative">
            <Search className="w-4 h-4 text-fa-muted absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search peoples" aria-label="Search the peoples you met" className="fa-input w-full !pl-8" />
          </div>
          <ul className="space-y-1.5" data-testid="peoples-list">
            {m.rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setPicked(r.id)} aria-pressed={r.id === selectedId} data-people-row={r.id}
                  className={`w-full text-left rounded-lg border px-2.5 py-2 min-h-[52px] ${r.id === selectedId ? 'fa-selected' : 'border-fa-line bg-fa-raised hover:bg-fa-hover'} ${r.eliminated ? 'opacity-60' : ''}`}>
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} aria-hidden="true" />
                    <span className="text-[13px] font-semibold truncate flex-1">{r.name}{r.eliminated ? ' (fallen)' : ''}</span>
                    <span className={`fa-chip !min-h-[20px] !px-1.5 !text-[10px] uppercase tracking-wide ${RELATION_TONE[r.relation] || ''}`}>{RELATION_LABEL[r.relation]}</span>
                  </span>
                  <span className="block text-[11px] text-fa-muted truncate pl-[18px]">{r.title}</span>
                  <span className="flex items-center gap-2 pl-[18px] mt-1">
                    <span className="relative flex-1 h-1 rounded-full bg-fa-ink/60" aria-hidden="true">
                      <span className="absolute top-[-2px] bottom-[-2px] left-1/2 w-px bg-fa-muted/70" />
                      <span className={`absolute inset-y-0 rounded-full ${r.opinion >= 0 ? 'bg-fa-good' : 'bg-fa-danger'}`} style={r.opinion >= 0 ? { left: '50%', width: `${Math.min(50, r.opinion / 2)}%` } : { right: '50%', width: `${Math.min(50, -r.opinion / 2)}%` }} />
                    </span>
                    <span className={`fa-num text-[11px] w-8 text-right ${r.opinion >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{r.opinion > 0 ? '+' : ''}{r.opinion}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {m.rows.length === 0 && <p className="text-[12px] text-fa-muted">{search ? 'No people by that name.' : 'You have met no other people yet.'}</p>}
          {m.counts.unmet > 0 && (
            <p className="text-[12px] text-fa-muted" data-testid="unmet-count">
              <span className="fa-num text-fa-text">{m.counts.unmet}</span> {m.counts.unmet === 1 ? 'people has' : 'peoples have'} not been met yet. Explore with armies, settlers and ships: diplomacy opens once you see their land.
            </p>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          {selected && <NationCard key={selected.id} nation={selected} />}
          {playerNation?.vassalOf && (
            // A vassal's own way out: liberty desire rises the stronger the vassal grows (resolveTurn.js).
            <ActionButton icon={Unlock} label="Declare Independence"
              description={`Liberty desire ${Math.round(playerNation.libertyDesire || 0)} of 100 from ${state.nations[playerNation.vassalOf]?.name || playerNation.vassalOf}; needs 50 to declare`}
              costs={ACTION_COSTS.declareIndependence} onClick={handleDeclareIndependence}
              disabled={playerNation.isAtWar || (playerNation.libertyDesire || 0) < 50} size="small" />
          )}
          {isModernAge && (
            <ActionButton icon={Sparkles} label="Cultural Export"
              description={`Soft power abroad: -${CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION} hostility with every nation, +${CULTURAL_EXPORT_INFLUENCE_GAIN} cultural influence (${formatNumber(playerNation?.culturalInfluence || 0)} so far)`}
              costs={ACTION_COSTS.culturalExport} onClick={handleCulturalExport}
              disabled={!canAfford(state.resources, ACTION_COSTS.culturalExport)} size="small" />
          )}
        </div>
      </div>

      <IndependentsList />
    </div>
  );
};

export default DiplomacyPanel;
