// src/hooks/interactionModel.js
// One priority registry for everything that wants the middle of the screen (playtest audit X16,
// I151 to I153): the decision cards (an event, a peace offer, an attack to answer, the pre-battle
// card, a tribute demand, a join offer, the research choice), the turn report and the user's own
// sheets, the two side panels (the tab dock and the city panel) and informational notices (first
// contact). Pure: a list of entries and which one is active; useExclusivePanel.js holds the store
// and the React hooks.
//
// Rules:
//   - On a phone or a tablet exactly one entry shows: the active one. The others are tucked (a
//     card or a notice waits as a chip, a panel just closes) and come back when it closes.
//   - On a desktop or laptop the panels stay beside the cards as before (shownIds below).
//   - Something the game opens (an arrival) takes the screen only from something of lower priority;
//     something the player opens always takes it (the other waits as a chip).
//   - The player can set a card aside ("Look at the map first"): it stays a chip until tapped.

// Two side panels (about 380 + 450 px) only leave half the screen to the map from about here up,
// and a decision card beside the wide dock (640 + 52 px) only keeps its width from here up.
export const EXCLUSIVE_BELOW_WIDTH = 1600;

// Who goes first when several arrive in one turn: the engine's own order (the battle queue waits
// for an event and a peace offer, battleQueue.js), then the report, then the choices that can wait.
export const PRIORITY = {
  event: 90,
  peace: 80,
  defense: 70,
  report: 65,
  capture: 62, // the capture card (decision 40): after the report, before the next attack's card
  preBattle: 60,
  tribute: 50,
  join: 45,
  research: 40,
  sheet: 30, // the player's own sheets: settings, the nation overview, the log
  panel: 10, // the tab dock, the city panel
  notice: 5 // first contact: shows when nothing else is up
};

export const emptyInteractions = () => ({ entries: [], activeId: null, seq: 0 });

const find = (s, id) => s.entries.find((e) => e.id === id) || null;

/** The entry that takes the screen when the active one goes: highest priority, then first come. */
const pickNext = (entries) => {
  let best = null;
  entries.forEach((e) => {
    if (e.tucked) return;
    if (!best || e.priority > best.priority || (e.priority === best.priority && e.seq < best.seq)) best = e;
  });
  return best ? best.id : null;
};

/**
 * Something opened. `entry`: { id, priority, kind: 'card' | 'panel' | 'notice', label?, testId? }.
 * `user`: the player opened it (it takes the screen); otherwise it takes it only from something
 * of lower priority.
 */
export const openInteraction = (s, entry, { user = false } = {}) => {
  const old = find(s, entry.id);
  if (old) {
    const entries = s.entries.map((e) => (e.id === entry.id ? { ...e, ...entry, tucked: user ? false : e.tucked } : e));
    return { ...s, entries, activeId: user ? entry.id : s.activeId };
  }
  const seq = s.seq + 1;
  const added = { kind: 'card', priority: 0, label: null, ...entry, seq, tucked: false };
  const entries = [...s.entries, added];
  const active = find(s, s.activeId);
  const takes = user || !active || added.priority > active.priority;
  return { entries, seq, activeId: takes ? added.id : s.activeId };
};

/** Something closed for good (answered, dismissed): the next one in line takes the screen. */
export const closeInteraction = (s, id) => {
  if (!find(s, id)) return s;
  const entries = s.entries.filter((e) => e.id !== id);
  return { ...s, entries, activeId: s.activeId === id ? pickNext(entries) : s.activeId };
};

/** The player asked for this one (a chip tap, End Turn's blocker): it takes the screen. */
export const promoteInteraction = (s, id) => {
  if (!find(s, id)) return s;
  return { ...s, entries: s.entries.map((e) => (e.id === id ? { ...e, tucked: false } : e)), activeId: id };
};

/** The player set this one aside: it waits as a chip until asked for. */
export const tuckInteraction = (s, id) => {
  if (!find(s, id)) return s;
  const entries = s.entries.map((e) => (e.id === id ? { ...e, tucked: true } : e));
  return { ...s, entries, activeId: s.activeId === id ? pickNext(entries) : s.activeId };
};

/** New words for an open entry's chip. */
export const relabelInteraction = (s, id, patch) => {
  const e = find(s, id);
  if (!e || Object.keys(patch).every((k) => e[k] === patch[k])) return s;
  return { ...s, entries: s.entries.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
};

/**
 * The ids on screen. `compact`: a phone or a tablet (the user's ruling of 2026-10-13: the one-card
 * rule is theirs only): exactly the active entry shows. A desktop or laptop keeps what it had:
 *   - the two side panels take turns below EXCLUSIVE_BELOW_WIDTH and share the screen above it;
 *   - cards sit beside the panels; the pressing ones (an event, a peace offer, an attack, the turn
 *     report) show together as before, and a lesser one (an army's arrival, a tribute demand)
 *     waits for them, which is what the old "busy" lists did;
 *   - a notice shows when no card does.
 */
export const shownIds = (s, width, compact = false) => {
  const out = new Set();
  const active = find(s, s.activeId);
  if (compact) {
    if (active && !active.tucked) out.add(active.id);
    return out;
  }
  const cards = s.entries.filter((e) => e.kind === 'card' && !e.tucked);
  if (cards.length) {
    const top = Math.max(...cards.map((e) => e.priority));
    const floor = Math.min(top, PRIORITY.report);
    cards.forEach((e) => { if (e.priority >= floor || e.id === s.activeId) out.add(e.id); });
  }
  const panels = s.entries.filter((e) => e.kind === 'panel' && !e.tucked);
  if (width >= EXCLUSIVE_BELOW_WIDTH) panels.forEach((e) => out.add(e.id));
  else if (panels.length) {
    // The one the player opened last (the active one when it is a panel).
    const last = active && active.kind === 'panel' && !active.tucked ? active : panels.reduce((a, b) => (b.seq > a.seq ? b : a));
    out.add(last.id);
  }
  if (!cards.length) { const notice = pickNext(s.entries.filter((e) => e.kind === 'notice')); if (notice) out.add(notice); }
  return out;
};

/** Whether this id shows. An id the registry has not heard of yet shows (it registers on mount). */
export const isShown = (s, id, width, compact = false) => !find(s, id) || shownIds(s, width, compact).has(id);

/** The cards and notices that wait: one chip each, the most pressing first. Panels have no chip. */
export const waitingChips = (s, width, compact = false) => {
  const shown = shownIds(s, width, compact);
  return s.entries
    .filter((e) => e.kind !== 'panel' && e.label && !shown.has(e.id))
    .sort((a, b) => b.priority - a.priority || a.seq - b.seq)
    .map((e) => ({ id: e.id, label: e.label, testId: e.testId || null, tone: e.tone || null, priority: e.priority }));
};
