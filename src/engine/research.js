// src/engine/research.js
// Research the Civilization way (plan §2). Every turn a nation's science (its tech points: the
// flat base, Science buildings, a share of its development, scholars and modifiers)
// goes into the tech it is currently researching. When the tech's cost is reached it is
// researched; what's left over carries into the next tech in the queue, so no science is lost.
// With nothing to research, science banks in the tech point stock until a tech is picked.
// Switching keeps the progress made on each tech. Picking a tech further down a line queues the
// missing earlier ones first.
//
//   cost = RESEARCH_AGE_BASE[tech's age] x the speed's cost multiplier at the PAYING nation's own age
//          x (1 + research cost modifiers and diffusion)
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
import { AGES, AGE_ORDER, getAgeIndex, speedCostMult } from '../data/ages';
import { grantRenown, techRenown } from './renown';
import { DOCTRINE_TECH_CATEGORY_PRIORITY } from '../data/nations';
import { LogTypes } from '../data/types';
import { msg, thing, carry, people } from './messages';
import { getModifier } from './modifiers/sheet';
import { withDiffusion } from './techDiffusion';
import { ageOf, getResearched } from './nationState';
import { WRITING_TECH, NO_WRITING_COST_MULT } from './stonePhase';
import { awardEraLegacy } from './eraGoals';
import { isIndependentNation } from '../data/independents';
import { AGRICULTURE_TECH } from '../data/hearths';

// Science cost of one tech, by its age, before the speed multiplier. With no calendar and no year
// gate (eight-ages plan KTD4) these alone pace the ages, calibrated with the balance-sim (U17,
// peoples world, Normal, seeds 11 to 13, 300 turns) to KTD9's target turns: about half the majors
// past Bronze at turn 48 and past Classical at turn 157, Kingdoms ending near 324. Gunpowder and
// Modern are first guesses past the 300 turns measured (eight-age calibration, U96).
// Stone (U47, peoples, scripted, seeds 11 to 14): 15 puts 20% to 27% of majors past Stone at the
// age's end turn on the three speeds (plan SC3: 10% to 40%; 12 gave 55% to 61%).
export const RESEARCH_AGE_BASE = { stone: 15, bronze: 17, classical: 82, kingdoms: 1200, gunpowder: 2400, modern: 6000 };
export { SCIENCE_PER_DEV } from '../data/actionCosts';
export const FOCUS_SCIENCE_BONUS = 0.1;
// A nation's first tech costs a quarter (U47): a band's first village makes 2 science, and a full
// price first tech (about 50 on Normal, writing not yet known) left it waiting 25 turns.
export const FIRST_TECH_COST_MULT = 0.25;
// A safety cap on techs completed in one turn (a big bank paid into cheap techs).
const MAX_COMPLETIONS_PER_TURN = 6;
// AI nations pay their banked science into research every AI_RESEARCH_PERIOD turns, staggered by
// nation (science still accumulates every turn, so nothing is lost; completions land in batches).
// 240 nations working out research every turn cost about 10% of a turn; this brings it to ~3%.
export const AI_RESEARCH_PERIOD = 3;
const stagger = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) % AI_RESEARCH_PERIOD; };
/** Does AI nation `id` spend its science on `turn` (the turn number being resolved)? */
export const researchesThisTurn = (id, turn) => (turn + stagger(id)) % AI_RESEARCH_PERIOD === 0;

export const emptyResearch = () => ({ current: null, queue: [], progress: {}, auto: false, lastCompleted: null });

const isPlayer = (state, nationId) => nationId === state.playerNationId;
const researchOf = (state, nationId) => (isPlayer(state, nationId) ? state.research : state.nations[nationId]?.research) || emptyResearch();
const researchedSetOf = (state, nationId) => new Set(isPlayer(state, nationId)
  ? Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched)
  : state.nations[nationId]?.tech?.researched || []);
const techAgeOf = (state, nationId) => ageOf(state, nationId);

export const getResearchCost = (state, nationId, techId) => {
  const tech = TECH_TREE[techId];
  if (!tech) return Infinity;
  const base = RESEARCH_AGE_BASE[tech.ageId] ?? RESEARCH_AGE_BASE.modern;
  const speed = speedCostMult(state.gameSpeed, techAgeOf(state, nationId)); // the speed table (ages.js, KTD9): keyed by the paying nation's own age
  const mult = withDiffusion(state, nationId, techId, getModifier(state, nationId, 'national.researchCost').total);
  const known = getResearched(state, nationId);
  const writing = known.includes(WRITING_TECH) ? 1 : NO_WRITING_COST_MULT; // stonePhase.js: no writing, half the science
  const first = known.some((id) => id !== AGRICULTURE_TECH) ? 1 : FIRST_TECH_COST_MULT; // a hearth people starts with Agriculture: its first chosen tech is still the first
  return Math.max(1, Math.round(base * speed * (1 + mult) * writing * first));
};

/** The research window (eight-ages plan KTD4): a nation may start techs of its own age and the next. */
export const inResearchWindow = (ageId, tech) => !!tech && getAgeIndex(tech.ageId) <= getAgeIndex(ageId) + 1;

// Can this tech be researched now? (It is in the research window of the nation's age `ageId`, its
// line's earlier tech is known, and no exclusive rival is.) `researched` is a Set of tech ids. No
// rule reads the year.
export const canStartTech = (techId, researched, ageId, techDefs = TECH_TREE) => {
  const tech = techDefs[techId];
  if (!tech) return { ok: false, reason: 'Unknown tech' };
  if (researched.has(techId)) return { ok: false, reason: 'Already researched' };
  if (!inResearchWindow(ageId, tech)) return { ok: false, reason: `Reach the ${AGES[AGE_ORDER[Math.max(0, getAgeIndex(tech.ageId) - 1)]]?.name || tech.ageId} first`, window: true };
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

// The techs an advisor (or the AI) would pick, best first: startable now, the earliest age first (a
// nation finishes its own age before reaching ahead), Agriculture before anything else for a people
// that forages (outside a hearth, hearths.js; eight-ages plan U36), then the doctrine's line
// priority, then the line's order, then the id, so the pick is deterministic.
export const suggestTechs = (state, nationId, count = 3, researched = researchedSetOf(state, nationId), ageId = techAgeOf(state, nationId)) => {
  const doctrine = state.nations[nationId]?.doctrine;
  const priority = DOCTRINE_TECH_CATEGORY_PRIORITY[doctrine] || [];
  const rank = (cat) => { const i = priority.indexOf(cat); return i === -1 ? 99 : i; };
  return Object.values(TECH_TREE)
    .filter((t) => canStartTech(t.id, researched, ageId).ok)
    .sort((a, b) => getAgeIndex(a.ageId) - getAgeIndex(b.ageId) || (b.id === AGRICULTURE_TECH) - (a.id === AGRICULTURE_TECH) || rank(a.category) - rank(b.category) || a.lineIndex - b.lineIndex || (a.id < b.id ? -1 : 1))
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

/** The age a researched Set reaches: from the first age, on while 6 of the age's 10 techs are known. */
export const deriveTechAge = (researched) => {
  let ageId = AGE_ORDER[0];
  for (;;) {
    const next = techAgeAfter(ageId, researched);
    if (next === ageId) return ageId;
    ageId = next;
  }
};

/**
 * `nationId` with every tech of the ages before `ageId` researched and its age derived from that
 * (never lowered). Era fixtures (later-era starts, kept for tests and the sandbox) use it so their
 * nations are in the fixture's age by research, the only way a nation has an age (KTD1).
 */
export const withAgesResearched = (state, nationId, ageId) => withTechsResearched(state, nationId, AGE_ORDER.slice(0, Math.max(0, AGE_ORDER.indexOf(ageId))).flatMap((a) => getTechsForAge(a).map((t) => t.id)));

/** The state with `ids` (tech ids) researched by a nation, its age re-derived (never lowered). */
export const withTechsResearched = (state, nationId, ids) => {
  const researched = researchedSetOf(state, nationId);
  ids.forEach((id) => researched.add(id));
  const derived = deriveTechAge(researched);
  const current = techAgeOf(state, nationId);
  const techAgeId = AGE_ORDER.indexOf(current) > AGE_ORDER.indexOf(derived) ? current : derived;
  if (isPlayer(state, nationId)) {
    const techTree = { ...state.techTree };
    ids.forEach((id) => { techTree[id] = { ...techTree[id], researched: true }; });
    return { ...state, techTree, techAgeId };
  }
  const nation = state.nations[nationId];
  if (!nation) return state;
  const list = [...(nation.tech?.researched || [])];
  ids.forEach((id) => { if (!list.includes(id)) list.push(id); });
  return { ...state, nations: { ...state.nations, [nationId]: { ...nation, tech: { ...nation.tech, researched: list, ageId: techAgeId } } } };
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
      return canStartTech(id, researched, techAgeId).ok ? research.queue.shift() : null; // the next one isn't ready yet: wait
    }
    return auto ? suggestTechs(state, nationId, 1, researched, techAgeId)[0] || null : null;
  };
  while (stock > 0 && completed.length < MAX_COMPLETIONS_PER_TURN) {
    if (!research.current || researched.has(research.current) || !canStartTech(research.current, researched, techAgeId).ok) {
      if (research.current && !researched.has(research.current) && TECH_TREE[research.current] && !canStartTech(research.current, researched, techAgeId).ok) break; // chosen but not yet available: bank
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

// A nation's own age advanced (KTD7): each age it left is scored for its era goals (a legacy), the
// turn it entered the new age is kept (nation.ageSince), and the first major into an age is named
// in the log. Returns the nation; pushes the player's lines into `logs`.
const isMajorNation = (n) => !!n && !n.isEliminated && !isIndependentNation(n);
const onAgeAdvance = (state, nation, fromAgeId, toAgeId, logs, world) => {
  let n = nation;
  for (let i = getAgeIndex(fromAgeId); i < getAgeIndex(toAgeId); i++) {
    const legacy = awardEraLegacy(state, n, AGE_ORDER[i], state.turnNumber);
    n = legacy.nation;
    if (nation.id === state.playerNationId && legacy.log) logs.push({ year: state.year, ...carry(legacy.log), type: LogTypes.MILESTONE });
  }
  if (getAgeIndex(toAgeId) > world.top) {
    world.top = getAgeIndex(toAgeId);
    logs.push({ year: state.year, ...msg('m.world.firstIntoAge', { nation: people(nation.id, nation.name), age: thing('age', toAgeId, AGES[toAgeId]?.name) }), type: LogTypes.MILESTONE });
  }
  return { ...n, ageSince: state.turnNumber };
};

// Each tech completed earns the ruler renown by the tech's own age (renown.js).
const withTechRenown = (nation, completed, turn) => completed.reduce((n, id) => grantRenown(n, 'tech', techRenown(getAgeIndex(TECH_TREE[id]?.ageId)), turn, id), nation);

// Runs every nation's research for the turn (the player's and every AI nation with an economy).
export const applyResearchTurn = (state) => {
  let next = state;
  // The highest age any major holds before this turn's research: who passes it is first in the world.
  const world = { top: Math.max(0, ...Object.keys(state.nations || {}).filter((id) => isMajorNation(state.nations[id])).map((id) => getAgeIndex(techAgeOf(state, id)))) };
  // Boosts from the map (boosts.js): every tech whose fact a nation has met gets its share first.
  const boostedPlayer = applyBoosts(state, state.playerNationId, researchOf(state, state.playerNationId), researchedSetOf(state, state.playerNationId));
  if (boostedPlayer.applied.length) {
    next = { ...next, research: boostedPlayer.research, logs: [...next.logs, ...boostedPlayer.applied.map((id) => ({ year: state.year, ...msg('m.world.boost', { boost: thing('boost', id, BOOSTS[id].label), tech: thing('tech', id, TECH_TREE[id].name), pct: Math.round(BOOST_SHARE * 100) }), type: LogTypes.TECH }))] };
  }
  // The player.
  const p = stepResearch(next, state.playerNationId);
  if (p.completed.length || p.stock !== (state.resources?.techPoints || 0) || p.research.current !== state.research?.current || p.research !== state.research) {
    const techTree = { ...state.techTree };
    p.completed.forEach((id) => { techTree[id] = { ...techTree[id], researched: true }; });
    const logs = [...next.logs];
    p.completed.forEach((id) => logs.push({ year: state.year, ...msg('m.world.researched', { tech: thing('tech', id, TECH_TREE[id].name) }), type: LogTypes.TECH }));
    const before = techAgeOf(state, state.playerNationId);
    if (p.techAgeId !== before) logs.push({ year: state.year, ...msg('m.world.techAge', { age: thing('age', p.techAgeId, AGES[p.techAgeId]?.name) }), type: LogTypes.MILESTONE });
    next = { ...next, techTree, techAgeId: p.techAgeId, research: p.research, resources: { ...next.resources, techPoints: p.stock }, logs };
    const me = next.nations?.[state.playerNationId];
    if (me && p.completed.length) next = { ...next, nations: { ...next.nations, [state.playerNationId]: withTechRenown(me, p.completed, state.turnNumber) } };
    if (p.techAgeId !== before && me) next = { ...next, nations: { ...next.nations, [state.playerNationId]: onAgeAdvance(next, next.nations[state.playerNationId], before, p.techAgeId, logs, world) } };
  }
  // AI nations.
  let nations = null;
  Object.keys(state.nations).forEach((id) => {
    const nation = state.nations[id];
    if (id === state.playerNationId || nation.isEliminated || !nation.economy) return;
    if (!researchesThisTurn(id, state.turnNumber)) return;
    const boosted = applyBoosts(state, id, researchOf(state, id), researchedSetOf(state, id));
    const r = stepResearch(boosted.applied.length ? { ...state, nations: { ...state.nations, [id]: { ...nation, research: boosted.research } } } : state, id);
    if (!r.completed.length && r.stock === nation.economy.techPoints && r.research.current === nation.research?.current) return;
    nations ||= { ...next.nations };
    const advanced = r.techAgeId !== techAgeOf(state, id);
    let logs = null;
    if (advanced) { logs = [...next.logs]; }
    const scored = advanced ? onAgeAdvance(state, nation, techAgeOf(state, id), r.techAgeId, logs, world) : nation;
    if (logs && logs.length !== next.logs.length) next = { ...next, logs };
    nations[id] = {
      ...withTechRenown(scored, r.completed, state.turnNumber),
      research: r.research,
      economy: { ...nation.economy, techPoints: r.stock },
      // The same researched list while nothing completed: its identity keys the tile-yield memos.
      tech: r.completed.length || !nation.tech ? { researched: [...(nation.tech?.researched || []), ...r.completed], ageId: r.techAgeId } : (nation.tech.ageId === r.techAgeId ? nation.tech : { ...nation.tech, ageId: r.techAgeId })
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
