// src/components/panels/MilitaryPanel.jsx
// Military tab (plan §7 / §7.5 / §9): nation overview plus twelve of the fifteen planned actions —
// Recruit Unit, Disband Unit, Move Army, Launch Invasion, Promote Unit, Hire General (a support
// action for Appoint General), Appoint General, Embark/Disembark Army, Amphibious Assault, Naval
// Engagement, Suppress Rebellion — against the per-region army model (src/context/
// GameContext.jsx's flat `state.units` dict), unit classes (src/data/unitClasses.js), the phased
// battle engine (src/engine/battle.js), promotions/generals (src/data/promotions.js,
// src/data/generals.js), age-gated naval reach (src/data/navalReach.js), and rebellion
// (src/data/rebellion.js — spawned and grown every turn by src/engine/resolveTurn.js).

import React from 'react';
import { Swords, UserPlus, Trash2, Flag, Award, UserCog, Anchor, Ship, Flame } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds, getNationCapital } from '../../data/regions';
import { ACTION_COSTS, ARMY_MAINTENANCE_MIN, ARMY_MAINTENANCE_MAX, ARMY_MAINTENANCE_DEFAULT } from '../../data/actionCosts';
import { UNIT_CLASSES, getAvailableClasses } from '../../data/unitClasses';
import { ALL_PERKS, XP_THRESHOLDS, RANK_ORDER, getRankForXp, canPromote, hasPerk } from '../../data/promotions';
import { isCoastal, getSeaLanesWithinReach, isReachableBySea } from '../../data/navalReach';
import { REBEL_OWNER_ID, REVOLT_SUCCESS_TURNS } from '../../data/rebellion';
import { getEffectiveAgeId } from '../../data/ages';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { canAfford, formatNumber, getFieldedStrength } from '../../utils/helpers';
import { getRecruitUnitCost } from '../../engine/economy';
import { ActionButton } from '../ui';

// Every region a unit could MOVE to right now (redeploying within your own territory) — land-
// adjacent always, plus (for naval units) every coastal region within the current age's naval
// reach (src/data/navalReach.js) — filtered to regions the player actually owns. Entering foreign
// territory is what Launch Invasion/Amphibious Assault are for, with their own cost/war
// consequences; Move Army has neither, so it must never be able to walk a unit into someone else's
// region — confirmed as a real bug (playtest report: Israeli units could "move" straight into
// Jordanian/Egyptian regions with no war, no cost beyond the ordinary move, and no consequence).
const getMoveOptions = (unit, age, regions, playerNationId) => {
  const isOwned = (id) => regions[id]?.owner === playerNationId;
  const landNeighbors = getNeighborIds(unit.regionId).filter(isOwned);
  if (unit.domain !== 'naval') return landNeighbors;
  const seaLanes = getSeaLanesWithinReach(unit.regionId, age).map((lane) => lane.to).filter(isOwned);
  return [...new Set([...landNeighbors, ...seaLanes])];
};

// Whether `fromRegionId` can reach `toRegionId` at all right now — land-adjacent or, for a naval
// force, within the current age's sea-lane reach.
const isReachable = (fromRegionId, toRegionId, age) =>
  getNeighborIds(fromRegionId).includes(toRegionId) || isReachableBySea(fromRegionId, toRegionId, age);

const MilitaryPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const playerNation = state.nations[state.playerNationId];
  // isAtWar means "in a war with SOMEONE" (used for AI-tiering) — this list is specifically wars
  // involving the player, so two AI nations fighting each other doesn't show up as "War with X".
  const atWarWith = Object.values(state.nations).filter(n => !n.isPlayer && isAtWarWithPlayer(state, n.id));

  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const isPlayerOwned = regionState?.owner === state.playerNationId;
  const unitsHere = Object.values(state.units).filter(u => u.regionId === selectedRegion);
  // Matches RECRUIT_UNIT's own gate (GameContext.jsx) — otherwise a tech-earned age ahead of the
  // calendar would let the reducer accept a class this list doesn't even show as recruitable.
  const availableClasses = getAvailableClasses(getEffectiveAgeId(state.age, state.techAgeId));

  // Adjacent player-owned regions with at least one land unit — the possible launch points for
  // invading the selected foreign region.
  const invasionSources = (regionData && !isPlayerOwned)
    ? getNeighborIds(selectedRegion)
      .filter(nId => state.regions[nId]?.owner === state.playerNationId)
      .map(nId => ({ regionId: nId, unitCount: Object.values(state.units).filter(u => u.regionId === nId && u.ownerId === state.playerNationId && u.domain === 'land').length }))
      .filter(source => source.unitCount > 0)
    : [];

  // Player naval units, anywhere, carrying at least one embarked land unit and within reach of
  // the selected foreign coastal region — the possible launch points for an amphibious assault.
  const amphibiousSources = (regionData && !isPlayerOwned && isCoastal(selectedRegion))
    ? Object.values(state.units)
      .filter(u => u.ownerId === state.playerNationId && u.domain === 'naval' && isReachable(u.regionId, selectedRegion, state.age))
      .map(u => ({ unit: u, cargoCount: Object.values(state.units).filter(c => c.embarkedOn === u.id).length }))
      .filter(({ cargoCount }) => cargoCount > 0)
    : [];

  // Player naval units within reach of the selected region, when it holds an enemy fleet worth
  // contesting — the possible launch points for a Naval Engagement.
  const defendingNavalUnits = regionData ? Object.values(state.units).filter(u => u.regionId === selectedRegion && u.domain === 'naval' && u.ownerId !== state.playerNationId) : [];
  const navalEngagementSources = (regionData && defendingNavalUnits.length > 0)
    ? [...new Set(Object.values(state.units).filter(u => u.ownerId === state.playerNationId && u.domain === 'naval' && isReachable(u.regionId, selectedRegion, state.age)).map(u => u.regionId))]
    : [];

  // A rebel army spawned in the player's own selected region (src/engine/resolveTurn.js) — the
  // trigger for Suppress Rebellion.
  const rebelUnits = (regionData && isPlayerOwned) ? unitsHere.filter(u => u.ownerId === REBEL_OWNER_ID) : [];

  const handleSetArmyMaintenance = (value) => dispatch({ type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: Number(value) } });
  const handleSetNavyMaintenance = (value) => dispatch({ type: ActionTypes.SET_NAVY_MAINTENANCE, payload: { value: Number(value) } });

  const handleRecruit = (classId) => {
    if (!canAfford(state.resources, getRecruitUnitCost(state, state.age))) return addLog('Not enough resources', 'action');
    triggerEffect('recruit_unit', { region: selectedRegion, variant: classId, age: state.age });
    dispatch({ type: ActionTypes.RECRUIT_UNIT, payload: { regionId: selectedRegion, classId } });
  };
  const handleDisband = (unitId) => {
    const unit = state.units[unitId];
    // Plan §M14: units no longer carry their own frozen ageId (they auto-upgrade with their owner's
    // current tech instead) — the disband effect's age is purely cosmetic, so it uses the CURRENT
    // calendar age rather than one this unit no longer remembers.
    if (unit) triggerEffect('disband_unit', { region: unit.regionId, variant: unit.classId, age: state.age });
    dispatch({ type: ActionTypes.DISBAND_UNIT, payload: { unitId } });
  };
  const handleMove = (unitId, toRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.moveArmy)) return addLog('Not enough resources', 'action');
    triggerEffect('move_army', { from: state.units[unitId]?.regionId, to: toRegionId });
    dispatch({ type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId } });
  };
  const handleInvade = (fromRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.launchInvasion)) return addLog('Not enough resources', 'action');
    triggerEffect('ground_invasion', { from: fromRegionId, to: selectedRegion });
    dispatch({ type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId: selectedRegion } });
  };
  const handlePromote = (unitId, perkId) => {
    if (!canAfford(state.resources, ACTION_COSTS.promoteUnit)) return addLog('Not enough resources', 'action');
    triggerEffect('promote_unit', { region: state.units[unitId]?.regionId });
    dispatch({ type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId } });
  };
  const handleHireGeneral = () => {
    if (!canAfford(state.resources, ACTION_COSTS.hireGeneral)) return addLog('Not enough resources', 'action');
    triggerEffect('hire_general', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.HIRE_GENERAL, payload: {} });
  };
  const handleAppointGeneral = (generalId, unitId) => {
    triggerEffect('appoint_general', { region: unitId ? state.units[unitId]?.regionId : getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId: unitId || null } });
  };
  const handleEmbark = (landUnitId, navalUnitId) => {
    if (!canAfford(state.resources, ACTION_COSTS.embarkUnit)) return addLog('Not enough resources', 'action');
    triggerEffect('embark_unit', { region: state.units[landUnitId]?.regionId });
    dispatch({ type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
  };
  const handleDisembark = (landUnitId) => {
    if (!canAfford(state.resources, ACTION_COSTS.disembarkUnit)) return addLog('Not enough resources', 'action');
    triggerEffect('disembark_unit', { region: state.units[landUnitId]?.regionId });
    dispatch({ type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId } });
  };
  const handleAmphibiousAssault = (navalUnitId) => {
    if (!canAfford(state.resources, ACTION_COSTS.amphibiousAssault)) return addLog('Not enough resources', 'action');
    triggerEffect('amphibious_assault', { from: state.units[navalUnitId]?.regionId, to: selectedRegion });
    dispatch({ type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: selectedRegion } });
  };
  const handleNavalEngagement = (fromRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.navalEngagement)) return addLog('Not enough resources', 'action');
    triggerEffect('naval_engagement', { from: fromRegionId, to: selectedRegion });
    dispatch({ type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId, targetRegionId: selectedRegion } });
  };
  const handleSuppressRebellion = () => {
    if (!canAfford(state.resources, ACTION_COSTS.suppressRebellion)) return addLog('Not enough resources', 'action');
    triggerEffect('suppress_rebellion', { region: selectedRegion });
    dispatch({ type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: selectedRegion } });
  };

  const generals = Object.entries(state.hiredCommanders);
  const unassignedGenerals = generals.filter(([, g]) => !g.assignedUnitId);

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

      {!regionData && (
        <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
          Select a region on the globe to recruit and command armies there.
        </div>
      )}

      {regionData && !isPlayerOwned && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Invade {regionData.name}</div>
          {invasionSources.length === 0 && amphibiousSources.length === 0 && navalEngagementSources.length === 0 && (
            <div className="text-[10px] text-slate-500">
              You don&apos;t control an adjacent region with land units, or a fleet within reach.
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
          {amphibiousSources.map(({ unit, cargoCount }) => (
            <ActionButton
              key={unit.id}
              icon={Anchor}
              label={`Amphibious assault from ${REGIONS_DATA[unit.regionId]?.name}`}
              description={`${cargoCount} embarked land unit${cargoCount === 1 ? '' : 's'}${getNeighborIds(selectedRegion).some(nId => state.regions[nId]?.owner === state.playerNationId) ? '' : ' — no beachhead, takes a landing penalty'}`}
              costs={ACTION_COSTS.amphibiousAssault}
              onClick={() => handleAmphibiousAssault(unit.id)}
              disabled={!canAfford(state.resources, ACTION_COSTS.amphibiousAssault)}
              variant="danger"
              size="small"
            />
          ))}
          {navalEngagementSources.map((regionId) => (
            <ActionButton
              key={regionId}
              icon={Ship}
              label={`Naval engagement from ${REGIONS_DATA[regionId]?.name}`}
              description={`Contest ${defendingNavalUnits.length} enemy fleet unit${defendingNavalUnits.length === 1 ? '' : 's'}`}
              costs={ACTION_COSTS.navalEngagement}
              onClick={() => handleNavalEngagement(regionId)}
              disabled={!canAfford(state.resources, ACTION_COSTS.navalEngagement)}
              variant="danger"
              size="small"
            />
          ))}
        </div>
      )}

      {regionData && isPlayerOwned && (
        <>
          {rebelUnits.length > 0 && (
            <ActionButton
              icon={Flame}
              label={`Suppress the rebellion in ${regionData.name}`}
              description={
                regionState.formerOwner
                  ? `${rebelUnits.length} rebel unit${rebelUnits.length === 1 ? '' : 's'} holding out — ${Math.max(0, REVOLT_SUCCESS_TURNS - (state.turnNumber - (rebelUnits[0].spawnedTurn ?? state.turnNumber)))} turn(s) left before ${state.nations[regionState.formerOwner]?.name || regionState.formerOwner} reclaims it`
                  : `${rebelUnits.length} rebel unit${rebelUnits.length === 1 ? '' : 's'} holding out`
              }
              costs={ACTION_COSTS.suppressRebellion}
              onClick={handleSuppressRebellion}
              disabled={!canAfford(state.resources, ACTION_COSTS.suppressRebellion) || unitsHere.every(u => u.ownerId !== state.playerNationId || u.domain !== 'land')}
              variant="danger"
            />
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Recruit in {regionData.name}</div>
            {(() => {
              // Plan §M11 resource sink: cost is dynamic (the age's strategic resource, or a gold
              // penalty when it's short) — see getRecruitUnitCost's own header.
              const recruitCost = getRecruitUnitCost(state, state.age);
              return availableClasses.map(classId => (
                <ActionButton
                  key={classId}
                  icon={UserPlus}
                  label={UNIT_CLASSES[classId].name}
                  description={UNIT_CLASSES[classId].role}
                  costs={recruitCost}
                  onClick={() => handleRecruit(classId)}
                  disabled={!canAfford(state.resources, recruitCost)}
                  resources={state.resources}
                  size="small"
                />
              ));
            })()}
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
                age={state.age}
                regions={state.regions}
                playerNationId={state.playerNationId}
                generals={state.hiredCommanders}
                unassignedGenerals={unassignedGenerals}
                navalUnitsHere={unitsHere.filter(u => u.domain === 'naval' && u.id !== unit.id)}
                cargoByNavalId={unitsHere.reduce((acc, u) => {
                  if (u.embarkedOn) acc[u.embarkedOn] = (acc[u.embarkedOn] || 0) + 1;
                  return acc;
                }, {})}
                onDisband={() => handleDisband(unit.id)}
                onMove={(toRegionId) => handleMove(unit.id, toRegionId)}
                onPromote={(perkId) => handlePromote(unit.id, perkId)}
                onAssignGeneral={(generalId) => handleAppointGeneral(generalId, unit.id)}
                onUnassignGeneral={() => handleAppointGeneral(unit.commanderId, null)}
                onEmbark={(navalUnitId) => handleEmbark(unit.id, navalUnitId)}
                onDisembark={() => handleDisembark(unit.id)}
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

const UnitRow = ({
  unit, age, regions, playerNationId, generals, unassignedGenerals, navalUnitsHere, cargoByNavalId,
  onDisband, onMove, onPromote, onAssignGeneral, onUnassignGeneral, onEmbark, onDisembark
}) => {
  const moveOptions = getMoveOptions(unit, age, regions, playerNationId);
  const rank = getRankForXp(unit.xp || 0);
  const nextRank = RANK_ORDER[RANK_ORDER.indexOf(rank) + 1];
  const promotable = canPromote(unit);
  const unheldPerks = ALL_PERKS.filter((p) => !hasPerk(unit, p.id));
  const commander = unit.commanderId ? generals[unit.commanderId] : null;
  const embarkableTransports = unit.domain === 'land' ? navalUnitsHere.filter((n) => (cargoByNavalId[n.id] || 0) < n.transportCapacity) : [];

  return (
    <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold capitalize">{UNIT_CLASSES[unit.classId]?.name || unit.classId}</span>
        <span className="text-slate-400 capitalize">{rank}</span>
      </div>
      <div className="flex gap-3 text-slate-400 font-mono">
        <span>STR {unit.strength}/{unit.maxStrength}</span>
        <span>MOR {unit.morale}</span>
        {/* Plan §M14: replaces the dead `organization` field (written everywhere, read nowhere but
            this exact label) with the real, newly-meaningful movesLeft counter. */}
        <span>MOV {unit.movesLeft ?? 1}</span>
      </div>
      <div className="text-slate-500 font-mono">
        XP {unit.xp || 0}{nextRank ? ` / ${XP_THRESHOLDS[nextRank]} to ${nextRank}` : ' (max rank)'}
      </div>
      {unit.domain === 'naval' && (
        <div className="text-slate-500 font-mono">Cargo {cargoByNavalId[unit.id] || 0}/{unit.transportCapacity}</div>
      )}

      {unit.embarkedOn ? (
        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-slate-400 flex items-center gap-1"><Anchor size={11} /> Embarked for transport</span>
          <button
            onClick={onDisembark}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px]"
          >
            Disembark
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            className="flex-1 bg-slate-700 text-slate-200 rounded px-1.5 py-1 text-[11px] disabled:opacity-40"
            disabled={moveOptions.length === 0}
            defaultValue=""
            onChange={(e) => { if (e.target.value) { onMove(e.target.value); e.target.value = ''; } }}
          >
            <option value="" disabled>Move to…</option>
            {moveOptions.map(nId => (
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
      )}

      {embarkableTransports.length > 0 && (
        <select
          className="w-full bg-slate-700 text-slate-200 rounded px-1.5 py-1 text-[11px]"
          defaultValue=""
          onChange={(e) => { if (e.target.value) { onEmbark(e.target.value); e.target.value = ''; } }}
        >
          <option value="" disabled>Embark on…</option>
          {embarkableTransports.map((n) => (
            <option key={n.id} value={n.id}>Transport ({cargoByNavalId[n.id] || 0}/{n.transportCapacity})</option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-1.5">
        {commander ? (
          <>
            <span className="flex-1 text-slate-400">Commander: {commander.name}</span>
            <button onClick={onUnassignGeneral} className="text-[10px] text-slate-500 hover:text-slate-300 underline">recall</button>
          </>
        ) : (
          <select
            className="flex-1 bg-slate-700 text-slate-200 rounded px-1.5 py-1 text-[11px] disabled:opacity-40"
            disabled={unassignedGenerals.length === 0}
            defaultValue=""
            onChange={(e) => { if (e.target.value) { onAssignGeneral(e.target.value); e.target.value = ''; } }}
          >
            <option value="" disabled>Assign general…</option>
            {unassignedGenerals.map(([id, g]) => (
              <option key={id} value={id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {promotable && (
        <div className="space-y-1 pt-1 border-t border-slate-700">
          <div className="text-slate-400 flex items-center gap-1"><Award size={11} /> Choose a promotion:</div>
          <div className="flex flex-wrap gap-1">
            {unheldPerks.map((perk) => (
              <button
                key={perk.id}
                onClick={() => onPromote(perk.id)}
                title={perk.description}
                className="px-1.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 text-[10px]"
              >
                {perk.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MilitaryPanel;
