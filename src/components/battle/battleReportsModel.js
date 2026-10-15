// src/components/battle/battleReportsModel.js
// W16 Battle reports (plans/UI-DESIGN.md): the player's last 30 battles (src/engine/battleReports.js)
// as a list with filters (All, Won, Lost, Command, Auto, Sieges, Field, Sea) and the detail of
// one: its name, the result from your side (Victory, Held, Defeat, Lost, Repelled, Stalemate),
// Command or Auto, both sides in and lost, a plain summary and the strength timeline. Pure.
import { auxiliaryLine, ledgerOf, menOf } from '../../engine/battleLedger';
import { playerWon } from '../../engine/battleReports';
import { FATE_VIEW, battleTitle, describeOutcome, fateOf, fateText, nationName, regionName, sidesFor, timelineFor, verificationNotice } from './battleReportView';

export const REPORT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'command', label: 'Command' },
  { id: 'auto', label: 'Auto' },
  { id: 'siege', label: 'Sieges' },
  { id: 'field', label: 'Field' },
  { id: 'sea', label: 'Sea' }
];

/** What sort of battle an entry was: 'sea', 'field' or 'siege' (an assault on a city, a landing, a defence). */
export const reportGroup = (e) => {
  if (e.kind === 'naval' || e.battleType === 'naval') return 'sea';
  if (['field', 'river', 'ambush', 'sally'].includes(e.battleType) || e.kind === 'field') return 'field';
  return 'siege';
};

export const filterReports = (reports = [], filter = 'all') => reports.filter((e) => {
  if (filter === 'won') return playerWon(e);
  if (filter === 'lost') return e.outcome !== 'stalemate' && !playerWon(e);
  if (filter === 'command') return !!e.commanded;
  if (filter === 'auto') return !e.commanded;
  if (filter === 'siege' || filter === 'field' || filter === 'sea') return reportGroup(e) === filter;
  return true;
});

/** The result word from your side and its tone. */
export const resultOf = (e) => {
  if (e.outcome === 'stalemate') return { label: 'Stalemate', tone: 'draw' };
  const won = playerWon(e);
  // A raid or a sack takes no city: it is driven off, or it gets through (I006).
  if (e.kind === 'raid' || e.kind === 'sack') {
    if (e.playerSide === 'defender') return won ? { label: 'Driven off', tone: 'win' } : { label: e.kind === 'sack' ? 'Sacked' : 'Raided', tone: 'loss' };
    return won ? { label: 'Victory', tone: 'win' } : { label: 'Driven off', tone: 'loss' };
  }
  if (e.playerSide === 'defender') return won ? { label: 'Held', tone: 'win' } : { label: e.captured ? 'Lost' : 'Defeat', tone: 'loss' };
  return won ? { label: 'Victory', tone: 'win' } : { label: 'Repelled', tone: 'loss' };
};

export const yearText = (y) => (y < 0 ? `${-y} BCE` : `${y} CE`);
const men = (n) => Math.round(n || 0);
const sideMen = (e, side) => menOf((e.sides?.[side] || []).reduce((s, u) => s + u.before, 0));

/** One row of the list. */
export const reportRow = (state, e) => {
  const { mine, theirs } = sidesFor(e);
  return {
    id: e.id,
    name: battleTitle(state, e),
    group: reportGroup(e),
    when: `T${e.turn} · ${yearText(e.year)}`,
    mode: e.commanded ? 'Command' : 'Auto',
    result: resultOf(e),
    losses: `-${men(e.fallen?.[mine])} / -${men(e.fallen?.[theirs])}`
  };
};

/**
 * One side's units for the detail: men before and after and the fate in plain words
 * (battleReportView.js FATE_VIEW). Works for older entries without fates.
 */
export const fateRows = (e, side) => (e?.sides?.[side] || []).map((u) => {
  const fate = fateOf(e, side, u);
  return {
    id: u.id, classId: u.classId, navalLine: u.navalLine || null, regiment: u.regiment || null,
    menBefore: menOf(u.before), menAfter: menOf(u.after), temp: u.temp || null,
    fate, tone: FATE_VIEW[fate].tone, text: fateText(e, side, u), byCavalry: !!u.byCavalry
  };
});

/**
 * The battle whose detail shows (REPORT-01): the picked one if the filter still lists it, else the
 * first the filter lists, else null (the empty state; never a battle the filter hides).
 */
export const detailFor = (all, shown, pickedId) => {
  const picked = all.find((r) => r.id === pickedId) || null;
  return picked && shown.includes(picked) ? picked : shown[0] || null;
};

/**
 * The line under a report about its replay, from the mode the battle was RECORDED in (REPORT-02):
 * an Auto battle never says "commanded battles keep no replay".
 */
export const replayFooter = (e, canReplay, oneRound) => {
  if (oneRound) return 'Decided in one round: these numbers are the whole battle.';
  if (e.commanded) return canReplay ? 'Commanded battle: the timeline above is kept.' : 'Commanded battles keep no replay yet.';
  return canReplay ? 'Auto battles keep their rounds.' : 'This Auto battle was decided without rounds to replay.';
};

/** The detail of one battle. */
export const reportDetail = (state, e) => {
  if (!e) return null;
  const { mine, theirs } = sidesFor(e);
  const myNation = e[`${mine}NationId`]; const theirNation = e[`${theirs}NationId`];
  const outcome = describeOutcome(e);
  const fled = (e.fled?.[mine] || 0) + (e.fled?.[theirs] || 0) > 0
    ? ` Fled the field: ${men(e.fled[mine])} of yours, ${men(e.fled[theirs])} of theirs.` : '';
  const destroyed = (e.sides?.[theirs] || []).filter((u) => u.after <= 0).length;
  const lostUnits = (e.sides?.[mine] || []).filter((u) => u.after <= 0).length;
  const ledger = ledgerOf(e);
  // One round has no course to play back (I016): say so, and keep the replay for the longer ones.
  const rounds = e.rounds ?? Math.max(0, timelineFor(e).filter((p) => !p.pursuit).length - 1);
  return {
    ...reportRow(state, e),
    who: `${e.playerSide === 'attacker' ? 'You attacked' : 'You defended'} · ${e.commanded ? 'Command' : 'Auto'}${e.terrain ? ` · ${e.terrain}` : ''}`,
    yours: { name: nationName(state, myNation), in: men(sideMen(e, mine)), lost: men(e.fallen?.[mine]) },
    theirs: { name: nationName(state, theirNation), in: men(sideMen(e, theirs)), lost: men(e.fallen?.[theirs]) },
    summary: `${outcome.text}. ${destroyed ? `${destroyed} of their regiments destroyed` : 'None of their regiments destroyed'}; ${lostUnits ? `${lostUnits} of yours lost` : 'none of yours lost'}.${fled}`,
    timeline: timelineFor(e),
    canReplay: timelineFor(e).length > 1,
    footer: replayFooter(e, timelineFor(e).length > 1, !e.commanded && rounds === 1),
    oneRound: !e.commanded && rounds === 1,
    // The receipt: what the campaign logged, the temporary troops, and how a commanded battle was checked.
    line: e.line || null,
    aux: [auxiliaryLine(ledger.aux), auxiliaryLine(ledger.theirAux, { yours: false })].filter(Boolean),
    notice: verificationNotice(e),
    place: e.targetRegionId ? regionName(e.targetRegionId) : null,
    targetRegionId: e.targetRegionId || null
  };
};
