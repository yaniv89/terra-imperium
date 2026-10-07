// src/components/battle/battleReportView.js
// How a battle report entry (src/engine/battleReports.js) reads from the player's side: the
// headline, which bar is "ours", how many of each side fell. Pure, shared by the replay, the
// report sheet and the Military tab's list.
import { unitDisplayName } from '../../data/unitNames';
import { REGIONS_DATA } from '../../data/regions';
import { battleName } from '../../engine/battleNames';

export const regionName = (id) => (id && REGIONS_DATA[id]?.name) || id || 'the field';
export const unitName = (classId, ageId = 'bronze', navalLine = null) => unitDisplayName(ageId, classId, navalLine) || 'Unit';
export const nationName = (state, id) => (id === 'rebels' ? 'Rebels' : state.nations?.[id]?.name || id || 'Unknown');
// "Siege of Kish": the name the entry was given when fought, or one made now for an older entry.
export const battleTitle = (state, entry) => entry?.name || battleName(state, entry || {});

// 'win' | 'loss' | 'draw', and a short headline.
export const describeOutcome = (entry) => {
  const place = regionName(entry.targetRegionId);
  if (entry.outcome === 'stalemate') return { tone: 'draw', text: `Stalemate at ${place}` };
  const won = entry.outcome === entry.playerSide;
  if (entry.kind === 'naval') return won ? { tone: 'win', text: `Victory at sea off ${place}` } : { tone: 'loss', text: `Defeat at sea off ${place}` };
  if (entry.kind === 'rebellion') return won ? { tone: 'win', text: `Rebels crushed in ${place}` } : { tone: 'loss', text: `The rebels held ${place}` };
  if (entry.playerSide === 'attacker') {
    if (!won) return { tone: 'loss', text: `Repelled at ${place}` };
    return entry.captured ? { tone: 'win', text: `${place} taken` } : { tone: 'win', text: `Victory at ${place}: the siege goes on` };
  }
  if (won) return { tone: 'win', text: `${place} held` };
  return entry.captured ? { tone: 'loss', text: `${place} lost` } : { tone: 'loss', text: `${place} held, but its walls are damaged` };
};

// The player's side and the enemy's, in that order, for bars and tables.
export const sidesFor = (entry) => {
  const mine = entry.playerSide === 'attacker' ? 'attacker' : 'defender';
  const theirs = mine === 'attacker' ? 'defender' : 'attacker';
  return { mine, theirs };
};

// The timeline as [{ mine, theirs, mineBroken, theirsBroken }] fractions of each side's start.
export const timelineFor = (entry) => {
  const t = entry.timeline || [];
  if (t.length < 2) return [];
  const { mine } = sidesFor(entry);
  const key = mine === 'attacker' ? ['att', 'def'] : ['def', 'att'];
  const broken = mine === 'attacker' ? ['attBroken', 'defBroken'] : ['defBroken', 'attBroken'];
  const start = { mine: Math.max(1, t[0][key[0]]), theirs: Math.max(1, t[0][key[1]]) };
  return t.map((p) => ({
    mine: p[key[0]] / start.mine,
    theirs: p[key[1]] / start.theirs,
    mineAbs: p[key[0]], theirsAbs: p[key[1]],
    mineBroken: !!p[broken[0]], theirsBroken: !!p[broken[1]],
    pursuit: !!p.pursuit
  }));
};

export const formatMen = (n) => Math.round(n || 0).toLocaleString('en-US');

// Each unit's fate in plain words (src/engine/battleReports.js unitFate), with a tone the sheet
// colours and picks an icon by: 'good', 'calm', 'warn', 'bad'. 'broke' is only for reports saved
// before fates were recorded: a broken unit of the losing side whose end was not written down.
export const FATE_VIEW = {
  held: { text: 'Held the field', tone: 'good' },
  pulledBack: { text: 'Pulled back', tone: 'warn' },
  withdrew: { text: 'Withdrew in good order', tone: 'calm' },
  escaped: { text: 'Broke but escaped', tone: 'warn' },
  runDown: { text: 'Caught and destroyed while fleeing', tone: 'bad' },
  fellFighting: { text: 'Destroyed in the fight', tone: 'bad' },
  broke: { text: 'Broke and fled', tone: 'warn' }
};

/** A unit's fate in a report entry: the recorded one, or the best reading of an older entry. */
export const fateOf = (entry, side, u) => {
  if (u.fate && FATE_VIEW[u.fate]) return u.fate;
  if (!(u.after > 0)) return 'fellFighting';
  const loser = entry.outcome === 'attacker' ? 'defender' : entry.outcome === 'defender' ? 'attacker' : null;
  if (side !== loser) return u.routed ? 'pulledBack' : 'held';
  return u.routed ? 'broke' : 'withdrew';
};

/** The plain words for a unit's fate. */
export const fateText = (entry, side, u) => {
  const fate = fateOf(entry, side, u);
  if (fate === 'runDown') {
    if (u.domain === 'naval' || u.classId === 'naval') return 'Sunk while falling back';
    if (u.byCavalry) return 'Run down by cavalry while fleeing';
  }
  return FATE_VIEW[fate].text;
};

// Without intelligence on the target, the odds are a scouts' guess, not numbers (plan §6a): three
// broad bands from the real auto-resolve chance, so the decision is never blind but intel still
// matters.
export const SCOUT_BANDS = [
  { id: 'likely', min: 0.65, label: 'Likely win', tone: 'text-emerald-300', hint: 'Your scouts think the garrison is weaker than your army.' },
  { id: 'uncertain', min: 0.35, label: 'Uncertain', tone: 'text-amber-300', hint: 'Your scouts can\'t tell who has the edge.' },
  { id: 'unlikely', min: -1, label: 'Unlikely', tone: 'text-red-300', hint: 'Your scouts think the garrison is stronger than your army.' }
];
export const scoutsEstimate = (winChance) => SCOUT_BANDS.find((b) => winChance >= b.min);
