// src/components/map/MarchBar.jsx
// The bar at the top of the map while choosing where an army marches (MarchContext): what to do,
// then the plan for the province chosen (arrival turn, supplies, where it will halt) with March,
// Move now (a neighbour of your own, this turn), Attack and Cancel.
// Attack on an enemy city: an army that borders it attacks now (the city card and its attack
// card); a far one gets a march to attack (marchAttack.js): the route preview and the turns to
// arrive show here first ("4 turns, stops at Der"), and the assault is offered when it arrives.
import React, { useState } from 'react';
import { Flag, Swords, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { getTiles } from '../../data/geo/tiles';
import { accessOf, marchingUnits, marchOrigin, moveNowCheck, placeName } from '../../engine/routes';
import { attackReach } from '../../engine/marchAttack';
import { whereLabel } from '../../engine/unitLocation';
import { canSeeTile } from '../../engine/sight';
import { enemyStackAt, validateFieldAttack } from '../../engine/fieldBattle';
import PreBattleModal from '../battle/PreBattleModal';
import { useMarch } from './MarchContext';

const name = (id) => REGIONS_DATA[id]?.name || id;

/** What the bar offers for a target: pure, for tests. `plan` is MarchContext's planMarch. */
export const marchBarModel = (state, march, plan) => {
  const target = march.target;
  const isTile = typeof target === 'number';
  const naval = !!march.naval;
  const units = marchingUnits(state, march.from, march.unitIds || null, { naval });
  const access = target != null && !isTile ? accessOf(state, target) : null;
  const enemyCity = !naval && !isTile && target != null && access === 'enemy';
  const reach = enemyCity ? attackReach(state, march.from, target, march.unitIds || null) : null;
  // Where the stack stands (not its base: playtest audit I058), for "The army near Siwa".
  const origin = marchOrigin(state, march.from, march.unitIds || null, { naval });
  // A visible enemy army on the tile aimed at (I067): beside the stack it can be attacked now;
  // further away the bar says how to reach it.
  const foes = !naval && isTile && target != null && canSeeTile(state, target) ? enemyStackAt(state, target) : [];
  const enemyArmy = foes.length ? { strength: foes.reduce((s, u) => s + u.strength, 0), owner: state.nations[foes[0].ownerId]?.name || 'Rebel', adjacent: origin != null && getTiles().neighbors[origin].includes(target) && validateFieldAttack(state, march.from, target, { ignoreCost: true }).ok } : null;
  return {
    target, isTile, naval, units, origin, enemyArmy,
    fromText: origin != null ? whereLabel(state, origin).text : null,
    // Move now only where the march itself would arrive this turn (routes.js moveNowCheck, the
    // same route and schedule as the preview: I065), for every unit of the stack.
    canMoveNow: !naval && target != null && !isTile && access === 'own' && units.length > 0 && units.every((u) => moveNowCheck(state, u, target).ok),
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
  const [fieldAttack, setFieldAttack] = useState(null); // the tile of an enemy army beside the stack
  if (!ctx?.march || ctx.march.dragging) return null;
  const { march, plan, cancel } = ctx;
  const m = marchBarModel(state, march, plan);
  const { target, isTile, naval } = m;
  const targetName = isTile ? placeName(state, target) : name(target);

  const marchNow = () => { dispatch({ type: ActionTypes.SET_ROUTE, payload: { ...(isTile ? { fromRegionId: march.from, toTile: target } : { fromRegionId: march.from, toRegionId: target }), naval, unitIds: march.unitIds || null } }); cancel(); };
  const marchAttack = () => { dispatch({ type: ActionTypes.SET_ROUTE, payload: { fromRegionId: march.from, toRegionId: target, attack: true, unitIds: march.unitIds || null } }); cancel(); };
  const moveNow = () => { m.units.forEach((u) => dispatch({ type: ActionTypes.MOVE_ARMY, payload: { unitId: u.id, toRegionId: target } })); cancel(); };
  const attack = () => { cancel(); onSelectRegion?.(target); };

  // The army's own place, never its base ("march to from Men-nefer" while it stood at Jerusalem).
  const who = <b data-testid="march-origin">{naval ? 'The fleet' : 'The army'} {m.fromText || `at ${name(march.from)}`}</b>;
  const turnsText = (n) => `${n} turn${n > 1 ? 's' : ''}`;
  // When it sets out (I066): a march walks at End Turn; a stack that already moved now waits a turn.
  const leaves = plan?.ok ? (plan.spent ? ', it already moved this turn' : ', it sets out at End Turn') : '';
  let line;
  if (target == null) line = naval ? <>{who}: tap a port or a sea tile to sail to.</> : <>{who}: tap a city or a tile to march to.</>;
  else if (m.canAttackNow) line = <>Your army borders <b>{targetName}</b>: attack it now.</>;
  else if (m.enemyArmy?.adjacent) line = <span data-testid="march-enemy-army">An army of {m.enemyArmy.owner} ({m.enemyArmy.strength.toLocaleString()}) stands beside yours: attack it now.</span>;
  else if (!plan?.ok) line = <span className="text-fa-danger-text">{plan?.reason || 'No route.'}</span>;
  else if (m.canMarchAttack) {
    line = (
      <span data-testid="march-attack-plan">
        Attack <b>{targetName}</b>: march {turnsText(plan.turns)}, then the assault, about {plan.supplies} supplies{m.stopsAt && <span className="text-fa-danger-text">. Stops at {name(m.stopsAt)} first</span>}
      </span>
    );
  } else if (m.enemyArmy) {
    line = <span data-testid="march-enemy-army">An army of {m.enemyArmy.owner} ({m.enemyArmy.strength.toLocaleString()}) stands there, {turnsText(plan.turns)} away: march beside it, then attack it from the army sheet. About {plan.supplies} supplies.</span>;
  } else {
    line = (
      <span data-testid="march-plan">
        To <b>{targetName}</b>: {turnsText(plan.turns)}{leaves}{naval ? '' : `, about ${plan.supplies} supplies`}{m.canMoveNow ? '. Move now arrives this turn' : ''}
        {plan.haltAt && <span className="text-fa-danger-text">. Halts at {name(plan.haltAt)} to attack</span>}
      </span>
    );
  }
  if (fieldAttack != null) return <PreBattleModal fromRegionId={march.from} tile={fieldAttack} onClose={() => { setFieldAttack(null); cancel(); }} />;

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
      {m.enemyArmy?.adjacent && <button onClick={() => setFieldAttack(target)} data-testid="march-attack-army" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-fa-text">Attack</button>}
      {m.canMoveNow && <button onClick={moveNow} data-testid="march-move-now" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-fa-hover hover:bg-fa-line font-semibold">Move now</button>}
      {plan?.ok && !m.canAttackNow && !m.canMarchAttack && !m.enemyArmy?.adjacent &&<button onClick={marchNow} data-testid="march-confirm" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-fa-text">{naval ? 'Sail' : 'March'}</button>}
      <button onClick={cancel} aria-label="Cancel march" className="shrink-0 p-2 rounded-lg hover:bg-fa-raised text-fa-muted"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default MarchBar;
