// src/components/panels/TechPanel.jsx
// Research tab: Set Focus, Fund Scholars, and Research Tech against the 50-tech, 5-category tree
// authored in src/data/techTree.js. Research speed comes from Science buildings (calcIncome,
// src/utils/helpers.js) — a nation with none simply won't accumulate tech points to spend here.

import React from 'react';
import { Beaker, BookOpen, GraduationCap, Check, Lock } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes, TechCategories } from '../../data/types';
import { TECH_TREE, canResearchTech, getTechsByCategory, getTechPowerCost } from '../../data/techTree';
import { ACTION_COSTS, TECH_RESEARCH_POOL } from '../../data/actionCosts';
import { getNationCapital } from '../../data/regions';
import { getAgesBehind, getAgesBehindResearchCostMultiplier } from '../../data/ages';
import { canAfford } from '../../utils/helpers';
import { getModifier } from '../../engine/modifiers/sheet';
import { ActionButton, CollapsibleSection } from '../ui';

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
  // Falling behind the calendar on your OWN tech-earned age now has real teeth (src/data/ages.js's
  // getAgesBehindResearchCostMultiplier) — surfaced here so the cost increase isn't a silent,
  // confusing surprise. The old flat combat malus this used to also warn about is gone (plan
  // §M14) — combat now compares BOTH sides' own ages directly (src/data/unitClasses.js's
  // getRosterCombatMultiplier), so there's no longer a single "-X%" figure to quote in advance.
  const agesBehind = getAgesBehind(state.age, state.techAgeId);
  const agesBehindMult = getAgesBehindResearchCostMultiplier(agesBehind);
  // Plan §M7: national.researchCost (nothing sources it yet but Scientific Method's own tech
  // effect) and Research Focus's own -15% power discount for the currently-focused line.
  const nationalResearchCostMult = getModifier(state, state.playerNationId, 'national.researchCost').total;
  const getTechCosts = (tech) => {
    const focused = state.researchFocus === tech.category;
    const power = Math.round(getTechPowerCost(tech, { researchCostMult: nationalResearchCostMult, focused }) * agesBehindMult);
    const techPoints = Math.round(tech.cost.techPoints * (1 + nationalResearchCostMult) * agesBehindMult);
    return { [TECH_RESEARCH_POOL[tech.category]]: power, techPoints };
  };

  // Plan feedback: a flat ~50-button list was overcrowded. Only one category starts expanded — the
  // focused one, or (with no focus set) the first category with a tech that's structurally eligible
  // (prerequisites/age/exclusivity met) even if not affordable THIS turn — affordability changes
  // turn to turn and shouldn't be what decides which section a player sees on load, or nothing
  // would ever auto-expand at the very start of a game when nobody can afford anything yet.
  const defaultOpenCategoryId = state.researchFocus || Object.values(TechCategories).find((categoryId) => (
    (categories[categoryId]?.techs || []).some((tech) => {
      if (state.techTree[tech.id]?.researched) return false;
      const { can, reason } = canResearchTech(tech.id, state.techTree, state.resources, state.year, TECH_TREE, agesBehind, nationalResearchCostMult, false);
      return can || reason === 'Insufficient tech points' || reason?.startsWith('Need ');
    })
  ));

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
  const handleResearch = (tech) => {
    if (!canAfford(state.resources, getTechCosts(tech))) return addLog('Not enough resources', 'action');
    triggerEffect('research_tech', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.RESEARCH_TECH, payload: { techId: tech.id } });
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
        {agesBehind > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-amber-700/40 text-[11px] text-amber-400">
            {agesBehind} age{agesBehind === 1 ? '' : 's'} behind the calendar — research costs +{Math.round((agesBehindMult - 1) * 100)}%,
            and your units fight at a real disadvantage against anyone more advanced until you catch up.
          </div>
        )}
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

      {Object.values(TechCategories).map(categoryId => {
        const techs = categories[categoryId]?.techs || [];
        const researchedCount = techs.filter((t) => state.techTree[t.id]?.researched).length;
        return (
          <CollapsibleSection
            key={categoryId}
            title={CATEGORY_LABELS[categoryId]}
            defaultOpen={categoryId === defaultOpenCategoryId}
            summary={`${researchedCount}/${techs.length} researched`}
          >
            {techs.map(tech => {
              const techState = state.techTree[tech.id];
              const focused = state.researchFocus === categoryId;
              const check = canResearchTech(tech.id, state.techTree, state.resources, state.year, TECH_TREE, agesBehind, nationalResearchCostMult, focused);
              const costs = getTechCosts(tech);
              return (
                <ActionButton
                  key={tech.id}
                  icon={techState?.researched ? Check : check.can ? BookOpen : Lock}
                  label={tech.name}
                  description={techState?.researched ? 'Researched' : focused ? `${check.reason || 'Available'} (focused: -15% power)` : check.reason || 'Available'}
                  costs={techState?.researched ? null : costs}
                  onClick={() => handleResearch(tech)}
                  disabled={techState?.researched || !check.can}
                  variant={techState?.researched ? 'success' : 'default'}
                  size="small"
                />
              );
            })}
          </CollapsibleSection>
        );
      })}
    </div>
  );
};

export default TechPanel;
