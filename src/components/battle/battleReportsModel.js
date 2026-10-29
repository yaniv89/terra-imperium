// src/components/battle/battleReportsModel.js
// W16 Battle reports (plans/UI-DESIGN.md): the player's last 30 battles (src/engine/battleReports.js)
// as a list with filters (All, Won, Lost, Command, Auto, Sieges, Field, Sea) and the detail of
// one: its name, the result from your side (Victory, Held, Defeat, Lost, Repelled, Stalemate),
// Command or Auto, both sides in and lost, a plain summary and the strength timeline. Pure.
import { ledgerOf, menOf } from '../../engine/battleLedger';
import { t, formatYear } from '../../i18n/core';
import { auxiliaryText } from './battleText';
import { messageOf } from '../../i18n/messageText';
import { playerWon } from '../../engine/battleReports';
import { terrainWord } from '../../i18n/gameText';
import { FATE_VIEW, battleTitle, describeOutcome, fateOf, fateText, nationName, regionName, sidesFor, timelineFor, verificationNotice } from './battleReportView';

export const REPORT_FILTERS = ['all', 'won', 'lost', 'command', 'auto', 'siege', 'field', 'sea'].map((id) => ({ id, get label() { return t(`bt.rep.filter.${id}`); } }));

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

/** How the battle was fought: Command, Auto, or Command then Auto (a switch part-way, H-01). */
export const modeText = (e) => (e.switchedAtSec != null ? t('bt.rep.modeSwitched') : e.commanded ? t('bt.rep.modeCommand') : t('bt.rep.modeAuto'));

/** The result word from your side and its tone. */
export const resultOf = (e) => {
  if (e.outcome === 'stalemate') return { label: t('bt.rep.res.stalemate'), tone: 'draw' };
  const won = playerWon(e);
  // A raid or a sack takes no city: it is driven off, or it gets through (I006).
  if (e.kind === 'raid' || e.kind === 'sack') {
    if (e.playerSide === 'defender') return won ? { label: t('bt.rep.res.drivenOff'), tone: 'win' } : { label: e.kind === 'sack' ? t('bt.rep.res.sacked') : t('bt.rep.res.raided'), tone: 'loss' };
    return won ? { label: t('bt.rep.res.victory'), tone: 'win' } : { label: t('bt.rep.res.drivenOff'), tone: 'loss' };
  }
  if (e.playerSide === 'defender') return won ? { label: t('bt.rep.res.held'), tone: 'win' } : { label: e.captured ? t('bt.rep.res.lost') : t('bt.rep.res.defeat'), tone: 'loss' };
  return won ? { label: t('bt.rep.res.victory'), tone: 'win' } : { label: t('bt.rep.res.repelled'), tone: 'loss' };
};

export const yearText = (y) => formatYear(y);
const men = (n) => Math.round(n || 0);
const sideMen = (e, side) => menOf((e.sides?.[side] || []).reduce((s, u) => s + u.before, 0));

/** One row of the list. */
export const reportRow = (state, e) => {
  const { mine, theirs } = sidesFor(e);
  return {
    id: e.id,
    name: battleTitle(state, e),
    group: reportGroup(e),
    when: t('bt.rep.when', { turn: e.turn, year: yearText(e.year) }),
    mode: modeText(e),
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
  if (oneRound) return t('bt.rep.footer.oneRound');
  if (e.commanded && e.switchedAtSec == null) return canReplay ? t('bt.rep.footer.cmdReplay') : t('bt.rep.footer.cmdNoReplay');
  return canReplay ? t('bt.rep.footer.autoReplay') : t('bt.rep.footer.autoNone');
};

/** The detail of one battle. */
export const reportDetail = (state, e) => {
  if (!e) return null;
  const { mine, theirs } = sidesFor(e);
  const myNation = e[`${mine}NationId`]; const theirNation = e[`${theirs}NationId`];
  const outcome = describeOutcome(e);
  const fled = (e.fled?.[mine] || 0) + (e.fled?.[theirs] || 0) > 0
    ? t('bt.rep.fledField', { a: men(e.fled[mine]), b: men(e.fled[theirs]) }) : '';
  // Regiments are units on the map: a city's militia (temp) is never "a regiment lost" (manual playtest 29 Oct).
  const destroyed = (e.sides?.[theirs] || []).filter((u) => !u.temp && u.after <= 0).length;
  const lostUnits = (e.sides?.[mine] || []).filter((u) => !u.temp && u.after <= 0).length;
  const ledger = ledgerOf(e);
  // One round has no course to play back (I016): say so, and keep the replay for the longer ones.
  const rounds = e.rounds ?? Math.max(0, timelineFor(e).filter((p) => !p.pursuit).length - 1);
  return {
    ...reportRow(state, e),
    who: t(e.terrain ? 'bt.rep.whoTerrain' : 'bt.rep.who', { side: e.playerSide === 'attacker' ? t('bt.rep.youAttacked') : t('bt.rep.youDefended'), mode: modeText(e), terrain: e.terrain ? terrainWord(e.terrain) : '' }),
    yours: { name: nationName(state, myNation), in: men(sideMen(e, mine)), lost: men(e.fallen?.[mine]) },
    theirs: { name: nationName(state, theirNation), in: men(sideMen(e, theirs)), lost: men(e.fallen?.[theirs]) },
    summary: t('bt.rep.summary', { outcome: outcome.text, theirs: destroyed ? t('bt.rep.destroyedTheirs.some', { n: destroyed }) : t('bt.rep.destroyedTheirs.zero'), yours: lostUnits ? t('bt.rep.lostYours.some', { n: lostUnits }) : t('bt.rep.lostYours.zero'), fled }),
    timeline: timelineFor(e),
    canReplay: timelineFor(e).length > 1,
    footer: replayFooter(e, timelineFor(e).length > 1, !e.commanded && rounds === 1),
    oneRound: !e.commanded && rounds === 1,
    // The receipt: what the campaign logged, the temporary troops, and how a commanded battle was checked.
    line: e.lineMsg ? messageOf(e.lineMsg.key, e.lineMsg.vars) : e.line || null,
    aux: [auxiliaryText(ledger.aux), auxiliaryText(ledger.theirAux, { yours: false })].filter(Boolean),
    notice: verificationNotice(e),
    place: e.targetRegionId ? regionName(e.targetRegionId) : null,
    targetRegionId: e.targetRegionId || null
  };
};
