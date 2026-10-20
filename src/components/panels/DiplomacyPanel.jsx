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

import { t as tNow, isolateLtr } from '../../i18n';
import { rich } from '../../i18n/rich';
import { useT } from '../../i18n/useT';
import { messageOf } from '../../i18n/messageText';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, HeartHandshake, Sparkles, Unlock, Ban } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import {
  ACTION_COSTS, CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION
} from '../../data/actionCosts';
import { getNationCapital } from '../../data/regions';
import { isAgeAtLeast } from '../../data/ages';
import { canAfford } from '../../utils/helpers';
import ActionCard from './ActionCard';
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
import { demandTerms } from '../../engine/aiAccords';
import { mapOfferTerms } from '../../engine/mapTrade';
import IndependentsList from '../independents/IndependentsList';
import { openTributeDemand, openJoinOffer, openIndependent } from '../independents/independentEvents';
import { ageOf } from '../../engine/nationState';


const COST_UNITS = new Set(['gold', 'adm', 'dip', 'mil']);
const unitOf = (key) => (COST_UNITS.has(key) ? ` ${tNow(`nc.unit.${key}`)}` : key);
const describeShortfall = (resources, costs, n) => Object.entries(costs)
  .filter(([key, amount]) => (resources[key] || 0) < amount)
  .map(([key, amount]) => tNow('nc.shortfallItem', { n: n(amount), unit: unitOf(key).trim(), have: n(resources[key] || 0) }))
  .join(', ');
// The price of an action in words ("100 Gold, 1 DIP"), as helpers.getCostString writes it.
const costText = (costs, n) => Object.entries(costs || {}).filter(([, v]) => v).map(([k, v]) => (COST_UNITS.has(k) ? `${n(v)} ${tNow(`p2.cu.${k}`)}` : null)).filter(Boolean).join(', ');

const RELATION_TONE = { war: 'text-fa-danger-text border-fa-danger', pact: 'text-fa-good border-fa-good/60', trade: 'text-fa-you border-fa-you/60', vassal: 'text-fa-indep border-fa-indep/60' };

const DiplomacyPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { lang, name: nameIn, n } = useT();
  const { triggerEffect } = useEffects();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null);

  const handleCulturalExport = () => {
    if (!canAfford(state.resources, ACTION_COSTS.culturalExport)) return addLog(tNow('nc.notEnoughNeed', { list: describeShortfall(state.resources, ACTION_COSTS.culturalExport, n) }), 'action');
    triggerEffect('cultural_export', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.CULTURAL_EXPORT });
    return undefined;
  };
  const handleDeclareIndependence = () => {
    triggerEffect('declare_independence', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.DECLARE_INDEPENDENCE, payload: {} });
  };
  const isModernAge = isAgeAtLeast(ageOf(state, state.playerNationId), 'modern');
  const playerNation = state.nations[state.playerNationId];

  // The peoples you met (engine/fog.js) and anyone at war with you, war first, then the coldest.
  const m = useMemo(() => peoplesModel(state, search), [state, search]);
  const selectedId = picked && m.rows.some((r) => r.id === picked) ? picked : m.rows[0]?.id || null;
  // Keep the card on the people shown: an action that warms them (a gift, a map) re-sorts the
  // list, and the card must not jump to whoever is now first.
  useEffect(() => { if (selectedId && selectedId !== picked) setPicked(selectedId); }, [selectedId, picked]);
  const selected = selectedId ? state.nations[selectedId] : null;
  const pendingPeaceOffer = state.pendingPeaceOffer;
  const pendingPeaceOfferNation = pendingPeaceOffer ? state.nations[pendingPeaceOffer.from] : null;
  const demand = useMemo(() => demandTerms(state), [state]);
  const say = (m) => (m ? messageOf(m.key, m.vars, lang) : '');
  const tributes = (state.tributeDemands || []).filter((d) => state.nations[d.indepId] && !state.nations[d.indepId].isEliminated);
  const joins = (state.joinOffers || []).filter((o) => state.nations[o.indepId] && !state.nations[o.indepId].isEliminated);
  const mapOffer = useMemo(() => mapOfferTerms(state), [state]);

  return (
    <div className="px-3 sm:px-4 pt-3 pb-4 space-y-3" data-testid="peoples-tab">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="fa-heading text-[19px]">{tNow('rail.diplomacy')}</h2>
        <span className="fa-label" data-testid="peoples-counts">{tNow('p2.pp.met', { n: m.counts.met })}{m.counts.war ? tNow('p2.pp.war', { n: m.counts.war }) : ''}{m.counts.pact ? tNow('p2.pp.pact', { count: m.counts.pact }) : ''}</span>
      </div>

      {pendingPeaceOffer && (
        // resolveWarProgress blocks further turns until this is accepted or rejected (resolveTurn.js).
        <div className="fa-card p-2.5 flex flex-wrap items-center justify-between gap-2 border-fa-brass/60">
          <div className="text-[13px] min-w-0">
            {rich(tNow('p2.pp.offerPeace'), { name: <span className="font-semibold">{nameIn('people', pendingPeaceOffer.from, pendingPeaceOfferNation?.name || pendingPeaceOffer.from)}</span> })}
            {pendingPeaceOffer.terms.length === 0 ? tNow('p2.pp.white') : tNow('p2.pp.terms', { count: pendingPeaceOffer.terms.length })}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="primary" onClick={() => dispatch({ type: ActionTypes.ACCEPT_PENDING_PEACE })}><HeartHandshake className="w-3.5 h-3.5" aria-hidden="true" />{tNow('dip.accept')}</Button>
            <Button size="sm" onClick={() => dispatch({ type: ActionTypes.REJECT_PENDING_PEACE })}><Ban className="w-3.5 h-3.5" aria-hidden="true" />{tNow('dip.reject')}</Button>
          </div>
        </div>
      )}
      {/* A major's demand (aiAccords.js demandTerms: the same terms the answer applies). The card
          states the sum, the deadline, what meeting it buys and what refusing risks (X21, I104). */}
      {demand && !demand.void && (
        <div className="fa-card p-2.5 space-y-1.5 border-fa-danger" data-testid="pending-demand">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px]">
            <div className="min-w-0"><span className="font-semibold">{nameIn('people', demand.from, demand.name)}</span> {messageOf('m.diplo.cardDemandWord', null, lang)} <span className="font-semibold" data-testid="demand-ask">{say(demand.askMsg)}</span>.</div>
            <div className="text-fa-muted text-[12px] shrink-0" data-testid="demand-deadline">{messageOf('m.diplo.cardDeadline', { turn: demand.deadline, count: demand.turnsLeft }, lang)}</div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 pl:grid-cols-2 text-[12px]">
            <div data-testid="demand-pay"><span className="font-semibold text-fa-good">{messageOf(demand.kind === 'tribute' ? 'm.diplo.cardIfPay' : demand.kind === 'city' ? 'm.diplo.cardIfYield' : 'm.diplo.cardIfPromise', null, lang)}</span> {say(demand.pay.textMsg)}</div>
            <div data-testid="demand-refuse"><span className="font-semibold text-fa-danger-text">{tNow('dip.ifRefuse')}</span> {say(demand.refuse.textMsg)}</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {demand.pay.reason && <span className="text-[12px] text-fa-danger-text me-auto" data-testid="demand-blocked">{say(demand.pay.reasonMsg)}</span>}
            <Button size="sm" disabled={!demand.pay.ok} onClick={() => dispatch({ type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } })} data-testid="demand-accept">{demand.amount != null ? messageOf('m.diplo.btnPayGold', { gold: demand.amount }, lang) : say(demand.pay.labelMsg)}</Button>
            <Button size="sm" variant="danger" onClick={() => dispatch({ type: ActionTypes.ANSWER_DEMAND, payload: { accept: false } })} data-testid="demand-decline">{tNow('dip.refuse')}</Button>
          </div>
        </div>
      )}
      {/* Independents' tribute demands (phase W2, raids.js; the W15 sheet, phase W4). */}
      {tributes.map((d) => (
        <div key={d.id} className="fa-card p-2.5 flex flex-wrap items-center justify-between gap-2 border-dashed border-fa-indep" data-testid="tribute-demand">
          <div className="text-[13px] min-w-0">
            {rich(tNow('p2.pp.tribute', { gold: d.gold, turns: d.turns }), { name: <button type="button" className="font-semibold underline text-fa-indep" onClick={() => openIndependent(d.indepId)}>{nameIn('people', d.indepId, state.nations[d.indepId].name)}</button> })} <span className="text-fa-muted">{tNow('p2.pp.tributeNote', { turn: d.expires })}</span>
          </div>
          <Button size="sm" onClick={() => openTributeDemand(d.id)} data-testid="tribute-demand-answer" className="shrink-0">{tNow('dip.answer')}</Button>
        </div>
      ))}
      {/* Independents offering to join (phase W3, indepPolicy.js): accept and the city is yours, peacefully. */}
      {joins.map((o) => (
        <div key={o.id} className="fa-card p-2.5 flex flex-wrap items-center justify-between gap-2 border-fa-good/60" data-testid="join-offer">
          <div className="text-[13px] min-w-0">
            {rich(tNow('p2.pp.join'), { name: <button type="button" className="font-semibold underline text-fa-indep" onClick={() => openJoinOffer(o.id)}>{nameIn('people', o.indepId, state.nations[o.indepId].name)}</button> })} <span className="text-fa-muted">{tNow('p2.pp.joinNote', { turn: o.expires })}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" onClick={() => dispatch({ type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: true } })}>{tNow('dip.accept')}</Button>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: false } })}>{tNow('dip.decline')}</Button>
          </div>
        </div>
      ))}
      {/* A major's offer to swap maps (mapTrade.js, I116): never blocks the turn, lapses on its own. */}
      {mapOffer && (
        <div className="fa-card p-2.5 flex flex-wrap items-center justify-between gap-2 border-fa-you/60" data-testid="map-offer">
          <div className="text-[13px] min-w-0">
            {rich(tNow('p2.pp.mapOffer'), { name: <button type="button" className="font-semibold underline" onClick={() => setPicked(mapOffer.from)}>{nameIn('people', mapOffer.from, mapOffer.name)}</button> })} <span className="text-fa-muted">{tNow('p2.pp.mapNote', { text: say(mapOffer.textMsg), turn: mapOffer.until })}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" disabled={!mapOffer.ok} onClick={() => dispatch({ type: ActionTypes.ANSWER_MAP_OFFER, payload: { accept: true } })} data-testid="map-offer-accept">{tNow('dip.swap')}</Button>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: ActionTypes.ANSWER_MAP_OFFER, payload: { accept: false } })} data-testid="map-offer-decline">{tNow('dip.decline')}</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] items-start">
        <div className="space-y-2 min-w-0">
          <div className="relative">
            <Search className="w-4 h-4 text-fa-muted absolute start-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tNow('start.searchAria')} aria-label={tNow('dip.searchAria')} className="fa-input w-full !ps-8" />
          </div>
          <ul className="space-y-1.5" data-testid="peoples-list">
            {m.rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setPicked(r.id)} aria-pressed={r.id === selectedId} data-people-row={r.id}
                  className={`w-full text-start rounded-lg border px-2.5 py-2 min-h-[52px] ${r.id === selectedId ? 'fa-selected' : 'border-fa-line bg-fa-raised hover:bg-fa-hover'} ${r.eliminated ? 'opacity-60' : ''}`}>
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} aria-hidden="true" />
                    <span className="text-[13px] font-semibold truncate flex-1">{r.name}{r.eliminated ? tNow('p2.pp.fallen') : ''}</span>
                    <span className={`fa-chip !min-h-[20px] !px-1.5 !text-[10px] uppercase tracking-wide ${RELATION_TONE[r.relation] || ''}`}>{RELATION_LABEL[r.relation]}</span>
                  </span>
                  <span className="block text-[11px] text-fa-muted truncate ps-[18px]">{r.title}</span>
                  <span className="flex items-center gap-2 ps-[18px] mt-1">
                    <span className="relative flex-1 h-1 rounded-full bg-fa-ink/60" aria-hidden="true">
                      <span className="absolute top-[-2px] bottom-[-2px] left-1/2 w-px bg-fa-muted/70" />
                      <span className={`absolute inset-y-0 rounded-full ${r.opinion >= 0 ? 'bg-fa-good' : 'bg-fa-danger'}`} style={r.opinion >= 0 ? { insetInlineStart: '50%', width: `${Math.min(50, r.opinion / 2)}%` } : { insetInlineEnd: '50%', width: `${Math.min(50, -r.opinion / 2)}%` }} />
                    </span>
                    <span className={`fa-num text-[11px] w-8 text-end ${r.opinion >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{isolateLtr(`${r.opinion > 0 ? '+' : ''}${r.opinion}`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {m.rows.length === 0 && <p className="text-[12px] text-fa-muted">{search ? tNow('p2.pp.noMatch') : tNow('p2.pp.none')}</p>}
          {m.counts.unmet > 0 && (
            <p className="text-[12px] text-fa-muted" data-testid="unmet-count">
              {rich(tNow('p2.pp.unmet', { count: m.counts.unmet, n: '{n}' }), { n: <span className="fa-num text-fa-text">{m.counts.unmet}</span> })}
            </p>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          {selected && <NationCard key={selected.id} nation={selected} />}
          {playerNation?.vassalOf && (
            // A vassal's own way out: liberty desire rises the stronger the vassal grows (resolveTurn.js).
            <ActionCard icon={Unlock} label={tNow('dip.independence')}
              description={tNow('p2.pp.liberty', { n: Math.round(playerNation.libertyDesire || 0), name: nameIn('people', playerNation.vassalOf, state.nations[playerNation.vassalOf]?.name || playerNation.vassalOf) })}
              cost={costText(ACTION_COSTS.declareIndependence, n)} onClick={handleDeclareIndependence}
              disabled={playerNation.isAtWar || (playerNation.libertyDesire || 0) < 50} />
          )}
          {isModernAge && (
            <ActionCard icon={Sparkles} label={tNow('dip.export')}
              description={tNow('p2.pp.exportDesc', { h: CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION, g: CULTURAL_EXPORT_INFLUENCE_GAIN, n: n(playerNation?.culturalInfluence || 0) })}
              cost={costText(ACTION_COSTS.culturalExport, n)} onClick={handleCulturalExport}
              disabled={!canAfford(state.resources, ACTION_COSTS.culturalExport)} />
          )}
        </div>
      </div>

      <IndependentsList />
    </div>
  );
};

export default DiplomacyPanel;
