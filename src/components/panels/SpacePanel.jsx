// src/components/panels/SpacePanel.jsx
// Space Race tab (plan §10.4), orbital layer: launching satellites and striking down a rival's.
// The mission ladder and missiles are Task 31's job; this tab will grow to hold them too.

import React, { useState } from 'react';
import { Satellite, Radio, Zap } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { ACTION_COSTS } from '../../data/actionCosts';
import { SATELLITE_TYPES, SATELLITE_TYPE_IDS, canLaunchSatellite, getOrbitalEffectivenessMult } from '../../data/satellites';
import { canAfford, formatNumber } from '../../utils/helpers';
import { ActionButton } from '../ui';

const SpacePanel = () => {
  const { state, dispatch, addLog } = useGame();
  const [selectedTargetId, setSelectedTargetId] = useState('');

  const launchable = canLaunchSatellite(state.age, state.techAgeId, state.year);
  const ownSatellites = Object.values(state.satellites).filter(s => s.ownerId === state.playerNationId);
  const enemySatellites = Object.values(state.satellites).filter(s => s.ownerId !== state.playerNationId);
  const effectivenessMult = getOrbitalEffectivenessMult(state.orbitalDebrisLevel);

  const handleLaunch = (typeId) => {
    if (!canAfford(state.resources, ACTION_COSTS.launchSatellite)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.LAUNCH_SATELLITE, payload: { typeId } });
  };

  const handleAsatStrike = () => {
    if (!selectedTargetId) return addLog('Select a target satellite first', 'action');
    if (!canAfford(state.resources, ACTION_COSTS.asatStrike)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.ASAT_STRIKE, payload: { targetSatelliteId: selectedTargetId } });
    setSelectedTargetId('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white font-bold text-lg">
        <Satellite size={20} className="text-cyan-400" />
        Space Race
      </div>

      {!launchable && (
        <div className="text-slate-400 text-xs bg-slate-800/60 rounded-lg p-3">
          Orbital launches require reaching the Modern Age and the year 1957 or later.
        </div>
      )}

      <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
        <div className="text-slate-400">Orbital Debris Level</div>
        <div className="text-white font-semibold">{state.orbitalDebrisLevel || 0}/100 ({Math.round(effectivenessMult * 100)}% satellite effectiveness)</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Every ASAT strike raises this for everyone in orbit — it decays slowly at rest.</div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">Your Satellites ({ownSatellites.length})</div>
        {ownSatellites.length === 0 && <div className="text-[10px] text-slate-500">None in orbit yet.</div>}
        {ownSatellites.map(sat => (
          <div key={sat.id} className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg p-2 text-xs">
            <Radio size={14} className="text-cyan-400 shrink-0" />
            <div className="flex-1">
              <div className="text-white">{SATELLITE_TYPES[sat.typeId]?.name}</div>
              <div className="text-slate-500">{SATELLITE_TYPES[sat.typeId]?.description}</div>
            </div>
          </div>
        ))}
        {SATELLITE_TYPE_IDS.map(typeId => (
          <ActionButton
            key={typeId}
            icon={Satellite}
            label={`Launch ${SATELLITE_TYPES[typeId].name}`}
            description={SATELLITE_TYPES[typeId].description}
            costs={ACTION_COSTS.launchSatellite}
            onClick={() => handleLaunch(typeId)}
            disabled={!launchable || !canAfford(state.resources, ACTION_COSTS.launchSatellite)}
            size="small"
          />
        ))}
      </div>

      {enemySatellites.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Anti-Satellite Strike</div>
          <select
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
          >
            <option value="">Select a target satellite...</option>
            {enemySatellites.map(sat => (
              <option key={sat.id} value={sat.id}>
                {state.nations[sat.ownerId]?.name || sat.ownerId} — {SATELLITE_TYPES[sat.typeId]?.name}
              </option>
            ))}
          </select>
          <ActionButton
            icon={Zap}
            label="Launch ASAT Strike"
            description="Destroys the selected satellite. Raises orbital debris for everyone."
            costs={ACTION_COSTS.asatStrike}
            onClick={handleAsatStrike}
            disabled={!selectedTargetId || !canAfford(state.resources, ACTION_COSTS.asatStrike)}
          />
        </div>
      )}

      <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
        World satellites in orbit: {formatNumber(Object.keys(state.satellites).length)}
      </div>
    </div>
  );
};

export default SpacePanel;
