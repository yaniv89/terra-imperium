// src/components/panels/MilitaryPanel.jsx
// Military tab: empire-wide command only now — fielded strength, army/navy maintenance sliders,
// active wars, the Officer Corps (hire generals), and the last battle report. Region-specific
// actions (recruit, per-unit move/promote/embark, invasion/amphibious/naval-engagement launches,
// suppress rebellion) used to render here whenever a region was selected — they now live in the
// Civ-style ProvinceModal.jsx (its Military tab), opened via RegionInfoModal's "Manage Region"
// button, so this tab stays a short, always-relevant overview regardless of map selection.
import React, { useState } from 'react';
import { BATTLE_TYPES } from '../../battle/setup/battleType';
import { Swords, UserCog } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { ACTION_COSTS, ARMY_MAINTENANCE_MIN, ARMY_MAINTENANCE_MAX, ARMY_MAINTENANCE_DEFAULT } from '../../data/actionCosts';
import { UNIT_CLASSES } from '../../data/unitClasses';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { canAfford, formatNumber, getFieldedStrength } from '../../utils/helpers';
import { useEffects } from '../../context/EffectsContext';
import { describeOutcome, formatMen, sidesFor } from '../battle/battleReportView';
import { openBattleReport } from '../battle/battleReportEvents';
import { computeSupplyFlow } from '../../engine/supplies';
import { getEffectiveAgeId } from '../../data/ages';
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
  const supply=computeSupplyFlow({regions:state.regions,units:state.units,nationId:state.playerNationId,ageId:getEffectiveAgeId(state.age,state.techAgeId),resources:state.resources});
  const reserves=Object.values(state.units).filter(u=>u.ownerId===state.playerNationId&&u.domain==='land'&&!u.embarkedOn&&state.regions[u.regionId]?.owner===state.playerNationId&&!state.regions[u.regionId]?.underInvasion).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-fa-text font-bold text-lg">
        <Swords size={20} className="text-fa-danger-text" />
        {playerNation?.name}
      </div>
      <div className="bg-fa-raised/60 rounded-lg p-3 text-sm">
        <div className="text-fa-muted">Military Strength</div>
        <div className="text-fa-text font-semibold text-xl">{formatNumber(getFieldedStrength(state, state.playerNationId))}</div>
      </div>

      <div className="bg-fa-raised/60 rounded-lg p-3 text-sm space-y-1">
        <div className="text-fa-muted">Campaign supplies and reserve</div>
        <div className="text-fa-text">Stock: {Math.round(state.resources.supplies || 0)} · Next turn: +{supply.produced} / −{supply.consumed}</div>
        <div className="text-fa-text">{supply.campaigning} armies campaigning · {reserves} armies at home</div>
        <p className={supply.hungry?'text-amber-300':'text-fa-muted'}>{supply.hungry?'Supply shortage: bring armies home or build Industry and stockpile '+supply.metalId+'. Campaign armies lose morale and cannot reinforce.':'Keep a reserve at home to reinforce from manpower. Industry converts '+supply.metalId+' into supplies for distant campaigns.'}</p>
      </div>
      {/* Military maintenance slider (plan §M11): free, adjustable any time — scales army/navy
          upkeep only (see economy.js's header on the morale-recovery/reinforcement scope trim). */}
      <div className="bg-fa-raised/60 rounded-lg p-3 text-sm space-y-2">
        <div className="text-fa-muted">Maintenance</div>
        {[
          { label: 'Army', value: playerNation?.armyMaintenance ?? ARMY_MAINTENANCE_DEFAULT, onChange: handleSetArmyMaintenance },
          { label: 'Navy', value: playerNation?.navyMaintenance ?? ARMY_MAINTENANCE_DEFAULT, onChange: handleSetNavyMaintenance }
        ].map(({ label, value, onChange }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-fa-muted w-10 text-xs">{label}</span>
            <input
              type="range"
              min={ARMY_MAINTENANCE_MIN}
              max={ARMY_MAINTENANCE_MAX}
              step={10}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1"
            />
            <span className="text-fa-text text-xs w-10 text-right">{value}%</span>
          </div>
        ))}
      </div>

      <div className="bg-fa-raised/60 rounded-lg p-3 text-sm">
        <div className="text-fa-muted mb-1">Active Wars</div>
        {atWarWith.length === 0 ? (
          <div className="text-fa-muted">At peace with the world.</div>
        ) : (
          <ul className="space-y-1">
            {atWarWith.map(n => (
              <li key={n.id} className="text-fa-danger-text">War with {n.name}</li>
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

      {/* Tactical Battles: your own attacks always ask (pre-battle modal); enemy assaults can opt out. */}
      <div className="bg-fa-raised/40 rounded-lg p-3 space-y-2" data-testid="battle-settings">
        <div className="text-xs font-semibold text-fa-text">Battles</div>
        <div className="text-[11px] text-fa-muted">Your attacks on a defended province always ask how to fight: manually, auto-resolve, or call it off.</div>
        <label className="flex items-center justify-between gap-2 text-[12px] text-fa-text min-h-[40px]">
          <span>Auto-resolve enemy assaults on my provinces</span>
          <input type="checkbox" className="w-5 h-5" checked={state.battleSettings?.autoDefend === true} onChange={(e) => dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { autoDefend: e.target.checked } })} data-testid="auto-defend" />
        </label>
        <label className="flex items-center justify-between gap-2 text-[12px] text-fa-text min-h-[40px]">
          <span>Instant battles (skip the auto-resolve replay)</span>
          <input type="checkbox" className="w-5 h-5" checked={state.battleSettings?.instantBattles === true} onChange={(e) => dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { instantBattles: e.target.checked } })} data-testid="instant-battles" />
        </label>
        <label className="flex items-center justify-between gap-2 text-[12px] text-fa-text min-h-[40px]">
          <span>Warn me before End Turn while armies or settlers can still move</span>
          <input type="checkbox" className="w-5 h-5" checked={state.battleSettings?.warnEndTurn === true} onChange={(e) => dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { warnEndTurn: e.target.checked } })} data-testid="warn-end-turn" />
        </label>
      </div>

      <BattleReportList reports={state.battleReports || []} />
      {state.lastBattleReport?.log && <BattleReport report={state.lastBattleReport} />}

      <div className="text-fa-muted text-xs text-center pt-4 border-t border-fa-line">
        Select a region on the map and use its &quot;Manage Region&quot; button to recruit and command armies there.
      </div>
    </div>
  );
};

const OUTCOME_LABELS = {
  attacker: { text: 'Victory', className: 'text-fa-good' },
  defender: { text: 'Repelled', className: 'text-fa-danger-text' },
  stalemate: { text: 'Stalemate', className: 'text-amber-400' }
};
// A won round against a still-defended region (src/engine/siege.js) doesn't mean the region
// changed hands — `report.captured` is only ever explicitly `false` (not merely absent) for
// LAUNCH_INVASION/AMPHIBIOUS_ASSAULT reports where the siege continues, so this never misfires on
// a NAVAL_ENGAGEMENT/SUPPRESS_REBELLION report (which don't set `captured` at all).
const SIEGE_CONTINUES_LABEL = { text: 'Siege Continues', className: 'text-amber-400' };

const PHASE_LABELS = { ranged: 'Ranged', shock: 'Shock', flanking: 'Flanking', pursuit: 'Pursuit' };

// The player's last battles (src/engine/battleReports.js), newest first; tap one for the full
// report sheet (BattleReportSheet.jsx).
const REPORT_FILTERS = [['all', 'All'], ['win', 'Won'], ['loss', 'Lost']];
const BattleReportList = ({ reports }) => {
  const [filter, setFilter] = useState('all');
  if (!reports.length) return null;
  const shown = reports.filter((r) => filter === 'all' || describeOutcome(r).tone === filter);
  return (
    <div className="bg-fa-raised/40 rounded-lg p-3 space-y-2" data-testid="battle-report-list">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-fa-text">Battle reports</div>
        <div className="flex gap-1">
          {REPORT_FILTERS.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-2 py-1 rounded text-[10px] ${filter === id ? 'bg-blue-600 text-fa-text' : 'bg-fa-hover/60 text-fa-text'}`}>{label}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <div className="text-[11px] text-fa-muted">None.</div>}
      {shown.map((r) => {
        const result = describeOutcome(r);
        const { mine, theirs } = sidesFor(r);
        return (
          <button key={r.id} onClick={() => openBattleReport(r.id)} className="w-full text-left rounded-md bg-fa-panel/60 hover:bg-fa-panel px-2 py-1.5 min-h-[40px]">
            <div className="flex justify-between gap-2 text-[11px]">
              <span className={`truncate font-semibold ${result.tone === 'win' ? 'text-fa-good' : result.tone === 'loss' ? 'text-fa-danger-text' : 'text-amber-300'}`}>{result.text}</span>
              <span className="shrink-0 text-fa-muted">{r.year < 0 ? `${-r.year} BCE` : `${r.year} CE`}</span>
            </div>
            <div className="text-[10px] text-fa-muted">Fallen {formatMen(r.fallen[mine])} of yours · {formatMen(r.fallen[theirs])} of theirs</div>
          </button>
        );
      })}
    </div>
  );
};

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
    <div className="bg-fa-raised/60 rounded-lg p-3 text-xs space-y-2 border border-fa-line">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-fa-text">Last Battle: {REGIONS_DATA[report.fromRegionId]?.name} → {REGIONS_DATA[report.targetRegionId]?.name}</span>
        <span className={`font-bold ${outcome.className}`}>{outcome.text}</span>
      </div>
      <div className="text-fa-muted font-mono">
        {report.battleType && report.battleType !== 'field' ? `${BATTLE_TYPES[report.battleType]?.label || report.battleType}: ` : ''}Combat width {report.combatWidth} on {report.terrain} terrain — {report.deployedAttackers} vs {report.deployedDefenders} deployed
        {report.isAttackingFortification ? ', attacking a fortification' : ''}
      </div>
      <div className="space-y-0.5">
        {Object.entries(PHASE_LABELS).map(([key, label]) => phaseTotals[key] && (
          <div key={key} className="flex justify-between text-fa-muted">
            <span>{label} ({phaseTotals[key].count})</span>
            <span className="font-mono">{formatNumber(phaseTotals[key].damage)} dmg</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const OfficerCorps = ({ generals, units, canAffordHire, onHire }) => (
  <div className="bg-fa-raised/60 rounded-lg p-3 text-xs space-y-2">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-fa-text">Officer Corps</span>
      <button
        onClick={onHire}
        disabled={!canAffordHire}
        className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-fa-text text-[11px] flex items-center gap-1"
      >
        <UserCog size={12} /> Hire ({ACTION_COSTS.hireGeneral.gold}g)
      </button>
    </div>
    {generals.length === 0 && <div className="text-fa-muted">No generals hired yet.</div>}
    {generals.map(([id, general]) => (
      <div key={id} className="flex items-center justify-between text-fa-muted">
        <span>{general.name} <span className="text-fa-muted capitalize">({general.personality})</span></span>
        <span className="font-mono text-fa-muted">
          {general.assignedUnitId ? `commanding ${UNIT_CLASSES[units[general.assignedUnitId]?.classId]?.name || 'a unit'}` : 'unassigned'}
        </span>
      </div>
    ))}
  </div>
);

export default MilitaryPanel;
