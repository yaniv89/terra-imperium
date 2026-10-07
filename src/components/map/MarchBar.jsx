// src/components/map/MarchBar.jsx
// The bar at the top of the map while choosing where an army marches (MarchContext): what to do,
// then the plan for the province chosen (arrival turn, supplies, where it will halt) with March,
// Move now (a neighbour of your own, this turn), Attack and Cancel.
// Attack on an enemy city: an army that borders it attacks now (the city card and its attack
// card); a far one gets a march to attack (marchAttack.js): the route preview and the turns to
// arrive show here first ("4 turns, stops at Der"), and the assault is offered when it arrives.
import React from 'react';
import { Flag, Swords, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds } from '../../data/regions';
import { accessOf, marchingUnits, placeName } from '../../engine/routes';
import { attackReach } from '../../engine/marchAttack';
import { useMarch } from './MarchContext';

const name = (id) => REGIONS_DATA[id]?.name || id;

/** What the bar offers for a target: pure, for tests. `plan` is MarchContext's planMarch. */
export const marchBarModel = (state, march, plan) => {
  const target = march.target;
  const isTile = typeof target === 'number';
  const naval = !!march.naval;
  const units = marchingUnits(state, march.from, march.unitIds || null, { naval });
  const neighbour = target != null && !isTile && getNeighborIds(march.from).includes(target);
  const access = target != null && !isTile ? accessOf(state, target) : null;
  const enemyCity = !naval && !isTile && target != null && access === 'enemy';
  const reach = enemyCity ? attackReach(state, march.from, target, march.unitIds || null) : null;
  return {
    target, isTile, naval, units,
    canMoveNow: !naval && neighbour && access === 'own' && units.length > 0 && units.every((u) => (u.movesLeft ?? 1) > 0),
    // The immediate attack only for an army that borders the city.
    canAttackNow: enemyCity && reach === 'adjacent',
    // Far: march there to attack it.
    canMarchAttack: enemyCity && reach === 'far' && !!plan?.ok,
    stopsAt: plan?.ok && plan.haltAt && plan.haltAt !== target ? plan.haltAt : null
  };
};

const MarchBar = ({ onSelectRegion }) => {
  const { state, dispatch } = useGame();
  const ctx = useMarch();
  if (!ctx?.march || ctx.march.dragging) return null;
  const { march, plan, cancel } = ctx;
  const m = marchBarModel(state, march, plan);
  const { target, isTile, naval } = m;
  const targetName = isTile ? placeName(state, target) : name(target);

  const marchNow = () => { dispatch({ type: ActionTypes.SET_ROUTE, payload: { ...(isTile ? { fromRegionId: march.from, toTile: target } : { fromRegionId: march.from, toRegionId: target }), naval, unitIds: march.unitIds || null } }); cancel(); };
  const marchAttack = () => { dispatch({ type: ActionTypes.SET_ROUTE, payload: { fromRegionId: march.from, toRegionId: target, attack: true, unitIds: march.unitIds || null } }); cancel(); };
  const moveNow = () => { m.units.forEach((u) => dispatch({ type: ActionTypes.MOVE_ARMY, payload: { unitId: u.id, toRegionId: target } })); cancel(); };
  const attack = () => { cancel(); onSelectRegion?.(target); };

  let line;
  if (target == null) line = naval ? <>Tap a port or a sea tile to sail to from <b>{name(march.from)}</b>.</> : <>Tap a city or a tile to march to from <b>{name(march.from)}</b>.</>;
  else if (m.canAttackNow) line = <>Your army borders <b>{targetName}</b>: attack it now.</>;
  else if (!plan?.ok) line = <span className="text-fa-danger-text">{plan?.reason || 'No route.'}</span>;
  else if (m.canMarchAttack) {
    line = (
      <span data-testid="march-attack-plan">
        Attack <b>{targetName}</b>: march {plan.turns} turn{plan.turns > 1 ? 's' : ''}, then the assault{m.stopsAt && <span className="text-fa-danger-text">. Stops at {name(m.stopsAt)} first</span>}
      </span>
    );
  } else {
    line = (
      <>
        To <b>{targetName}</b>: {plan.turns} turn{plan.turns > 1 ? 's' : ''}{naval ? '' : `, about ${plan.supplies} supplies`}
        {plan.haltAt && <span className="text-fa-danger-text">. Halts at {name(plan.haltAt)} to attack</span>}
      </>
    );
  }

  return (
    <div data-testid="march-bar" className="absolute left-1/2 -translate-x-1/2 top-[calc(var(--header-height,4.5rem)+0.5rem)] z-30 w-[min(560px,calc(100%-1rem))] pl:w-[min(520px,calc(100%-9rem))] rounded-xl border border-emerald-500/50 bg-fa-panel/95 shadow-2xl px-3 py-2 text-[12px] text-fa-text flex items-center gap-2">
      <Flag className="w-4 h-4 text-fa-good shrink-0" />
      <div className="flex-1 min-w-0 leading-snug">{line}</div>
      {m.canAttackNow && <button onClick={attack} data-testid="march-attack-now" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-fa-text">Attack</button>}
      {m.canMarchAttack && (
        <button onClick={marchAttack} data-testid="march-attack" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-fa-text flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5" aria-hidden="true" />March to attack
        </button>
      )}
      {m.canMoveNow && <button onClick={moveNow} className="shrink-0 min-h-[36px] px-3 rounded-lg bg-fa-hover hover:bg-fa-line font-semibold">Move now</button>}
      {plan?.ok && !m.canAttackNow && !m.canMarchAttack && <button onClick={marchNow} data-testid="march-confirm" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-fa-text">{naval ? 'Sail' : 'March'}</button>}
      <button onClick={cancel} aria-label="Cancel march" className="shrink-0 p-2 rounded-lg hover:bg-fa-raised text-fa-muted"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default MarchBar;
