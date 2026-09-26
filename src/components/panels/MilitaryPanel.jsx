// src/components/panels/MilitaryPanel.jsx
// Military tab: empire-wide command only now — fielded strength, army/navy maintenance sliders,
// active wars, the Officer Corps (hire generals), and the last battle report. Region-specific
// actions (recruit, per-unit move/promote/embark, invasion/amphibious/naval-engagement launches,
// suppress rebellion) used to render here whenever a region was selected — they now live in the
// Civ-style ProvinceModal.jsx (its Military tab), opened via RegionInfoModal's "Manage Region"
// button, so this tab stays a short, always-relevant overview regardless of map selection.
import React from 'react';
import { Swords, UserCog } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { ACTION_COSTS, ARMY_MAINTENANCE_MIN, ARMY_MAINTENANCE_MAX, ARMY_MAINTENANCE_DEFAULT } from '../../data/actionCosts';
import { UNIT_CLASSES } from '../../data/unitClasses';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { canAfford, formatNumber, getFieldedStrength } from '../../utils/helpers';
import { useEffects } from '../../context/EffectsContext';
import { getNationCapital } from '../../data/regions';

const MilitaryPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const playerNation = state.nations[state.playerNationId];
  // isAtWar means "in a war with SOMEONE" (used for AI-tiering) — this list is specifically wars
  // involving the player, so two AI nations fighting each other doesn't show up as "War with X".
  const atWarWith = Object.values(state.nations).filter(n => !n.isPlayer && isAtWarWithPlayer(state, n.id));

  const handleSetArmyMaintenance = (value) => dispatch({ type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: Number(value) } });
  const handleSetNavyMaintenance = (value) => dispatch({ type: ActionTypes.SET_NAVY_MAINTENANCE, payload: { value: Number(value) } });
  const handleHireGeneral = () => {
    if (!canAfford(state.resources, ACTION_COSTS.hireGeneral)) return addLog('Not enough resources', 'action');
    triggerEffect('hire_general', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.HIRE_GENERAL, payload: {} });
  };

  const generals = Object.entries(state.hiredCommanders);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white font-bold text-lg">
        <Swords size={20} className="text-red-400" />
        {playerNation?.name}
      </div>
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
        <div className="text-slate-400">Military Strength</div>
        <div className="text-white font-semibold text-xl">{formatNumber(getFieldedStrength(state, state.playerNationId))}</div>
      </div>

      {/* Military maintenance slider (plan §M11): free, adjustable any time — scales army/navy
          upkeep only (see economy.js's header on the morale-recovery/reinforcement scope trim). */}
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm space-y-2">
        <div className="text-slate-400">Maintenance</div>
        {[
          { label: 'Army', value: playerNation?.armyMaintenance ?? ARMY_MAINTENANCE_DEFAULT, onChange: handleSetArmyMaintenance },
          { label: 'Navy', value: playerNation?.navyMaintenance ?? ARMY_MAINTENANCE_DEFAULT, onChange: handleSetNavyMaintenance }
        ].map(({ label, value, onChange }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-slate-400 w-10 text-xs">{label}</span>
            <input
              type="range"
              min={ARMY_MAINTENANCE_MIN}
              max={ARMY_MAINTENANCE_MAX}
              step={10}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1"
            />
            <span className="text-white text-xs w-10 text-right">{value}%</span>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
        <div className="text-slate-400 mb-1">Active Wars</div>
        {atWarWith.length === 0 ? (
          <div className="text-slate-500">At peace with the world.</div>
        ) : (
          <ul className="space-y-1">
            {atWarWith.map(n => (
              <li key={n.id} className="text-red-400">War with {n.name}</li>
            ))}
          </ul>
        )}
      </div>

      <OfficerCorps
        generals={generals}
        units={state.units}
        canAffordHire={canAfford(state.resources, ACTION_COSTS.hireGeneral)}
        onHire={handleHireGeneral}
      />

      {state.lastBattleReport && <BattleReport report={state.lastBattleReport} />}

      <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
        Select a region on the map and use its &quot;Manage Region&quot; button to recruit and command armies there.
      </div>
    </div>
  );
};

const OUTCOME_LABELS = {
  attacker: { text: 'Victory', className: 'text-green-400' },
  defender: { text: 'Repelled', className: 'text-red-400' },
  stalemate: { text: 'Stalemate', className: 'text-amber-400' }
};
// A won round against a still-defended region (src/engine/siege.js) doesn't mean the region
// changed hands — `report.captured` is only ever explicitly `false` (not merely absent) for
// LAUNCH_INVASION/AMPHIBIOUS_ASSAULT reports where the siege continues, so this never misfires on
// a NAVAL_ENGAGEMENT/SUPPRESS_REBELLION report (which don't set `captured` at all).
const SIEGE_CONTINUES_LABEL = { text: 'Siege Continues', className: 'text-amber-400' };

const PHASE_LABELS = { ranged: 'Ranged', shock: 'Shock', flanking: 'Flanking', pursuit: 'Pursuit' };

// After-action report (plan §9's "detailed after-action reports"): an itemized, phase-by-phase
// breakdown of the most recent LAUNCH_INVASION battle (src/engine/battle.js's report shape).
const BattleReport = ({ report }) => {
  const outcome = (report.outcome === 'attacker' && report.captured === false)
    ? SIEGE_CONTINUES_LABEL
    : (OUTCOME_LABELS[report.outcome] || OUTCOME_LABELS.stalemate);
  const phaseTotals = report.log.reduce((acc, entry) => {
    const key = entry.phase;
    acc[key] = acc[key] || { count: 0, damage: 0 };
    acc[key].count += 1;
    acc[key].damage += entry.damage;
    return acc;
  }, {});

  return (
    <div className="bg-slate-800/60 rounded-lg p-3 text-xs space-y-2 border border-slate-700">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-300">Last Battle: {REGIONS_DATA[report.fromRegionId]?.name} → {REGIONS_DATA[report.targetRegionId]?.name}</span>
        <span className={`font-bold ${outcome.className}`}>{outcome.text}</span>
      </div>
      <div className="text-slate-400 font-mono">
        Combat width {report.combatWidth} on {report.terrain} terrain — {report.deployedAttackers} vs {report.deployedDefenders} deployed
        {report.isAttackingFortification ? ', attacking a fortification' : ''}
      </div>
      <div className="space-y-0.5">
        {Object.entries(PHASE_LABELS).map(([key, label]) => phaseTotals[key] && (
          <div key={key} className="flex justify-between text-slate-400">
            <span>{label} ({phaseTotals[key].count})</span>
            <span className="font-mono">{formatNumber(phaseTotals[key].damage)} dmg</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const OfficerCorps = ({ generals, units, canAffordHire, onHire }) => (
  <div className="bg-slate-800/60 rounded-lg p-3 text-xs space-y-2">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-slate-300">Officer Corps</span>
      <button
        onClick={onHire}
        disabled={!canAffordHire}
        className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] flex items-center gap-1"
      >
        <UserCog size={12} /> Hire ({ACTION_COSTS.hireGeneral.gold}g)
      </button>
    </div>
    {generals.length === 0 && <div className="text-slate-500">No generals hired yet.</div>}
    {generals.map(([id, general]) => (
      <div key={id} className="flex items-center justify-between text-slate-400">
        <span>{general.name} <span className="text-slate-500 capitalize">({general.personality})</span></span>
        <span className="font-mono text-slate-500">
          {general.assignedUnitId ? `commanding ${UNIT_CLASSES[units[general.assignedUnitId]?.classId]?.name || 'a unit'}` : 'unassigned'}
        </span>
      </div>
    ))}
  </div>
);

export default MilitaryPanel;
