// src/components/panels/MilitaryPanel.jsx
// Military actions panel - training, combat, invasions

import React, { useState, useEffect } from 'react';
import { Shield, Users, Swords, Plane, Target, Crosshair, Skull, Anchor, AlertTriangle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GamePhases, ActionTypes } from '../../data/types';
import { REGIONS_DATA, isAdjacentToOwner } from '../../data/regions';
import { canAfford, calcMilitaryPower, formatNumber, getInvasionForRegion, sumUnits, hasEnoughUnits } from '../../utils/helpers';
import { ACTION_COSTS } from '../../data/actionCosts';
import { ActionButton } from '../ui';

const UNIT_LABELS = { infantry: 'Infantry', armor: 'Armor', air: 'Air' };

const MilitaryPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();

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
  useEffect(() => {
    if (!isPreState && isEnemyRegion && isAtWarWithOwner && isAdjacent) {
      setComposition({ ...militaryUnits });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion]);

  // Get active invasion for selected region
  const activeInvasion = selectedRegion ? getInvasionForRegion(selectedRegion, state.invasions) : null;
  const enemyInvasionHere = activeInvasion && !activeInvasion.isPlayerAttacker;

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
    dispatch({ type: ActionTypes.LAUNCH_PLAYER_INVASION, payload: { targetRegion: selectedRegion, composition } });
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
          <div className="space-y-1.5">
            {state.invasions.filter(i => i.active).map(inv => (
              <div key={inv.id} className="flex justify-between items-center text-[11px]">
                <span className={inv.isPlayerAttacker ? 'text-green-400' : 'text-red-400'}>
                  {inv.isPlayerAttacker ? '→' : '←'} {REGIONS_DATA[inv.targetRegion]?.name}
                </span>
                <div className="flex gap-2 font-mono">
                  <span className="text-slate-400">{formatNumber(inv.isPlayerAttacker ? sumUnits(inv.composition) : inv.strength)} str</span>
                  <span className="text-yellow-400">{inv.morale}% mor</span>
                  <span className="text-blue-400">{inv.supply}% sup</span>
                </div>
              </div>
            ))}
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
