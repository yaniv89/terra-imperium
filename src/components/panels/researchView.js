// src/components/panels/researchView.js
// What the research UI shows (the Research tab, the choice sheet, the top bar pill), worked out
// once from the state: science per turn, the current tech with its progress and turns left, the
// queue with when each would finish, and a tech's effect in plain words. Pure.
import { boostOf } from '../../engine/boosts';
import { TechCategories } from '../../data/types';
import { TECH_TREE } from '../../data/techTree';
import { AGES, AGE_ORDER } from '../../data/ages';
import { calcIncome } from '../../utils/helpers';
import { canStartTech, getResearchCost, getResearchPath, recommendTechs, FOCUS_SCIENCE_BONUS, inResearchWindow, ageDoneFor } from '../../engine/research';
import { BOOST_SHARE } from '../../data/boosts';
import { LAW_CATEGORIES } from '../../data/laws';
import { ageOf, futureTechsOf } from '../../engine/nationState';
import { getTechDiffusion } from '../../engine/techDiffusion';
import { researchSchedule, researchStatus, techGate, gateText } from '../../engine/researchStatus';
import { t as tNow, isolateLtr } from '../../i18n';
import { ageName } from '../../i18n/core';
import { mapEffectLabel } from '../../engine/techMapEffects';
import { techName, unitName, buildingTierName, improvementName, lawName } from '../../i18n/gameText';
import { UNIT_UNLOCKS } from '../../data/unitClasses';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { IMPROVEMENTS } from '../../data/tileYields';
import { buildingId } from '../../data/glossary';

// Isolated so Hebrew keeps "+10%" in order (it showed "10%+").
const pct = (v) => isolateLtr(`${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
const EFFECT_WORDS = {
  goldMult: (v) => tNow('fx.gold', { pct: pct(v) }),
  hrMult: (v) => tNow('fx.manpower', { pct: pct(v) }),
  techPointsMult: (v) => tNow('fx.science', { pct: pct(v) }),
  researchCost: (v) => tNow('fx.researchCost', { pct: pct(v) }),
  developmentCost: (v) => tNow('fx.developmentCost', { pct: pct(v) }),
  stabilityCost: (v) => tNow('fx.stabilityCost', { pct: pct(v) }),
  attrition: (v) => tNow('fx.attrition', { pct: pct(v) }),
  decreePace: () => tNow('fx.decreePace'),
  opinion: (v) => tNow('fx.opinion', { n: v }),
  supplyRange: (v) => tNow('fx.supplyRange', { n: v }),
  popGrowthBonus: () => tNow('fx.popGrowth'),
  stabilityBonus: (v) => (v > 0 ? tNow('fx.stabilityPlus', { n: v }) : tNow('fx.unrestEverywhere'))
};

// "+25% gold" style phrases for a tech's effects; every tech also counts toward the next age.
export const describeTech = (tech) => {
  const parts = Object.entries(tech?.effects || {}).map(([k, v]) => (EFFECT_WORDS[k] ? EFFECT_WORDS[k](v) : null)).filter(Boolean);
  const nextAgeId = AGE_ORDER[AGE_ORDER.indexOf(tech?.ageId) + 1];
  const nextAge = AGES[nextAgeId]?.name;
  if (nextAge) parts.push(tNow('fx.nextAge', { age: ageName(nextAgeId, nextAge) }));
  return parts.join(', ');
};

/** The units, buildings, tile improvements and laws a tech unlocks: { kind, id, name } with the name in the
 *  current language; kind and id are the glossary's (a law has no entry: kind null). */
export const techUnlockRefs = (techId) => [
  ...Object.entries(UNIT_UNLOCKS).flatMap(([ageId, row]) => Object.keys(row).filter((c) => row[c] === techId).map((c) => ({ kind: 'unit', id: `${ageId}_${c}`, name: unitName(ageId, c) }))),
  ...Object.entries(BUILDING_CATEGORIES).flatMap(([cat, def]) => def.tiers.map((tier, i) => (tier.requiresTech === techId ? { kind: 'building', id: buildingId(cat, i), name: buildingTierName(cat, i, tier.name) } : null)).filter(Boolean)),
  ...Object.entries(IMPROVEMENTS).filter(([, imp]) => imp.requiresTech === techId).map(([id, imp]) => ({ kind: 'improvement', id, name: improvementName(id, imp.name) })),
  ...Object.values(LAW_CATEGORIES).flat().filter((law) => law.requiresTech === techId).map((law) => ({ kind: null, id: law.id, name: tNow('p2.tr.law', { name: lawName(law.id, law.name) }) }))
];
/** The same as names only ([] when none). */
export const techUnlocks = (techId) => techUnlockRefs(techId).map((r) => r.name);

// How far a tech is, for a locked unit or building ("Needs Copper Working, researching, 3 turns
// left"; playtest 40550092795 step 51): under way or queued, the turn it lands; otherwise the
// research its path would take if picked now. Null once known. { kind, turns, steps, gate }
export const techEta = (state, techId) => {
  const research = state.research || {};
  const order = [research.current, ...(research.queue || [])].filter(Boolean);
  const at = order.indexOf(techId);
  if (at >= 0) {
    const s = researchSchedule(state, order)[at];
    return { kind: at === 0 ? 'current' : 'queued', turns: s.finishesIn, steps: 1, gate: s.waitsOnGate ? s.gate : null };
  }
  const path = getResearchPath(techId, researchedSet(state));
  if (!path.length) return null;
  const sched = researchSchedule(state, path);
  return { kind: 'path', turns: sched[sched.length - 1].finishesIn, steps: path.length, gate: sched.find((x) => x.gate)?.gate || null };
};
export const techEtaText = (eta) => {
  if (!eta) return null;
  if (eta.gate) return gateText(eta.gate);
  if (eta.turns === Infinity) return formatTurns(Infinity); // "about no science of research" read as nonsense
  const turns = formatTurns(eta.turns);
  if (eta.kind === 'current') return tNow('p2.eta.current', { turns });
  if (eta.kind === 'queued') return tNow('p2.eta.queued', { turns });
  return eta.steps > 1 ? tNow('p2.eta.pathN', { turns, n: eta.steps }) : tNow('p2.eta.path', { turns });
};

// The advisor's picks (research.js recommendTechs) with their reasons in plain words.
const REASON_WORDS = {
  boost: () => tNow('p2.rec.boost', { pct: Math.round(BOOST_SHARE * 100) }),
  warUnit: () => tNow('p2.rec.warUnit'),
  unlock: () => tNow('p2.rec.unlock'),
  focus: () => tNow('p2.rec.focus')
};
export const recommendText = (reasons = []) => tNow('p2.rec.line', { list: (reasons.length ? reasons.map((r) => REASON_WORDS[r]()) : [tNow('p2.rec.cheap')]).join(', ') });
export const recommendedTechs = (state, count = 3) => recommendTechs(state, state.playerNationId, count).map((r) => ({ ...r, text: recommendText(r.reasons) }));

export const getSciencePerTurn = (state) => Math.round((calcIncome(state).techPoints || 0) * 10) / 10;

export const researchedSet = (state) => new Set(Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched));

// Why a tech cannot start, in the current language (the engine's canStartTech keeps the English text).
export const startReasonText = (techId, researched, ageId) => {
  const tech = TECH_TREE[techId];
  if (!tech) return tNow('p2.rs.unknown');
  if (researched.has(techId)) return tNow('p2.rs.done');
  if (!inResearchWindow(ageId, tech)) { const need = AGE_ORDER[Math.max(0, AGE_ORDER.indexOf(tech.ageId) - 1)]; return tNow('p2.rs.reachAge', { age: ageName(need, AGES[need]?.name) }); }
  const prereqs = tech.requiresAny ? tech.prerequisites.some((p) => researched.has(p)) : tech.prerequisites.every((p) => researched.has(p));
  if (!prereqs) return tNow('p2.rs.needs', { list: tech.prerequisites.map((p) => techName(p, TECH_TREE[p]?.name || p)).join(tNow('p2.rs.and')) });
  const rival = (tech.exclusiveWith || []).find((id) => researched.has(id));
  if (rival) return tNow('p2.rs.exclusive', { name: techName(rival, TECH_TREE[rival]?.name || rival) });
  if (tech.repeatable && !ageDoneFor(tech, researched)) return tNow('p2.rs.ageFirst', { age: ageName(tech.ageId, AGES[tech.ageId]?.name) });
  return null;
};

// Everything the panel needs about one tech.
export const techInfo = (state, techId, science = getSciencePerTurn(state)) => {
  const tech = TECH_TREE[techId];
  const research = state.research || {};
  const researched = researchedSet(state);
  const cost = getResearchCost(state, state.playerNationId, techId);
  const progress = research.progress?.[techId] || 0;
  const rate = science * (state.researchFocus === tech.category ? 1 + FOCUS_SCIENCE_BONUS : 1);
  const remaining = Math.max(0, cost - progress);
  const start = canStartTech(techId, researched, ageOf(state, state.playerNationId));
  const gate = techGate(state, techId, researched);
  const diffusion = researched.has(techId) ? null : getTechDiffusion(state, state.playerNationId, techId);
  const boost = researched.has(techId) ? null : boostOf(state, state.playerNationId, techId);
  return {
    tech,
    boost,
    mapEffect: mapEffectLabel(techId),
    unlocks: techUnlocks(techId),
    cost,
    progress,
    share: cost > 0 ? Math.min(1, progress / cost) : 0,
    // turns of science alone; a date gate is `gate` and `turns` is the later of the two
    scienceTurns: rate > 0 ? Math.max(1, Math.ceil(remaining / rate)) : Infinity,
    turns: Math.max(rate > 0 ? Math.max(1, Math.ceil(remaining / rate)) : Infinity, gate ? gate.turns : 0),
    gate,
    gateText: gateText(gate),
    researched: researched.has(techId),
    repeats: tech.repeatable ? futureTechsOf(state, state.playerNationId) : 0,
    current: research.current === techId,
    queuedAt: (research.queue || []).indexOf(techId),
    canStart: start.ok,
    reason: start.reason,
    future: !!start.window, // its age is not open yet: shows the age, never a turn count
    reasonText: start.ok ? null : startReasonText(techId, researched, ageOf(state, state.playerNationId)),
    diffusion
  };
};

// The All techs list of one age (TechPanel's age tabs, plan U6): one row a tech, in the order a
// player acts on them, each with its state and the honest time. `line` is the row's second line:
// turns of science for an open tech, the path's turns for a tech under way, queued or behind a
// prerequisite (`needs` lists those), the age for a future one.
const ROW_ORDER = ['current', 'queued', 'available', 'locked', 'future', 'researched'];
export const rowStateOf = (info) => (info.researched ? 'researched' : info.current ? 'current' : info.queuedAt >= 0 ? 'queued' : info.canStart ? 'available' : info.future ? 'future' : 'locked');
export const ageRows = (state, ageId, science = getSciencePerTurn(state)) => {
  const researched = researchedSet(state);
  return Object.values(TECH_TREE).filter((t) => t.ageId === ageId).map((tech) => {
    const info = techInfo(state, tech.id, science);
    const rowState = rowStateOf(info);
    const needs = rowState === 'locked' ? (tech.prerequisites || []).filter((p) => !researched.has(p)) : [];
    const eta = rowState === 'current' || rowState === 'queued' || rowState === 'locked' ? techEta(state, tech.id) : null;
    const line = rowState === 'researched' ? tNow('p2.tr.known')
      : rowState === 'future' ? tNow('p2.row.futureLine', { age: ageName(tech.ageId, AGES[tech.ageId]?.name) })
        : rowState === 'available' ? (info.gate ? info.gateText : tNow('p2.tr.costTurns', { cost: info.cost, turns: formatTurns(info.turns) }))
          : rowState === 'locked' && !needs.length ? info.reasonText
            : techEtaText(eta);
    return { info, rowState, needs, eta, line };
  }).sort((a, b) => ROW_ORDER.indexOf(a.rowState) - ROW_ORDER.indexOf(b.rowState));
};

// The current tech and the queue, each with the turn it would finish (cumulative, and never before
// its date: researchStatus.js researchSchedule). `status` is the one research status every surface reads.
export const getResearchView = (state) => {
  const science = getSciencePerTurn(state);
  const research = state.research || {};
  const order = [research.current, ...(research.queue || [])].filter(Boolean);
  const schedule = researchSchedule(state, order, science);
  const items = order.map((id, i) => ({ ...techInfo(state, id, science), finishesIn: schedule[i].finishesIn, waitsOnGate: schedule[i].waitsOnGate }));
  return { science, bank: Math.round(state.resources?.techPoints || 0), current: items[0] || null, queue: items.slice(1), auto: !!research.auto, status: researchStatus(state, { science }) };
};

export const formatTurns = (n) => (n === Infinity ? tNow('research.noScience') : tNow('research.turnsCount', { count: n }));
/** The honest time for one research item: "waits for 500 CE, about 12 turns" when a date holds it back. */
export const formatEta = (item) => (item?.gate ? gateText(item.gate) : formatTurns(item?.finishesIn ?? item?.turns));

// The research web (plan C3.1): one column per step of a line (two per age), one row per line,
// every prerequisite an edge. Pure; TechPanel draws it as an SVG.
export const GRAPH_COL_W = 150;
export const GRAPH_ROW_H = 64;
export const GRAPH_NODE_W = 132;
export const GRAPH_NODE_H = 44;
export const GRAPH_THIN_W = 40; // a collapsed age (TechPanel's jump strip): one thin column, no techs drawn
export const techGraph = (state, collapsed = []) => {
  const lines = Object.values(TechCategories);
  const ageX = {};
  const ageW = {};
  let cursor = 0;
  // Two columns an age, more where a line has extra techs (the Future's robot techs and Future Tech).
  const colsOf = (ageId) => Math.max(2, ...lines.map((c) => Object.values(TECH_TREE).filter((t) => t.category === c && t.ageId === ageId).length));
  AGE_ORDER.forEach((ageId) => { ageX[ageId] = cursor; ageW[ageId] = collapsed.includes(ageId) ? GRAPH_THIN_W : colsOf(ageId) * GRAPH_COL_W; cursor += ageW[ageId]; });
  const colX = (ageId, col) => ageX[ageId] + (col - 2 * AGE_ORDER.indexOf(ageId)) * GRAPH_COL_W;
  const science = getSciencePerTurn(state);
  const nodes = [];
  const byId = new Map();
  lines.forEach((category, row) => {
    Object.values(TECH_TREE).filter((t) => t.category === category).sort((a, b) => a.lineIndex - b.lineIndex).forEach((tech, col) => {
      if (collapsed.includes(tech.ageId)) return;
      const info = techInfo(state, tech.id, science);
      const node = { id: tech.id, name: techName(tech.id, tech.name), category, row, col, ageId: tech.ageId, x: colX(tech.ageId, col), y: row * GRAPH_ROW_H, status: info.researched ? 'researched' : info.current ? 'current' : info.queuedAt >= 0 ? 'queued' : info.canStart ? 'available' : 'locked', turns: info.turns, cost: info.cost, reason: info.reason };
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
  const ages = AGE_ORDER.map((ageId) => ({ ageId, name: ageName(ageId, AGES[ageId]?.name || ageId), x: ageX[ageId], width: ageW[ageId], collapsed: collapsed.includes(ageId) }));
  return { nodes, edges, width: cursor, height: lines.length * GRAPH_ROW_H, ages, rows: lines };
};
