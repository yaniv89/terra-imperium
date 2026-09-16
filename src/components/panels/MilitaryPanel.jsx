// src/components/panels/MilitaryPanel.jsx
// Military actions panel - training, combat, invasions

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Users, Swords, Plane, Target, Crosshair, Skull, Anchor, AlertTriangle, Castle, Award, Coins, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useCombatEffects } from '../../context/CombatEffectsContext';
import { GamePhases, ActionTypes } from '../../data/types';
import { REGIONS_DATA, isAdjacentToOwner } from '../../data/regions';
import { canAfford, calcMilitaryPower, formatNumber, getInvasionForRegion, sumUnits, hasEnoughUnits } from '../../utils/helpers';
import { ACTION_COSTS } from '../../data/actionCosts';
import { PERSONAS } from '../../data/personas';
import { ActionButton, ProgressBar } from '../ui';

const UNIT_LABELS = { infantry: 'Infantry', armor: 'Armor', air: 'Air' };

// Trend arrow for a stat that just changed turn-over-turn (Phase 9) — rising/falling/steady,
// so a player can see an invasion is about to collapse before it actually does.
const TrendArrow = ({ current, previous }) => {
  if (previous === undefined || current === previous) return <Minus className="w-2.5 h-2.5 text-slate-500" />;
  return current > previous
    ? <TrendingUp className="w-2.5 h-2.5 text-green-400" />
    : <TrendingDown className="w-2.5 h-2.5 text-red-400" />;
};

const MilitaryPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useCombatEffects();

  const isPreState = state.phase === GamePhases.PRE_STATE;
  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const isPlayerOwned = regionState?.owner === 'player';
  const isEnemyRegion = regionState && regionState.owner !== 'player';
  const enemyNation = isEnemyRegion ? state.nations[regionState.owner] : null;
  const isAtWarWithOwner = enemyNation?.isAtWar;
  const isAdjacent = selectedRegion ? isAdjacentToOwner(selectedRegion, state.regions, 'player') : false;
  const militaryPower = calcMilitaryPower(state);
  const militaryUnits = state.militaryUnits;

  // Composition committed to the next invasion the player launches — defaults to "send
  // everything available" and clamps down whenever the selected target or arsenal changes.
  const [composition, setComposition] = useState({ infantry: 0, armor: 0, air: 0 });
  // Approach chosen before launch (Phase 8) — storm (fast, decisive, risky) or siege (slow,
  // safe, guaranteed erosion). Changeable after launch too, via each active invasion's controls.
  const [launchApproach, setLaunchApproach] = useState('storm');
  useEffect(() => {
    if (!isPreState && isEnemyRegion && isAtWarWithOwner && isAdjacent) {
      setComposition({ ...militaryUnits });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion]);

  // Get active invasion for selected region
  const activeInvasion = selectedRegion ? getInvasionForRegion(selectedRegion, state.invasions) : null;
  const enemyInvasionHere = activeInvasion && !activeInvasion.isPlayerAttacker;

  // Morale/supply trend tracking (Phase 9) — the ref still holds the PREVIOUS render's values
  // while this render runs (it's only overwritten in the effect below, which fires after
  // commit), so reading it here gives "since last turn" without needing new game state for it.
  const prevInvasionStatsRef = useRef({});
  const prevInvasionStats = prevInvasionStatsRef.current;
  useEffect(() => {
    const snapshot = {};
    state.invasions.forEach(inv => { snapshot[inv.id] = { morale: inv.morale, supply: inv.supply }; });
    prevInvasionStatsRef.current = snapshot;
  }, [state.invasions]);

  // Active wars
  const activeWars = state.wars.filter(w => w.active);

  // Train Underground (Pre-state)
  const handleTrainUnderground = () => {
    if (!canAfford(state.resources, ACTION_COSTS.trainUnderground)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.TRAIN_UNDERGROUND });
  };

  // Train Infantry (Post-state)
  const handleTrainInfantry = () => {
    if (!canAfford(state.resources, ACTION_COSTS.trainInfantry)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.TRAIN_INFANTRY });
  };

  // Build Tanks
  const handleBuildTanks = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildTanks)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.BUILD_TANKS });
  };

  // Build Jets
  const handleBuildJets = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildJets)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.BUILD_JETS });
  };

  // Launch Invasion
  const handleInvade = () => {
    if (!isEnemyRegion || !isAtWarWithOwner) {
      addLog('Must be at war to invade', 'action');
      return;
    }
    if (!isAdjacent) {
      addLog('Invasion must originate from adjacent controlled territory', 'action');
      return;
    }
    if (sumUnits(composition) <= 0) {
      addLog('Commit at least some forces to invade', 'action');
      return;
    }
    if (!hasEnoughUnits(militaryUnits, composition)) {
      addLog('Not enough forces available for that composition', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.launchInvasion)) {
      addLog('Not enough resources for invasion', 'action');
      return;
    }
    // isAdjacent (checked above) guarantees at least one player-owned neighbor exists to launch from.
    const originId = REGIONS_DATA[selectedRegion].neighbors.find(id => state.regions[id]?.owner === 'player');
    triggerEffect('invasion', originId, selectedRegion);
    dispatch({ type: ActionTypes.LAUNCH_PLAYER_INVASION, payload: { targetRegion: selectedRegion, composition, approach: launchApproach } });
  };

  const handleSetApproach = (invasionId, approach) => {
    dispatch({ type: ActionTypes.SET_INVASION_APPROACH, payload: { invasionId, approach } });
  };

  const handleSetOrder = (invasionId, tacticalOrder) => {
    dispatch({ type: ActionTypes.SET_INVASION_ORDER, payload: { invasionId, tacticalOrder } });
  };

  const handleCommissionCommander = (personaId) => {
    if (!canAfford(state.resources, ACTION_COSTS.commissionCommander)) {
      addLog('Not enough resources to commission a commander', 'action');
      return;
    }
    dispatch({ type: ActionTypes.COMMISSION_COMMANDER, payload: { personaId } });
  };

  const handleAssignCommander = (invasionId, personaId) => {
    dispatch({ type: ActionTypes.ASSIGN_COMMANDER, payload: { invasionId, personaId } });
  };

  const handleHireMercenaries = (invasionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.hireMercenaries)) {
      addLog('Not enough resources to hire mercenaries', 'action');
      return;
    }
    dispatch({ type: ActionTypes.HIRE_MERCENARIES, payload: { invasionId } });
  };

  // Counterattack
  const handleCounterattack = () => {
    if (!enemyInvasionHere) {
      addLog('No enemy invasion to counter', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.counterattack)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.COUNTERATTACK, payload: { regionId: selectedRegion } });
  };

  // Air Strike
  const handleAirStrike = () => {
    const enemyInvasions = state.invasions.filter(i => !i.isPlayerAttacker && i.active);
    if (enemyInvasions.length === 0) {
      addLog('No enemy forces to strike', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.airStrike)) {
      addLog('Not enough resources', 'action');
      return;
    }
    // Matches the reducer's own target selection (GameContext.jsx AIR_STRIKE: the first active
    // enemy invasion) so the animation always lands on the region actually hit.
    const target = enemyInvasions[0];
    triggerEffect('airstrike', 'tel_aviv', target.targetRegion);
    dispatch({ type: ActionTypes.AIR_STRIKE });
  };

  // Fortify
  const handleFortify = () => {
    if (!isPlayerOwned) {
      addLog('Select an owned region', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.fortify)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.FORTIFY, payload: { regionId: selectedRegion } });
  };

  return (
    <div className="space-y-2">
      {/* Military Power Display */}
      <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">
            {isPreState ? 'Underground Strength' : 'Military Power'}
          </span>
          <span className="font-mono font-bold text-red-400">
            {formatNumber(militaryPower)}
          </span>
        </div>
        {!isPreState && (
          <div className="grid grid-cols-3 gap-1.5 mt-2 text-[10px]">
            {Object.entries(UNIT_LABELS).map(([type, label]) => (
              <div key={type} className="bg-slate-900/50 rounded px-1.5 py-1 text-center">
                <div className="text-slate-500">{label}</div>
                <div className="font-mono text-slate-200">{formatNumber(militaryUnits[type])}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pre-State Actions */}
      {isPreState ? (
        <>
          <ActionButton
            icon={Shield}
            label="Train Underground"
            description="Strengthen the Haganah defense forces"
            costs={ACTION_COSTS.trainUnderground}
            effects={{ underground: 500 }}
            onClick={handleTrainUnderground}
            disabled={state.resources.actionPoints < 1}
            variant="default"
          />

          <ActionButton
            icon={Target}
            label="Guerrilla Operation"
            description="Conduct operations against hostile forces"
            costs={{ money: 2000, actionPoints: 1 }}
            effects={{ custom: 'Reduce enemy control' }}
            onClick={() => addLog('Select a contested region for operations', 'action')}
            disabled={true}
            variant="warning"
          />
        </>
      ) : (
        <>
          {/* Post-State Training Actions */}
          <ActionButton
            icon={Users}
            label="Train Infantry"
            description="Expand IDF ground forces"
            costs={ACTION_COSTS.trainInfantry}
            effects={{ militaryPower: 1000 }}
            onClick={handleTrainInfantry}
            disabled={state.resources.actionPoints < 1}
            variant="default"
          />

          <ActionButton
            icon={Shield}
            label="Build Tanks"
            description="Armored corps expansion"
            costs={ACTION_COSTS.buildTanks}
            effects={{ militaryPower: 2000 }}
            onClick={handleBuildTanks}
            disabled={state.resources.actionPoints < 1}
            variant="default"
          />

          <ActionButton
            icon={Plane}
            label="Build Jets"
            description="Air force expansion for superiority"
            costs={ACTION_COSTS.buildJets}
            effects={{ militaryPower: 3000 }}
            onClick={handleBuildJets}
            disabled={state.resources.actionPoints < 1 || state.resources.techPoints < 10}
            variant="default"
          />

          {/* Combat Actions */}
          {isPlayerOwned && (
            <ActionButton
              icon={Anchor}
              label="Fortify Position"
              description="Strengthen defenses in selected region"
              costs={ACTION_COSTS.fortify}
              effects={{ control: 10 }}
              onClick={handleFortify}
              disabled={state.resources.actionPoints < 1}
              variant="default"
            />
          )}

          {/* Counterattack - when region is under invasion */}
          {isPlayerOwned && enemyInvasionHere && (
            <ActionButton
              icon={Crosshair}
              label="Counterattack"
              description={`Push back enemy invasion in ${regionData?.name}`}
              costs={ACTION_COSTS.counterattack}
              effects={{ control: 15, custom: 'Weaken enemy' }}
              onClick={handleCounterattack}
              disabled={state.resources.actionPoints < 2}
              variant="warning"
            />
          )}

          {/* Air Strike - when there are enemy invasions */}
          {state.invasions.some(i => !i.isPlayerAttacker && i.active) && (
            <ActionButton
              icon={Plane}
              label="Air Strike"
              description="Bomb enemy invasion forces"
              costs={ACTION_COSTS.airStrike}
              effects={{ custom: '-40% enemy strength, -25 morale' }}
              onClick={handleAirStrike}
              disabled={state.resources.actionPoints < 2}
              variant="danger"
            />
          )}

          {/* Invasion - when selected enemy region and at war */}
          {isEnemyRegion && isAtWarWithOwner && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
                <Swords className="w-4 h-4" />
                Invade {regionData?.name}
              </div>
              {!isAdjacent ? (
                <p className="text-xs text-slate-400">
                  Not adjacent to any territory you control — invasions must launch from a bordering region.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-400">
                    Commit forces from your arsenal. Composition matters — armor struggles in {regionData?.terrain}
                    {' '}terrain, infantry and defenders both benefit from it.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(UNIT_LABELS).map(([type, label]) => (
                      <label key={type} className="text-[10px] text-slate-400">
                        {label}
                        <input
                          type="number"
                          min={0}
                          max={militaryUnits[type]}
                          value={composition[type]}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(militaryUnits[type], Number(e.target.value) || 0));
                            setComposition(prev => ({ ...prev, [type]: val }));
                          }}
                          className="w-full mt-0.5 px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() => setComposition({ ...militaryUnits })}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                  >
                    Commit everything available
                  </button>

                  {/* Approach (Phase 8): storm risks it all on one roll, siege trades speed for
                      safety. Changeable later too, once the invasion is underway. */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setLaunchApproach('storm')}
                      className={`flex-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                        launchApproach === 'storm' ? 'bg-red-500/30 border-red-500/50 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      <Swords className="w-3 h-3 inline mr-1" />Storm
                    </button>
                    <button
                      onClick={() => setLaunchApproach('siege')}
                      className={`flex-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                        launchApproach === 'siege' ? 'bg-amber-500/30 border-amber-500/50 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      <Castle className="w-3 h-3 inline mr-1" />Siege
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500">
                    {launchApproach === 'storm'
                      ? 'Storm: one decisive roll — can win outright or stall, higher casualties.'
                      : 'Siege: no roll — slow, safe, guaranteed control erosion over several turns.'}
                  </p>

                  <ActionButton
                    icon={Swords}
                    label={`Launch Invasion (${formatNumber(sumUnits(composition))} committed)`}
                    description={`Offensive against ${enemyNation?.name}`}
                    costs={ACTION_COSTS.launchInvasion}
                    effects={{ custom: 'Capture territory' }}
                    onClick={handleInvade}
                    disabled={state.resources.actionPoints < 3 || sumUnits(composition) <= 0 || !hasEnoughUnits(militaryUnits, composition)}
                    variant="danger"
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Active Wars Section */}
      {activeWars.length > 0 && (
        <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
          <div className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
            <Skull className="w-4 h-4" />
            Active Wars ({activeWars.length})
          </div>
          <div className="space-y-1">
            {activeWars.map(war => {
              const enemy = state.nations[war.enemy];
              return (
                <div key={war.id} className="flex justify-between items-center text-xs">
                  <span className="text-red-300">vs {enemy?.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Since {war.startYear}</span>
                    <span className="text-orange-400 font-mono">
                      {formatNumber(enemy?.militaryStrength || 0)} str
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Invasions */}
      {state.invasions.filter(i => i.active).length > 0 && (
        <div className="mt-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
          <div className="text-orange-400 font-bold text-xs mb-2 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" />
            Active Invasions
          </div>
          <div className="space-y-2">
            {state.invasions.filter(i => i.active).map(inv => {
              const commander = inv.commanderId ? PERSONAS[inv.commanderId] : null;
              return (
                <div key={inv.id} className="text-[11px] border-b border-orange-500/10 last:border-0 pb-2 last:pb-0">
                  <div className="flex justify-between items-center">
                    <span className={inv.isPlayerAttacker ? 'text-green-400' : 'text-red-400'}>
                      {inv.isPlayerAttacker ? '→' : '←'} {REGIONS_DATA[inv.targetRegion]?.name}
                      {inv.approach === 'siege' && <span className="ml-1 text-amber-400">(siege)</span>}
                    </span>
                    <span className="text-slate-400 font-mono">{formatNumber(inv.isPlayerAttacker ? sumUnits(inv.composition) : inv.strength)} str</span>
                  </div>

                  {/* Morale/supply trend bars (Phase 9) — a declining trend is visible before the
                      invasion actually collapses, instead of only after the fact. */}
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 font-mono w-8 shrink-0">{inv.morale}%</span>
                      <ProgressBar value={inv.morale} color="yellow" size="small" className="flex-1" />
                      <TrendArrow current={inv.morale} previous={prevInvasionStats[inv.id]?.morale} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-blue-400 font-mono w-8 shrink-0">{inv.supply}%</span>
                      <ProgressBar value={inv.supply} color="blue" size="small" className="flex-1" />
                      <TrendArrow current={inv.supply} previous={prevInvasionStats[inv.id]?.supply} />
                    </div>
                  </div>

                  {/* Tactical controls (Phase 8) — player-attacking invasions only. */}
                  {inv.isPlayerAttacker && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex gap-1">
                        {['storm', 'siege'].map(approach => (
                          <button
                            key={approach}
                            onClick={() => handleSetApproach(inv.id, approach)}
                            className={`px-1.5 py-0.5 text-[9px] rounded border capitalize ${
                              (inv.approach || 'storm') === approach
                                ? 'bg-amber-500/30 border-amber-500/50 text-amber-300'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}
                          >
                            {approach}
                          </button>
                        ))}
                        {(inv.approach || 'storm') === 'storm' && ['press', 'hold', 'probe'].map(order => (
                          <button
                            key={order}
                            onClick={() => handleSetOrder(inv.id, order)}
                            className={`px-1.5 py-0.5 text-[9px] rounded border capitalize ${
                              (inv.tacticalOrder || 'press') === order
                                ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}
                          >
                            {order}
                          </button>
                        ))}
                        <button
                          onClick={() => handleHireMercenaries(inv.id)}
                          disabled={!canAfford(state.resources, ACTION_COSTS.hireMercenaries)}
                          className="px-1.5 py-0.5 text-[9px] rounded border bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700 disabled:opacity-40 flex items-center gap-0.5"
                          title={`Cost: ${formatNumber(ACTION_COSTS.hireMercenaries.money)}`}
                        >
                          <Coins className="w-2.5 h-2.5" />Mercs
                        </button>
                      </div>

                      {/* Commander assignment */}
                      {state.hiredCommanders.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-[9px] text-slate-500">Commander:</span>
                          <button
                            onClick={() => handleAssignCommander(inv.id, null)}
                            className={`px-1.5 py-0.5 text-[9px] rounded border ${!inv.commanderId ? 'bg-slate-700 border-slate-500 text-slate-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                          >
                            None
                          </button>
                          {state.hiredCommanders.map(personaId => (
                            <button
                              key={personaId}
                              onClick={() => handleAssignCommander(inv.id, personaId)}
                              className={`px-1.5 py-0.5 text-[9px] rounded border ${
                                inv.commanderId === personaId ? 'bg-purple-500/30 border-purple-500/50 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-500'
                              }`}
                            >
                              {PERSONAS[personaId].name}
                            </button>
                          ))}
                        </div>
                      )}
                      {commander && (
                        <p className="text-[9px] text-purple-300">{commander.name}: {commander.description}</p>
                      )}
                      {inv.mercenaryBoost && (
                        <p className="text-[9px] text-emerald-400">
                          +{formatNumber(inv.mercenaryBoost.amount)} mercenary infantry ({inv.mercenaryBoost.turnsRemaining} turns left)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Officer Corps (Phase 8): commission commanders here, assign them to a front above. */}
      {!isPreState && (
        <div className="mt-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
          <div className="text-purple-300 font-bold text-xs mb-2 flex items-center gap-2">
            <Award className="w-3 h-3" />
            Officer Corps
          </div>
          <div className="space-y-1">
            {Object.values(PERSONAS).map(persona => {
              const hired = state.hiredCommanders.includes(persona.id);
              return (
                <div key={persona.id} className="flex justify-between items-center gap-2 text-[10px] p-1.5 rounded bg-slate-800/50">
                  <div>
                    <div className="text-white font-semibold">{persona.name}</div>
                    <div className="text-slate-500">{persona.description}</div>
                  </div>
                  {hired ? (
                    <span className="px-1.5 py-0.5 text-[9px] bg-green-500/20 text-green-400 rounded shrink-0">Commissioned</span>
                  ) : (
                    <button
                      onClick={() => handleCommissionCommander(persona.id)}
                      disabled={!canAfford(state.resources, ACTION_COSTS.commissionCommander)}
                      className="px-2 py-1 text-[9px] rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 disabled:opacity-40 shrink-0"
                    >
                      Commission ({formatNumber(ACTION_COSTS.commissionCommander.money)})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hint for enemy region selection */}
      {!isPreState && !selectedRegion && (
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 text-center mt-3">
          <p className="text-xs text-slate-500">
            Select an enemy region at war to launch an invasion
          </p>
        </div>
      )}
    </div>
  );
};

export default MilitaryPanel;
