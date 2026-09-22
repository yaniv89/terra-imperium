// src/components/panels/SpacePanel.jsx
// Space Race tab (plan §10.4): orbital layer (satellites, ASAT), missiles + ABM defense, and the
// space mission ladder.

import React, { useState } from 'react';
import { Satellite, Radio, Zap, Rocket, ShieldCheck, Milestone } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { ACTION_COSTS } from '../../data/actionCosts';
import { SATELLITE_TYPES, SATELLITE_TYPE_IDS, canLaunchSatellite, getOrbitalEffectivenessMult } from '../../data/satellites';
import { MISSILE_TIERS, MISSILE_TIER_IDS, MAX_ABM_LEVEL } from '../../data/missiles';
import { SPACE_MISSIONS, canLaunchMission } from '../../data/spaceMissions';
import { REGIONS_DATA, getNationCapital } from '../../data/regions';
import { canAfford, formatNumber } from '../../utils/helpers';
import { ActionButton } from '../ui';

const SpacePanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [missileTierId, setMissileTierId] = useState('tactical');
  const [missileTargetRegionId, setMissileTargetRegionId] = useState('');

  const launchable = canLaunchSatellite(state.age, state.techAgeId, state.year);
  const ownSatellites = Object.values(state.satellites).filter(s => s.ownerId === state.playerNationId);
  const enemySatellites = Object.values(state.satellites).filter(s => s.ownerId !== state.playerNationId);
  const effectivenessMult = getOrbitalEffectivenessMult(state.orbitalDebrisLevel);
  const playerNation = state.nations[state.playerNationId];
  const otherRegionIds = Object.keys(state.regions).filter(id => state.regions[id].owner !== state.playerNationId).sort();

  const handleLaunch = (typeId) => {
    if (!canAfford(state.resources, ACTION_COSTS.launchSatellite)) return addLog('Not enough resources', 'action');
    triggerEffect('launch_satellite', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.LAUNCH_SATELLITE, payload: { typeId } });
  };

  const handleAsatStrike = () => {
    if (!selectedTargetId) return addLog('Select a target satellite first', 'action');
    if (!canAfford(state.resources, ACTION_COSTS.asatStrike)) return addLog('Not enough resources', 'action');
    triggerEffect('asat_strike', { from: getNationCapital(state.playerNationId), to: getNationCapital(state.satellites[selectedTargetId]?.ownerId) });
    dispatch({ type: ActionTypes.ASAT_STRIKE, payload: { targetSatelliteId: selectedTargetId } });
    setSelectedTargetId('');
  };

  const handleBuildMissile = (tierId) => {
    if (!canAfford(state.resources, ACTION_COSTS.buildMissile[tierId])) return addLog('Not enough resources', 'action');
    triggerEffect('build_missile', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.BUILD_MISSILE, payload: { tierId } });
  };

  const handleMissileStrike = () => {
    if (!missileTargetRegionId) return addLog('Select a target region first', 'action');
    if (!canAfford(state.resources, ACTION_COSTS.missileStrike)) return addLog('Not enough resources', 'action');
    triggerEffect('missile_strike', { from: getNationCapital(state.playerNationId), to: missileTargetRegionId });
    dispatch({ type: ActionTypes.MISSILE_STRIKE, payload: { tierId: missileTierId, targetRegionId: missileTargetRegionId } });
    setMissileTargetRegionId('');
  };

  const handleBuildAbm = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildAbmDefense)) return addLog('Not enough resources', 'action');
    triggerEffect('build_abm_defense', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.BUILD_ABM_DEFENSE, payload: {} });
  };

  const handleLaunchMission = (missionId) => {
    const mission = SPACE_MISSIONS.find(m => m.id === missionId);
    const costs = { ...mission.cost, actionPoints: ACTION_COSTS.launchMission.actionPoints };
    if (!canAfford(state.resources, costs)) return addLog('Not enough resources', 'action');
    triggerEffect('launch_mission', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.LAUNCH_MISSION, payload: { missionId } });
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

      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="text-xs font-semibold text-slate-300">Missile Stockpile</div>
        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] text-slate-400">
          {MISSILE_TIER_IDS.map(tierId => (
            <div key={tierId} className="bg-slate-800/60 rounded-lg p-1.5">
              <div className="text-white font-semibold">{playerNation?.missiles?.[tierId] || 0}</div>
              <div>{MISSILE_TIERS[tierId].name}</div>
            </div>
          ))}
        </div>
        {MISSILE_TIER_IDS.map(tierId => (
          <ActionButton
            key={tierId}
            icon={Rocket}
            label={`Build ${MISSILE_TIERS[tierId].name}`}
            description={`Range: ${MISSILE_TIERS[tierId].range === Infinity ? 'Global' : `${MISSILE_TIERS[tierId].range} hops`}`}
            costs={ACTION_COSTS.buildMissile[tierId]}
            onClick={() => handleBuildMissile(tierId)}
            disabled={!canAfford(state.resources, ACTION_COSTS.buildMissile[tierId])}
            size="small"
          />
        ))}

        <div className="text-xs font-semibold text-slate-300 pt-1">Missile Strike</div>
        <select
          value={missileTierId}
          onChange={(e) => setMissileTierId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
        >
          {MISSILE_TIER_IDS.map(tierId => (
            <option key={tierId} value={tierId}>{MISSILE_TIERS[tierId].name} ({playerNation?.missiles?.[tierId] || 0} in stock)</option>
          ))}
        </select>
        <select
          value={missileTargetRegionId}
          onChange={(e) => setMissileTargetRegionId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
        >
          <option value="">Select a target region...</option>
          {otherRegionIds.map(id => (
            <option key={id} value={id}>{REGIONS_DATA[id]?.name || id} ({state.nations[state.regions[id].owner]?.name || state.regions[id].owner})</option>
          ))}
        </select>
        <ActionButton
          icon={Zap}
          label="Launch Missile Strike"
          description="Damages the target region and nation directly — no army required."
          costs={ACTION_COSTS.missileStrike}
          onClick={handleMissileStrike}
          disabled={!missileTargetRegionId || !(playerNation?.missiles?.[missileTierId] > 0) || !canAfford(state.resources, ACTION_COSTS.missileStrike)}
        />

        <ActionButton
          icon={ShieldCheck}
          label={`ABM Defense (Level ${playerNation?.abmDefenseLevel || 0}/${MAX_ABM_LEVEL})`}
          description="Each level intercepts more of any incoming missile's damage. Never perfect."
          costs={ACTION_COSTS.buildAbmDefense}
          onClick={handleBuildAbm}
          disabled={(playerNation?.abmDefenseLevel || 0) >= MAX_ABM_LEVEL || !canAfford(state.resources, ACTION_COSTS.buildAbmDefense)}
          size="small"
        />
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Milestone size={14} />
          Space Mission Ladder
        </div>
        {SPACE_MISSIONS.map(mission => {
          const completed = (state.completedMissions || []).includes(mission.id);
          const turnsRemaining = state.spaceMissionProgress?.[mission.id];
          const eligible = launchable && canLaunchMission(mission.id, state.completedMissions || [], state.spaceMissionProgress || {});
          const costs = { ...mission.cost, actionPoints: ACTION_COSTS.launchMission.actionPoints };
          let status = mission.description;
          if (completed) status = 'Completed';
          else if (turnsRemaining !== undefined) status = `In progress — ${turnsRemaining} turn${turnsRemaining === 1 ? '' : 's'} remaining`;
          return (
            <ActionButton
              key={mission.id}
              icon={Milestone}
              label={`${mission.name}${completed ? ' ✓' : ''}`}
              description={status}
              costs={!completed && turnsRemaining === undefined ? costs : null}
              onClick={() => handleLaunchMission(mission.id)}
              disabled={completed || turnsRemaining !== undefined || !eligible || !canAfford(state.resources, costs)}
              size="small"
            />
          );
        })}
      </div>
    </div>
  );
};

export default SpacePanel;
