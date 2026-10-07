// src/components/battle/battleReportsModel.js
// W16 Battle reports (plans/UI-DESIGN.md): the player's last 30 battles (src/engine/battleReports.js)
// as a list with filters (All, Won, Lost, Command, Auto, Sieges, Field, Sea) and the detail of
// one: its name, the result from your side (Victory, Held, Defeat, Lost, Repelled, Stalemate),
// Command or Auto, both sides in and lost, a plain summary and the strength timeline. Pure.
import { MEN_PER_STRENGTH } from '../../engine/aftermath';
import { playerWon } from '../../engine/battleReports';
import { FATE_VIEW, battleTitle, describeOutcome, fateOf, fateText, nationName, regionName, sidesFor, timelineFor } from './battleReportView';

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
  if (e.playerSide === 'defender') return won ? { label: 'Held', tone: 'win' } : { label: e.captured ? 'Lost' : 'Defeat', tone: 'loss' };
  return won ? { label: 'Victory', tone: 'win' } : { label: 'Repelled', tone: 'loss' };
};

export const yearText = (y) => (y < 0 ? `${-y} BCE` : `${y} CE`);
const men = (n) => Math.round(n || 0);
const sideMen = (e, side) => (e.sides?.[side] || []).reduce((s, u) => s + u.before, 0) * MEN_PER_STRENGTH;

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
    menBefore: men(u.before * MEN_PER_STRENGTH), menAfter: men(u.after * MEN_PER_STRENGTH),
    fate, tone: FATE_VIEW[fate].tone, text: fateText(e, side, u), byCavalry: !!u.byCavalry
  };
});

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
  return {
    ...reportRow(state, e),
    who: `${e.playerSide === 'attacker' ? 'You attacked' : 'You defended'} · ${e.commanded ? 'Command' : 'Auto'}${e.terrain ? ` · ${e.terrain}` : ''}`,
    yours: { name: nationName(state, myNation), in: men(sideMen(e, mine)), lost: men(e.fallen?.[mine]) },
    theirs: { name: nationName(state, theirNation), in: men(sideMen(e, theirs)), lost: men(e.fallen?.[theirs]) },
    summary: `${outcome.text}. ${destroyed ? `${destroyed} of their regiments destroyed` : 'None of their regiments destroyed'}; ${lostUnits ? `${lostUnits} of yours lost` : 'none of yours lost'}.${fled}`,
    timeline: timelineFor(e),
    canReplay: timelineFor(e).length > 1,
    place: e.targetRegionId ? regionName(e.targetRegionId) : null,
    targetRegionId: e.targetRegionId || null
  };
};
