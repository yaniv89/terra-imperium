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
import { MISSILE_TIERS, MISSILE_TIER_IDS, MAX_ABM_LEVEL, canBuildMissile } from '../../data/missiles';
import { ageOf } from '../../engine/nationState';
import { REBEL_OWNER_ID } from '../../data/rebellion';
import { SPACE_MISSIONS, canLaunchMission } from '../../data/spaceMissions';
import { REGIONS_DATA, getNationCapital } from '../../data/regions';
import { canAfford, formatNumber } from '../../utils/helpers';
import { ActionButton } from '../ui';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { nameNow } from '../../i18n/names';
import { satelliteName, satelliteDescription, missileName, spaceMissionName, spaceMissionDescription } from '../../i18n/gameText';

const SpacePanel = () => {
  useT(); // redraw when the language changes
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [missileTierId, setMissileTierId] = useState('tactical');
  const [missileTargetRegionId, setMissileTargetRegionId] = useState('');

  const launchable = canLaunchSatellite(null, ageOf(state, state.playerNationId), state.year);
  const ownSatellites = Object.values(state.satellites).filter(s => s.ownerId === state.playerNationId);
  const enemySatellites = Object.values(state.satellites).filter(s => s.ownerId !== state.playerNationId);
  const effectivenessMult = getOrbitalEffectivenessMult(state.orbitalDebrisLevel);
  const playerNation = state.nations[state.playerNationId];
  // Strikes are acts of war (the reducer rejects a strike on anyone you're not at war with), so only
  // enemy- or rebel-held provinces are offered as targets.
  const enemyIds = new Set(state.wars.filter(w => w.active && (w.aggressor === state.playerNationId || w.enemy === state.playerNationId))
    .map(w => (w.aggressor === state.playerNationId ? w.enemy : w.aggressor)));
  const otherRegionIds = Object.keys(state.regions).filter((id) => {
    const r = state.regions[id];
    if (r.owner === state.playerNationId) return false;
    const holder = r.occupiedBy ?? r.owner;
    return holder === REBEL_OWNER_ID || enemyIds.has(holder);
  }).sort();
  const missilesUnlocked = canBuildMissile(ageOf(state, state.playerNationId));

  const handleLaunch = (typeId) => {
    if (!canAfford(state.resources, ACTION_COSTS.launchSatellite)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('launch_satellite', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.LAUNCH_SATELLITE, payload: { typeId } });
  };

  const handleAsatStrike = () => {
    if (!selectedTargetId) return addLog(tNow('p1.sp.pickSatFirst'), 'action');
    if (!canAfford(state.resources, ACTION_COSTS.asatStrike)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('asat_strike', { from: getNationCapital(state.playerNationId), to: getNationCapital(state.satellites[selectedTargetId]?.ownerId) });
    dispatch({ type: ActionTypes.ASAT_STRIKE, payload: { targetSatelliteId: selectedTargetId } });
    setSelectedTargetId('');
  };

  const handleBuildMissile = (tierId) => {
    if (!canAfford(state.resources, ACTION_COSTS.buildMissile[tierId])) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('build_missile', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.BUILD_MISSILE, payload: { tierId } });
  };

  const handleMissileStrike = () => {
    if (!missileTargetRegionId) return addLog(tNow('p1.sp.pickRegionFirst'), 'action');
    if (!canAfford(state.resources, ACTION_COSTS.missileStrike)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('missile_strike', { from: getNationCapital(state.playerNationId), to: missileTargetRegionId });
    dispatch({ type: ActionTypes.MISSILE_STRIKE, payload: { tierId: missileTierId, targetRegionId: missileTargetRegionId } });
    setMissileTargetRegionId('');
  };

  const handleBuildAbm = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildAbmDefense)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('build_abm_defense', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.BUILD_ABM_DEFENSE, payload: {} });
  };

  const handleLaunchMission = (missionId) => {
    const mission = SPACE_MISSIONS.find(m => m.id === missionId);
    const costs = { ...mission.cost, dip: ACTION_COSTS.launchMission.dip };
    if (!canAfford(state.resources, costs)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('launch_mission', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.LAUNCH_MISSION, payload: { missionId } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-fa-text font-bold text-lg">
        <Satellite size={20} className="text-cyan-400" />
        {tNow('p1.sp.title')}
      </div>

      {!launchable && (
        <div className="text-fa-muted text-xs bg-fa-raised/60 rounded-lg p-3">
          {tNow('p1.sp.needModern')}
        </div>
      )}

      <div className="bg-fa-raised/60 rounded-lg p-3 text-sm">
        <div className="text-fa-muted">{tNow('p1.sp.debris')}</div>
        <div className="text-fa-text font-semibold">{tNow('p1.sp.debrisValue', { level: state.orbitalDebrisLevel || 0, pct: Math.round(effectivenessMult * 100) })}</div>
        <div className="text-[10px] text-fa-muted mt-0.5">{tNow('p1.sp.debrisHelp')}</div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-fa-text">{tNow('p1.sp.yours', { n: ownSatellites.length })}</div>
        {ownSatellites.length === 0 && <div className="text-[10px] text-fa-muted">{tNow('p1.sp.none')}</div>}
        {ownSatellites.map(sat => (
          <div key={sat.id} className="flex items-center gap-1.5 bg-fa-raised/60 rounded-lg p-2 text-xs">
            <Radio size={14} className="text-cyan-400 shrink-0" />
            <div className="flex-1">
              <div className="text-fa-text">{satelliteName(sat.typeId, SATELLITE_TYPES[sat.typeId]?.name)}</div>
              <div className="text-fa-muted">{satelliteDescription(sat.typeId, SATELLITE_TYPES[sat.typeId]?.description)}</div>
            </div>
          </div>
        ))}
        {SATELLITE_TYPE_IDS.map(typeId => (
          <ActionButton
            key={typeId}
            icon={Satellite}
            label={tNow('p1.sp.launch', { name: satelliteName(typeId, SATELLITE_TYPES[typeId].name) })}
            description={satelliteDescription(typeId, SATELLITE_TYPES[typeId].description)}
            costs={ACTION_COSTS.launchSatellite}
            onClick={() => handleLaunch(typeId)}
            disabled={!launchable || !canAfford(state.resources, ACTION_COSTS.launchSatellite)}
            size="small"
          />
        ))}
      </div>

      {enemySatellites.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-fa-text">{tNow('p1.sp.asat')}</div>
          <select
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            className="w-full bg-fa-raised border border-fa-line rounded-lg p-2 text-xs text-fa-text"
          >
            <option value="">{tNow('p1.sp.pickSat')}</option>
            {enemySatellites.map(sat => (
              <option key={sat.id} value={sat.id}>
                {state.nations[sat.ownerId]?.name ? nameNow('people', sat.ownerId, state.nations[sat.ownerId].name) : sat.ownerId} — {satelliteName(sat.typeId, SATELLITE_TYPES[sat.typeId]?.name)}
              </option>
            ))}
          </select>
          <ActionButton
            icon={Zap}
            label={tNow('p1.sp.asatLaunch')}
            description={tNow('p1.sp.asatDesc')}
            costs={ACTION_COSTS.asatStrike}
            onClick={handleAsatStrike}
            disabled={!selectedTargetId || !canAfford(state.resources, ACTION_COSTS.asatStrike)}
          />
        </div>
      )}

      <div className="text-[10px] text-fa-muted pt-2 border-t border-fa-line">
        {tNow('p1.sp.world', { n: formatNumber(Object.keys(state.satellites).length) })}
      </div>

      {!missilesUnlocked && (
        <div className="pt-2 border-t border-fa-line text-xs text-fa-muted">{tNow('p1.sp.missilesLocked')}</div>
      )}
      {missilesUnlocked && (
      <div className="space-y-2 pt-2 border-t border-fa-line">
        <div className="text-xs font-semibold text-fa-text">{tNow('p1.sp.stockpile')}</div>
        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] text-fa-muted">
          {MISSILE_TIER_IDS.map(tierId => (
            <div key={tierId} className="bg-fa-raised/60 rounded-lg p-1.5">
              <div className="text-fa-text font-semibold">{playerNation?.missiles?.[tierId] || 0}</div>
              <div>{missileName(tierId, MISSILE_TIERS[tierId].name)}</div>
            </div>
          ))}
        </div>
        {MISSILE_TIER_IDS.map(tierId => (
          <ActionButton
            key={tierId}
            icon={Rocket}
            label={tNow('p1.sp.build', { name: missileName(tierId, MISSILE_TIERS[tierId].name) })}
            description={MISSILE_TIERS[tierId].range === Infinity ? tNow('p1.sp.rangeGlobal') : tNow('p1.sp.rangeHops', { n: MISSILE_TIERS[tierId].range })}
            costs={ACTION_COSTS.buildMissile[tierId]}
            onClick={() => handleBuildMissile(tierId)}
            disabled={!canAfford(state.resources, ACTION_COSTS.buildMissile[tierId])}
            size="small"
          />
        ))}

        <div className="text-xs font-semibold text-fa-text pt-1">{tNow('p1.sp.strike')}</div>
        <select
          value={missileTierId}
          onChange={(e) => setMissileTierId(e.target.value)}
          className="w-full bg-fa-raised border border-fa-line rounded-lg p-2 text-xs text-fa-text"
        >
          {MISSILE_TIER_IDS.map(tierId => (
            <option key={tierId} value={tierId}>{tNow('p1.sp.inStock', { name: missileName(tierId, MISSILE_TIERS[tierId].name), n: playerNation?.missiles?.[tierId] || 0 })}</option>
          ))}
        </select>
        <select
          value={missileTargetRegionId}
          onChange={(e) => setMissileTargetRegionId(e.target.value)}
          className="w-full bg-fa-raised border border-fa-line rounded-lg p-2 text-xs text-fa-text"
        >
          <option value="">{otherRegionIds.length ? tNow('p1.sp.pickRegion') : tNow('p1.sp.noTargets')}</option>
          {otherRegionIds.map(id => (
            <option key={id} value={id}>{REGIONS_DATA[id]?.name ? nameNow('city', null, REGIONS_DATA[id].name) : id} ({state.nations[state.regions[id].owner]?.name ? nameNow('people', state.regions[id].owner, state.nations[state.regions[id].owner].name) : state.regions[id].owner})</option>
          ))}
        </select>
        <ActionButton
          icon={Zap}
          label={tNow('p1.sp.strikeLaunch')}
          description={tNow('p1.sp.strikeDesc')}
          costs={ACTION_COSTS.missileStrike}
          onClick={handleMissileStrike}
          disabled={!missileTargetRegionId || !(playerNation?.missiles?.[missileTierId] > 0) || !canAfford(state.resources, ACTION_COSTS.missileStrike)}
        />

        <ActionButton
          icon={ShieldCheck}
          label={tNow('p1.sp.abm', { level: playerNation?.abmDefenseLevel || 0, max: MAX_ABM_LEVEL })}
          description={tNow('p1.sp.abmDesc')}
          costs={ACTION_COSTS.buildAbmDefense}
          onClick={handleBuildAbm}
          disabled={(playerNation?.abmDefenseLevel || 0) >= MAX_ABM_LEVEL || !canAfford(state.resources, ACTION_COSTS.buildAbmDefense)}
          size="small"
        />
      </div>
      )}

      <div className="space-y-2 pt-2 border-t border-fa-line">
        <div className="text-xs font-semibold text-fa-text flex items-center gap-1.5">
          <Milestone size={14} />
          {tNow('p1.sp.ladder')}
        </div>
        {SPACE_MISSIONS.map(mission => {
          const completed = (state.completedMissions || []).includes(mission.id);
          const turnsRemaining = state.spaceMissionProgress?.[mission.id];
          const eligible = launchable && canLaunchMission(mission.id, state.completedMissions || [], state.spaceMissionProgress || {});
          const costs = { ...mission.cost, dip: ACTION_COSTS.launchMission.dip };
          let status = spaceMissionDescription(mission.id, mission.description);
          if (completed) status = tNow('p1.sp.completed');
          else if (turnsRemaining !== undefined) status = tNow('p1.sp.progress', { count: turnsRemaining });
          return (
            <ActionButton
              key={mission.id}
              icon={Milestone}
              label={`${spaceMissionName(mission.id, mission.name)}${completed ? ' ✓' : ''}`}
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
