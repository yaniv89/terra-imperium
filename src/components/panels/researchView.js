// src/components/panels/researchView.js
// What the research UI shows (the Research tab, the choice sheet, the top bar pill), worked out
// once from the state: science per turn, the current tech with its progress and turns left, the
// queue with when each would finish, and a tech's effect in plain words. Pure.
import { TECH_TREE } from '../../data/techTree';
import { AGES, AGE_ORDER } from '../../data/ages';
import { calcIncome } from '../../utils/helpers';
import { canStartTech, getResearchCost, FOCUS_SCIENCE_BONUS } from '../../engine/research';
import { getTechDiffusion } from '../../engine/techDiffusion';

const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const EFFECT_WORDS = {
  goldMult: (v) => `${pct(v)} gold`,
  hrMult: (v) => `${pct(v)} manpower`,
  techPointsMult: (v) => `${pct(v)} science`,
  researchCost: (v) => `${pct(v)} research cost`,
  developmentCost: (v) => `${pct(v)} development cost`,
  stabilityCost: (v) => `${pct(v)} stability cost`,
  attrition: (v) => `${pct(v)} attrition`,
  admBonus: (v) => `+${v} ADM a turn`,
  dipBonus: (v) => `+${v} DIP a turn`,
  milBonus: (v) => `+${v} MIL a turn`,
  supplyRange: (v) => `+${v} supply range`,
  popGrowthBonus: () => 'faster population growth',
  stabilityBonus: (v) => (v > 0 ? `+${v} stability` : 'more unrest everywhere')
};

// "+25% gold" style phrases for a tech's effects; every tech also counts toward the next age.
export const describeTech = (tech) => {
  const parts = Object.entries(tech?.effects || {}).map(([k, v]) => (EFFECT_WORDS[k] ? EFFECT_WORDS[k](v) : null)).filter(Boolean);
  const nextAge = AGES[AGE_ORDER[AGE_ORDER.indexOf(tech?.ageId) + 1]]?.name;
  if (nextAge) parts.push(`counts toward the ${nextAge}`);
  return parts.join(', ');
};

export const getSciencePerTurn = (state) => Math.round((calcIncome(state).techPoints || 0) * 10) / 10;

export const researchedSet = (state) => new Set(Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched));

// Everything the panel needs about one tech.
export const techInfo = (state, techId, science = getSciencePerTurn(state)) => {
  const tech = TECH_TREE[techId];
  const research = state.research || {};
  const researched = researchedSet(state);
  const cost = getResearchCost(state, state.playerNationId, techId);
  const progress = research.progress?.[techId] || 0;
  const rate = science * (state.researchFocus === tech.category ? 1 + FOCUS_SCIENCE_BONUS : 1);
  const remaining = Math.max(0, cost - progress);
  const start = canStartTech(techId, researched, state.year);
  const diffusion = researched.has(techId) ? null : getTechDiffusion(state, state.playerNationId, techId);
  return {
    tech,
    cost,
    progress,
    share: cost > 0 ? Math.min(1, progress / cost) : 0,
    turns: rate > 0 ? Math.max(1, Math.ceil(remaining / rate)) : Infinity,
    researched: researched.has(techId),
    current: research.current === techId,
    queuedAt: (research.queue || []).indexOf(techId),
    canStart: start.ok,
    reason: start.reason,
    diffusion
  };
};

// The current tech and the queue, each with the turn it would finish (cumulative).
export const getResearchView = (state) => {
  const science = getSciencePerTurn(state);
  const research = state.research || {};
  const order = [research.current, ...(research.queue || [])].filter(Boolean);
  let turnsSoFar = 0; let carry = state.resources?.techPoints || 0;
  const items = order.map((id) => {
    const info = techInfo(state, id, science);
    const remaining = Math.max(0, info.cost - info.progress - carry);
    carry = Math.max(0, carry - (info.cost - info.progress));
    const turns = remaining <= 0 ? 0 : science > 0 ? Math.ceil(remaining / science) : Infinity;
    turnsSoFar += turns;
    return { ...info, finishesIn: Math.max(1, turnsSoFar) };
  });
  return { science, bank: Math.round(state.resources?.techPoints || 0), current: items[0] || null, queue: items.slice(1), auto: !!research.auto };
};

export const formatTurns = (n) => (n === Infinity ? 'no science' : `${n} turn${n === 1 ? '' : 's'}`);
