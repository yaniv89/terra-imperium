// src/components/map/MarchBar.jsx
// The bar at the top of the map while choosing where an army marches (MarchContext): what to do,
// then the plan for the province chosen (arrival turn, supplies, where it will halt) with March,
// Move now (a neighbour of your own, this turn), Attack (an enemy neighbour) and Cancel.
import React from 'react';
import { Flag, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds } from '../../data/regions';
import { accessOf, marchingUnits, placeName } from '../../engine/routes';
import { useMarch } from './MarchContext';

const name = (id) => REGIONS_DATA[id]?.name || id;

const MarchBar = ({ onSelectRegion }) => {
  const { state, dispatch } = useGame();
  const ctx = useMarch();
  if (!ctx?.march || ctx.march.dragging) return null;
  const { march, plan, cancel } = ctx;
  const target = march.target;
  const isTile = typeof target === 'number';
  const units = marchingUnits(state, march.from);
  const neighbour = target && !isTile && getNeighborIds(march.from).includes(target);
  const access = target && !isTile ? accessOf(state, target) : null;
  const targetName = isTile ? placeName(state, target) : name(target);
  const canMoveNow = neighbour && access === 'own' && units.length > 0 && units.every((u) => (u.movesLeft ?? 1) > 0);
  const canAttack = neighbour && access === 'enemy';

  const marchNow = () => { dispatch({ type: ActionTypes.SET_ROUTE, payload: isTile ? { fromRegionId: march.from, toTile: target } : { fromRegionId: march.from, toRegionId: target } }); cancel(); };
  const moveNow = () => { units.forEach((u) => dispatch({ type: ActionTypes.MOVE_ARMY, payload: { unitId: u.id, toRegionId: target } })); cancel(); };
  const attack = () => { cancel(); onSelectRegion?.(target); };

  let line;
  if (!target) line = <>Tap a city or a tile to march to from <b>{name(march.from)}</b>.</>;
  else if (!plan?.ok) line = <span className="text-red-300">{plan?.reason || 'No route.'}</span>;
  else {
    line = (
      <>
        To <b>{targetName}</b>: {plan.turns} turn{plan.turns > 1 ? 's' : ''}, about {plan.supplies} supplies
        {plan.haltAt && <span className="text-red-300">. Halts at {name(plan.haltAt)} to attack</span>}
      </>
    );
  }

  return (
    <div data-testid="march-bar" className="absolute left-1/2 -translate-x-1/2 top-[calc(var(--header-height,4.5rem)+0.5rem)] z-30 w-[min(560px,calc(100%-1rem))] pl:w-[min(520px,calc(100%-9rem))] rounded-xl border border-emerald-500/50 bg-slate-900/95 shadow-2xl px-3 py-2 text-[12px] text-slate-200 flex items-center gap-2">
      <Flag className="w-4 h-4 text-emerald-300 shrink-0" />
      <div className="flex-1 min-w-0 leading-snug">{line}</div>
      {canAttack && <button onClick={attack} className="shrink-0 min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-white">Attack</button>}
      {canMoveNow && <button onClick={moveNow} className="shrink-0 min-h-[36px] px-3 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold">Move now</button>}
      {plan?.ok && !canAttack && <button onClick={marchNow} data-testid="march-confirm" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white">March</button>}
      <button onClick={cancel} aria-label="Cancel march" className="shrink-0 p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default MarchBar;
