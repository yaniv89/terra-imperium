// src/components/panels/MilitaryPanel.jsx
// Military tab (plan §7): nation overview plus the first three of the fifteen planned actions —
// Recruit Unit, Disband Unit, Move Army — against the new per-region army model (src/context/
// GameContext.jsx's flat `state.units` dict) and unit classes (src/data/unitClasses.js). The rest
// (promotions, generals, navies/amphibious invasion, phased battle resolution) land in their own
// tasks as the army sim deepens.

import React from 'react';
import { Swords, UserPlus, Trash2 } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds } from '../../data/regions';
import { ACTION_COSTS } from '../../data/actionCosts';
import { UNIT_CLASSES, getAvailableClasses } from '../../data/unitClasses';
import { canAfford, formatNumber } from '../../utils/helpers';
import { ActionButton } from '../ui';

const MilitaryPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();
  const playerNation = state.nations[state.playerNationId];
  const atWarWith = Object.values(state.nations).filter(n => n.isAtWar && !n.isPlayer);

  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const isPlayerOwned = regionState?.owner === state.playerNationId;
  const unitsHere = Object.values(state.units).filter(u => u.regionId === selectedRegion);
  const availableClasses = getAvailableClasses(state.age);

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

      {!regionData && (
        <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
          Select a region on the globe to recruit and command armies there.
        </div>
      )}

      {regionData && !isPlayerOwned && (
        <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
          You don&apos;t control {regionData.name} — military actions are unavailable here.
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
