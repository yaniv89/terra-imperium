// src/components/battle/battleHudModel.js
// What the battle screens (U1b: B01 Battle HUD, B05 City assault, B06 Alerts and pause, B08
// Result; plans/UI-DESIGN.md) show, from the HUD frame (render/view.js) and the setup. Pure.
//   contextFor        what the bottom-right context panel shows for the selection (B10)
//   selectionSummary  the top pill: "Spearmen  3 squads, 146 men  74%"
//   cityAssaultView   the real city: houses standing and ruined, housing then and now, the 50% line
//   nextAlerts        new alerts between two frames (gate breached, a regiment of yours Shaken, enemy
//                     squads broke, workers attacked, the keep at half, enemy reinforcements), at most
//                     two shown; one about a squad carries its index (Go selects it)
//   battleResultModel the result screen: losses, XP with its formula, the general's fate, what the
//                     city keeps under the 50% rule, loot, and Auto's odds for comparison
import { getSquadDisplayName } from '../../battle/data/battleStats';
import { getRankForXp } from '../../data/promotions';
import { getGeneralXpMultiplier } from '../../data/generals';
import { hashRoll, COMMANDER_FALL_CHANCE } from '../../engine/aftermath';
import { XP_WIN, XP_LOSE } from '../../engine/battleOutcome';
import { TICK_HZ } from '../../battle/sim/constants';
import { CITY_DAMAGE_CARRY_MAX } from './warModel';
import { SHAKEN_MORALE } from '../../battle/sim/morale';

/** A squad beaten down but not running: the player's side in a commanded battle (sim/morale.js). */
export const isShakenView = (q) => !!q && q.alive && !q.routed && q.classId !== 'worker' && q.morale <= SHAKEN_MORALE;

const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

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
  const name = kinds.length === 1 ? (kinds[0] === 'worker' ? 'Laborers' : getSquadDisplayName(kinds[0], selected[0].ageId)) : `${kinds.length} kinds`;
  const men = sum(selected, (q) => Math.max(0, q.strength));
  const max = sum(selected, (q) => Math.max(1, q.maxStrength));
  const morale = Math.round(sum(selected, (q) => q.morale) / selected.length);
  return { name, squads: selected.length, men, share: max ? men / max : 0, morale, routed: selected.some((q) => q.routed), shaken: selected.filter(isShakenView).length };
};

/**
 * The real city in a city assault (setup.city): its houses by index, how many stand, the housing
 * they gave at the start and give now (plus the town hall), and the 50% rule's line.
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
  const maxLost = Math.floor(total * CITY_DAMAGE_CARRY_MAX);
  const gate = hud.structures.find((s) => s.kind === 'gate');
  const towers = hud.structures.filter((s) => s.kind === 'tower');
  const keep = hud.structures[0];
  return {
    total, standing, ruined: Math.max(0, ruined), maxLost,
    carried: Math.min(Math.max(0, ruined), maxLost),
    housingStart, housingNow,
    gate: gate ? { alive: gate.alive, hp: gate.hp, maxHp: gate.maxHp } : null,
    towers: { standing: towers.filter((t) => t.alive).length, total: towers.length },
    keep: keep ? { alive: keep.alive, hp: keep.hp, maxHp: keep.maxHp } : null
  };
};

const ALERT_KEEP_TICKS = 20 * TICK_HZ; // an alert stays 20 s
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
      const what = s.kind === 'gate' ? 'Gate breached' : s.kind === 'tower' ? 'A tower falls' : 'The keep falls';
      out.push({ id: `s${i}`, kind: s.kind, title: what, detail: attacking ? 'Your way in is open.' : 'Your defences are giving way.', x: s.x, y: s.y, tick: cur.tick, tone: attacking ? 'good' : 'danger' });
    }
    if (i === 0 && s.alive && p.hp > p.maxHp / 2 && s.hp <= s.maxHp / 2) {
      out.push({ id: 'keep-half', kind: 'keep', title: attacking ? 'The keep is at half' : 'Your keep is at half', detail: `${Math.round(s.hp)} of ${s.maxHp} HP`, x: s.x, y: s.y, tick: cur.tick, tone: attacking ? 'good' : 'danger' });
    }
  });
  // Your squads never rout in a commanded battle: one beaten down is Shaken (Go selects it, Rally Cry
  // restores it). Enemy squads that break are told once per frame, grouped.
  const broke = [];
  cur.squads.forEach((q, i) => {
    const p = prev.squads[i];
    if (!p) return;
    if (q.side === playerSide) {
      if (!isShakenView(p) && isShakenView(q) && q.onField) out.push({ id: `sh${q.idx}`, kind: 'shaken', squad: q.idx, title: `${getSquadDisplayName(q.classId, q.ageId)} shaken`, detail: 'Weaker until morale returns; Rally Cry helps.', x: q.x, y: q.y, tick: cur.tick, tone: 'danger' });
    } else if (!p.routed && q.routed && q.alive && q.visible !== false) broke.push(q);
  });
  if (broke.length) out.push({ id: `b${cur.tick}`, kind: 'broke', title: broke.length === 1 ? `Enemy ${getSquadDisplayName(broke[0].classId, broke[0].ageId).toLowerCase()} broke` : `${broke.length} enemy squads broke`, detail: 'Running for their edge.', x: broke[0].x, y: broke[0].y, tick: cur.tick, tone: 'good' });
  const hitWorkers = cur.squads.filter((q, i) => q.side === playerSide && q.classId === 'worker' && q.alive && prev.squads[i] && q.strength < prev.squads[i].strength);
  if (hitWorkers.length && cur.tick - (last.workers ?? -Infinity) >= WORKER_ALERT_GAP) {
    out.push({ id: `w${cur.tick}`, kind: 'workers', title: 'Workers under attack', detail: `${hitWorkers.length} squad${hitWorkers.length === 1 ? '' : 's'} hit.`, x: hitWorkers[0].x, y: hitWorkers[0].y, tick: cur.tick, tone: 'danger' });
  }
  const arriving = cur.squads.filter((q, i) => q.side !== playerSide && q.reinforcement && q.onField && prev.squads[i] && !prev.squads[i].onField && q.visible);
  if (arriving.length) out.push({ id: `e${cur.tick}`, kind: 'reinforcements', title: 'Enemy reinforcements', detail: `${arriving.length} squad${arriving.length === 1 ? '' : 's'} from ${arriving[0].reinforcement.name || 'the edge'}.`, x: arriving[0].x, y: arriving[0].y, tick: cur.tick, tone: 'danger' });
  return out;
};

/** The alerts to show now: the newest two still fresh, and how many older ones are folded away. */
export const visibleAlerts = (alerts, tick) => {
  const fresh = alerts.filter((a) => tick - a.tick < ALERT_KEEP_TICKS);
  return { shown: fresh.slice(-2).reverse(), older: Math.max(0, fresh.length - 2) };
};

/** How long the battle has left at each speed, in minutes. */
export const minutesLeft = (seconds, speed = 1) => Math.max(0, Math.round(seconds / 60 / speed));

const lossOf = (units, before) => {
  const start = sum(before, (u) => Math.max(0, u.strength));
  const end = sum(units, (u) => Math.max(0, u.strength));
  return { start, end, lost: Math.max(0, start - end), destroyed: units.filter((u) => u.strength <= 0).length };
};

/**
 * The B08 result. `campaign` (optional, from the game): { turnNumber, year, hiredCommanders,
 * ageId, auto: { win } } where auto.win is Auto's chance to win this same battle for you.
 */
export const battleResultModel = (ended, setup, playerSide, campaign = {}) => {
  const { result } = ended;
  const mySide = playerSide === 0 ? 'attacker' : 'defender';
  const won = result.outcome === mySide;
  const draw = result.outcome === 'stalemate';
  const myUnits = playerSide === 0 ? result.attackerUnits : result.defenderUnits;
  const theirUnits = playerSide === 0 ? result.defenderUnits : result.attackerUnits;
  const mine = lossOf(myUnits, setup.sides[playerSide].units);
  const theirs = lossOf(theirUnits, setup.sides[1 - playerSide].units);
  const tac = result.report?.tactical || {};
  const deployed = new Set(playerSide === 0 ? result.report?.deployedAttackerIds || [] : result.report?.deployedDefenderIds || []);
  const base = won ? XP_WIN : draw ? Math.round((XP_WIN + XP_LOSE) / 2) : XP_LOSE;
  const commanders = campaign.hiredCommanders || {};
  const xp = myUnits.filter((u) => deployed.has(u.id) && !u.militia && !u.synthetic && u.strength > 0).map((u) => {
    const mult = getGeneralXpMultiplier(commanders[u.commanderId]);
    const bonus = tac.xpBonusById?.[u.id] || 0;
    const gained = Math.round(base * mult) + bonus;
    const before = u.xp || 0;
    const rankUp = getRankForXp(before + gained) !== getRankForXp(before) ? getRankForXp(before + gained) : null;
    return { id: u.id, name: getSquadDisplayName(u.classId, campaign.ageId || setup.sides[playerSide].ageId), gained, bonus, mult, rankUp };
  }).sort((a, b) => b.gained - a.gained);
  const generals = myUnits.filter((u) => u.commanderId).map((u) => {
    const g = commanders[u.commanderId];
    const name = g?.name || 'Your general';
    if (u.strength > 0) return { name, fate: 'survived', text: `${name} survived.` };
    const falls = campaign.turnNumber != null ? hashRoll(`${u.id}|${campaign.turnNumber}`) < COMMANDER_FALL_CHANCE : null;
    return { name, fate: falls === null ? 'unknown' : falls ? 'fell' : 'escaped', text: falls === null ? `${name}'s regiment was destroyed: a ${Math.round(COMMANDER_FALL_CHANCE * 100)}% chance to fall.` : falls ? `${name} fell with the regiment.` : `${name} escaped the rout, without a regiment now.` };
  });
  let city = null;
  if (setup.city && tac.cityDamage) {
    const houses = setup.structures.filter((s) => s.kind === 'house' && !s.ruinedAtStart);
    const houseIds = new Set(houses.map((s) => s.manifestId));
    const ruined = tac.cityDamage.destroyed.filter((id) => houseIds.has(id)).length;
    const total = houses.length;
    const maxLost = Math.floor(total * CITY_DAMAGE_CARRY_MAX);
    const otherDown = tac.cityDamage.destroyed.filter((id) => !houseIds.has(id)).length;
    city = { total, ruined, maxLost, carried: Math.min(ruined, maxLost), kept: total - Math.min(ruined, maxLost), otherDown, damaged: tac.cityDamage.damaged.length };
  }
  const eco = tac.economy?.[playerSide] || null;
  const autoWin = campaign.auto?.win;
  return {
    won, draw,
    verdict: draw ? 'Stalemate' : won ? (playerSide === 1 ? 'Held' : 'Victory') : 'Defeat',
    reason: tac.reason || null,
    duration: tac.durationSec || 0,
    mine, theirs,
    workersLost: eco?.workersLost ?? null,
    loot: eco ? { gold: eco.looted || 0 } : null,
    xp, xpRule: `${base} for a ${won ? 'win' : draw ? 'draw' : 'loss'}, x1.25 with a logistician general, plus up to 20 for the fighting you did`,
    generals,
    city,
    auto: Number.isFinite(autoWin)
      ? `Auto wins this battle ${Math.round(autoWin * 100)}% of the time; it counts the same either way.`
      : 'Auto is tuned to score about the same as playing: it counts the same either way.'
  };
};
