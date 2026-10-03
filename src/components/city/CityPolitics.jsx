// src/components/city/CityPolitics.jsx
// The city sheet's Politics tab (plans/civ-map-rework.md E4): loyalty with its parts, the culture
// shares, why unrest moves, the governor (seat one from here), the estates' land in this city, a
// disaster in progress. Phone first: stacked cards, 44 px buttons.
import React from 'react';
import { Heart, Users, Flame, Crown, Landmark } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { cityPoliticsModel } from './cityPoliticsModel';
import { GOVERNOR_ASSIGN_TURNS } from '../../engine/governors';

const Card = ({ icon: Icon, title, children, testId }) => (
  <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1" data-testid={testId}>
    <div className="flex items-center gap-1.5 text-slate-200 font-semibold"><Icon className="w-3.5 h-3.5" />{title}</div>
    {children}
  </div>
);
const signed = (v) => `${v > 0 ? '+' : ''}${v}`;

const CityPolitics = ({ cityId }) => {
  const { state, dispatch } = useGame();
  const m = cityPoliticsModel(state, cityId);
  if (!m) return null;
  return (
    <div className="space-y-2" data-testid="city-politics">
      <Card icon={Heart} title={`Loyalty ${m.loyalty} (settling at ${m.loyaltyTarget})`}>
        <div className="text-slate-400">{m.loyaltyParts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ') || 'Nothing moves it.'}</div>
        <div className="text-slate-500">People: {m.culture.map((c) => `${c.name} ${c.share}%`).join(', ')}</div>
        {m.ungovernedLoyalty ? <div className="text-amber-300">No governor: {m.ungovernedLoyalty} loyalty.</div> : null}
      </Card>
      <Card icon={Users} title={`Unrest ${m.unrest}`}>
        <ul className="text-slate-400 space-y-0.5">
          {m.unrestReasons.map((r) => <li key={r.id} className="flex justify-between"><span>{r.label}</span><span className={r.value > 0 ? 'text-red-300' : 'text-emerald-300'}>{r.value == null ? r.note : `${signed(r.value)} a turn`}</span></li>)}
        </ul>
      </Card>
      {m.group && (
        <Card icon={Crown} title={`Governor of ${m.group.seatName}'s ${m.group.cities} cit${m.group.cities === 1 ? 'y' : 'ies'}`} testId="city-governor">
          {m.governor && <div className="text-emerald-200">{m.governor.name} (skill {m.governor.skill}): {m.governor.effects}.</div>}
          {m.pending && <div className="text-amber-200">{m.pending.name} takes office on turn {m.pending.ready}.</div>}
          {!m.governor && !m.pending && <div className="text-slate-400">The seat is empty{m.mine ? ` (${GOVERNOR_ASSIGN_TURNS} turns to take office).` : '.'}</div>}
          {m.mine && m.governor && <button type="button" onClick={() => dispatch({ type: ActionTypes.DISMISS_GOVERNOR, payload: { seatId: m.group.seat } })} className="min-h-[44px] px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200">Recall</button>}
          {m.mine && !m.governor && !m.pending && (
            <div className="flex flex-wrap gap-1">
              {m.candidates.map((c) => <button key={c.id} type="button" data-testid="city-assign-governor" onClick={() => dispatch({ type: ActionTypes.ASSIGN_GOVERNOR, payload: { seatId: m.group.seat, candidateId: c.id } })} className="min-h-[44px] px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white">Seat {c.name} (skill {c.skill})</button>)}
              {!m.candidates.length && <span className="text-slate-500">No candidates at court.</span>}
            </div>
          )}
        </Card>
      )}
      {m.estates.length > 0 && (
        <Card icon={Landmark} title="The estates here" testId="city-estates">
          {m.estates.map((e) => <div key={e.estateId} className="text-slate-400">{e.label}: {e.tiles} tile{e.tiles === 1 ? '' : 's'} ({e.worked} worked), {e.gives}.</div>)}
          <div className="text-slate-500">Press 6 on the map to see their land. Seize Land on the Domestic tab takes it back.</div>
        </Card>
      )}
      {m.disaster && <Card icon={Flame} title={`${m.disaster.kind[0].toUpperCase()}${m.disaster.kind.slice(1)} in progress`}><div className="text-slate-400">{m.disaster.turnsLeft} turn{m.disaster.turnsLeft === 1 ? '' : 's'} left.</div></Card>}
    </div>
  );
};

export default CityPolitics;
