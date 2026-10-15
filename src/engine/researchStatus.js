// src/engine/researchStatus.js
// ONE research status for every surface (playtest audit CB12, items I133 to I136): the top bar chip,
// the research sheet, the Empire card, the "Choose research" prompt and End Turn's blocker all read
// this and nothing else, so they cannot disagree.
//
// It answers, in plain words:
//   what is under way (or why nothing is), how much science is banked, and when it finishes.
//   A tech whose year has not come waits for its date: the finish is the LATER of "science ready"
//   and "date reached", never a bare "1 turn". The wait is a generic `gate` object so a later soft
//   gate (the same tech earlier at an extra cost) only changes the data, not the screens:
//     gate = { kind: 'wait' | 'cost', year, label, turns, extraCostMult }
//   kind 'wait' (today): the tech cannot start before `year`. kind 'cost' (reserved): it may start
//   early for `extraCostMult` more; nothing produces it yet.
//   The turns to a year follow the real calendar schedule (the speed table, getYearsPerTurn, age by
//   age), the same stepping resolveTurn uses, so BCE to CE and age changes count.
// Pure. Reads state only.
import { TECH_TREE } from '../data/techTree';
import { t as tNow, formatYear } from '../i18n/core';
import { getYearsPerTurn, getCalendarAgeId } from '../data/ages';
import { calcIncome } from '../utils/helpers';
import { getResearchCost, suggestTechs, FOCUS_SCIENCE_BONUS } from './research';

const MAX_LOOKAHEAD_TURNS = 4000;

/** "500 CE" / "800 BCE". */
export const yearText = (year) => formatYear(year);

/** Turns until the calendar reaches `targetYear` (0 if it already has), stepping the speed table
 * the way resolveTurn does (the years of the age you start the turn in). Infinity past the end. */
export const turnsUntilYear = (state, targetYear) => {
  let year = state.year;
  let age = state.age || getCalendarAgeId(year);
  let turns = 0;
  while (year < targetYear && turns < MAX_LOOKAHEAD_TURNS) {
    year += getYearsPerTurn(age, state.gameSpeed);
    age = getCalendarAgeId(year);
    turns += 1;
  }
  return year >= targetYear ? turns : Infinity;
};

const researchedOf = (state) => new Set(Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched));

/** The gate on one tech, or null. Today: its year has not come (a hard wait). */
export const techGate = (state, techId, researched = researchedOf(state)) => {
  const tech = TECH_TREE[techId];
  if (!tech || researched.has(techId)) return null;
  if (tech.yearAvailable > state.year) {
    return { kind: 'wait', year: tech.yearAvailable, label: yearText(tech.yearAvailable), turns: turnsUntilYear(state, tech.yearAvailable), extraCostMult: 0 };
  }
  return null;
};

const rateFor = (state, techId, science) => {
  const tech = TECH_TREE[techId];
  return science * (tech && state.researchFocus === tech.category ? 1 + FOCUS_SCIENCE_BONUS : 1);
};

/**
 * When would each tech of `order` finish, in turns from now? Science goes into them in order and
 * banks while a gate holds one back. Returns one entry per tech:
 *   { techId, cost, progress, scienceTurns, gate, finishesIn, waitsOnGate }
 * `finishesIn` = max(science ready, date reached, the one before); at least 1; Infinity with no science.
 */
export const researchSchedule = (state, order, science = null) => {
  const sci = science ?? Math.round((calcIncome(state).techPoints || 0) * 10) / 10;
  const researched = researchedOf(state);
  const bank = Math.max(0, state.resources?.techPoints || 0);
  const nationId = state.playerNationId;
  let cumulative = 0;
  let prev = 1;
  return order.map((techId) => {
    const cost = getResearchCost(state, nationId, techId);
    const progress = state.research?.progress?.[techId] || 0;
    cumulative += Math.max(0, cost - progress);
    const rate = rateFor(state, techId, sci);
    const short = cumulative - bank;
    const scienceTurns = short <= 0 ? 0 : rate > 0 ? Math.ceil(short / rate) : Infinity;
    const gate = techGate(state, techId, researched);
    const gateTurns = gate ? gate.turns : 0;
    const finishesIn = Math.max(1, scienceTurns, gateTurns, prev);
    prev = finishesIn;
    return { techId, cost, progress, scienceTurns, gate, finishesIn, waitsOnGate: !!gate && gateTurns >= scienceTurns };
  });
};

/** The earliest tech that is only held back by its date (its prerequisites are known). */
export const nextGatedTech = (state, researched = researchedOf(state)) => {
  let best = null;
  Object.values(TECH_TREE).forEach((t) => {
    if (researched.has(t.id) || !(t.yearAvailable > state.year)) return;
    const prereqs = t.requiresAny ? t.prerequisites.some((p) => researched.has(p)) : t.prerequisites.every((p) => researched.has(p));
    if (!prereqs || (t.exclusiveWith || []).some((id) => researched.has(id))) return;
    if (!best || t.yearAvailable < best.yearAvailable || (t.yearAvailable === best.yearAvailable && t.id < best.id)) best = t;
  });
  return best ? { techId: best.id, name: best.name, year: best.yearAvailable, label: yearText(best.yearAvailable), turns: turnsUntilYear(state, best.yearAvailable) } : null;
};

const aboutTurns = (n) => (n === Infinity ? tNow('research.longTime') : tNow('research.aboutTurns', { count: n }));

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
 *   'waiting'          the tech under way waits for its date (gate); science banks
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
      ? tNow('research.noteWaits', { name, gate: gate.label, about: aboutTurns(gate.turns), bank: bankText })
      : tNow('research.noteFinishes', { name, time: first.finishesIn === Infinity ? tNow('research.noTime') : tNow('research.turnsCount', { count: first.finishesIn }) });
    return { ...base, kind: gate ? 'waiting' : 'researching', gate, finishesIn: first.finishesIn, needsChoice: false, note, shortLabel: gate ? tNow('research.shortWaits', { name, gate: gate.label }) : tNow('research.shortTurns', { name, n: first.finishesIn === Infinity ? '?' : first.finishesIn }) };
  }
  if (startable) {
    if (!needsChoice && !r.auto) return { ...base, kind: 'researching', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteQueued'), shortLabel: tNow('research.queued') };
    if (r.auto) return { ...base, kind: 'advisor', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteAdvisor'), shortLabel: tNow('research.advisorPicks') };
    return { ...base, kind: 'choose', gate: null, finishesIn: null, needsChoice: true, note: tNow('prompt.research'), shortLabel: tNow('chip.research') };
  }
  if (next) {
    const why = tNow('research.nothingYet', { name: next.name, label: next.label, about: aboutTurns(next.turns) });
    if (r.auto) return { ...base, kind: 'advisor-waiting', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteAdvisorWaits', { why, bank: bank > 0 ? tNow('research.soFar', { n: bank }) : '' }), shortLabel: tNow('research.waitingFor', { label: next.label }) };
    return { ...base, kind: 'idle-waiting', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteIdleWaits', { why, bank: bank > 0 ? tNow('research.soFar', { n: bank }) : '' }), shortLabel: tNow('research.waitingFor', { label: next.label }) };
  }
  return { ...base, kind: 'done', gate: null, finishesIn: null, needsChoice: false, note: tNow('research.noteDone'), shortLabel: tNow('research.nothingLeft') };
};

/** "waits for 500 CE, about 12 turns" for an item with a gate, else null. */
export const gateText = (gate) => (gate && gate.kind === 'wait' ? tNow('research.gateText', { label: gate.label, about: aboutTurns(gate.turns) }) : null);

/**
 * What "Let my advisor pick" does right now: `{ techId }` when something can start (the caller
 * dispatches RESEARCH_TECH after turning the advisor on), else `{ why }` in plain words.
 * Only picks when nothing is under way.
 */
export const advisorPlan = (state) => {
  const status = researchStatus(state);
  if (state.research?.current) return { techId: null, why: null };
  const pick = suggestTechs(state, state.playerNationId, 1)[0] || null;
  if (pick) return { techId: pick, why: null };
  return { techId: null, why: status.note };
};

/**
 * Fund Scholars preview (I138): the science it adds, the bank after, and the turns it saves on the
 * tech under way (banked for later when nothing is under way or a date holds the tech back).
 */
export const scholarsPreview = (state, added) => {
  const bank = Math.max(0, state.resources?.techPoints || 0);
  const current = state.research?.current || null;
  const sched = (s) => researchSchedule(s, [current])[0];
  const name = current ? TECH_TREE[current]?.name || current : null;
  let turnsSaved = 0;
  let note;
  if (!current) {
    note = `+${added} science goes into the bank (${Math.round(bank + added)} banked) for your next choice.`;
  } else {
    const now = sched(state);
    const then = sched({ ...state, resources: { ...state.resources, techPoints: bank + added } });
    if (now.waitsOnGate && now.gate) note = `+${added} science is banked: ${name} still waits for ${now.gate.label}.`;
    else {
      turnsSaved = now.finishesIn === Infinity ? 0 : Math.max(0, now.finishesIn - then.finishesIn);
      note = turnsSaved > 0 ? `+${added} science, saves ${turnsSaved} turn${turnsSaved === 1 ? '' : 's'} on ${name}.` : `+${added} science for ${name}.`;
    }
  }
  return { added, bankAfter: Math.round(bank + added), turnsSaved, note };
};
