// src/components/battle/battleReportView.js
// How a battle report entry (src/engine/battleReports.js) reads from the player's side: the
// headline, which bar is "ours", how many of each side fell. Pure, shared by the replay, the
// report sheet and the Military tab's list.
import { unitName as unitDisplayName } from '../../i18n/gameText';
import { REGIONS_DATA } from '../../data/regions';
import { battleName } from '../../engine/battleNames';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';

export const regionName = (id) => { const n = id && REGIONS_DATA[id]?.name; return n ? nameNow('city', null, n) : id || t('bt.rep.theField'); };
export const unitName = (classId, ageId = 'bronze', navalLine = null) => unitDisplayName(ageId, classId, navalLine) || t('bt.rep.unit');
export const nationName = (state, id) => { if (id === 'rebels') return t('bt.rep.rebels'); const n = state.nations?.[id]; return n?.name ? nameNow('people', id, n.name) : id || t('bt.rep.unknown'); };
// "Siege of Kish": the name the entry was given when fought, or one made now for an older entry.
export const battleTitle = (state, entry) => nameNow('battle', null, entry?.name || battleName(state, entry || {}));

// 'win' | 'loss' | 'draw', and a short headline.
export const describeOutcome = (entry) => {
  const place = regionName(entry.targetRegionId);
  if (entry.outcome === 'stalemate') return { tone: 'draw', text: t('bt.rep.out.stalemate', { place }) };
  const won = entry.outcome === entry.playerSide;
  if (entry.kind === 'naval') return won ? { tone: 'win', text: t('bt.rep.out.seaWin', { place }) } : { tone: 'loss', text: t('bt.rep.out.seaLoss', { place }) };
  if (entry.kind === 'rebellion') return won ? { tone: 'win', text: t('bt.rep.out.rebelWin', { place }) } : { tone: 'loss', text: t('bt.rep.out.rebelLoss', { place }) };
  // A raid or a sack is never a conquest, and it says nothing about walls (I006): the raiders are
  // driven off, or they get through with the loot.
  if (entry.kind === 'raid' || entry.kind === 'sack') {
    const sack = entry.kind === 'sack';
    if (entry.playerSide === 'defender') {
      if (won) return { tone: 'win', text: t(sack ? 'bt.rep.out.sackDefWin' : 'bt.rep.out.raidDefWin', { place }) };
      return { tone: 'loss', text: t(sack ? 'bt.rep.out.sackDefLoss' : 'bt.rep.out.raidDefLoss', { place }) };
    }
    return won ? { tone: 'win', text: t(sack ? 'bt.rep.out.sackAtkWin' : 'bt.rep.out.raidAtkWin', { place }) } : { tone: 'loss', text: t('bt.rep.out.raidAtkLoss', { place }) };
  }
  // A battle in the open takes no city either.
  if (entry.kind === 'field') return won ? { tone: 'win', text: t('bt.rep.out.fieldWin', { place }) } : { tone: 'loss', text: t('bt.rep.out.fieldLoss', { place }) };
  if (entry.playerSide === 'attacker') {
    if (!won) return { tone: 'loss', text: t('bt.rep.out.repelled', { place }) };
    return entry.captured ? { tone: 'win', text: t('bt.rep.out.taken', { place }) } : { tone: 'win', text: t('bt.rep.out.notYet', { place }) };
  }
  if (won) return { tone: 'win', text: t('bt.rep.out.held', { place }) };
  return entry.captured ? { tone: 'loss', text: t('bt.rep.out.lost', { place }) } : { tone: 'loss', text: t('bt.rep.out.holdsOn', { place }) };
};

// How a commanded battle was checked by the campaign (src/engine/battleVerify.js), in plain words
// for the player, or null when there is nothing to say (verified, or an Auto battle).
const VERIFY_KINDS = new Set(['desync', 'setup', 'cut', 'version', 'error', 'no_setup']);
export const verificationNotice = (entry) => {
  const parts = [];
  if (entry?.verification && VERIFY_KINDS.has(entry.verification)) parts.push(t(`bt.rep.verify.${entry.verification}`));
  const missing = (entry?.breaches || []).filter((b) => b.kind === 'missing').length;
  if (missing) parts.push(t('bt.rep.missing', { count: missing }));
  const other = (entry?.breaches || []).some((b) => b.kind !== 'missing');
  if (other) parts.push(t('bt.rep.mismatch'));
  return parts.length ? parts.join(' ') : null;
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
// (`text` is read when needed, so it follows the language.)
const fateView = (id, tone) => ({ tone, get text() { return t(`bt.rep.fate.${id}`); } });
export const FATE_VIEW = {
  held: fateView('held', 'good'),
  pulledBack: fateView('pulledBack', 'warn'),
  withdrew: fateView('withdrew', 'calm'),
  escaped: fateView('escaped', 'warn'),
  runDown: fateView('runDown', 'bad'),
  fellFighting: fateView('fellFighting', 'bad'),
  broke: fateView('broke', 'warn')
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
    if (u.domain === 'naval' || u.classId === 'naval') return t('bt.rep.fate.sunk');
    if (u.byCavalry) return t('bt.rep.fate.cavalry');
  }
  return FATE_VIEW[fate].text;
};

// Without intelligence on the target, the odds are a scouts' guess, not numbers (plan §6a): three
// broad bands from the real auto-resolve chance, so the decision is never blind but intel still
// matters.
const scoutBand = (id, min, tone) => ({ id, min, tone, get label() { return t(`bt.scout.${id}`); }, get hint() { return t(`bt.scout.${id}Hint`); } });
export const SCOUT_BANDS = [scoutBand('likely', 0.65, 'text-emerald-300'), scoutBand('uncertain', 0.35, 'text-amber-300'), scoutBand('unlikely', -1, 'text-red-300')];
export const scoutsEstimate = (winChance) => SCOUT_BANDS.find((b) => winChance >= b.min);
