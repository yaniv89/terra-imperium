// src/components/ui/topBarModel.js
// The one world top bar (plans/UI-DESIGN.md section 2, SPEC-REVISION rule 2): nation, gold, food,
// science with the current tech and its turns, culture, the player's age and year label, turn, and a war pill when at war.
// Every number carries its reasons (the popover lines a tap opens). Pure.
import { calcNationBalance } from '../../engine/economy';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { getResearchView } from '../panels/researchView';
import { PEOPLES } from '../../data/peoples';
import { t as tNow, formatYear } from '../../i18n';
import { nameNow } from '../../i18n/names';
import { techName } from '../../i18n/gameText';
import { ageProgress } from './ageProgress';
import { shortAge } from '../panels/researchSheetModel';
import { decreesOf, decreeCap } from '../../engine/decrees';
import { DECREE_ACTS, DECREE_TRICKLE_BELOW } from '../../data/decrees';

export const EXPENSE_IDS = ['armyUpkeep', 'marchingUpkeep', 'navyUpkeep', 'fortUpkeep', 'buildingUpkeep', 'advisorSalaries', 'loanInterest'];
/** The expense line's name in the current language (an unknown id is spelled out from its camel case). */
export const expenseLabel = (id) => (EXPENSE_IDS.includes(id) ? tNow(`expense.${id}`) : titleCase(id));
const round1 = (v) => Math.round((v || 0) * 10) / 10;
const titleCase = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export const yearLabel = (year) => formatYear(year);

/** "Bronze Working 3t" style, short enough for the bar. */
export const scienceLabel = (current, status = null) => {
  if (!current) return status && !status.needsChoice ? status.shortLabel : tNow('chip.research');
  if (current.gate) return tNow('research.shortWaits', { name: techName(current.tech.id, current.tech.name), gate: current.gate.label });
  const t = current.finishesIn === Infinity ? '?' : current.finishesIn;
  return tNow('research.shortTurns', { name: techName(current.tech.id, current.tech.name), n: t });
};

/** The ruler's decrees: banked, the cap, why each recent one came or went (newest first), and what the acts cost. */
export const decreeView = (nation) => {
  const costs = {};
  Object.entries(DECREE_ACTS).forEach(([id, a]) => { (costs[a.decrees] ||= []).push(tNow(`decree.act.${id}`)); });
  return {
    value: decreesOf(nation),
    cap: decreeCap(nation),
    below: DECREE_TRICKLE_BELOW,
    reasons: (nation.ruler?.decreeLog || []).map((e, i) => ({
      id: `${e.turn}-${i}`,
      label: `${tNow(e.deed ? `decree.deed.${e.deed}` : `decree.act.${e.act}`)}${e.detail ? `: ${e.detail}` : ''}`,
      value: e.n
    })),
    costs: Object.entries(costs).sort(([a], [b]) => b - a).map(([n, labels]) => ({ n: Number(n), labels }))
  };
};

export const topBarModel = (state) => {
  const me = state.playerNationId;
  const nation = state.nations?.[me] || {};
  const cities = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null)
    .sort((a, b) => (b.size || 0) - (a.size || 0) || (a.name < b.name ? -1 : 1));
  const { income, expenses, net } = calcNationBalance(state, me);
  const research = getResearchView(state);
  const age = ageProgress(state, me);
  const foodPerTurn = round1(cities.reduce((s, c) => s + (c.lastYields?.food || 0), 0));
  const cultureRows = cities.map((c) => ({ id: c.id, label: nameNow('city', null, c.name), value: round1(c.lastYields?.culture || 0) })).filter((r) => r.value !== 0);
  const wars = Object.values(state.nations || {}).filter((n) => !n.isPlayer && n.id !== me && isAtWarWithPlayer(state, n.id)).map((n) => ({ id: n.id, name: nameNow('people', n.id, PEOPLES[n.id]?.name || n.name) }));
  return {
    // the short people name in the bar ("Akkad"), the title ("The Akkadian tribes") in its label
    nation: { id: me, name: nameNow('people', me, PEOPLES[me]?.name || nation.name || me), title: nameNow('people', me, nation.name || me), color: nation.color || '#5B9BF0' },
    gold: {
      value: Math.round(state.resources?.gold || 0),
      perTurn: Math.round(net),
      reasons: [
        { id: 'income', label: tNow('topbar.income'), value: Math.round(income.gold || 0) },
        ...Object.entries(expenses).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, label: expenseLabel(k), value: -Math.round(v) }))
      ]
    },
    food: {
      value: Math.round(cities.reduce((s, c) => s + (c.food || 0), 0)),
      perTurn: foodPerTurn,
      reasons: cities.map((c) => ({ id: c.id, label: nameNow('city', null, c.name), value: round1(c.lastYields?.food || 0) }))
    },
    science: {
      perTurn: research.science,
      current: research.current ? { name: techName(research.current.tech.id, research.current.tech.name), turns: research.current.finishesIn, gate: research.current.gate } : null,
      status: research.status,
      label: scienceLabel(research.current, research.status),
      bank: research.bank
    },
    decrees: decreeView(nation),
    culture: {
      perTurn: round1(cities.reduce((s, c) => s + (c.lastYields?.culture || 0), 0)),
      reasons: cultureRows
    },
    // the player's own age and how many more techs bring the next (never a world age)
    age: { id: age.ageId, name: shortAge(age.ageId), nextName: age.nextAgeId ? shortAge(age.nextAgeId) : null, techsLeft: age.techsLeft },
    year: yearLabel(state.year),
    turn: state.turnNumber || 0,
    wars,
    warLabel: wars.length === 0 ? null : wars.length === 1 ? tNow('topbar.atWar', { name: wars[0].name }) : tNow('topbar.atWar', { name: wars.length })
  };
};
