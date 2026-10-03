// src/components/battle/PreBattleModal.jsx
// The pre-battle interception (Tactical Battles plan §2, §10.2). EVERY attack you launch — on a
// garrisoned province or an empty one — stops here first — it is never skipped by a remembered setting (that used to
// happen: one shared "auto" switch silently auto-resolved everything, so the manual battle seemed
// to vanish). It shows both armies, their commanders, the ground and the walls, the real
// auto-resolve odds and why, and asks how to fight:
//   Fight manually — the real-time tactical battle, with exactly these armies, terrain and walls
//   Auto-resolve   — the same rules resolved instantly
//   Call off       — no attack; nothing is spent and the army keeps its move
// With `navalUnitId` it's an amphibious landing by the troops aboard that fleet.
// A bottom sheet on phones, a centred card on desktop.
import React, { useMemo, useState } from 'react';
import { Zap, Swords, Undo2, X, Mountain, Castle, Crown, Star } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { getRegionTerrain } from '../../data/terrain';
import { UNIT_CLASSES } from '../../data/unitClasses';
import { ACTION_COSTS } from '../../data/actionCosts';
import { estimateInvasionOdds, estimateLandingOdds, estimateFieldOdds, estimateFleetOdds } from '../../engine/battleOdds';
import { scoutsEstimate } from './battleReportView';
import { validateInvasion, validateAmphibious } from '../../engine/invasion';
import { validateFieldAttack } from '../../engine/fieldBattle';
import { validateFleetAttack } from '../../engine/navalBattle';
import { legacyTerrainOf } from '../../engine/world/registry';
import { getTiles } from '../../data/geo/tiles';
import { describeAttackBlock } from '../../utils/attackAvailability';
import { getRegionModifier } from '../../engine/modifiers/sheet';
import { canSeeRegionDetails } from '../../engine/intel';
import { canAfford } from '../../utils/helpers';

const pct = (v) => `${Math.round(v * 100)}%`;

// "3 Pikemen · 1 Knights" and the total strength, for one side.
export const summarizeArmy = (units, hiredCommanders = {}) => {
  const byClass = {};
  units.forEach((u) => { byClass[u.classId] = (byClass[u.classId] || 0) + 1; });
  const commanders = [...new Set(units.map((u) => u.commanderId).filter(Boolean))].map((id) => hiredCommanders[id]?.name || 'A general');
  return {
    lines: Object.entries(byClass).map(([classId, n]) => ({ classId, n, name: UNIT_CLASSES[classId]?.name || classId })),
    strength: units.reduce((s, u) => s + Math.max(0, u.strength), 0),
    commanders
  };
};

const ArmyColumn = ({ title, tone, army, hidden }) => (
  <div className={`rounded-lg border p-2 ${tone === 'you' ? 'border-blue-500/40 bg-blue-500/5' : 'border-orange-500/40 bg-orange-500/5'}`}>
    <div className={`text-[11px] font-semibold mb-1 ${tone === 'you' ? 'text-blue-300' : 'text-orange-300'}`}>{title}</div>
    {hidden ? (
      <div className="text-[11px] text-slate-400">Unknown — espionage against them reveals their forces.</div>
    ) : (
      <>
        <div className="text-[11px] text-slate-200 leading-snug">{army.lines.map((l) => `${l.n} ${l.name}`).join(' · ') || 'none'}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">Strength {army.strength.toLocaleString()}</div>
        {army.commanders.length > 0 && (
          <div className="text-[10px] text-amber-200 mt-0.5 flex items-center gap-1"><Crown className="w-3 h-3" /> {army.commanders.join(', ')}</div>
        )}
      </>
    )}
  </div>
);

// With `tile` it's a field battle (fieldBattle.js) against the enemy stack on that tile; with
// `fromTile` too it's a sea battle (navalBattle.js) between the fleets on the two tiles.
const PreBattleModal = ({ fromRegionId, targetRegionId = null, navalUnitId = null, tile = null, fromTile = null, onClose }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const landing = !!navalUnitId;
  const fleet = tile != null && fromTile != null;
  const field = tile != null;
  const origin = landing ? state.units[navalUnitId]?.regionId : fromRegionId;
  const preferred = state.battleSettings?.defaultMode === 'command' ? 'command' : state.battleSettings?.defaultMode === 'auto' ? 'auto' : null;
  const [prefer, setPrefer] = useState(false);

  const v = landing ? validateAmphibious(state, navalUnitId, targetRegionId)
    : fleet ? validateFleetAttack(state, fromTile, tile)
    : field ? validateFieldAttack(state, fromRegionId, tile)
    : validateInvasion(state, fromRegionId, targetRegionId);
  const blockedReason = describeAttackBlock(v);
  const odds = useMemo(() => v.ok ? (landing ? estimateLandingOdds(state, navalUnitId, targetRegionId, 200) : fleet ? estimateFleetOdds(state, fromTile, tile, 200) : field ? estimateFieldOdds(state, fromRegionId, tile, 200) : estimateInvasionOdds(state, fromRegionId, targetRegionId, 200)) : null,
    [state, landing, fleet, field, tile, fromTile, navalUnitId, fromRegionId, targetRegionId, v.ok]);
  const affordable = canAfford(state.resources, landing ? ACTION_COSTS.amphibiousAssault : fleet ? ACTION_COSTS.navalEngagement : ACTION_COSTS.launchInvasion);
  // An enemy fleet off the beach must be fought at sea first, which is always auto-resolved.
  const blockedAtSea = landing && Object.values(state.units).some((u) => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
  // The enemy garrison and the odds computed from it are intelligence: no intel, no numbers.
  const hasIntel = field ? true : canSeeRegionDetails(state, targetRegionId);

  const region = field ? null : state.regions[targetRegionId];
  const terrain = fleet ? 'open water' : field ? legacyTerrainOf(getTiles(), tile) : getRegionTerrain(targetRegionId, REGIONS_DATA);
  const fortTier = field ? 0 : (region?.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total;
  const mine = summarizeArmy(v?.ok ? (landing ? v.embarkedLandUnits : v.attackerUnits) : [], state.hiredCommanders);
  const theirs = summarizeArmy(v?.ok ? (landing ? v.defenderLandUnits : v.defenderUnits) : [], state.hiredCommanders);
  const enemyName = field ? (v?.ok && v.defenderNationId !== 'rebels' ? state.nations[v.defenderNationId]?.name : 'the rebels') || 'the enemy' : state.nations[region?.owner]?.name || 'the enemy';
  // Known to be empty (you have intel): there's no battle to fight, the army just marches in.
  const knownEmpty = !field && hasIntel && v?.ok && (landing ? v.defenderLandUnits : v.defenderUnits).length === 0;

  const remember = (mode) => { if (prefer) dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { defaultMode: mode } }); };
  const auto = () => {
    if (blockedReason) return addLog(blockedReason, 'action');
    if (!affordable) return addLog('Not enough resources', 'action');
    remember('auto');
    if (landing) {
      triggerEffect('amphibious_assault', { from: origin, to: targetRegionId });
      dispatch({ type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId } });
    } else if (fleet) {
      dispatch({ type: ActionTypes.ATTACK_FLEET, payload: { fromTile, tile } });
    } else if (field) {
      dispatch({ type: ActionTypes.ATTACK_ARMY, payload: { fromRegionId, tile } });
    } else {
      triggerEffect('ground_invasion', { from: fromRegionId, to: targetRegionId });
      dispatch({ type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId } });
    }
    onClose();
  };
  const command = () => {
    if (blockedReason || blockedAtSea) return addLog(blockedReason || 'Defeat the defending fleet first.', 'action');
    if (!affordable) return addLog('Not enough resources', 'action');
    remember('command');
    dispatch(landing
      ? { type: ActionTypes.BEGIN_AMPHIBIOUS_BATTLE, payload: { navalUnitId, targetRegionId } }
      : { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: fleet ? { fromTile, tile, naval: true } : field ? { fromRegionId, tile } : { fromRegionId, targetRegionId } });
    onClose();
  };
  const ring = (mode) => (preferred === mode ? ' ring-2 ring-amber-300/70' : '');

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center sheet-backdrop" onClick={onClose} data-testid="battle-choice">
      <div onClick={(e) => e.stopPropagation()} className="sheet-panel w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-slate-200 shadow-2xl space-y-3" data-testid="pre-battle">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-bold text-white">{fleet ? `Attack the fleet at sea` : field ? `Attack the army near ${getTiles().names[tile] || REGIONS_DATA[origin]?.name || 'the field'}` : `${landing ? 'Land on' : 'Attack'} ${REGIONS_DATA[targetRegionId]?.name}`}</div>
            <div className="text-xs text-slate-400">{fleet ? `your fleet beside it · ${enemyName}'s fleet` : <>{landing ? 'by sea from' : 'from'} {REGIONS_DATA[origin]?.name} · {field ? `${enemyName}'s army` : `held by ${enemyName}`}</>}</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 text-slate-400" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ArmyColumn title="Your army" tone="you" army={mine} />
          <ArmyColumn title="Their garrison" tone="them" army={theirs} hidden={!hasIntel} />
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 flex items-center gap-1 capitalize"><Mountain className="w-3.5 h-3.5 text-emerald-300" /> {terrain}</span>
          <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 flex items-center gap-1" data-testid="pre-battle-fort"><Castle className="w-3.5 h-3.5 text-slate-300" /> {fortTier > 0 ? `Fortifications tier ${fortTier}` : 'No fortifications'}</span>
          {landing && <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700">{v?.hasBeachhead ? 'Beachhead next door' : 'No foothold: landing penalty'}</span>}
        </div>

        {odds && !odds.undefended && hasIntel && (
          <div className="space-y-2 rounded-lg bg-slate-800/60 p-3" data-testid="battle-odds">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-lg font-bold text-blue-300">{pct(odds.attacker)}</div><div className="text-[10px] text-slate-400">you win</div></div>
              <div><div className="text-lg font-bold text-emerald-300" data-testid="battle-odds-capture">{pct(odds.capture)}</div><div className="text-[10px] text-slate-400">{field ? 'drive them off' : 'take the region'}</div></div>
              <div><div className="text-lg font-bold text-orange-300">{pct(odds.defender)}</div><div className="text-[10px] text-slate-400">they hold</div></div>
            </div>
            {/* Balance of power: your strength against theirs, as the auto-resolve weighs it. */}
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-900" title="Win / draw / loss">
              <div className="bg-blue-500" style={{ width: pct(odds.attacker) }} />
              <div className="bg-slate-500" style={{ width: pct(odds.stalemate) }} />
              <div className="bg-orange-500" style={{ width: pct(odds.defender) }} />
            </div>
            <div className="text-[11px] text-slate-400">Expected losses: yours {pct(odds.attackerLossShare)} · theirs {pct(odds.defenderLossShare)}{!odds.hasMelee ? ' · you need infantry or cavalry to take the region' : ''}</div>
            <div className="flex flex-wrap gap-1" data-testid="battle-odds-factors">
              {odds.factors.filter((f) => Math.abs(f.value - 1) >= 0.02).map((f) => (
                <span key={f.id} className={`px-1.5 py-0.5 rounded text-[10px] border ${f.value > 1 ? 'border-emerald-500/50 text-emerald-300' : 'border-red-500/50 text-red-300'}`} title={f.detail || ''}>
                  {f.label} ×{f.value.toFixed(2)}
                </span>
              ))}
            </div>
          </div>
        )}

        {odds && !hasIntel && (() => {
          const band = scoutsEstimate(odds.attacker);
          return (
            <div className="rounded-lg bg-slate-800/60 p-3 space-y-1" data-testid="battle-odds-scouts">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-slate-400">Scouts&apos; estimate</span>
                <span className={`text-base font-bold ${band.tone}`}>{band.label}</span>
              </div>
              <div className="text-[11px] text-slate-400">{band.hint} Spy on {enemyName} (Diplomacy) for exact odds.</div>
            </div>
          );
        })()}

        {landing && blockedAtSea && (
          <div className="text-[11px] text-slate-400 rounded-lg bg-slate-800/60 px-3 py-2">An enemy fleet guards the coast: it has to be fought at sea first, so this landing can only be auto-resolved.</div>
        )}

        {knownEmpty && (
          <div className="text-[11px] text-emerald-200 rounded-lg bg-emerald-900/30 border border-emerald-700/40 px-3 py-2" data-testid="pre-battle-undefended">No garrison: the province falls as soon as your army marches in.</div>
        )}

        {blockedReason && <div role="status" className="text-sm text-amber-200 rounded-lg border border-amber-500/40 p-3" data-testid="battle-blocked-reason">{blockedReason}</div>}

        {!knownEmpty && <button type="button" onClick={command} disabled={!!blockedReason || !affordable || blockedAtSea} className={`w-full min-h-[64px] p-3 rounded-xl bg-blue-600/90 border border-blue-400 flex items-center gap-3 text-left disabled:opacity-50${ring('command')}`} data-testid="battle-choice-command">
          <Swords className="w-6 h-6 text-white shrink-0" />
          <span>
            <span className="block font-semibold text-white">Fight manually {preferred === 'command' && <Star className="inline w-3.5 h-3.5 text-amber-300" />}</span>
            <span className="block text-xs text-blue-100">Command it in real time with exactly these armies, this ground and these walls.</span>
          </span>
        </button>}
        <button type="button" onClick={auto} disabled={!!blockedReason || !affordable} className={`w-full min-h-[64px] p-3 rounded-xl bg-slate-800 border border-slate-600 flex items-center gap-3 text-left disabled:opacity-50${ring('auto')}`} data-testid="battle-choice-auto">
          <Zap className="w-6 h-6 text-amber-300 shrink-0" />
          <span>
            <span className="block font-semibold text-white">{knownEmpty ? 'March in' : 'Auto-resolve'} {!knownEmpty && preferred === 'auto' && <Star className="inline w-3.5 h-3.5 text-amber-300" />}</span>
            <span className="block text-xs text-slate-400">{knownEmpty ? 'Take the province now.' : `${odds && !odds.undefended && hasIntel ? 'Instant, by the odds above.' : 'Instant, by the same rules (your scouts\' estimate above).'} Break their whole garrison and the region is yours.`}</span>
          </span>
        </button>
        <button type="button" onClick={onClose} className="w-full min-h-[48px] p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-3 text-left" data-testid="battle-choice-calloff">
          <Undo2 className="w-5 h-5 text-slate-300 shrink-0" />
          <span>
            <span className="block font-semibold text-slate-200 text-sm">Call off the attack</span>
            <span className="block text-[11px] text-slate-500">Nothing is spent; your army keeps its move.</span>
          </span>
        </button>

        {!knownEmpty && <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={prefer} onChange={(e) => setPrefer(e.target.checked)} /> Highlight my choice next time (you&apos;ll still be asked)
        </label>}
      </div>
    </div>
  );
};

export default PreBattleModal;
