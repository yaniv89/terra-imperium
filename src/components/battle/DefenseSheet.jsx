// src/components/battle/DefenseSheet.jsx
// "Under attack!" (Tactical Battles plan §16). At the start of a turn where the AI assaulted one
// or more of the player's garrisoned regions, this sheet lists each assault with its odds and asks
// how to fight it: Auto-resolve (instant), Command (the tactical battle, with the player
// defending) or Withdraw (fall back to a neighbouring province and give this one up). The turn can't end until every assault is fought. It can be tucked away to look at
// the map, leaving a pill to bring it back. A bottom sheet on phones, a centred card on desktop.
import { unitDisplayName } from '../../data/unitNames';
import { getEffectiveAgeId } from '../../data/ages';
import React, { useMemo, useState } from 'react';
import { Shield, Swords, Zap, ChevronDown, Undo2 } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { battleName } from '../../engine/battleNames';
import { estimateDefenseOdds, getDefenseArmies, getWithdrawalTarget } from '../../engine/defense';

const pct = (v) => `${Math.round(v * 100)}%`;

const forceSummary = (units, ageId = 'bronze') => {
  const counts = {};
  units.forEach((u) => { counts[u.classId] = (counts[u.classId] || 0) + 1; });
  return Object.entries(counts).map(([id, n]) => `${n} ${unitDisplayName(ageId, id)}`).join(' · ') || 'none';
};

const DefenseRow = ({ def, state, dispatch }) => {
  const armies = useMemo(() => getDefenseArmies(state, def), [state.units, def]); // eslint-disable-line react-hooks/exhaustive-deps
  const odds = useMemo(() => estimateDefenseOdds(state, def, 30), [state.units, state.regions, def]); // eslint-disable-line react-hooks/exhaustive-deps
  const region = state.regions[def.regionId];
  const enemy = state.nations[def.aggressorId]?.name || def.aggressorId;
  const fallback = getWithdrawalTarget(state, def.regionId);
  return (
    <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-3 space-y-2" data-testid="defense-row">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold text-white">{region?.name ? battleName(state, { kind: 'defense', targetRegionId: def.regionId }) : REGIONS_DATA[def.regionId]?.name || def.regionId}</div>
        <div className="text-[11px] text-slate-400 shrink-0">control {region?.control ?? '?'}%</div>
      </div>
      <div className="text-[11px] text-slate-300 leading-snug">
        <span className="text-orange-300">{enemy}:</span> {forceSummary(armies.attackerUnits, getEffectiveAgeId(state.age, state.techAgeId))}
        <br />
        <span className="text-blue-300">Your garrison:</span> {forceSummary(armies.defenderUnits, getEffectiveAgeId(state.age, state.techAgeId))}
      </div>
      {!odds.undefended && (
        <div className="space-y-1">
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-900">
            <div className="bg-blue-500" style={{ width: pct(odds.holdChance) }} />
            <div className="bg-orange-500" style={{ width: pct(1 - odds.holdChance) }} />
          </div>
          <div className="text-[11px] text-slate-400">Auto-resolve holds {pct(odds.holdChance)} of the time · about −{odds.avgDamage}% control on average</div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => dispatch({ type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } })} className="min-h-[48px] rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center gap-2 text-sm font-semibold text-white" data-testid="defense-auto">
          <Zap className="w-4 h-4 text-amber-300" /> Auto
        </button>
        <button type="button" onClick={() => dispatch({ type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } })} className="min-h-[48px] rounded-lg bg-blue-600/90 border border-blue-400 flex items-center justify-center gap-2 text-sm font-semibold text-white" data-testid="defense-command">
          <Swords className="w-4 h-4" /> Command
        </button>
        <button type="button" disabled={!fallback} onClick={() => dispatch({ type: ActionTypes.WITHDRAW_FROM_DEFENSE, payload: { defenseId: def.id } })} className="min-h-[48px] rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center gap-2 text-sm font-semibold text-slate-200 disabled:opacity-40" title={fallback ? `Fall back to ${REGIONS_DATA[fallback]?.name}: the enemy takes the province, your troops lose morale` : 'Nowhere to fall back to'} data-testid="defense-withdraw">
          <Undo2 className="w-4 h-4" /> Withdraw
        </button>
      </div>
      {fallback && <div className="text-[10px] text-slate-500">Withdraw: your garrison falls back to {REGIONS_DATA[fallback]?.name} (−25 morale, −5% men) and {enemy} takes the province.</div>}
    </div>
  );
};

const DefenseSheet = () => {
  const { state, dispatch } = useGame();
  const [tucked, setTucked] = useState(false);
  const defenses = state.pendingDefenses || [];
  if (!defenses.length || state.pendingBattle) return null;

  if (tucked) {
    return (
      <button type="button" onClick={() => setTucked(false)} className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] pl:bottom-3 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-bold shadow-2xl animate-pulse flex items-center gap-2" data-testid="defense-pill">
        <Shield className="w-4 h-4" /> {defenses.length} under attack
      </button>
    );
  }

  const enemies = [...new Set(defenses.map((d) => state.nations[d.aggressorId]?.name || d.aggressorId))];
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sheet-backdrop" data-testid="defense-sheet">
      <div className="sheet-panel w-full sm:max-w-md max-h-[85vh] flex flex-col bg-slate-900 border border-red-500/60 rounded-t-2xl sm:rounded-2xl text-slate-200 shadow-2xl">
        <div className="p-4 pb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2"><Shield className="w-5 h-5 text-red-400" /> Under attack!</div>
            <div className="text-xs text-slate-400">
              {enemies.join(', ')} {enemies.length > 1 ? 'are' : 'is'} assaulting your land — {defenses.length} {defenses.length > 1 ? 'battles' : 'battle'} to fight before the turn can end.
            </div>
          </div>
          <button type="button" onClick={() => setTucked(true)} className="p-2 -m-2 text-slate-400" aria-label="Look at the map first"><ChevronDown className="w-5 h-5" /></button>
        </div>
        <div className="px-4 space-y-2 overflow-y-auto">
          {defenses.map((def) => <DefenseRow key={def.id} def={def} state={state} dispatch={dispatch} />)}
        </div>
        <div className="p-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2">
          {defenses.length > 1 && (
            <button type="button" onClick={() => dispatch({ type: ActionTypes.RESOLVE_ALL_DEFENSES_AUTO })} className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-sm font-semibold text-white" data-testid="defense-auto-all">
              Auto-resolve all
            </button>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={state.battleSettings?.autoDefend === true} onChange={(e) => dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { autoDefend: e.target.checked } })} />
            Auto-resolve enemy assaults from now on (your own attacks still ask)
          </label>
        </div>
      </div>
    </div>
  );
};

export default DefenseSheet;
