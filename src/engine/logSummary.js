// src/engine/logSummary.js
// One summarizer for recurring log and turn-report lines (playtest audit I170, I171): a line that
// the game writes again and again (the per-turn "Upkeep", "Rebels plunder your land trade route to
// D'mt: no trade this turn" 90 turns running) becomes ONE entry with a count, and the original
// lines stay available in `details` for anyone who opens it. Pure; reads only the lines given.
//
// A line recurs when it matches a RECURRING rule. Rules are listed here, not guessed, so a
// one-off message is never merged by accident. The key of a rule's line is the text with its
// numbers blanked ("Upkeep: -# (army #...)"), plus the rule's own `keyOf` when the same rule must
// keep different subjects apart (one trade route per partner).
import { countOf } from './grammar';

export const RECURRING = [
  { id: 'upkeep', test: /^Upkeep:/, noun: 'turn' },
  { id: 'plunder', test: /plunder your .* trade route/i, noun: 'turn' },
  { id: 'cut-route', test: /cut your trade route/i, noun: 'time' },
  { id: 'hunger', test: /^Out of (supplies|supply):/, noun: 'turn' }
];

const blank = (message) => String(message).replace(/-?\d[\d,.]*/g, '#');
const asLog = (l) => (typeof l === 'string' ? { message: l, type: 'action' } : l || { message: '', type: 'action' });

/** The rule a line belongs to, or null. */
export const recurringRuleOf = (message) => RECURRING.find((r) => r.test.test(String(message || ''))) || null;

/**
 * Collapse recurring lines. Returns the lines in order with every recurring group replaced by
 * its latest line (kept at the latest line's place), carrying `count` (how many lines it stands
 * for), `firstYear`, `details` (every original line, oldest first) and a `message` that says so
 * when count > 1: "<latest message> (x12 since 1400)". Lines that are not recurring pass through
 * as they were (same object). Groups of one line pass through unchanged.
 */
export const summarizeLogs = (logs, { minCount = 2 } = {}) => {
  const list = (logs || []).map(asLog);
  const groups = new Map();
  list.forEach((l, i) => {
    const rule = recurringRuleOf(l.message);
    if (!rule) return;
    const key = `${rule.id}|${rule.id === 'upkeep' ? '' : blank(l.message)}`;
    const g = groups.get(key) || { rule, items: [] };
    g.items.push({ log: l, index: i });
    groups.set(key, g);
  });
  const lastOf = new Map();
  groups.forEach((g, key) => { if (g.items.length >= minCount) lastOf.set(g.items[g.items.length - 1].index, key); });
  const hidden = new Set();
  groups.forEach((g) => { if (g.items.length >= minCount) g.items.slice(0, -1).forEach((it) => hidden.add(it.index)); });
  const out = [];
  list.forEach((l, i) => {
    if (hidden.has(i)) return;
    const key = lastOf.get(i);
    if (key === undefined) { out.push(l); return; }
    const g = groups.get(key);
    const first = g.items[0].log;
    const count = g.items.length;
    out.push({
      ...l,
      message: `${l.message} (${countOf(count, g.rule.noun)} so far, since ${first.year})`,
      count,
      firstYear: first.year,
      details: g.items.map((it) => it.log)
    });
  });
  return out;
};
