// src/components/panels/TechPanel.jsx
// Research tab, Civ-style (src/engine/research.js): science per turn, the tech being researched
// with its progress and turns left, the queue, and the five lines of techs. Choosing a tech costs
// nothing: science pays for it at the end of each turn, and the rest carries into the next one.
// "Research" makes a tech the target (queuing its missing earlier techs first); "Queue" adds it
// after what's already planned. Fund Scholars and Research Focus feed the same science.
import React from 'react';
import { Beaker, BookOpen, GraduationCap, Check, Lock, X, ListPlus, Sparkles } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes, TechCategories } from '../../data/types';
import { getTechsByCategory } from '../../data/techTree';
import { ACTION_COSTS, FUND_SCHOLARS_TECHPOINTS } from '../../data/actionCosts';
import { getNationCapital } from '../../data/regions';
import { getAgesBehind, getAgesBehindResearchCostMultiplier } from '../../data/ages';
import { canAfford } from '../../utils/helpers';
import { FOCUS_SCIENCE_BONUS } from '../../engine/research';
import { ActionButton, CollapsibleSection } from '../ui';
import { describeTech, formatTurns, getResearchView, getSciencePerTurn, techInfo } from './researchView';

export const CATEGORY_LABELS = {
  [TechCategories.MILITARY]: 'Military',
  [TechCategories.ECONOMY]: 'Economy',
  [TechCategories.INFRASTRUCTURE]: 'Infrastructure',
  [TechCategories.GOVERNANCE]: 'Governance',
  [TechCategories.SCIENCE]: 'Science'
};

const ProgressBar = ({ share }) => (
  <div className="h-2 rounded-full bg-slate-900 overflow-hidden"><div className="h-full rounded-full bg-purple-500" style={{ width: `${Math.round(share * 100)}%` }} /></div>
);

const TechRow = ({ info, onResearch, onQueue }) => {
  const { tech, researched, current, queuedAt, canStart, reason, cost, turns, share, diffusion, boost, mapEffect } = info;
  const status = researched ? 'Researched' : current ? `Researching · ${formatTurns(turns)}` : queuedAt >= 0 ? `Queued #${queuedAt + 2}` : canStart ? `${cost} science · ${formatTurns(turns)}` : reason;
  const diffusionNote = !diffusion || researched ? '' : diffusion.pioneer ? ' · first in the world: +20% cost'
    : diffusion.neighborsWithIt ? ` · ${diffusion.neighborsWithIt} neighbour${diffusion.neighborsWithIt > 1 ? 's know' : ' knows'} it: -${Math.round((1 - diffusion.mult) * 100)}%` : '';
  const Icon = researched ? Check : current ? Sparkles : canStart || queuedAt >= 0 ? BookOpen : Lock;
  return (
    <div className={`rounded-lg border px-2.5 py-2 space-y-1 ${current ? 'border-purple-500/70 bg-purple-500/10' : researched ? 'border-emerald-700/40 bg-emerald-900/10' : 'border-slate-700 bg-slate-800/40'}`} data-testid={`tech-${tech.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100"><Icon className={`w-3.5 h-3.5 shrink-0 ${researched ? 'text-emerald-400' : current ? 'text-purple-300' : 'text-slate-400'}`} /><span className="truncate">{tech.name}</span></div>
          <div className="text-[11px] text-slate-400">{status}{diffusionNote}</div>
        </div>
        {!researched && !current && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onResearch(tech.id)} className="px-2 min-h-[32px] rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold">Research</button>
            {queuedAt < 0 && <button onClick={() => onQueue(tech.id)} aria-label={`Queue ${tech.name}`} title="Add to the queue" className="px-1.5 min-h-[32px] rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200"><ListPlus className="w-4 h-4" /></button>}
          </div>
        )}
      </div>
      <div className="text-[11px] text-slate-500">{describeTech(tech)}</div>
      {mapEffect && <div className="text-[10px] text-sky-300" data-testid="tech-map-effect">Map: {mapEffect}</div>}
      {boost && <div className={`text-[10px] ${boost.taken ? 'text-emerald-400' : boost.met ? 'text-amber-300' : 'text-slate-500'}`} data-testid="tech-boost">Boost: {boost.label}{boost.taken ? ' (taken)' : boost.met ? ' (met, lands next turn)' : ''}</div>}
      {current && <ProgressBar share={share} />}
    </div>
  );
};

const TechPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const categories = getTechsByCategory();
  const view = getResearchView(state);
  const science = getSciencePerTurn(state);
  const agesBehind = getAgesBehind(state.age, state.techAgeId);
  const agesBehindMult = getAgesBehindResearchCostMultiplier(agesBehind);

  const research = (techId) => {
    triggerEffect('research_tech', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.RESEARCH_TECH, payload: { techId } });
  };
  const queue = (techId) => dispatch({ type: ActionTypes.QUEUE_RESEARCH, payload: { techId } });
  const unqueue = (techId) => dispatch({ type: ActionTypes.UNQUEUE_RESEARCH, payload: { techId } });
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
  // The line of the tech being researched starts open, else the focused one, else the first.
  const openCategory = view.current?.tech.category || state.researchFocus || TechCategories.MILITARY;

  return (
    <div className="space-y-3" data-testid="research-tab">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white font-bold text-lg"><Beaker size={20} className="text-purple-400" /> Research</div>
        <div className="text-right">
          <div className="text-sm font-bold text-purple-300 font-mono">+{science} science/turn</div>
          {view.bank > 0 && <div className="text-[10px] text-slate-400">{view.bank} banked</div>}
        </div>
      </div>

      {/* What's being researched now, and what follows. */}
      <div className="rounded-lg border border-purple-500/40 bg-purple-500/5 p-3 space-y-2" data-testid="research-current">
        {view.current ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-purple-300">Researching</div>
                <div className="font-bold text-white truncate">{view.current.tech.name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-white">{formatTurns(view.current.finishesIn)}</div>
                <div className="text-[10px] text-slate-400 font-mono">{Math.floor(view.current.progress)} / {view.current.cost}</div>
              </div>
            </div>
            <ProgressBar share={view.current.share} />
            <div className="text-[11px] text-slate-400">{describeTech(view.current.tech)}</div>
            {!view.current.canStart && <div className="text-[11px] text-amber-300">{view.current.reason}: science banks until then.</div>}
          </>
        ) : (
          <div className="text-[12px] text-amber-200">Nothing is being researched{view.bank > 0 ? `: ${view.bank} science is waiting` : ''}. Pick a tech below, or let your advisor choose.</div>
        )}
        {view.queue.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="research-queue">
            {view.queue.map((q, i) => (
              <span key={q.tech.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-200">
                {i + 2}. {q.tech.name} <span className="text-slate-500">· {q.finishesIn}t</span>
                <button onClick={() => unqueue(q.tech.id)} aria-label={`Remove ${q.tech.name} from the queue`} className="p-0.5 rounded-full hover:bg-slate-700 text-slate-400"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <label className="flex items-center justify-between gap-2 text-[12px] text-slate-200 min-h-[36px]">
          <span>Let my advisor pick the next tech when the queue runs out</span>
          <input type="checkbox" className="w-5 h-5" checked={view.auto} onChange={(e) => dispatch({ type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: e.target.checked } })} data-testid="research-auto" />
        </label>
      </div>

      {agesBehind > 0 && (
        <div className="text-[11px] text-amber-400 rounded-lg border border-amber-700/40 p-2">
          {agesBehind} age{agesBehind === 1 ? '' : 's'} behind the calendar: research costs +{Math.round((agesBehindMult - 1) * 100)}%, and your units fight at a disadvantage against anyone more advanced.
        </div>
      )}

      <ActionButton
        icon={GraduationCap}
        label="Fund Scholars"
        description="Turn gold into science, paid into your research at the end of the turn"
        costs={ACTION_COSTS.fundScholars}
        effects={{ custom: `+${FUND_SCHOLARS_TECHPOINTS} science` }}
        onClick={handleFundScholars}
        disabled={!canAfford(state.resources, ACTION_COSTS.fundScholars)}
        size="small"
      />

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-slate-300">Research Focus <span className="font-normal text-slate-500">(+{Math.round(FOCUS_SCIENCE_BONUS * 100)}% science for that line)</span></div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(TechCategories).map((categoryId) => (
            <button
              key={categoryId}
              onClick={() => handleFocus(categoryId)}
              disabled={state.researchFocus === categoryId || !canAfford(state.resources, ACTION_COSTS.setResearchFocus)}
              className={`px-2 py-1.5 rounded text-xs border ${state.researchFocus === categoryId ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {CATEGORY_LABELS[categoryId]}
            </button>
          ))}
        </div>
      </div>

      {Object.values(TechCategories).map((categoryId) => {
        const techs = categories[categoryId]?.techs || [];
        const researchedCount = techs.filter((t) => state.techTree[t.id]?.researched).length;
        return (
          <CollapsibleSection key={categoryId} title={CATEGORY_LABELS[categoryId]} defaultOpen={categoryId === openCategory} summary={`${researchedCount}/${techs.length} researched`}>
            <div className="space-y-1.5">
              {techs.map((tech) => <TechRow key={tech.id} info={techInfo(state, tech.id, science)} onResearch={research} onQueue={queue} />)}
            </div>
          </CollapsibleSection>
        );
      })}
    </div>
  );
};

export default TechPanel;
