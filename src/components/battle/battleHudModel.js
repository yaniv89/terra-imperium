// src/components/battle/battleHudModel.js
// What the battle screens (U1b: B01 Battle HUD, B05 City assault, B06 Alerts and pause, B08
// Result; plans/UI-DESIGN.md) show, from the HUD frame (render/view.js) and the setup. Pure.
//   contextFor        what the bottom-right context panel shows for the selection (B10)
//   selectionSummary  the top pill: "Spearmen  3 squads, 146 men  74%"
//   cityAssaultView   the real city: houses standing and ruined, housing then and now
//   nextAlerts        new alerts between two frames (gate breached, a regiment of yours Shaken, enemy
//                     squads broke, workers attacked, the keep at half, enemy reinforcements), at most
//                     two shown; one about a squad carries its index (Go selects it)
//   battleResultModel the result screen. With the campaign's receipt (src/engine/battleReceipt.js)
//                     it shows what is committed: the verdict, the participant ledger's losses, the
//                     XP really gained, each general's real fate, the city as it then stands, the
//                     gold that reaches the treasury. Without one (the sandbox) it reads the battle.
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { squadName, ecoLabel, auxiliaryText, msgRefText, carryText } from './battleText';
import { getRankForXp } from '../../data/promotions';
import { getGeneralXpMultiplier } from '../../data/generals';
import { hashRoll, COMMANDER_FALL_CHANCE } from '../../engine/aftermath';
import { XP_WIN, XP_LOSE } from '../../engine/battleOutcome';
import { playerWon } from '../../engine/battleReports';
import { TICK_HZ, Q } from '../../battle/sim/constants';
import { isBaseType } from '../../battle/sim/base';
import { describeOutcome, verificationNotice } from './battleReportView';
import { resultOf } from './battleReportsModel';
import { SHAKEN_MORALE } from '../../battle/sim/morale';

/** A squad beaten down but not running: the player's side in a commanded battle (sim/morale.js). */
export const isShakenView = (q) => !!q && q.alive && !q.routed && q.classId !== 'worker' && q.morale <= SHAKEN_MORALE;

const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

/**
 * I195: where a side's squads are, so a count that drops is explained. Laborers are left out.
 * { field, routed, killed, withdrew, arriving, out } over the squads that ever stood in the battle
 * (arriving: allied reinforcements still marching in; out: past the 300 cap, never in it).
 */
export const armyTally = (hud, side) => {
  const t = { field: 0, routed: 0, killed: 0, withdrew: 0, arriving: 0, out: 0 };
  (hud?.squads || []).forEach((q) => {
    if (q.side !== side || q.classId === 'worker') return;
    if (!q.alive) t.killed += 1;
    else if (q.fled) t.withdrew += 1;
    else if (q.onField) t[q.routed ? 'routed' : 'field'] += 1;
    else if (q.enterTick >= 0) t.arriving += 1;
    else t.out += 1;
  });
  return t;
};
/** The tally in words: "8 on the field, 2 killed, 1 routed, 1 withdrew, 2 arriving". */
export const armyTallyText = (tally) => [
  t('bt.tally.field', { n: tally.field }),
  tally.killed ? t('bt.tally.killed', { n: tally.killed }) : null,
  tally.routed ? t('bt.tally.routed', { n: tally.routed }) : null,
  tally.withdrew ? t('bt.tally.withdrew', { n: tally.withdrew }) : null,
  tally.arriving ? t('bt.tally.arriving', { n: tally.arriving }) : null,
  tally.out ? t('bt.tally.out', { n: tally.out }) : null
].filter(Boolean).join(', ');

/**
 * The context panel's state (B10, AoE style: the actions of the selection only):
 * 'place' (a building in hand) | 'building' (your finished building) | 'site' (your building going up)
 * | 'workers' (laborers only: the build grid) | 'mixed' (laborers and troops) | 'army' | 'inspect'
 * (something not yours) | 'none'.
 */
export const contextFor = ({ selectedSquads = [], building = null, inspect = null, armed = null } = {}) => {
  if (armed && typeof armed === 'object' && armed.type === 'place') return 'place';
  if (building) return building.built ? 'building' : 'site';
  if (selectedSquads.length) {
    const workers = selectedSquads.filter((q) => q.classId === 'worker').length;
    return workers === selectedSquads.length ? 'workers' : workers ? 'mixed' : 'army';
  }
  return inspect ? 'inspect' : 'none';
};

/** The selected squads in one line, or null. */
export const selectionSummary = (selected = []) => {
  if (!selected.length) return null;
  const kinds = [...new Set(selected.map((q) => q.classId))];
  const name = kinds.length === 1 ? (kinds[0] === 'worker' ? t('bt.sel.laborers') : squadName(kinds[0], selected[0].ageId)) : t('bt.sel.kinds', { n: kinds.length });
  const men = sum(selected, (q) => Math.max(0, q.strength));
  const max = sum(selected, (q) => Math.max(1, q.maxStrength));
  const morale = Math.round(sum(selected, (q) => q.morale) / selected.length);
  // strength lost to attrition (out of supply on enemy ground): every loss has a cause on screen (H-03)
  const attrition = sum(selected, (q) => Math.max(0, q.attritionLost || 0));
  return { name, squads: selected.length, men, share: max ? men / max : 0, morale, routed: selected.some((q) => q.routed), shaken: selected.filter(isShakenView).length, attrition };
};

/**
 * The real city in a city assault (setup.city): its houses by index, how many stand, and the
 * housing they gave at the start and give now (plus the town hall).
 */
export const cityAssaultView = (hud, setup) => {
  if (!hud || !setup?.city) return null;
  // the houses standing when the battle began (ruins from an earlier battle do not count)
  const idx = setup.structures.map((s, i) => (s.kind === 'house' && !s.ruinedAtStart ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const total = idx.length;
  const standing = idx.filter((i) => hud.structures[i]?.alive).length;
  const ruined = total - standing;
  const hall = setup.structures[0]?.housing || 0;
  const hallUp = hud.structures[0]?.alive ? hall : 0;
  const housingStart = sum(idx, (i) => setup.structures[i].housing || 0) + hall;
  const housingNow = sum(idx.filter((i) => hud.structures[i]?.alive), (i) => setup.structures[i].housing || 0) + hallUp;
  const gate = hud.structures.find((s) => s.kind === 'gate');
  const towers = hud.structures.filter((s) => s.kind === 'tower');
  const keep = hud.structures[0];
  return {
    total, standing, ruined: Math.max(0, ruined),
    housingStart, housingNow,
    gate: gate ? { alive: gate.alive, hp: gate.hp, maxHp: gate.maxHp } : null,
    towers: { standing: towers.filter((t) => t.alive).length, total: towers.length },
    keep: keep ? { alive: keep.alive, hp: keep.hp, maxHp: keep.maxHp } : null
  };
};

export const ALERT_SHOW_TICKS = 8 * TICK_HZ; // an alert shows 8 s, then lives on in the history (I203)
const WORKER_ALERT_GAP = 30 * TICK_HZ;

/**
 * New alerts between frame `prev` and `cur`: [{ id, kind, title, detail, x, y, tick, tone }].
 * `playerSide` 0 attacks, 1 defends.
 */
export const nextAlerts = (prev, cur, playerSide, setup, last = {}) => {
  if (!prev || !cur) return [];
  const out = [];
  const attacking = playerSide === 0;
  cur.structures.forEach((s, i) => {
    const p = prev.structures[i];
    if (!p) return;
    if (p.alive && !s.alive && (s.kind === 'gate' || s.kind === 'tower' || s.kind === 'keep')) {
      const what = s.kind === 'gate' ? t('bt.alert.gate') : s.kind === 'tower' ? t('bt.alert.tower') : t('bt.alert.keepFalls');
      out.push({ id: `s${i}`, kind: s.kind, title: what, detail: attacking ? t('bt.alert.wayIn') : t('bt.alert.defGiving'), x: s.x, y: s.y, tick: cur.tick, tone: attacking ? 'good' : 'danger' });
    }
    if (i === 0 && s.alive && p.hp > p.maxHp / 2 && s.hp <= s.maxHp / 2) {
      out.push({ id: 'keep-half', kind: 'keep', title: attacking ? t('bt.alert.keepHalfAtk') : t('bt.alert.keepHalfDef'), detail: t('bt.alert.hpOf', { hp: Math.round(s.hp), max: s.maxHp }), x: s.x, y: s.y, tick: cur.tick, tone: attacking ? 'good' : 'danger' });
    }
  });
  // Your squads never rout in a commanded battle: one beaten down is Shaken (Go selects it, Rally Cry
  // restores it). Enemy squads that break are told once per frame, grouped.
  const broke = [];
  cur.squads.forEach((q, i) => {
    const p = prev.squads[i];
    if (!p) return;
    if (q.side === playerSide) {
      if (!isShakenView(p) && isShakenView(q) && q.onField) out.push({ id: `sh${q.idx}`, kind: 'shaken', squad: q.idx, title: t('bt.alert.squadShaken', { name: squadName(q.classId, q.ageId) }), detail: t('bt.alert.shakenDetail'), x: q.x, y: q.y, tick: cur.tick, tone: 'danger' });
    } else if (!p.routed && q.routed && q.alive && q.visible !== false) broke.push(q);
  });
  if (broke.length) out.push({ id: `b${cur.tick}`, kind: 'broke', title: broke.length === 1 ? t('bt.alert.enemyBroke', { name: squadName(broke[0].classId, broke[0].ageId).toLowerCase() }) : t('bt.alert.enemiesBroke', { n: broke.length }), detail: t('bt.alert.running'), x: broke[0].x, y: broke[0].y, tick: cur.tick, tone: 'good' });
  const hitWorkers = cur.squads.filter((q, i) => q.side === playerSide && q.classId === 'worker' && q.alive && prev.squads[i] && q.strength < prev.squads[i].strength);
  if (hitWorkers.length && cur.tick - (last.workers ?? -Infinity) >= WORKER_ALERT_GAP) {
    out.push({ id: `w${cur.tick}`, kind: 'workers', title: t('bt.alert.workersHit'), detail: t('bt.alert.squadsHit', { count: hitWorkers.length }), x: hitWorkers[0].x, y: hitWorkers[0].y, tick: cur.tick, tone: 'danger' });
  }
  const arriving = cur.squads.filter((q, i) => q.side !== playerSide && q.reinforcement && q.onField && prev.squads[i] && !prev.squads[i].onField && q.visible);
  if (arriving.length) out.push({ id: `e${cur.tick}`, kind: 'reinforcements', title: t('bt.alert.reinforcements'), detail: t('bt.alert.reinfFrom', { count: arriving.length, from: arriving[0].reinforcement.name ? nameNow('place', null, arriving[0].reinforcement.name) : t('bt.alert.theEdge') }), x: arriving[0].x, y: arriving[0].y, tick: cur.tick, tone: 'danger' });
  return out;
};

/**
 * I203: the alerts to show now: the newest two of the last 8 seconds (they fade on their own, so they
 * never pile up over the field), how many others there are, and the whole list newest first (the
 * history the player can open).
 */
export const visibleAlerts = (alerts, tick) => {
  const fresh = alerts.filter((a) => tick - a.tick < ALERT_SHOW_TICKS);
  const shown = fresh.slice(-2).reverse();
  return { shown, older: Math.max(0, alerts.length - shown.length), history: [...alerts].reverse() };
};

/**
 * I196, I197: where the enemy's objective is, as far as the player knows it (the view is already
 * seen from the player's side: enemy buildings never explored are not in it). Returns
 * { targets: [{ x, y, label }] in tiles, nearest to `from` first, note, fallback: { x, y } }.
 * `note` says why there is no target (their camp not seen yet) and where to look.
 */
export const enemyObjectives = (hud, setup, playerSide, from = null) => {
  const enemy = 1 - playerSide;
  const targets = [];
  const keep = hud?.structures?.[0];
  // The keep (or the town hall standing for it) is the defender's.
  if (enemy === 1 && keep?.alive && keep.kind === 'keep') targets.push({ x: keep.x / Q, y: keep.y / Q, label: t('bt.obj.theirKeep') });
  const ageId = setup?.sides?.[enemy]?.ageId;
  (hud?.eco?.buildings || []).forEach((b) => {
    if (b.side !== enemy || !b.alive || b.proxy || !b.built || !isBaseType(b.type)) return;
    targets.push({ x: b.x / Q, y: b.y / Q, label: t('bt.obj.theirs', { what: ecoLabel(b.type, ageId).toLowerCase() }) });
  });
  if (from) targets.sort((a, b) => ((a.x - from.x) ** 2 + (a.y - from.y) ** 2) - ((b.x - from.x) ** 2 + (b.y - from.y) ** 2));
  const map = setup?.map || {};
  const w = map.w || 0; const h = map.h || 0;
  // The enemy comes from the west edge when it attacks, sits to the east when it defends.
  const fallback = enemy === 0 ? { x: (map.attackerEdge || 1) + 6, y: h / 2 } : { x: map.keep?.x ?? w - 10, y: map.keep?.y ?? h / 2 };
  if (targets.length) return { targets, note: null, fallback };
  const seen = (hud?.squads || []).filter((q) => q.side === enemy && q.alive && q.onField && !q.fled && q.visible !== false);
  if (seen.length) {
    const x = seen.reduce((s, q) => s + q.x, 0) / seen.length / Q; const y = seen.reduce((s, q) => s + q.y, 0) / seen.length / Q;
    return { targets: [{ x, y, label: t('bt.obj.troopsSight') }], note: t('bt.obj.noteSeen', { count: seen.length }), fallback };
  }
  return { targets: [], note: t(enemy === 0 ? 'bt.obj.noteWest' : 'bt.obj.noteEast'), fallback };
};

/**
 * U12: Battle Supply for the top bar: now and the cap, the rise a second (from recent frames), what
 * the powers cost and whether it is low (under the cheapest power the side still has).
 */
export const supplyView = (hud, setup, playerSide, rate = null) => {
  const now = Math.floor(hud?.supply?.[playerSide] || 0);
  const cap = setup?.supplyCap || null;
  const costs = (hud?.powers || []).filter((p) => p.cost > 0 && p.usesLeft > 0).map((p) => ({ id: p.id, label: p.label, cost: p.cost }));
  const cheapest = costs.length ? Math.min(...costs.map((c) => c.cost)) : null;
  return { now, cap, rate, costs, low: cheapest !== null && now < cheapest };
};

/** The supply gained a second over recent samples [{ tick, v }] (drops from spending are left out). */
export const supplyRate = (samples) => {
  if (!samples || samples.length < 2) return null;
  let gain = 0;
  for (let i = 1; i < samples.length; i++) gain += Math.max(0, samples[i].v - samples[i - 1].v);
  const secs = (samples[samples.length - 1].tick - samples[0].tick) / TICK_HZ;
  return secs > 0 ? Math.round((gain / secs) * 10) / 10 : null;
};

/** What the player is told when the battle loop refused orders (its `ordersRefused` message). */
export const refusedText = (m) => (m?.full
  ? t('bt.refused.full')
  : m?.count > 1 ? t('bt.refused.many', { count: m.count }) : t('bt.refused.one'));

/** How long the battle has left at each speed, in minutes. */
export const minutesLeft = (seconds, speed = 1) => Math.max(0, Math.round(seconds / 60 / speed));

const lossOf = (units, before) => {
  const start = sum(before, (u) => Math.max(0, u.strength));
  const end = sum(units, (u) => Math.max(0, u.strength));
  return { start, end, lost: Math.max(0, start - end), destroyed: units.filter((u) => u.strength <= 0).length, fled: 0, runDown: 0 };
};
// A side of the participant ledger (battleLedger.js sideTotals), in the result screen's words.
const fromLedger = (t) => ({ start: t.before, end: t.after + t.fled, lost: t.fallen, destroyed: t.destroyed, fled: t.fled, runDown: t.runDown });

const GENERAL_TEXT = {
  survived: (name) => t('bt.result.generalSurvived', { name }),
  fell: (name) => t('bt.result.generalFell', { name }),
  escaped: (name) => t('bt.result.generalEscaped', { name })
};
const xpRuleOf = (base, won, draw) => t(won ? 'bt.result.xpWin' : draw ? 'bt.result.xpDraw' : 'bt.result.xpLoss', { base });
// Gold looted inside a battle is spent inside it: only gold the campaign pays in is "yours".
const lootOf = (eco, goldGained = 0) => (goldGained > 0 ? { gold: goldGained, banked: true } : eco?.looted > 0 ? { gold: eco.looted, banked: false } : null);

/**
 * The B08 result. `campaign` (optional, from the game): { turnNumber, year, hiredCommanders,
 * ageId, auto: { win } } where auto.win is Auto's chance to win this same battle for you.
 * `receipt`: the campaign's answer for this battle (src/engine/battleReceipt.js), `{ pending: true }`
 * while it is being counted, `{ failed: true }` when it could not be, or nothing outside a campaign
 * (the sandbox). `state`: 'committed' | 'void' | 'pending' | 'preview'.
 */
export const battleResultModel = (ended, setup, playerSide, campaign = {}, receipt = undefined) => {
  const { result } = ended;
  const tac = result.report?.tactical || {};
  const eco = tac.economy?.[playerSide] || null;
  const ageId = campaign.ageId || setup.sides[playerSide].ageId;
  const autoWin = campaign.auto?.win;
  const common = {
    reason: tac.reason || null,
    duration: tac.durationSec || 0,
    workersLost: eco?.workersLost ?? null,
    auto: Number.isFinite(autoWin)
      ? t('bt.result.autoWins', { pct: Math.round(autoWin * 100) })
      : t('bt.result.autoTuned')
  };
  const empty = { mine: null, theirs: null, xp: [], xpRule: null, generals: [], city: null, loot: null, aux: null, notice: null, headline: null };

  // The campaign is still counting the battle: no number is shown before it is the final one.
  if (receipt?.pending) return { ...common, ...empty, state: 'pending', won: false, draw: true, verdict: t('bt.result.over'), line: t('bt.result.counting') };
  // The battle changed nothing on the map (peace was made, the target can no longer be fought).
  if (receipt && receipt.applied === false && !receipt.failed) {
    const voidAt = (receipt.lines || []).indexOf(receipt.voidLine);
    return { ...common, ...empty, state: 'void', won: false, draw: true, verdict: t('bt.result.noEffect'), line: (receipt.voidLine ? carryText(receipt.lineMsgs?.[voidAt], receipt.voidLine) : null) || t('bt.result.voidLine') };
  }

  // What the campaign commits: the report entry and its ledger, read off the same reducer Continue runs.
  if (receipt?.applied) {
    const e = receipt.entry;
    const won = playerWon(e); const draw = e.outcome === 'stalemate';
    const base = won ? XP_WIN : draw ? Math.round((XP_WIN + XP_LOSE) / 2) : XP_LOSE;
    return {
      ...common,
      state: 'committed', won, draw,
      verdict: resultOf(e).label,
      headline: describeOutcome(e).text,
      line: msgRefText(receipt.lineMsg, receipt.line),
      reason: e.reason || common.reason,
      duration: e.durationSec || common.duration,
      mine: fromLedger(receipt.ledger.mine), theirs: fromLedger(receipt.ledger.theirs),
      xp: receipt.xp.map((x) => ({ id: x.id, name: squadName(x.classId, ageId), gained: x.gained, rankUp: x.rankUp })),
      xpRule: xpRuleOf(base, won, draw),
      generals: receipt.generals.map((g) => ({ name: g.name, fate: g.fate, text: GENERAL_TEXT[g.fate](g.name) })),
      city: setup.city ? { committed: true, line: carryText(receipt.cityLineMsg, receipt.cityLine), taken: !!receipt.city?.taken, control: receipt.city?.control ?? null } : null,
      loot: lootOf(eco, receipt.goldGained),
      aux: auxiliaryText(receipt.ledger.aux),
      notice: verificationNotice(e)
    };
  }

  // No campaign behind this battle (the sandbox), or its count could not be shown: the battle's own reading.
  const mySide = playerSide === 0 ? 'attacker' : 'defender';
  const won = result.outcome === mySide;
  const draw = result.outcome === 'stalemate';
  const myUnits = playerSide === 0 ? result.attackerUnits : result.defenderUnits;
  const theirUnits = playerSide === 0 ? result.defenderUnits : result.attackerUnits;
  const deployed = new Set(playerSide === 0 ? result.report?.deployedAttackerIds || [] : result.report?.deployedDefenderIds || []);
  const base = won ? XP_WIN : draw ? Math.round((XP_WIN + XP_LOSE) / 2) : XP_LOSE;
  const commanders = campaign.hiredCommanders || {};
  const xp = myUnits.filter((u) => deployed.has(u.id) && !u.militia && !u.synthetic && u.strength > 0).map((u) => {
    const mult = getGeneralXpMultiplier(commanders[u.commanderId]);
    const bonus = tac.xpBonusById?.[u.id] || 0;
    const gained = Math.round(base * mult) + bonus;
    const before = u.xp || 0;
    const rankUp = getRankForXp(before + gained) !== getRankForXp(before) ? getRankForXp(before + gained) : null;
    return { id: u.id, name: squadName(u.classId, ageId), gained, bonus, mult, rankUp };
  }).sort((a, b) => b.gained - a.gained);
  const generals = myUnits.filter((u) => u.commanderId).map((u) => {
    const g = commanders[u.commanderId];
    const name = g?.name || t('bt.result.yourGeneral');
    if (u.strength > 0) return { name, fate: 'survived', text: GENERAL_TEXT.survived(name) };
    const falls = campaign.turnNumber != null ? hashRoll(`${u.id}|${campaign.turnNumber}`) < COMMANDER_FALL_CHANCE : null;
    return { name, fate: falls === null ? 'unknown' : falls ? 'fell' : 'escaped', text: falls === null ? t('bt.result.generalDestroyed', { name, pct: Math.round(COMMANDER_FALL_CHANCE * 100) }) : GENERAL_TEXT[falls ? 'fell' : 'escaped'](name) };
  });
  let city = null;
  if (setup.city && tac.cityDamage) {
    const houses = setup.structures.filter((s) => s.kind === 'house' && !s.ruinedAtStart);
    const houseIds = new Set(houses.map((s) => s.manifestId));
    const ruined = tac.cityDamage.destroyed.filter((id) => houseIds.has(id)).length;
    const otherDown = tac.cityDamage.destroyed.filter((id) => !houseIds.has(id)).length;
    city = { committed: false, total: houses.length, ruined, otherDown, damaged: tac.cityDamage.damaged.length };
  }
  const auxTrained = Object.entries(eco?.trained || {}).reduce((s, [k, n]) => s + (k === 'worker' ? 0 : n), 0);
  return {
    ...common,
    state: 'preview', won, draw,
    verdict: draw ? t('bt.result.stalemate') : won ? (playerSide === 1 ? t('bt.result.held') : t('bt.result.victory')) : t('bt.result.defeat'),
    headline: null, line: null,
    mine: lossOf(myUnits, setup.sides[playerSide].units), theirs: lossOf(theirUnits, setup.sides[1 - playerSide].units),
    xp, xpRule: xpRuleOf(base, won, draw),
    generals,
    city,
    loot: lootOf(eco),
    aux: auxTrained > 0 ? auxiliaryText({ squads: auxTrained, standing: Object.values(eco.auxiliariesStanding || {}).reduce((s, n) => s + n, 0) }) : null,
    notice: receipt?.failed ? t('bt.result.campaignFailed') : null
  };
};
