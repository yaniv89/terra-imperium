// src/engine/researchStatus.js
// ONE research status for every surface (playtest audit CB12, items I133 to I136): the top bar chip,
// the research sheet, the Empire card, the "Choose research" prompt and End Turn's blocker all read
// this and nothing else, so they cannot disagree.
//
// It answers, in plain words:
//   what is under way (or why nothing is), how much science is banked, and when it finishes.
//   No tech waits for a year (eight-ages plan KTD4): a tech outside the nation's research window
//   (its own age and the next) waits for an age. The wait is a generic `gate` object so a later
//   soft gate only changes the data, not the screens:
//     gate = { kind: 'age' | 'cost', ageId, label, turns, extraCostMult }
//   kind 'age': the tech cannot start before the nation reaches `ageId` (label: its name); the
//   turns are unknown (null): reaching an age is research, not a date. kind 'cost' (reserved).
// Pure. Reads state only.
import { TECH_TREE } from '../data/techTree';
import { t as tNow, dataText, ageName } from '../i18n/core';
import { AGES, AGE_ORDER, getAgeIndex } from '../data/ages';
import { calcIncome } from '../utils/helpers';
import { getResearchCost, suggestTechs, recommendTechs, FOCUS_SCIENCE_BONUS, inResearchWindow, deriveTechAge } from './research';
import { ageOf } from './nationState';

const researchedOf = (state) => new Set(Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched));

/** The age a tech outside the window waits for: the one before the tech's own age. */
const ageGate = (tech) => {
  const ageId = AGE_ORDER[Math.max(0, getAgeIndex(tech.ageId) - 1)];
  return { kind: 'age', ageId, label: ageName(ageId, AGES[ageId]?.name), turns: null, extraCostMult: 0 };
};

/** The gate on one tech for the player at age `ageId` (default: the player's age), or null. */
export const techGate = (state, techId, researched = researchedOf(state), ageId = ageOf(state, state.playerNationId)) => {
  const tech = TECH_TREE[techId];
  if (!tech || researched.has(techId)) return null;
  return inResearchWindow(ageId, tech) ? null : ageGate(tech);
};

const rateFor = (state, techId, science) => {
  const tech = TECH_TREE[techId];
  return science * (tech && state.researchFocus === tech.category ? 1 + FOCUS_SCIENCE_BONUS : 1);
};

/**
 * When would each tech of `order` finish, in turns from now? Science goes into them in order and
 * banks while a gate holds one back (a gated tech and those after it never finish). Returns:
 *   { techId, cost, progress, scienceTurns, gate, finishesIn, waitsOnGate }
 * `finishesIn` = max(science ready, the one before); at least 1; Infinity with no science or a gate.
 */
export const researchSchedule = (state, order, science = null) => {
  const sci = science ?? Math.round((calcIncome(state).techPoints || 0) * 10) / 10;
  const researched = researchedOf(state);
  const bank = Math.max(0, state.resources?.techPoints || 0);
  const nationId = state.playerNationId;
  const done = new Set(researched);
  let ageId = ageOf(state, nationId);
  let cumulative = 0;
  let prev = 1;
  return order.map((techId) => {
    const cost = getResearchCost(state, nationId, techId);
    const progress = state.research?.progress?.[techId] || 0;
    cumulative += Math.max(0, cost - progress);
    const rate = rateFor(state, techId, sci);
    const short = cumulative - bank;
    const scienceTurns = short <= 0 ? 0 : rate > 0 ? Math.ceil(short / rate) : Infinity;
    // Techs earlier in the order count as done: they may move the age on and open this one.
    const gate = techGate(state, techId, done, ageId);
    const gateTurns = gate ? Infinity : 0;
    const finishesIn = Math.max(1, scienceTurns, gateTurns, prev);
    prev = finishesIn;
    done.add(techId);
    ageId = AGE_ORDER[Math.max(getAgeIndex(ageId), getAgeIndex(deriveTechAge(done)))];
    return { techId, cost, progress, scienceTurns, gate, finishesIn, waitsOnGate: !!gate && gateTurns >= scienceTurns };
  });
};

/** The earliest tech that is only held back by the research window (its prerequisites are known). */
export const nextGatedTech = (state, researched = researchedOf(state)) => {
  const ageId = ageOf(state, state.playerNationId);
  let best = null;
  Object.values(TECH_TREE).forEach((t) => {
    if (researched.has(t.id) || inResearchWindow(ageId, t)) return;
    const prereqs = t.requiresAny ? t.prerequisites.some((p) => researched.has(p)) : t.prerequisites.every((p) => researched.has(p));
    if (!prereqs || (t.exclusiveWith || []).some((id) => researched.has(id))) return;
    if (!best || getAgeIndex(t.ageId) < getAgeIndex(best.ageId) || (t.ageId === best.ageId && t.id < best.id)) best = t;
  });
  if (!best) return null;
  const gate = ageGate(best);
  return { techId: best.id, name: best.name, ageId: gate.ageId, label: gate.label, turns: null };
};


/** The single truth for "the player should choose research now": nothing under way or queued, no
 * advisor, and something can actually start. Cheap (no science math): the prompt chip, End Turn's
 * blocker and the choice sheet all call it. */
export const researchNeedsChoice = (state) => {
  const r = state.research;
  if (!r || r.current || r.queue?.length || r.auto) return false;
  return suggestTechs(state, state.playerNationId, 1).length > 0;
};

/**
 * The one status. kind:
 *   'researching'      a tech is under way and can start
 *   'waiting'          the tech under way waits for an age (gate); science banks
 *   'choose'           nothing under way, something can start, no advisor: the player should pick
 *   'advisor'          nothing under way yet, an advisor picks at the next turn's science
 *   'advisor-waiting'  nothing can start yet (all gated); the advisor resumes when one opens
 *   'idle-waiting'     nothing can start yet and no advisor; nothing for the player to do
 *   'done'             nothing left to research
 * `needsChoice` is true only for 'choose': it is the single truth behind the top bar chip, the
 * "Choose research" prompt, End Turn's blocker and the choice sheet.
 */
export const researchStatus = (state, { science = null } = {}) => {
  const me = state.playerNationId;
  const r = state.research || {};
  const researched = researchedOf(state);
  const sci = science ?? Math.round((calcIncome(state).techPoints || 0) * 10) / 10;
  const bank = Math.round(Math.max(0, state.resources?.techPoints || 0));
  const queue = r.queue || [];
  const order = [r.current, ...queue].filter(Boolean);
  const schedule = researchSchedule(state, order, sci);
  const startable = suggestTechs(state, me, 1, researched).length > 0;
  const needsChoice = researchNeedsChoice(state);
  const next = nextGatedTech(state, researched);
  const base = { science: sci, bank, schedule, startable, next, auto: !!r.auto, current: r.current || null, queue };

  if (r.current) {
    const first = schedule[0];
    const gate = first.gate;
    const name = TECH_TREE[r.current]?.name || r.current;
    const bankText = bank > 0 ? tNow('research.banked', { n: bank }) : '';
    const note = gate
      ? tNow('research.noteWaits', { name, gate: gate.label, bank: bankText })
      : tNow('research.noteFinishes', { name, time: first.finishesIn === Infinity ? tNow('research.noTime') : tNow('research.turnsCount', { count: first.finishesIn }) });
    return { ...base, kind: gate ? 'waiting' : 'researching', gate, finishesIn: first.finishesIn, needsChoice: false, note, shortLabel: gate ? tNow('research.shortWaits', { name, gate: gate.label }) : tNow('research.shortTurns', { name, n: first.finishesIn === Infinity ? '?' : first.finishesIn }) };
  }
  if (startable) {
    if (!needsChoice && !r.auto) return { ...base, kind: 'researching', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteQueued'), shortLabel: tNow('research.queued') };
    if (r.auto) return { ...base, kind: 'advisor', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteAdvisor'), shortLabel: tNow('research.advisorPicks') };
    return { ...base, kind: 'choose', gate: null, finishesIn: null, needsChoice: true, note: tNow('prompt.research'), shortLabel: tNow('chip.research') };
  }
  if (next) {
    const why = tNow('research.nothingYet', { name: next.name, label: next.label });
    if (r.auto) return { ...base, kind: 'advisor-waiting', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteAdvisorWaits', { why, bank: bank > 0 ? tNow('research.soFar', { n: bank }) : '' }), shortLabel: tNow('research.waitingFor', { label: next.label }) };
    return { ...base, kind: 'idle-waiting', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteIdleWaits', { why, bank: bank > 0 ? tNow('research.soFar', { n: bank }) : '' }), shortLabel: tNow('research.waitingFor', { label: next.label }) };
  }
  return { ...base, kind: 'done', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteDone'), shortLabel: tNow('research.nothingLeft') };
};

/** "waits for the Classical Age" for an item with a gate, else null. */
export const gateText = (gate) => (gate && gate.kind === 'age' ? tNow('research.gateText', { label: gate.label }) : null);

/**
 * What "Let my advisor pick" does right now: `{ techId }` when something can start (the caller
 * dispatches RESEARCH_TECH after turning the advisor on), else `{ why }` in plain words.
 * Only picks when nothing is under way.
 */
export const advisorPlan = (state) => {
  const status = researchStatus(state);
  if (state.research?.current) return { techId: null, why: null };
  const pick = recommendTechs(state, state.playerNationId, 1)[0] || null; // the same pick End Turn's advisor makes (research.js stepResearch)
  if (pick) return { techId: pick.techId, why: null, reasons: pick.reasons };
  return { techId: null, why: status.note };
};

/**
 * Fund Scholars preview (I138): the science it adds, the bank after, and the turns it saves on the
 * tech under way (banked for later when nothing is under way or an age holds the tech back).
 */
export const scholarsPreview = (state, added) => {
  const bank = Math.max(0, state.resources?.techPoints || 0);
  const current = state.research?.current || null;
  const sched = (s) => researchSchedule(s, [current])[0];
  const name = current ? dataText(`tech.${current}`, TECH_TREE[current]?.name || current) : null;
  let turnsSaved = 0;
  let note;
  if (!current) {
    note = tNow('p2.sch.bank', { added, bank: Math.round(bank + added) });
  } else {
    const now = sched(state);
    const then = sched({ ...state, resources: { ...state.resources, techPoints: bank + added } });
    if (now.waitsOnGate && now.gate) note = tNow('p2.sch.gated', { added, name, label: now.gate.label });
    else {
      turnsSaved = now.finishesIn === Infinity ? 0 : Math.max(0, now.finishesIn - then.finishesIn);
      note = turnsSaved > 0 ? tNow('p2.sch.saves', { added, count: turnsSaved, name }) : tNow('p2.sch.plain', { added, name });
    }
  }
  return { added, bankAfter: Math.round(bank + added), turnsSaved, note };
};
