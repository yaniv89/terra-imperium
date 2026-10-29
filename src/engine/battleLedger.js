// src/engine/battleLedger.js
// The participant ledger of a battle (playtest audit CB02; plan W02; addendum X04, X05; inventory
// I002, I003). One battle, one ledger: every unit that took the field, its strength before and
// at the end, and how it left. The battle report, the result screen and the Log all read it, so
// they can never disagree.
//
// The rows live on the battle report entry (battleReports.js `entry.sides`). Per side:
//   before  strength that went in
//   fallen  strength gone for good: killed in the fighting, plus the survivors the battle's result
//           destroyed (`runDown`: caught on the field, trapped in a fallen city, sunk falling back)
//   fled    survivors that broke and left the field (they live on in the campaign)
//   after   survivors that held or withdrew in order
// Conservation, per side:  before = after + fallen + fled.
//
// The check (checkLedger, called by the one outcome service, battleOutcome.js) compares the ledger
// with the map the outcome was committed to. A breach is kept on the entry (`entry.breaches`) and
// reported by stateAudit.js; it never throws: a battle always ends in the outcome service.
//   missing    a unit that took the field had no row in the battle's result (it counts as lost)
//   duplicate  one unit listed twice
//   gained     a unit ended stronger than it went in
//   retained   a unit destroyed in the battle still stands on the map
//   strength   a survivor's strength on the map is not the ledger's
//
// Men: the map counts strength; one point of strength is MEN_PER_STRENGTH men (aftermath.js).
// `menOf` / `menText` are the ONE conversion every battle surface shows men through. Pure.
import { MEN_PER_STRENGTH } from './aftermath';

export const LEDGER_VERSION = 1;

/** Men for a strength on the map. */
export const menOf = (strength) => Math.round(Math.max(0, strength || 0) * MEN_PER_STRENGTH);
// A scout party (unit.explorer, scouting.js) is a few riders, not a regiment: its strength is its
// health, and at full strength it is SCOUT_PARTY_MEN men (it read "3,000 men", help-map-8 playtest).
export const SCOUT_PARTY_MEN = 30;
/** Men in one unit on the map: menOf its strength, a scout party's own few. */
export const unitMenOf = (u) => (u?.explorer
  ? Math.round((SCOUT_PARTY_MEN * Math.max(0, u.strength || 0)) / Math.max(1, u.maxStrength || u.strength || 1))
  : menOf(u?.strength));
/** A count of men as text: 12,340. */
export const countText = (men) => Math.round(men || 0).toLocaleString('en-US');
/** Men for a strength on the map, as text. */
export const menText = (strength) => countText(menOf(strength));

const isGone = (u) => u.fate === 'runDown';

/** Men for `strength` of a report row (battleReports.js: a scout's row carries `explorer` and `max`). */
export const rowMenOf = (row, strength) => unitMenOf({ explorer: row?.explorer, strength, maxStrength: row?.max });

/** One side's totals from its rows, in strength: { units, before, after, fallen, fled, runDown,
 * destroyed }, and the same in men (`men`, each row through rowMenOf, so the men balance too). */
export const sideTotals = (rows = []) => {
  const t = { units: rows.length, before: 0, after: 0, fallen: 0, fled: 0, runDown: 0, destroyed: 0 };
  const men = { before: 0, after: 0, fallen: 0, fled: 0, runDown: 0 };
  rows.forEach((u) => {
    const before = Math.max(0, u.before || 0);
    const end = Math.max(0, Math.min(before, u.after || 0));
    const mBefore = rowMenOf(u, before); const mEnd = rowMenOf(u, end);
    t.before += before; men.before += mBefore;
    t.fallen += before - end; men.fallen += mBefore - mEnd;
    if (end <= 0) { t.destroyed += 1; return; }
    if (isGone(u)) { t.destroyed += 1; t.runDown += end; t.fallen += end; men.runDown += mEnd; men.fallen += mEnd; return; }
    if (u.routed) { t.fled += end; men.fled += mEnd; } else { t.after += end; men.after += mEnd; }
  });
  return { ...t, men };
};

/** before = after + fallen + fled for these totals. */
export const conserved = (t) => t.before === t.after + t.fallen + t.fled;

/**
 * The ledger of a report entry, from the player's side:
 * { mine, theirs (sideTotals), aux, conserved, breaches }. Works for entries saved before the
 * ledger (their rows carry before, after, routed and, since the fates, the fate).
 */
export const ledgerOf = (entry) => {
  const mineKey = entry?.playerSide === 'attacker' ? 'attacker' : 'defender';
  const theirsKey = mineKey === 'attacker' ? 'defender' : 'attacker';
  const mine = sideTotals(entry?.sides?.[mineKey]);
  const theirs = sideTotals(entry?.sides?.[theirsKey]);
  const breaches = entry?.breaches || [];
  return { mineKey, theirsKey, mine, theirs, aux: entry?.aux?.[mineKey] || null, theirAux: entry?.aux?.[theirsKey] || null, conserved: conserved(mine) && conserved(theirs) && !breaches.length, breaches };
};

/**
 * The ledger against the committed map. `rows`: { attacker, defender } report rows; `before` and
 * `after`: the units maps around the outcome; `missing`: ids the sanitizer found absent from the
 * battle's result (gameReducer.js sanitizeTacticalResult). Returns the breaches (empty = sound).
 */
export const checkLedger = ({ rows, before = {}, after = {}, missing = [] }) => {
  const breaches = [];
  const seen = new Set();
  (missing || []).forEach((id) => breaches.push({ id, kind: 'missing' }));
  ['attacker', 'defender'].forEach((side) => (rows?.[side] || []).forEach((u) => {
    if (seen.has(u.id)) { breaches.push({ id: u.id, kind: 'duplicate' }); return; }
    seen.add(u.id);
    if (u.after > u.before) breaches.push({ id: u.id, kind: 'gained', ledger: u.before, map: u.after });
    if (!before[u.id]) return; // militia, auxiliaries and synthetic troops live on the battle only
    const onMap = after[u.id] ? Math.max(0, after[u.id].strength || 0) : 0;
    const kept = u.after > 0 && !isGone(u) ? u.after : 0;
    if (kept === 0 && onMap > 0) breaches.push({ id: u.id, kind: 'retained', ledger: 0, map: onMap });
    else if (kept !== Math.round(onMap)) breaches.push({ id: u.id, kind: 'strength', ledger: kept, map: onMap });
  }));
  return breaches;
};

/**
 * The troops trained inside the battle, per side (I015): temporary, they leave after it. From a
 * commanded battle's economy report (squads by kind) or the auto-resolve's (strength).
 * [{ squads, standing } | { fielded, standing } | null] -> { attacker, defender } or null.
 */
export const auxiliariesOf = (report) => {
  const eco = report?.tactical?.economy;
  const count = (o) => Object.values(o || {}).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
  if (Array.isArray(eco)) {
    const side = (e) => {
      if (!e) return null;
      // Laborers are not troops: they are counted apart (workersLost).
      const trained = { ...(e.trained || {}) }; delete trained.worker;
      const squads = count(trained);
      return squads > 0 || e.workersLost > 0 ? { squads, standing: count(e.auxiliariesStanding), workersLost: e.workersLost || 0 } : null;
    };
    const out = { attacker: side(eco[0]), defender: side(eco[1]) };
    return out.attacker || out.defender ? out : null;
  }
  const auto = report?.auxiliaries;
  if (Array.isArray(auto)) {
    const side = (a) => (a && a.fielded > 0 ? { strength: Math.round(a.fielded), standing: Math.round(a.standing || 0) } : null);
    const out = { attacker: side(auto[0]), defender: side(auto[1]) };
    return out.attacker || out.defender ? out : null;
  }
  return null;
};

/** The plain line about a side's temporary troops, or null. Worded so a second pool (recruits that stay) can sit beside it. */
export const auxiliaryLine = (aux, { yours = true } = {}) => {
  if (!aux) return null;
  const who = yours ? 'Your' : 'Their';
  if (aux.squads > 0) return `${who} auxiliaries trained in the battle: ${aux.squads} squad${aux.squads === 1 ? '' : 's'}, ${aux.standing} standing at the end. Temporary: they leave after the battle.`;
  if (aux.strength > 0) return `${who} auxiliaries raised for the battle: ${menText(aux.strength)} men, ${menText(aux.standing)} standing at the end. Temporary: they leave after the battle.`;
  return null;
};

/** What the train buttons say before the player pays (I015). */
export const AUXILIARY_NOTE = 'Temporary: troops trained here fight this battle, then leave.';
