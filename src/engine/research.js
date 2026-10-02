// src/engine/research.js
// Research the Civilization way (plan §2). Every turn a nation's science (its tech points: the
// flat base, Science buildings, a share of its development, scholars, satellites and modifiers)
// goes into the tech it is currently researching. When the tech's cost is reached it is
// researched; what's left over carries into the next tech in the queue, so no science is lost.
// With nothing to research, science banks in the tech point stock until a tech is picked.
// Switching keeps the progress made on each tech. Picking a tech further down a line queues the
// missing earlier ones first.
//
//   cost = RESEARCH_AGE_BASE[age] / game speed x (1 + research cost modifiers and diffusion)
//          x the ages-behind multiplier
//
// Diffusion (techDiffusion.js) is Civ V's catch-up: cheaper when neighbours already know it,
// dearer as a pioneer. The ADM/DIP/MIL power pools no longer pay for research; Research Focus
// adds FOCUS_SCIENCE_BONUS to science spent on a tech of the focused line.
// The player's research lives on state.research and state.techTree; an AI nation's on
// nation.research and nation.tech. Both use the same step (applyResearchTurn below), run at the
// very end of resolveTurn, after this turn's income has been credited.
import { applyBoosts } from './boosts';
import { BOOSTS, BOOST_SHARE } from '../data/boosts';
import { TECH_TREE, getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD } from '../data/techTree';
import { AGES, AGE_ORDER, GAME_SPEEDS, getAgesBehind, getAgesBehindResearchCostMultiplier } from '../data/ages';
import { DOCTRINE_TECH_CATEGORY_PRIORITY } from '../data/nations';
import { LogTypes } from '../data/types';
import { getModifier } from './modifiers/sheet';
import { withDiffusion } from './techDiffusion';

// Science cost of one tech, by its age, at Normal speed. Calibrated with the balance-sim so a
// typical nation researches about 6 to 8 of an age's 10 techs before the calendar age ends.
// Recalibrated for the one-city Dawn start (plans/civ-map-rework.md, Part H): a size-2 capital
// makes about 3 science a turn, so a Bronze tech takes about 8 turns. The later ages keep their
// values until the balance-sim pass of workstream 13.
export const RESEARCH_AGE_BASE = { bronze: 24, classical: 85, kingdoms: 135, gunpowder: 140, modern: 290 };
export { SCIENCE_PER_DEV } from '../data/actionCosts';
export const FOCUS_SCIENCE_BONUS = 0.1;
// A safety cap on techs completed in one turn (a big bank paid into cheap techs).
const MAX_COMPLETIONS_PER_TURN = 6;
// AI nations pay their banked science into research every AI_RESEARCH_PERIOD turns, staggered by
// nation (science still accumulates every turn, so nothing is lost; completions land in batches).
// 240 nations working out research every turn cost about 10% of a turn; this brings it to ~3%.
export const AI_RESEARCH_PERIOD = 3;
const stagger = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) % AI_RESEARCH_PERIOD; };

export const emptyResearch = () => ({ current: null, queue: [], progress: {}, auto: false, lastCompleted: null });

const isPlayer = (state, nationId) => nationId === state.playerNationId;
const researchOf = (state, nationId) => (isPlayer(state, nationId) ? state.research : state.nations[nationId]?.research) || emptyResearch();
const researchedSetOf = (state, nationId) => new Set(isPlayer(state, nationId)
  ? Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched)
  : state.nations[nationId]?.tech?.researched || []);
const techAgeOf = (state, nationId) => (isPlayer(state, nationId) ? state.techAgeId : state.nations[nationId]?.tech?.ageId) || state.age;

export const getResearchCost = (state, nationId, techId) => {
  const tech = TECH_TREE[techId];
  if (!tech) return Infinity;
  const base = RESEARCH_AGE_BASE[tech.ageId] ?? RESEARCH_AGE_BASE.modern;
  const speed = GAME_SPEEDS[state.gameSpeed]?.multiplier || 1;
  const mult = withDiffusion(state, nationId, techId, getModifier(state, nationId, 'national.researchCost').total);
  const behind = getAgesBehindResearchCostMultiplier(getAgesBehind(state.age, techAgeOf(state, nationId)));
  return Math.max(1, Math.round((base / speed) * (1 + mult) * behind));
};

// Can this tech be researched now? (Its year has come, its line's earlier tech is known, and no
// exclusive rival is.) `researched` is a Set of tech ids.
export const canStartTech = (techId, researched, year, techDefs = TECH_TREE) => {
  const tech = techDefs[techId];
  if (!tech) return { ok: false, reason: 'Unknown tech' };
  if (researched.has(techId)) return { ok: false, reason: 'Already researched' };
  if (tech.yearAvailable > year) return { ok: false, reason: `Available from ${tech.yearAvailable < 0 ? `${-tech.yearAvailable} BCE` : `${tech.yearAvailable} CE`}` };
  const prereqs = tech.requiresAny ? tech.prerequisites.some((p) => researched.has(p)) : tech.prerequisites.every((p) => researched.has(p));
  if (!prereqs) return { ok: false, reason: `Needs ${tech.prerequisites.map((p) => techDefs[p]?.name || p).join(' and ')}` };
  const rival = (tech.exclusiveWith || []).find((id) => researched.has(id));
  if (rival) return { ok: false, reason: `Exclusive with ${techDefs[rival]?.name || rival}` };
  return { ok: true, reason: null };
};

// The path to a tech: its missing prerequisites, earliest first, then the tech itself.
export const getResearchPath = (techId, researched) => {
  const path = [];
  const visit = (id) => {
    const tech = TECH_TREE[id];
    if (!tech || researched.has(id) || path.includes(id)) return;
    const prereqs = tech.requiresAny ? (tech.prerequisites.some((p) => researched.has(p)) ? [] : tech.prerequisites.slice(0, 1)) : tech.prerequisites;
    prereqs.forEach(visit);
    path.push(id);
  };
  visit(techId);
  return path;
};

// The techs an advisor (or the AI) would pick, best first: available now, by the doctrine's
// line priority, then the earliest.
export const suggestTechs = (state, nationId, count = 3, researched = researchedSetOf(state, nationId)) => {
  const doctrine = state.nations[nationId]?.doctrine;
  const priority = DOCTRINE_TECH_CATEGORY_PRIORITY[doctrine] || [];
  const rank = (cat) => { const i = priority.indexOf(cat); return i === -1 ? 99 : i; };
  return Object.values(TECH_TREE)
    .filter((t) => canStartTech(t.id, researched, state.year).ok)
    .sort((a, b) => rank(a.category) - rank(b.category) || a.yearAvailable - b.yearAvailable || (a.id < b.id ? -1 : 1))
    .slice(0, count)
    .map((t) => t.id);
};

// Turns to finish `techId` at `sciencePerTurn` (Infinity with no science).
export const turnsToResearch = (state, nationId, techId, sciencePerTurn) => {
  const research = researchOf(state, nationId);
  const remaining = Math.max(0, getResearchCost(state, nationId, techId) - (research.progress?.[techId] || 0));
  const tech = TECH_TREE[techId];
  const focus = isPlayer(state, nationId) ? state.researchFocus : null;
  const rate = sciencePerTurn * (tech && focus === tech.category ? 1 + FOCUS_SCIENCE_BONUS : 1);
  return rate > 0 ? Math.max(1, Math.ceil(remaining / rate)) : Infinity;
};

// Tech age after researching: a majority of the current tech age's techs moves it on.
const techAgeAfter = (techAgeId, researched) => {
  const count = getTechsForAge(techAgeId).filter((t) => researched.has(t.id)).length;
  const nextIndex = AGE_ORDER.indexOf(techAgeId) + 1;
  return count >= TECH_AGE_ADVANCEMENT_THRESHOLD && nextIndex < AGE_ORDER.length ? AGE_ORDER[nextIndex] : techAgeId;
};

// One nation's research for one turn: pay the science stock into the current tech (and on down
// the queue). Pure. Returns { research, stock, completed: [techIds], techAgeId }.
export const stepResearch = (state, nationId) => {
  const start = researchOf(state, nationId);
  const research = { ...emptyResearch(), ...start, queue: [...(start.queue || [])], progress: { ...(start.progress || {}) } };
  const researched = researchedSetOf(state, nationId);
  const focus = isPlayer(state, nationId) ? state.researchFocus : null;
  const auto = !isPlayer(state, nationId) || research.auto;
  let stock = Math.max(0, (isPlayer(state, nationId) ? state.resources?.techPoints : state.nations[nationId]?.economy?.techPoints) || 0);
  let techAgeId = techAgeOf(state, nationId);
  const completed = [];
  const nextStartable = () => {
    while (research.queue.length) {
      const id = research.queue[0];
      if (researched.has(id) || !TECH_TREE[id]) { research.queue.shift(); continue; }
      return canStartTech(id, researched, state.year).ok ? research.queue.shift() : null; // the next one isn't ready yet: wait
    }
    return auto ? suggestTechs(state, nationId, 1, researched)[0] || null : null;
  };
  while (stock > 0 && completed.length < MAX_COMPLETIONS_PER_TURN) {
    if (!research.current || researched.has(research.current) || !canStartTech(research.current, researched, state.year).ok) {
      if (research.current && !researched.has(research.current) && TECH_TREE[research.current] && !canStartTech(research.current, researched, state.year).ok) break; // chosen but not yet available: bank
      research.current = nextStartable();
      if (!research.current) break;
    }
    const tech = TECH_TREE[research.current];
    const cost = getResearchCost({ ...state, ...(isPlayer(state, nationId) ? { techAgeId } : {}) }, nationId, research.current);
    const have = research.progress[research.current] || 0;
    const rate = focus && focus === tech.category ? 1 + FOCUS_SCIENCE_BONUS : 1;
    const spend = Math.min(stock, Math.ceil((cost - have) / rate));
    research.progress[research.current] = have + spend * rate;
    stock -= spend;
    if (research.progress[research.current] >= cost - 1e-9) {
      delete research.progress[research.current];
      researched.add(research.current);
      completed.push(research.current);
      techAgeId = techAgeAfter(techAgeId, researched);
      research.lastCompleted = { techId: research.current, turn: state.turnNumber };
      research.current = null;
    }
  }
  return { research, stock, completed, techAgeId };
};

// Runs every nation's research for the turn (the player's and every AI nation with an economy).
export const applyResearchTurn = (state) => {
  let next = state;
  // Boosts from the map (boosts.js): every tech whose fact a nation has met gets its share first.
  const boostedPlayer = applyBoosts(state, state.playerNationId, researchOf(state, state.playerNationId), researchedSetOf(state, state.playerNationId));
  if (boostedPlayer.applied.length) {
    next = { ...next, research: boostedPlayer.research, logs: [...next.logs, ...boostedPlayer.applied.map((id) => ({ year: state.year, message: `Boost: ${BOOSTS[id].label} speeds ${TECH_TREE[id].name} (${Math.round(BOOST_SHARE * 100)}% of its cost).`, type: LogTypes.TECH }))] };
  }
  // The player.
  const p = stepResearch(next, state.playerNationId);
  if (p.completed.length || p.stock !== (state.resources?.techPoints || 0) || p.research.current !== state.research?.current || p.research !== state.research) {
    const techTree = { ...state.techTree };
    p.completed.forEach((id) => { techTree[id] = { ...techTree[id], researched: true }; });
    const logs = [...next.logs];
    p.completed.forEach((id) => logs.push({ year: state.year, message: `Researched ${TECH_TREE[id].name}.`, type: LogTypes.TECH }));
    if (p.techAgeId !== state.techAgeId) logs.push({ year: state.year, message: `Your empire's expertise has reached the ${AGES[p.techAgeId]?.name}.`, type: LogTypes.MILESTONE });
    next = { ...next, techTree, techAgeId: p.techAgeId, research: p.research, resources: { ...next.resources, techPoints: p.stock }, logs };
  }
  // AI nations.
  let nations = null;
  Object.keys(state.nations).forEach((id) => {
    const nation = state.nations[id];
    if (id === state.playerNationId || nation.isEliminated || !nation.economy) return;
    if ((state.turnNumber + stagger(id)) % AI_RESEARCH_PERIOD !== 0) return;
    const boosted = applyBoosts(state, id, researchOf(state, id), researchedSetOf(state, id));
    const r = stepResearch(boosted.applied.length ? { ...state, nations: { ...state.nations, [id]: { ...nation, research: boosted.research } } } : state, id);
    if (!r.completed.length && r.stock === nation.economy.techPoints && r.research.current === nation.research?.current) return;
    nations ||= { ...next.nations };
    nations[id] = {
      ...nation,
      research: r.research,
      economy: { ...nation.economy, techPoints: r.stock },
      tech: { researched: [...(nation.tech?.researched || []), ...r.completed], ageId: r.techAgeId }
    };
  });
  return nations ? { ...next, nations } : next;
};

// Choose what to research: the tech (with its missing prerequisites queued before it) replaces
// the current target; progress already made on anything is kept.
export const chooseResearch = (research, techId, researched) => {
  const path = getResearchPath(techId, researched);
  if (!path.length) return research;
  return { ...emptyResearch(), ...research, current: path[0], queue: path.slice(1) };
};

// Add a tech (and its missing prerequisites) to the end of the queue.
export const queueResearch = (research, techId, researched) => {
  const already = new Set([research.current, ...(research.queue || [])].filter(Boolean));
  const path = getResearchPath(techId, researched).filter((id) => !already.has(id));
  if (!path.length) return research;
  if (!research.current) return { ...research, current: path[0], queue: [...(research.queue || []), ...path.slice(1)] };
  return { ...research, queue: [...(research.queue || []), ...path] };
};

// Remove a tech from the queue, with anything queued that needs it.
export const unqueueResearch = (research, techId) => {
  const removed = new Set([techId]);
  const queue = [];
  (research.queue || []).forEach((id) => {
    const needs = TECH_TREE[id]?.prerequisites || [];
    if (removed.has(id) || needs.some((p) => removed.has(p))) removed.add(id);
    else queue.push(id);
  });
  return { ...research, queue };
};
