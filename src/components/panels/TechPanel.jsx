// src/components/panels/TechPanel.jsx
// Technology research panel with societal alignment slider

import React, { useMemo } from 'react';
import { Beaker, Lock, Check, Sprout, Shield, Eye, ChevronRight, Skull, Zap, Radar } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GamePhases, ActionTypes } from '../../data/types';
import { TECH_TREE, getTechsByCategory, canResearchTech } from '../../data/techTree';
import { REGIONS_DATA } from '../../data/regions';
import { calcSocietalBonuses, formatMoney, getTechBonuses, canAfford } from '../../utils/helpers';
import { ACTION_COSTS } from '../../data/actionCosts';
import { ActionButton } from '../ui';

const CATEGORY_ICONS = {
  agri_econ: Sprout,
  defense: Shield,
  intel: Eye
};

const CATEGORY_COLORS = {
  agri_econ: 'text-green-400 border-green-500/30 bg-green-500/10',
  defense: 'text-red-400 border-red-500/30 bg-red-500/10',
  intel: 'text-purple-400 border-purple-500/30 bg-purple-500/10'
};

// Effect values that are literal per-turn amounts rather than fractional percentages
// (diplomacyIncomeBonus: 5 means +5 DP/turn, not +5% or +500%).
const FLAT_EFFECT_KEYS = new Set(['diplomacyIncomeBonus', 'hostilityReduction']);

const TechPanel = () => {
  const { state, dispatch, addLog } = useGame();
  
  const isPreState = state.phase === GamePhases.PRE_STATE;
  const societalBonuses = calcSocietalBonuses(state.societalSlider);
  const categories = useMemo(() => getTechsByCategory(), []);

  // Handle slider change
  const handleSliderChange = (e) => {
    dispatch({ type: ActionTypes.UPDATE_SLIDER, payload: parseInt(e.target.value) });
  };

  // Handle tech research. The reducer re-validates prerequisites/cost/year before applying
  // anything — this pre-check just gives a specific reason when a click won't do anything.
  const handleResearch = (techId) => {
    const check = canResearchTech(techId, state.techTree, state.resources, state.year);
    if (!check.can) {
      addLog(check.reason, 'action');
      return;
    }
    dispatch({ type: ActionTypes.RESEARCH_TECH_COSTED, payload: { techId } });
  };

  const techBonuses = useMemo(() => getTechBonuses(state.techTree), [state.techTree]);
  const activeEnemyInvasions = state.invasions.filter(i => !i.isPlayerAttacker && i.active);
  const targetableNations = Object.values(state.nations).filter(n => !n.isPlayer && (n.isAtWar || n.hostility > 60));

  const handleSabotage = (invasionId) => {
    if (!techBonuses.covertOps) {
      addLog('Requires Mossad', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.sabotageInvasion)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.SABOTAGE_INVASION, payload: { invasionId } });
  };

  const handleDestabilize = (nationId) => {
    if (!techBonuses.cyber) {
      addLog('Requires Unit 8200', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.destabilizeNation)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.DESTABILIZE_NATION, payload: { nationId } });
  };

  const handleTechTheft = () => {
    if (!techBonuses.globalIntel) {
      addLog('Requires Quantum Intelligence', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.covertTechTheft)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.COVERT_TECH_THEFT });
  };

  return (
    <div className="space-y-4">
      {/* Societal Alignment Slider */}
      <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-slate-400">Societal Alignment</span>
          <span className={`text-xs font-semibold ${
            societalBonuses.label === 'Secular' ? 'text-blue-400' :
            societalBonuses.label === 'Religious' ? 'text-purple-400' :
            'text-slate-400'
          }`}>
            {societalBonuses.label}
          </span>
        </div>

        {/* Slider */}
        <input
          type="range"
          min="0"
          max="100"
          value={state.societalSlider}
          onChange={handleSliderChange}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer 
                     bg-gradient-to-r from-blue-500 via-slate-500 to-purple-500"
          style={{
            WebkitAppearance: 'none',
            background: `linear-gradient(to right, #3b82f6 0%, #64748b 50%, #a855f7 100%)`
          }}
        />

        {/* Labels */}
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>Secular</span>
          <span>Balanced</span>
          <span>Religious</span>
        </div>

        {/* Bonuses Grid */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className={`p-1.5 rounded text-[10px] text-center ${
            societalBonuses.techMult > 1 ? 'bg-green-500/20 text-green-400' :
            societalBonuses.techMult < 1 ? 'bg-red-500/20 text-red-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            Tech: {societalBonuses.techMult > 1 ? '+' : ''}{((societalBonuses.techMult - 1) * 100).toFixed(0)}%
          </div>
          <div className={`p-1.5 rounded text-[10px] text-center ${
            societalBonuses.manMult > 1 ? 'bg-green-500/20 text-green-400' :
            societalBonuses.manMult < 1 ? 'bg-red-500/20 text-red-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            Manpower: {societalBonuses.manMult > 1 ? '+' : ''}{((societalBonuses.manMult - 1) * 100).toFixed(0)}%
          </div>
          <div className={`p-1.5 rounded text-[10px] text-center ${
            societalBonuses.defBonus > 0 ? 'bg-green-500/20 text-green-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            Defense: +{(societalBonuses.defBonus * 100).toFixed(0)}%
          </div>
          <div className={`p-1.5 rounded text-[10px] text-center ${
            societalBonuses.dipBonus > 0 ? 'bg-green-500/20 text-green-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            Diplomacy: +{(societalBonuses.dipBonus * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Tech Tree */}
      {isPreState ? (
        <div className="p-4 text-center text-slate-500">
          <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Technology research unlocks after independence</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600">
          {Object.entries(categories).map(([catId, category]) => {
            const Icon = CATEGORY_ICONS[catId] || Beaker;
            const colorClass = CATEGORY_COLORS[catId] || '';

            return (
              <div key={catId} className="space-y-2">
                {/* Category Header */}
                <div className={`flex items-center gap-2 text-sm font-semibold p-2 rounded border ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                  <span>{category.name}</span>
                </div>

                {/* Tech List */}
                <div className="space-y-1 pl-2">
                  {category.techs.map(tech => {
                    const techState = state.techTree[tech.id];
                    const check = canResearchTech(tech.id, state.techTree, state.resources, state.year);

                    return (
                      <button
                        key={tech.id}
                        onClick={() => handleResearch(tech.id)}
                        disabled={!check.can}
                        className={`
                          w-full p-2 rounded text-left transition-all text-xs
                          ${techState.researched 
                            ? 'bg-green-500/20 border border-green-500/30 cursor-default' 
                            : check.can 
                              ? 'bg-slate-700 hover:bg-slate-600 border border-slate-600 cursor-pointer' 
                              : 'bg-slate-800/50 border border-slate-700 opacity-50 cursor-not-allowed'
                          }
                        `}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Tech Name */}
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              {tech.name}
                              {techState.researched && (
                                <Check className="w-3 h-3 text-green-400" />
                              )}
                              {!techState.available && (
                                <span className="text-[9px] text-slate-500 font-normal">
                                  (Year {tech.yearAvailable})
                                </span>
                              )}
                            </div>

                            {/* Description */}
                            <div className="text-slate-400 text-[10px] mt-0.5">
                              {tech.description}
                            </div>

                            {/* Prerequisites */}
                            {tech.prerequisites.length > 0 && !techState.researched && (
                              <div className="flex items-center gap-1 mt-1 text-[9px]">
                                <span className="text-slate-500">Requires{tech.requiresAny ? ' (any)' : ''}:</span>
                                {tech.prerequisites.map((p, i) => (
                                  <span
                                    key={p}
                                    className={`
                                      ${state.techTree[p]?.researched ? 'text-green-400' : 'text-red-400'}
                                    `}
                                  >
                                    {TECH_TREE[p]?.name}
                                    {i < tech.prerequisites.length - 1 && (tech.requiresAny ? ' or ' : ', ')}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Exclusive-with fork indicator */}
                            {tech.exclusiveWith?.length > 0 && !techState.researched && (
                              <div className="flex items-center gap-1 mt-1 text-[9px]">
                                <span className="text-amber-500">⑂ Exclusive with:</span>
                                <span className={state.techTree[tech.exclusiveWith[0]]?.researched ? 'text-red-400' : 'text-slate-400'}>
                                  {TECH_TREE[tech.exclusiveWith[0]]?.name}
                                </span>
                              </div>
                            )}

                            {/* Specific rejection reason (e.g. locked out by an exclusive choice) */}
                            {!techState.researched && techState.available && !check.can && check.reason !== 'Prerequisites not met' && (
                              <div className="mt-1 text-[9px] text-red-400">{check.reason}</div>
                            )}
                          </div>

                          {/* Cost */}
                          {!techState.researched && (
                            <div className="text-right text-[10px] text-slate-500 shrink-0">
                              <div>{formatMoney(tech.cost.money)}</div>
                              <div>{tech.cost.techPoints} TP</div>
                              <div>2 AP</div>
                            </div>
                          )}
                        </div>

                        {/* Effect preview */}
                        {!techState.researched && check.can && (
                          <div className="mt-2 pt-1.5 border-t border-slate-600 text-[9px] text-green-400">
                            <ChevronRight className="w-3 h-3 inline" />
                            {Object.entries(tech.effects).map(([key, val]) => {
                              if (typeof val !== 'number') return `${key} `;
                              // "...Mult" effects are multipliers around 1.0 (moneyMult: 1.15 -> +15%).
                              // FLAT_EFFECT_KEYS are literal per-turn amounts, not percentages
                              // (diplomacyIncomeBonus: 5 -> +5 DP/turn). Everything else is a
                              // fractional bonus/discount in [0,1] (missileDefenseBonus: 0.4 -> +40%).
                              if (key.endsWith('Mult')) return `${key}: +${((val - 1) * 100).toFixed(0)}% `;
                              if (FLAT_EFFECT_KEYS.has(key)) return `${key}: +${val} `;
                              return `${key}: +${(val * 100).toFixed(0)}% `;
                            }).join('')}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Covert Operations — unlocked progressively by the Intelligence branch */}
      {!isPreState && (techBonuses.covertOps || techBonuses.cyber || techBonuses.globalIntel) && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-purple-500/30 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-purple-300">
            <Eye className="w-4 h-4" />
            Covert Operations
          </div>

          {techBonuses.covertOps && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 flex items-center gap-1"><Radar className="w-3 h-3" /> Sabotage Invasion</div>
              {activeEnemyInvasions.length === 0 ? (
                <p className="text-[9px] text-slate-500 pl-4">No active enemy invasions to sabotage.</p>
              ) : activeEnemyInvasions.map(inv => (
                <div key={inv.id} className="flex justify-between items-center text-[10px] pl-4">
                  <span className="text-slate-300">{REGIONS_DATA[inv.targetRegion]?.name}</span>
                  <button
                    onClick={() => handleSabotage(inv.id)}
                    disabled={!canAfford(state.resources, ACTION_COSTS.sabotageInvasion)}
                    className="px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-purple-300 rounded text-[9px]"
                  >
                    Sabotage (15 DP)
                  </button>
                </div>
              ))}
            </div>
          )}

          {techBonuses.cyber && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 flex items-center gap-1"><Zap className="w-3 h-3" /> Destabilize Nation</div>
              {targetableNations.length === 0 ? (
                <p className="text-[9px] text-slate-500 pl-4">No sufficiently hostile nations to target.</p>
              ) : targetableNations.map(nation => (
                <div key={nation.id} className="flex justify-between items-center text-[10px] pl-4">
                  <span className="text-slate-300">{nation.name}</span>
                  <button
                    onClick={() => handleDestabilize(nation.id)}
                    disabled={!canAfford(state.resources, ACTION_COSTS.destabilizeNation)}
                    className="px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-purple-300 rounded text-[9px]"
                  >
                    Destabilize ($20K, 30 DP)
                  </button>
                </div>
              ))}
            </div>
          )}

          {techBonuses.globalIntel && (
            <ActionButton
              icon={Skull}
              label="Covert Tech Theft"
              description="Quantum-assisted intelligence gathering steals foreign research"
              costs={ACTION_COSTS.covertTechTheft}
              effects={{ techPoints: 50 }}
              onClick={handleTechTheft}
              disabled={!canAfford(state.resources, ACTION_COSTS.covertTechTheft)}
              variant="purple"
              size="small"
            />
          )}
        </div>
      )}

      {/* Research Stats */}
      {!isPreState && (
        <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Researched:</span>
            <span className="font-mono text-purple-400">
              {Object.values(state.techTree).filter(t => t.researched).length} / {Object.keys(TECH_TREE).length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechPanel;
