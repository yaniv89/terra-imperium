// src/components/panels/researchView.js
// What the research UI shows (the Research tab, the choice sheet, the top bar pill), worked out
// once from the state: science per turn, the current tech with its progress and turns left, the
// queue with when each would finish, and a tech's effect in plain words. Pure.
import { boostOf } from '../../engine/boosts';
import { TechCategories } from '../../data/types';
import { TECH_TREE } from '../../data/techTree';
import { AGES, AGE_ORDER } from '../../data/ages';
import { calcIncome } from '../../utils/helpers';
import { canStartTech, getResearchCost, FOCUS_SCIENCE_BONUS } from '../../engine/research';
import { getTechDiffusion } from '../../engine/techDiffusion';
import { mapEffectLabel } from '../../engine/techMapEffects';

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
  const boost = researched.has(techId) ? null : boostOf(state, state.playerNationId, techId);
  return {
    tech,
    boost,
    mapEffect: mapEffectLabel(techId),
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

// The research web (plan C3.1): one column per step of a line (two per age), one row per line,
// every prerequisite an edge. Pure; TechPanel draws it as an SVG.
export const GRAPH_COL_W = 150;
export const GRAPH_ROW_H = 64;
export const GRAPH_NODE_W = 132;
export const GRAPH_NODE_H = 44;
export const techGraph = (state) => {
  const lines = Object.values(TechCategories);
  const science = getSciencePerTurn(state);
  const nodes = [];
  const byId = new Map();
  lines.forEach((category, row) => {
    Object.values(TECH_TREE).filter((t) => t.category === category).sort((a, b) => a.yearAvailable - b.yearAvailable).forEach((tech, col) => {
      const info = techInfo(state, tech.id, science);
      const node = { id: tech.id, name: tech.name, category, row, col, ageId: tech.ageId, x: col * GRAPH_COL_W, y: row * GRAPH_ROW_H, status: info.researched ? 'researched' : info.current ? 'current' : info.queuedAt >= 0 ? 'queued' : info.canStart ? 'available' : 'locked', turns: info.turns, cost: info.cost, reason: info.reason };
      nodes.push(node); byId.set(tech.id, node);
    });
  });
  const edges = [];
  // A prerequisite in the same column (same year, another line) is drawn vertically between the
  // node edges; every other one runs from the right edge of the prerequisite to the left edge.
  nodes.forEach((n) => (TECH_TREE[n.id].prerequisites || []).forEach((p) => {
    const from = byId.get(p);
    if (!from) return;
    const edge = { from: from.id, to: n.id, cross: from.row !== n.row };
    if (from.col === n.col) {
      const down = n.row > from.row;
      Object.assign(edge, { x1: from.x + GRAPH_NODE_W / 2, y1: from.y + (down ? GRAPH_NODE_H : 0), x2: n.x + GRAPH_NODE_W / 2, y2: n.y + (down ? 0 : GRAPH_NODE_H) });
    } else Object.assign(edge, { x1: from.x + GRAPH_NODE_W, y1: from.y + GRAPH_NODE_H / 2, x2: n.x, y2: n.y + GRAPH_NODE_H / 2 });
    edges.push(edge);
  }));
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  const ages = AGE_ORDER.map((ageId, i) => ({ ageId, name: AGES[ageId]?.name || ageId, x: i * 2 * GRAPH_COL_W, width: 2 * GRAPH_COL_W }));
  return { nodes, edges, width: cols * GRAPH_COL_W, height: lines.length * GRAPH_ROW_H, ages, rows: lines };
};
