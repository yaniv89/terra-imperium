// src/components/panels/empireOverviewModel.js
// The empire sheet's overview (plans/civ-map-rework.md E4): the nation at a glance, as a pure
// model the panel renders and the tests check. Authority with its parts, the era goals strip,
// the treasury with its income and upkeep lines, cities and people, wars, the current research.
import { AGES } from '../../data/ages';
import { authorityOf, AUTHORITY_NO_LAWS, AUTHORITY_CIVIL_WAR } from '../../engine/authority';
import { eraGoalProgress } from '../../engine/eraGoals';
import { calcNationBalance } from '../../engine/economy';
import { calcIncome } from '../../utils/helpers';
import { sizeToPeople } from '../../engine/world/cities';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { getResearchView } from './researchView';
import { expenseLabel } from '../ui/topBarModel';
import { t as tNow } from '../../i18n';
import { nameNow } from '../../i18n/names';
import { techName, playstyleName, goalUnit } from '../../i18n/gameText';
import { authorityPartLabel } from './empireText';

const INCOME_IDS = ['gold', 'techPoints', 'hr', 'adm', 'dip', 'mil', 'supplies'];

export const empireOverviewModel = (state) => {
  const me = state.playerNationId;
  const nation = state.nations?.[me];
  if (!nation) return null;
  const authority = authorityOf(state, me);
  const era = eraGoalProgress(state);
  const { income, expenses, net } = calcNationBalance(state, me);
  const yields = calcIncome(state);
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me);
  const people = mine.reduce((s, c) => s + sizeToPeople(c.size || 1), 0);
  const wars = Object.values(state.nations).filter((n) => !n.isPlayer && isAtWarWithPlayer(state, n.id)).map((n) => nameNow('people', n.id, n.name));
  const research = getResearchView(state);
  return {
    name: nation.name,
    authority: { total: authority.total, parts: authority.parts.map((p) => ({ ...p, label: authorityPartLabel(p, nation) })), tone: authority.total < AUTHORITY_CIVIL_WAR ? 'red' : authority.total < AUTHORITY_NO_LAWS ? 'amber' : 'green', note: authority.total < AUTHORITY_CIVIL_WAR ? tNow('empire.civilWar') : authority.total < AUTHORITY_NO_LAWS ? tNow('empire.tooLow') : null },
    era: { ageId: era.ageId, ageName: AGES[era.ageId]?.name || era.ageId, met: era.met, needed: era.needed, goals: era.goals.map((g) => ({ id: g.id, label: playstyleName(g.id, g.label), value: g.value, target: g.target, unit: goalUnit(g.id, g.unit), done: g.done })) },
    treasury: {
      gold: Math.round(state.resources?.gold || 0),
      income: Math.round(income.gold || 0),
      upkeep: Math.round(Object.values(expenses).reduce((s, v) => s + v, 0)),
      net: Math.round(net),
      expenseLines: Object.entries(expenses).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, label: expenseLabel(k), value: Math.round(v) })),
      yieldLines: INCOME_IDS.filter((k) => (yields[k] || 0) !== 0 && k !== 'gold').map((k) => ({ id: k, label: tNow(`empire.income.${k}`), value: Math.round((yields[k] || 0) * 10) / 10 }))
    },
    cities: mine.length,
    people,
    wars,
    research: research.current ? { name: techName(research.current.tech.id, research.current.tech.name), turns: research.current.finishesIn, gate: research.current.gate, science: research.science, note: research.status.note } : { name: null, turns: 0, gate: null, science: research.science, note: research.status.note }
  };
};
