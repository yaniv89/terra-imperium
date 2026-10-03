// src/components/panels/EmpireOverview.jsx
// The top of the empire sheet (plans/civ-map-rework.md E4): authority with its parts, the era
// goals strip, the treasury with its lines, cities and people, wars and the current research.
// Numbers come from empireOverviewModel.js; this only draws them. Phone first: stacked cards.
import React, { useMemo } from 'react';
import { Crown, Target, Coins, Swords, Beaker } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { empireOverviewModel } from './empireOverviewModel';
import { formatNumber } from '../../utils/helpers';
import { formatTurns } from './researchView';

const TONE = { red: 'text-red-400', amber: 'text-amber-300', green: 'text-emerald-300' };
const signed = (v) => `${v > 0 ? '+' : ''}${v}`;

const EmpireOverview = () => {
  const { state } = useGame();
  const m = useMemo(() => empireOverviewModel(state), [state]);
  if (!m) return null;
  return (
    <div className="space-y-2" data-testid="empire-overview">
      <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1" data-testid="empire-authority">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-slate-200 font-semibold"><Crown className="w-3.5 h-3.5" />Authority</span><span className={`font-mono font-bold ${TONE[m.authority.tone]}`}>{m.authority.total}</span></div>
        <div className="text-slate-400">{m.authority.parts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')}</div>
        {m.authority.note && <div className={TONE[m.authority.tone]}>{m.authority.note}</div>}
        <div className="text-slate-500">{m.cities} cit{m.cities === 1 ? 'y' : 'ies'} · {formatNumber(m.people)} people{m.wars.length ? ` · at war with ${m.wars.join(', ')}` : ' · at peace'}</div>
      </div>
      <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1" data-testid="empire-era">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-slate-200 font-semibold"><Target className="w-3.5 h-3.5" />{m.era.ageName} goals</span><span className="text-slate-400">{m.era.met}/{m.era.needed} for a legacy</span></div>
        <div className="flex flex-wrap gap-1">
          {m.era.goals.map((g) => <span key={g.id} className={`rounded px-1.5 py-0.5 ${g.done ? 'bg-emerald-800/50 text-emerald-200' : 'bg-slate-700/60 text-slate-300'}`} title={`${g.label}: ${g.value} of ${g.target} ${g.unit}`}>{g.label} {g.value}/{g.target}</span>)}
        </div>
      </div>
      <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1" data-testid="empire-treasury">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-slate-200 font-semibold"><Coins className="w-3.5 h-3.5" />Treasury {formatNumber(m.treasury.gold)}g</span><span className={`font-mono font-semibold ${m.treasury.net >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>{signed(m.treasury.net)}g a turn</span></div>
        <div className="flex justify-between text-slate-300"><span>Income</span><span>+{formatNumber(m.treasury.income)}g</span></div>
        {m.treasury.expenseLines.map((l) => <div key={l.id} className="flex justify-between text-slate-400"><span>{l.label}</span><span>-{formatNumber(l.value)}g</span></div>)}
        {m.treasury.yieldLines.length > 0 && <div className="text-slate-500">{m.treasury.yieldLines.map((l) => `${l.label} ${signed(l.value)}`).join(' · ')}</div>}
      </div>
      <div className="bg-slate-800/60 rounded-lg p-2 text-xs flex items-center justify-between gap-2" data-testid="empire-research">
        <span className="flex items-center gap-1.5 text-slate-200 font-semibold"><Beaker className="w-3.5 h-3.5" />{m.research.name ? `Researching ${m.research.name}` : 'Nothing being researched'}</span>
        <span className="text-slate-400 shrink-0">{m.research.name ? formatTurns(m.research.turns) : `${m.research.science} science a turn`}</span>
      </div>
      {m.wars.length > 0 && <div className="text-[11px] text-red-300 flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" />Wars: {m.wars.join(', ')}</div>}
    </div>
  );
};

export default EmpireOverview;
