// src/components/battle/BattleChoiceSheet.jsx
// "How do you want to fight?" (Tactical Battles plan §2, §10.2): Auto-resolve — today's instant
// battle, with its real odds shown — or Command the battle in real time. A bottom sheet on phones,
// a centred card on desktop. "Remember my choice" skips the question next time (changeable in the
// Military panel).
import React, { useMemo, useState } from 'react';
import { Zap, Swords, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { ACTION_COSTS } from '../../data/actionCosts';
import { estimateInvasionOdds } from '../../engine/battleOdds';
import { canSeeRegionDetails } from '../../engine/intel';
import { canAfford } from '../../utils/helpers';

const pct = (v) => `${Math.round(v * 100)}%`;

const BattleChoiceSheet = ({ fromRegionId, targetRegionId, onClose }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const [remember, setRemember] = useState(false);
  const odds = useMemo(() => estimateInvasionOdds(state, fromRegionId, targetRegionId, 200), [state.units, state.regions, fromRegionId, targetRegionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const affordable = canAfford(state.resources, ACTION_COSTS.launchInvasion);
  // The odds are computed from the enemy garrison, so they're intelligence too: without a
  // successful espionage op against the owner, the sheet doesn't reveal them.
  const hasIntel = canSeeRegionDetails(state, targetRegionId);

  const saveChoice = (mode) => { if (remember) dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { defaultMode: mode } }); };
  const auto = () => {
    if (!affordable) return addLog('Not enough resources', 'action');
    saveChoice('auto');
    triggerEffect('ground_invasion', { from: fromRegionId, to: targetRegionId });
    dispatch({ type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId } });
    onClose();
  };
  const command = () => {
    if (!affordable) return addLog('Not enough resources', 'action');
    saveChoice('command');
    dispatch({ type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId, targetRegionId } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose} data-testid="battle-choice">
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-slate-200 shadow-2xl space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-bold text-white">Attack {REGIONS_DATA[targetRegionId]?.name}</div>
            <div className="text-xs text-slate-400">from {REGIONS_DATA[fromRegionId]?.name}</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 text-slate-400" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        {odds && !odds.undefended && !hasIntel && (
          <div className="text-[11px] text-slate-400 rounded-lg bg-slate-800/60 px-3 py-2">
            The enemy garrison is unknown — no odds without intelligence. Espionage against them reveals their forces.
          </div>
        )}
        {odds && !odds.undefended && hasIntel && (
          <div className="space-y-1">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-800">
              <div className="bg-blue-500" style={{ width: pct(odds.attacker) }} />
              <div className="bg-slate-500" style={{ width: pct(odds.stalemate) }} />
              <div className="bg-orange-500" style={{ width: pct(odds.defender) }} />
            </div>
            <div className="text-[11px] text-slate-400">
              Auto-resolve breaks through {pct(odds.attacker)} of the time · your {odds.attackerStrength} vs their {odds.defenderStrength} strength · expected losses {pct(odds.attackerLossShare)} vs {pct(odds.defenderLossShare)}
            </div>
          </div>
        )}

        <button type="button" onClick={auto} disabled={!affordable} className="w-full min-h-[64px] p-3 rounded-xl bg-slate-800 border border-slate-600 flex items-center gap-3 text-left disabled:opacity-50" data-testid="battle-choice-auto">
          <Zap className="w-6 h-6 text-amber-300 shrink-0" />
          <span>
            <span className="block font-semibold text-white">Auto-resolve</span>
            <span className="block text-xs text-slate-400">Instant. One round of fighting; the siege grinds on turn by turn.</span>
          </span>
        </button>
        <button type="button" onClick={command} disabled={!affordable} className="w-full min-h-[64px] p-3 rounded-xl bg-blue-600/90 border border-blue-400 flex items-center gap-3 text-left disabled:opacity-50" data-testid="battle-choice-command">
          <Swords className="w-6 h-6 text-white shrink-0" />
          <span>
            <span className="block font-semibold text-white">Command the battle</span>
            <span className="block text-xs text-blue-100">Real time, 2–6 minutes. Fight it to the finish — take the keep for a decisive capture.</span>
          </span>
        </button>

        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember my choice
        </label>
      </div>
    </div>
  );
};

export default BattleChoiceSheet;
