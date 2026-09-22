// src/components/panels/TechPanel.jsx
// Research tab: Set Focus, Fund Scholars, and Research Tech against the 50-tech, 5-category tree
// authored in src/data/techTree.js. Research speed comes from Science buildings (calcIncome,
// src/utils/helpers.js) — a nation with none simply won't accumulate tech points to spend here.

import React from 'react';
import { Beaker, BookOpen, GraduationCap, Check, Lock } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes, TechCategories } from '../../data/types';
import { TECH_TREE, canResearchTech, getTechsByCategory } from '../../data/techTree';
import { ACTION_COSTS } from '../../data/actionCosts';
import { getNationCapital } from '../../data/regions';
import { canAfford } from '../../utils/helpers';
import { ActionButton } from '../ui';

const CATEGORY_LABELS = {
  [TechCategories.MILITARY]: 'Military',
  [TechCategories.ECONOMY]: 'Economy',
  [TechCategories.INFRASTRUCTURE]: 'Infrastructure',
  [TechCategories.GOVERNANCE]: 'Governance',
  [TechCategories.SCIENCE]: 'Science'
};

const TechPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const categories = getTechsByCategory();

  const handleFocus = (categoryId) => {
    if (!canAfford(state.resources, ACTION_COSTS.setResearchFocus)) return addLog('Not enough resources', 'action');
    triggerEffect('set_research_focus', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId } });
  };
  const handleFundScholars = () => {
    if (!canAfford(state.resources, ACTION_COSTS.fundScholars)) return addLog('Not enough resources', 'action');
    triggerEffect('fund_scholars', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.FUND_SCHOLARS, payload: {} });
  };
  const handleResearch = (techId, techCost) => {
    const costs = { ...techCost, actionPoints: ACTION_COSTS.researchTech.actionPoints };
    if (!canAfford(state.resources, costs)) return addLog('Not enough resources', 'action');
    triggerEffect('research_tech', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.RESEARCH_TECH, payload: { techId } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white font-bold text-lg">
        <Beaker size={20} className="text-purple-400" />
        Research
      </div>

      <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Researched:</span>
          <span className="font-mono text-purple-400">
            {Object.values(state.techTree).filter(t => t.researched).length} / {Object.keys(TECH_TREE).length}
          </span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-slate-400">Tech-earned age:</span>
          <span className="font-mono text-purple-400 capitalize">{state.techAgeId}</span>
        </div>
      </div>

      <ActionButton
        icon={GraduationCap}
        label="Fund Scholars"
        description="Convert gold into tech points"
        costs={ACTION_COSTS.fundScholars}
        effects={{ custom: '+20 Tech Points' }}
        onClick={handleFundScholars}
        disabled={!canAfford(state.resources, ACTION_COSTS.fundScholars)}
        size="small"
      />

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-slate-300">Research Focus</div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(TechCategories).map(categoryId => (
            <button
              key={categoryId}
              onClick={() => handleFocus(categoryId)}
              disabled={state.researchFocus === categoryId || !canAfford(state.resources, ACTION_COSTS.setResearchFocus)}
              className={`px-2 py-1.5 rounded text-xs border ${
                state.researchFocus === categoryId
                  ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {CATEGORY_LABELS[categoryId]}
            </button>
          ))}
        </div>
      </div>

      {Object.values(TechCategories).map(categoryId => (
        <div key={categoryId} className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-300">{CATEGORY_LABELS[categoryId]}</div>
          {(categories[categoryId]?.techs || []).map(tech => {
            const techState = state.techTree[tech.id];
            const check = canResearchTech(tech.id, state.techTree, state.resources, state.year);
            const costs = { ...tech.cost, actionPoints: ACTION_COSTS.researchTech.actionPoints };
            return (
              <ActionButton
                key={tech.id}
                icon={techState?.researched ? Check : check.can ? BookOpen : Lock}
                label={tech.name}
                description={techState?.researched ? 'Researched' : check.reason || 'Available'}
                costs={techState?.researched ? null : costs}
                onClick={() => handleResearch(tech.id, tech.cost)}
                disabled={techState?.researched || !check.can}
                variant={techState?.researched ? 'success' : 'default'}
                size="small"
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default TechPanel;
