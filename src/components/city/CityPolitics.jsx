// src/components/city/CityPolitics.jsx
// The city sheet's Politics tab (plans/civ-map-rework.md E4): loyalty with its parts, the culture
// shares, why unrest moves, the governor (seat one from here), a disaster in progress. Phone first: stacked cards, 44 px buttons.
import React from 'react';
import { Heart, Users, Flame, Crown, Scale } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { cityPoliticsModel, crownActions, crownNotes } from './cityPoliticsModel';
import { nameNow } from '../../i18n/names';
import { useEffects } from '../../context/EffectsContext';
import { ActionButton } from '../ui';
import { GOVERNOR_ASSIGN_TURNS } from '../../engine/governors';
import { useT } from '../../i18n/useT';

const Card = ({ icon: Icon, title, children, testId }) => (
  <div className="bg-fa-raised/60 rounded-lg p-2 text-xs space-y-1" data-testid={testId}>
    <div className="flex items-center gap-1.5 text-fa-text font-semibold"><Icon className="w-3.5 h-3.5" />{title}</div>
    {children}
  </div>
);
const signed = (v) => `${v > 0 ? '+' : ''}${v}`;

const CityPolitics = ({ cityId }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const { t } = useT();
  const m = cityPoliticsModel(state, cityId);
  if (!m) return null;
  const actions = crownActions(state, cityId);
  const notes = crownNotes(state, cityId);
  const act = (a) => {
    if (!a.enabled) return addLog(a.reason ? `${a.label}: ${a.reason}.` : t('cy.notEnough'), 'action');
    triggerEffect(a.id.replace(/([A-Z])/g, '_$1').toLowerCase(), { region: cityId });
    dispatch({ type: a.actionType, payload: a.payload });
  };
  return (
    <div className="space-y-2" data-testid="city-politics">
      {notes.map((n) => <div key={n.id} className={`text-[11px] rounded-lg p-2 border ${n.tone === 'red' ? 'bg-red-950/50 border-red-800/60 text-red-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`} data-testid={`crown-note-${n.id}`}>{n.text}</div>)}
      <Card icon={Heart} title={t('cy.loyaltySettling', { n: m.loyalty, target: m.loyaltyTarget })}>
        <div className="text-fa-muted">{m.loyaltyParts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ') || t('cy.nothingMoves')}</div>
        <div className="text-fa-muted">{t('cy.people', { list: m.culture.map((c) => `${c.name} ${c.share}%`).join(', ') })}</div>
        {m.ungovernedLoyalty ? <div className="text-amber-300">{t('cy.noGovernor', { n: m.ungovernedLoyalty })}</div> : null}
        {m.forecast?.grace ? <div className="text-fa-muted" data-testid="loyalty-grace">{m.forecast.grace}</div> : null}
        {m.forecast?.danger ? <div className="text-amber-300" data-testid="loyalty-forecast">{m.forecast.danger}</div> : null}
      </Card>
      <Card icon={Users} title={t('cy.unrestTitle', { n: m.unrest })}>
        <ul className="text-fa-muted space-y-0.5">
          {m.unrestReasons.map((r) => <li key={r.id} className="flex justify-between"><span>{r.label}</span><span className={r.value > 0 ? 'text-fa-danger-text' : 'text-fa-good'}>{r.value == null ? r.note : t('cy.aTurn', { v: signed(r.value) })}</span></li>)}
        </ul>
      </Card>
      {m.group && (
        <Card icon={Crown} title={t('cy.governorOf', { seat: m.group.seatName, count: m.group.cities })} testId="city-governor">
          {m.governor && <div className="text-emerald-200">{t('cy.governorLine', { name: m.governor.name, skill: m.governor.skill, effects: m.governor.effects })}</div>}
          {m.pending && <div className="text-amber-200">{t('cy.takesOffice', { name: m.pending.name, turn: m.pending.ready })}</div>}
          {!m.governor && !m.pending && <div className="text-fa-muted">{m.mine ? t('cy.seatEmptyMine', { count: GOVERNOR_ASSIGN_TURNS }) : t('cy.seatEmpty')}</div>}
          {m.mine && m.governor && <button type="button" onClick={() => dispatch({ type: ActionTypes.DISMISS_GOVERNOR, payload: { seatId: m.group.seat } })} className="min-h-[44px] px-3 rounded-lg bg-fa-hover hover:bg-fa-line text-fa-text">{t('cy.recall')}</button>}
          {m.mine && !m.governor && !m.pending && (
            <div className="flex flex-wrap gap-1">
              {m.candidates.map((c) => <button key={c.id} type="button" data-testid="city-assign-governor" onClick={() => dispatch({ type: ActionTypes.ASSIGN_GOVERNOR, payload: { seatId: m.group.seat, candidateId: c.id } })} className="min-h-[44px] px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-fa-text">{t('cy.seat', { name: nameNow('person', null, c.name), skill: c.skill })}</button>)}
              {!m.candidates.length && <span className="text-fa-muted">{t('cy.noCandidates')}</span>}
            </div>
          )}
        </Card>
      )}
      {actions.length > 0 && (
        <Card icon={Scale} title={t('cy.crown')} testId="city-crown">
          {actions.map((a) => <ActionButton key={a.id} icon={a.danger ? Flame : Scale} label={a.label} description={a.reason && !a.enabled ? `${a.description} (${a.reason})` : a.description} costs={a.costs} onClick={() => act(a)} disabled={!a.enabled} variant={a.danger ? 'danger' : undefined} resources={state.resources} size="small" />)}
        </Card>
      )}
      {m.disaster && <Card icon={Flame} title={t(`cy.disaster.${m.disaster.kind}`)}><div className="text-fa-muted">{t('cy.turnsLeft', { count: m.disaster.turnsLeft })}</div></Card>}
    </div>
  );
};

export default CityPolitics;
