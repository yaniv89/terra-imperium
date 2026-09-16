// src/components/panels/MilitaryPanel.jsx
// Military tab (plan §7): nation overview plus four of the fifteen planned actions — Recruit
// Unit, Disband Unit, Move Army, Launch Invasion — against the new per-region army model
// (src/context/GameContext.jsx's flat `state.units` dict), unit classes (src/data/unitClasses.js)
// and the phased battle engine (src/engine/battle.js). The rest (promotions, generals, navies/
// amphibious invasion) land in their own tasks as the army sim deepens.

import React from 'react';
import { Swords, UserPlus, Trash2, Flag } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds } from '../../data/regions';
import { ACTION_COSTS } from '../../data/actionCosts';
import { UNIT_CLASSES, getAvailableClasses } from '../../data/unitClasses';
import { canAfford, formatNumber } from '../../utils/helpers';
import { ActionButton } from '../ui';

const MilitaryPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const playerNation = state.nations[state.playerNationId];
  const atWarWith = Object.values(state.nations).filter(n => n.isAtWar && !n.isPlayer);

  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const isPlayerOwned = regionState?.owner === state.playerNationId;
  const unitsHere = Object.values(state.units).filter(u => u.regionId === selectedRegion);
  const availableClasses = getAvailableClasses(state.age);

  // Adjacent player-owned regions with at least one land unit — the possible launch points for
  // invading the selected foreign region.
  const invasionSources = (regionData && !isPlayerOwned)
    ? getNeighborIds(selectedRegion)
      .filter(nId => state.regions[nId]?.owner === state.playerNationId)
      .map(nId => ({ regionId: nId, unitCount: Object.values(state.units).filter(u => u.regionId === nId && u.ownerId === state.playerNationId && u.domain === 'land').length }))
      .filter(source => source.unitCount > 0)
    : [];

  const handleRecruit = (classId) => {
    if (!canAfford(state.resources, ACTION_COSTS.recruitUnit)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.RECRUIT_UNIT, payload: { regionId: selectedRegion, classId } });
  };
  const handleDisband = (unitId) => {
    dispatch({ type: ActionTypes.DISBAND_UNIT, payload: { unitId } });
  };
  const handleMove = (unitId, toRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.moveArmy)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId } });
  };
  const handleInvade = (fromRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.launchInvasion)) return addLog('Not enough resources', 'action');
    triggerEffect('ground_invasion', { from: fromRegionId, to: selectedRegion });
    dispatch({ type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId: selectedRegion } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white font-bold text-lg">
        <Swords size={20} className="text-red-400" />
        {playerNation?.name}
      </div>
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
        <div className="text-slate-400">Military Strength</div>
        <div className="text-white font-semibold text-xl">{formatNumber(playerNation?.militaryStrength || 0)}</div>
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

      {state.lastBattleReport && <BattleReport report={state.lastBattleReport} />}

      {!regionData && (
        <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
          Select a region on the globe to recruit and command armies there.
        </div>
      )}

      {regionData && !isPlayerOwned && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Invade {regionData.name}</div>
          {invasionSources.length === 0 && (
            <div className="text-[10px] text-slate-500">
              You don&apos;t control an adjacent region with land units stationed there.
            </div>
          )}
          {invasionSources.map(({ regionId, unitCount }) => (
            <ActionButton
              key={regionId}
              icon={Flag}
              label={`Launch from ${REGIONS_DATA[regionId]?.name}`}
              description={`${unitCount} land unit${unitCount === 1 ? '' : 's'} available`}
              costs={ACTION_COSTS.launchInvasion}
              onClick={() => handleInvade(regionId)}
              disabled={!canAfford(state.resources, ACTION_COSTS.launchInvasion)}
              variant="danger"
              size="small"
            />
          ))}
        </div>
      )}

      {regionData && isPlayerOwned && (
        <>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Recruit in {regionData.name}</div>
            {availableClasses.map(classId => (
              <ActionButton
                key={classId}
                icon={UserPlus}
                label={UNIT_CLASSES[classId].name}
                description={UNIT_CLASSES[classId].role}
                costs={ACTION_COSTS.recruitUnit}
                onClick={() => handleRecruit(classId)}
                disabled={!canAfford(state.resources, ACTION_COSTS.recruitUnit)}
                size="small"
              />
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Units stationed here</div>
            {unitsHere.length === 0 && (
              <div className="text-[10px] text-slate-500">No units stationed in this region.</div>
            )}
            {unitsHere.map(unit => (
              <UnitRow
                key={unit.id}
                unit={unit}
                onDisband={() => handleDisband(unit.id)}
                onMove={(toRegionId) => handleMove(unit.id, toRegionId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const OUTCOME_LABELS = {
  attacker: { text: 'Victory', className: 'text-green-400' },
  defender: { text: 'Repelled', className: 'text-red-400' },
  stalemate: { text: 'Stalemate', className: 'text-amber-400' }
};

const PHASE_LABELS = { ranged: 'Ranged', shock: 'Shock', flanking: 'Flanking', pursuit: 'Pursuit' };

// After-action report (plan §9's "detailed after-action reports"): an itemized, phase-by-phase
// breakdown of the most recent LAUNCH_INVASION battle (src/engine/battle.js's report shape).
const BattleReport = ({ report }) => {
  const outcome = OUTCOME_LABELS[report.outcome] || OUTCOME_LABELS.stalemate;
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

const UnitRow = ({ unit, onDisband, onMove }) => {
  const neighborIds = getNeighborIds(unit.regionId);
  return (
    <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold capitalize">{UNIT_CLASSES[unit.classId]?.name || unit.classId}</span>
        <span className="text-slate-400 capitalize">{unit.rank}</span>
      </div>
      <div className="flex gap-3 text-slate-400 font-mono">
        <span>STR {unit.strength}/{unit.maxStrength}</span>
        <span>MOR {unit.morale}</span>
        <span>ORG {unit.organization}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          className="flex-1 bg-slate-700 text-slate-200 rounded px-1.5 py-1 text-[11px] disabled:opacity-40"
          disabled={neighborIds.length === 0}
          defaultValue=""
          onChange={(e) => { if (e.target.value) { onMove(e.target.value); e.target.value = ''; } }}
        >
          <option value="" disabled>Move to…</option>
          {neighborIds.map(nId => (
            <option key={nId} value={nId}>{REGIONS_DATA[nId]?.name || nId}</option>
          ))}
        </select>
        <button
          onClick={onDisband}
          className="shrink-0 p-1.5 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400"
          title="Disband unit"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export default MilitaryPanel;
