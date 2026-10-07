// src/components/ui/topBarModel.js
// The one world top bar (plans/UI-DESIGN.md section 2, SPEC-REVISION rule 2): nation, gold, food,
// science with the current tech and its turns, culture, year, turn, and a war pill when at war.
// Every number carries its reasons (the popover lines a tap opens). Pure.
import { calcNationBalance } from '../../engine/economy';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { getResearchView } from '../panels/researchView';
import { PEOPLES } from '../../data/peoples';

const EXPENSE_LABELS = { armyUpkeep: 'Army upkeep', marchingUpkeep: 'Armies on the march', navyUpkeep: 'Navy upkeep', fortUpkeep: 'Fort upkeep', advisorSalaries: 'Advisors', loanInterest: 'Loan interest' };
const round1 = (v) => Math.round((v || 0) * 10) / 10;
const titleCase = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export const yearLabel = (year) => (year < 0 ? `${-year} BCE` : `${year} CE`);

/** "Bronze Working 3t" style, short enough for the bar. */
export const scienceLabel = (current) => {
  if (!current) return 'Choose research';
  const t = current.finishesIn === Infinity ? '?' : current.finishesIn;
  return `${current.tech.name} ${t}t`;
};

export const topBarModel = (state) => {
  const me = state.playerNationId;
  const nation = state.nations?.[me] || {};
  const cities = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null)
    .sort((a, b) => (b.size || 0) - (a.size || 0) || (a.name < b.name ? -1 : 1));
  const { income, expenses, net } = calcNationBalance(state, me);
  const research = getResearchView(state);
  const foodPerTurn = round1(cities.reduce((s, c) => s + (c.lastYields?.food || 0), 0));
  const cultureRows = cities.map((c) => ({ id: c.id, label: c.name, value: round1(c.lastYields?.culture || 0) })).filter((r) => r.value !== 0);
  const wars = Object.values(state.nations || {}).filter((n) => !n.isPlayer && n.id !== me && isAtWarWithPlayer(state, n.id)).map((n) => ({ id: n.id, name: PEOPLES[n.id]?.name || n.name }));
  return {
    // the short people name in the bar ("Akkad"), the title ("The Akkadian tribes") in its label
    nation: { id: me, name: PEOPLES[me]?.name || nation.name || me, title: nation.name || me, color: nation.color || '#5B9BF0' },
    gold: {
      value: Math.round(state.resources?.gold || 0),
      perTurn: Math.round(net),
      reasons: [
        { id: 'income', label: 'Income', value: Math.round(income.gold || 0) },
        ...Object.entries(expenses).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, label: EXPENSE_LABELS[k] || titleCase(k), value: -Math.round(v) }))
      ]
    },
    food: {
      value: Math.round(cities.reduce((s, c) => s + (c.food || 0), 0)),
      perTurn: foodPerTurn,
      reasons: cities.map((c) => ({ id: c.id, label: c.name, value: round1(c.lastYields?.food || 0) }))
    },
    science: {
      perTurn: research.science,
      current: research.current ? { name: research.current.tech.name, turns: research.current.finishesIn } : null,
      label: scienceLabel(research.current),
      bank: research.bank
    },
    culture: {
      perTurn: round1(cities.reduce((s, c) => s + (c.lastYields?.culture || 0), 0)),
      reasons: cultureRows
    },
    year: yearLabel(state.year),
    turn: state.turnNumber || 0,
    wars,
    warLabel: wars.length === 0 ? null : wars.length === 1 ? `At war: ${wars[0].name}` : `At war: ${wars.length}`
  };
};
