// src/components/panels/MilitaryPanel.jsx
// Military tab (plan §7): nation overview plus seven of the fifteen planned actions — Recruit
// Unit, Disband Unit, Move Army, Launch Invasion, Promote Unit, Hire General (a support action for
// Appoint General), Appoint General — against the per-region army model (src/context/
// GameContext.jsx's flat `state.units` dict), unit classes (src/data/unitClasses.js), the phased
// battle engine (src/engine/battle.js), and promotions/generals (src/data/promotions.js,
// src/data/generals.js). The rest (navies/amphibious invasion, supply attrition) land in their own
// tasks as the army sim deepens.

import React from 'react';
import { Swords, UserPlus, Trash2, Flag, Award, UserCog } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds } from '../../data/regions';
import { ACTION_COSTS } from '../../data/actionCosts';
import { UNIT_CLASSES, getAvailableClasses } from '../../data/unitClasses';
import { ALL_PERKS, XP_THRESHOLDS, RANK_ORDER, getRankForXp, canPromote, hasPerk } from '../../data/promotions';
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
  const handlePromote = (unitId, perkId) => {
    if (!canAfford(state.resources, ACTION_COSTS.promoteUnit)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId } });
  };
  const handleHireGeneral = () => {
    if (!canAfford(state.resources, ACTION_COSTS.hireGeneral)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.HIRE_GENERAL, payload: {} });
  };
  const handleAppointGeneral = (generalId, unitId) => {
    dispatch({ type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId: unitId || null } });
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
                generals={state.hiredCommanders}
                unassignedGenerals={unassignedGenerals}
                onDisband={() => handleDisband(unit.id)}
                onMove={(toRegionId) => handleMove(unit.id, toRegionId)}
                onPromote={(perkId) => handlePromote(unit.id, perkId)}
                onAssignGeneral={(generalId) => handleAppointGeneral(generalId, unit.id)}
                onUnassignGeneral={() => handleAppointGeneral(unit.commanderId, null)}
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

const UnitRow = ({ unit, generals, unassignedGenerals, onDisband, onMove, onPromote, onAssignGeneral, onUnassignGeneral }) => {
  const neighborIds = getNeighborIds(unit.regionId);
  const rank = getRankForXp(unit.xp || 0);
  const nextRank = RANK_ORDER[RANK_ORDER.indexOf(rank) + 1];
  const promotable = canPromote(unit);
  const unheldPerks = ALL_PERKS.filter((p) => !hasPerk(unit, p.id));
  const commander = unit.commanderId ? generals[unit.commanderId] : null;

  return (
    <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold capitalize">{UNIT_CLASSES[unit.classId]?.name || unit.classId}</span>
        <span className="text-slate-400 capitalize">{rank}</span>
      </div>
      <div className="flex gap-3 text-slate-400 font-mono">
        <span>STR {unit.strength}/{unit.maxStrength}</span>
        <span>MOR {unit.morale}</span>
        <span>ORG {unit.organization}</span>
      </div>
      <div className="text-slate-500 font-mono">
        XP {unit.xp || 0}{nextRank ? ` / ${XP_THRESHOLDS[nextRank]} to ${nextRank}` : ' (max rank)'}
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
