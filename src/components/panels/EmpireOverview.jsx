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
import { gateText } from '../../engine/researchStatus';
import { useT } from '../../i18n/useT';
import { ageName } from '../../i18n';

const TONE = { red: 'text-fa-danger-text', amber: 'text-amber-300', green: 'text-fa-good' };
const signed = (v) => `${v > 0 ? '+' : ''}${v}`;

const EmpireOverview = () => {
  const { state } = useGame();
  const { t, lang } = useT();
  // The model reads the current language through t(): recompute when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => empireOverviewModel(state), [state, lang]);
  if (!m) return null;
  return (
    <div className="space-y-2" data-testid="empire-overview">
      <div className="bg-fa-raised/60 rounded-lg p-2 text-xs space-y-1" data-testid="empire-authority">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-fa-text font-semibold"><Crown className="w-3.5 h-3.5" />{t('empire.authority')}</span><span className={`font-mono font-bold ${TONE[m.authority.tone]}`}>{m.authority.total}</span></div>
        <div className="text-fa-muted">{m.authority.parts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')}</div>
        {m.authority.note && <div className={TONE[m.authority.tone]}>{m.authority.note}</div>}
        <div className="text-fa-muted">{t('empire.cities', { count: m.cities })} · {t('empire.people', { n: formatNumber(m.people) })}{m.wars.length ? t('empire.atWarWith', { names: m.wars.join(t('chip.listSep')) }) : t('empire.atPeace')}</div>
      </div>
      <div className="bg-fa-raised/60 rounded-lg p-2 text-xs space-y-1" data-testid="empire-era">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-fa-text font-semibold"><Target className="w-3.5 h-3.5" />{t('empire.ageGoals', { age: ageName(m.era.ageId, m.era.ageName) })}</span><span className="text-fa-muted">{t('empire.forLegacy', { met: m.era.met, needed: m.era.needed })}</span></div>
        <div className="flex flex-wrap gap-1">
          {m.era.goals.map((g) => <span key={g.id} className={`rounded px-1.5 py-0.5 ${g.done ? 'bg-emerald-800/50 text-emerald-200' : 'bg-fa-hover/60 text-fa-text'}`} title={t('p1.eo.goalTip', { label: g.label, value: g.value, target: g.target, unit: g.unit })}>{g.label} {g.value}/{g.target}</span>)}
        </div>
      </div>
      <div className="bg-fa-raised/60 rounded-lg p-2 text-xs space-y-1" data-testid="empire-treasury">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-fa-text font-semibold"><Coins className="w-3.5 h-3.5" />{t('empire.treasury', { n: formatNumber(m.treasury.gold) })}</span><span className={`font-mono font-semibold ${m.treasury.net >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{t('empire.perTurn', { n: signed(m.treasury.net) })}</span></div>
        <div className="flex justify-between text-fa-text"><span>{t('topbar.income')}</span><span>+{formatNumber(m.treasury.income)}{t('empire.g')}</span></div>
        {m.treasury.expenseLines.map((l) => <div key={l.id} className="flex justify-between text-fa-muted"><span>{l.label}</span><span>-{formatNumber(l.value)}{t('empire.g')}</span></div>)}
        {m.treasury.yieldLines.length > 0 && <div className="text-fa-muted">{m.treasury.yieldLines.map((l) => `${l.label} ${signed(l.value)}`).join(' · ')}</div>}
      </div>
      <div className="bg-fa-raised/60 rounded-lg p-2 text-xs flex items-center justify-between gap-2" data-testid="empire-research">
        <span className="flex items-center gap-1.5 text-fa-text font-semibold"><Beaker className="w-3.5 h-3.5" />{m.research.name ? t('empire.researching', { name: m.research.name }) : t('empire.noResearch')}</span>
        <span className="text-fa-muted shrink-0">{m.research.name ? (m.research.gate ? gateText(m.research.gate) : formatTurns(m.research.turns)) : m.research.note}</span>
      </div>
      {m.wars.length > 0 && <div className="text-[11px] text-fa-danger-text flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" />{t('empire.wars', { names: m.wars.join(t('chip.listSep')) })}</div>}
    </div>
  );
};

export default EmpireOverview;
