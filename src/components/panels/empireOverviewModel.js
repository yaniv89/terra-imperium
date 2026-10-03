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
import { TECH_TREE } from '../../data/techTree';

const EXPENSE_LABELS = { armyUpkeep: 'Army upkeep', marchingUpkeep: 'Armies on the march', navyUpkeep: 'Navy upkeep', fortUpkeep: 'Fort upkeep', advisorSalaries: 'Advisors', loanInterest: 'Loan interest' };
const INCOME_LABELS = { gold: 'Gold', techPoints: 'Science', hr: 'Manpower', adm: 'Administrative', dip: 'Diplomatic', mil: 'Military', supplies: 'Supplies' };
const titleCase = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

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
  const wars = Object.values(state.nations).filter((n) => !n.isPlayer && isAtWarWithPlayer(state, n.id)).map((n) => n.name);
  const research = getResearchView(state);
  return {
    name: nation.name,
    authority: { total: authority.total, parts: authority.parts, tone: authority.total < AUTHORITY_CIVIL_WAR ? 'red' : authority.total < AUTHORITY_NO_LAWS ? 'amber' : 'green', note: authority.total < AUTHORITY_CIVIL_WAR ? 'Civil war looms.' : authority.total < AUTHORITY_NO_LAWS ? 'Too low for new laws; the estates demand.' : null },
    era: { ageName: AGES[era.ageId]?.name || era.ageId, met: era.met, needed: era.needed, goals: era.goals.map((g) => ({ id: g.id, label: g.label, value: g.value, target: g.target, unit: g.unit, done: g.done })) },
    treasury: {
      gold: Math.round(state.resources?.gold || 0),
      income: Math.round(income.gold || 0),
      upkeep: Math.round(Object.values(expenses).reduce((s, v) => s + v, 0)),
      net: Math.round(net),
      expenseLines: Object.entries(expenses).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, label: EXPENSE_LABELS[k] || titleCase(k), value: Math.round(v) })),
      yieldLines: Object.entries(INCOME_LABELS).filter(([k]) => (yields[k] || 0) !== 0 && k !== 'gold').map(([k, label]) => ({ id: k, label, value: Math.round((yields[k] || 0) * 10) / 10 }))
    },
    cities: mine.length,
    people,
    wars,
    research: research.current ? { name: TECH_TREE[research.current.id]?.name || research.current.id, turns: research.current.finishesIn, science: research.science } : { name: null, turns: 0, science: research.science }
  };
};
