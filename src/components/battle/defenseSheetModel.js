// src/components/battle/defenseSheetModel.js
// W14 "You are attacked" (plans/UI-DESIGN.md): what the interrupt shows for the first battle in
// the queue (src/engine/battleQueue.js): who attacks what, both forces (the attackers march in
// plain sight, so their numbers are exact), your garrison with the city's militia, houses, battle
// housing and walls, the honest Auto's odds, and the three ways: Command, Auto, Withdraw (a city
// only, when there is somewhere to fall back to). Pure.
import { ageOf } from '../../engine/nationState';
import { queuedBattleView, queuedKind, queuedCommandBlock } from '../../engine/battleQueue';
import { getWithdrawalTarget, WITHDRAW_MORALE_LOSS, WITHDRAW_STRENGTH_LOSS } from '../../engine/defense';
import { cityMilitia } from '../../engine/battleInputs';
import { legacyTerrainOf } from '../../engine/world/registry';
import { getTiles } from '../../data/geo/tiles';
import { plainPlace } from '../../engine/grammar';
import { isNoMansLand } from '../../engine/hostility';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { agreed, msgRefText } from './battleText';
import { rangeLine } from './preBattleModel';
import { armyView, battleSize, cityWallsView } from './warModel';

const OURS = { defense: 'garrison', field: 'army', naval: 'fleet', raid: 'troops', sack: 'town', intercept: 'fleet', landing: 'garrison' };
const KIND_OBJECT = { defense: '', field: 'your army near ', naval: 'your fleet near ', raid: 'your land near ', sack: '', intercept: 'your fleet near ', landing: '' };
const oursTitle = (kind) => t(`bt.def.ours.${OURS[kind] ? kind : 'field'}`);
const oursLower = (kind) => t(`bt.def.oursLower.${OURS[kind] ? kind : 'field'}`);
// What the attackers do, by kind (R3): a raid plunders, a sack hits a weak town, a landing comes ashore.
// I011: below this chance for Auto to hold, a defence is called hopeless on the card.
export const HOPELESS_HOLD = 0.15;
const KIND_VERB = { raid: ['raid', 'raids'], sack: ['sack', 'sacks'], landing: ['land at', 'lands at'], intercept: ['attack', 'attacks'] };

export const defenseSheetModel = (state, def, { samples = 30, view = null } = {}) => {
  if (!def) return null;
  const v = view || queuedBattleView(state, def, samples);
  const kind = queuedKind(def);
  const city = kind === 'defense';
  const region = state.regions?.[def.regionId];
  // A fort that stopped the player's army (R3 forts.js): here the player is the one attacking.
  const attacking = def.aggressorId === state.playerNationId;
  const foeId = attacking ? v.defenderUnits?.[0]?.ownerId : def.aggressorId;
  // Decision 41: a field clash or a raid on land inside neither side's borders is fought on Auto only.
  const noMansLand = (kind === 'field' || kind === 'raid') && isNoMansLand(state, def.tile, state.playerNationId, foeId) ? t('bt.pre.noMansText') : null;
  // DEF-01: why Command cannot open, said before the tap (the reducer refuses with the same words).
  const block = queuedCommandBlock(state, def);
  const commandBlocked = block && block.code !== 'no_mans_land' ? msgRefText(block.textMsg, block.text) : null;
  const enemy = state.nations?.[foeId]?.name ? nameNow('people', foeId, state.nations[foeId].name) : foeId || t('bt.def.enemy');
  const enemyShort = enemy.replace(/^The /, '').replace(/^(Kingdom|Empire|Republic|Tribes?|Chiefdom|City-state|Confederation) of /i, '');
  const place = city ? nameNow('city', null, region?.name || def.regionId) : nameNow('city', null, plainPlace(v.name));
  const myAge = ageOf(state, state.playerNationId);
  const theirAge = foeId && state.nations?.[foeId] ? ageOf(state, foeId) : myAge;
  const militia = city ? cityMilitia(state, def.regionId) : [];
  const mine = attacking ? v.attackerUnits || [] : [...(v.defenderUnits || []), ...militia];
  const yours = armyView(mine, { ageId: myAge, hiredCommanders: state.hiredCommanders || {} });
  const theirs = armyView(attacking ? v.defenderUnits || [] : v.attackerUnits || [], { ageId: theirAge, hiredCommanders: {} });
  const walls = city ? cityWallsView(state, def.regionId) : null;
  const fallbackId = city ? getWithdrawalTarget(state, def.regionId) : null;
  const terrain = def.tile != null ? legacyTerrainOf(getTiles(), def.tile) : 'mixed';
  const size = battleSize({ regiments: yours.regiments, terrain, kind: city ? 'defense' : 'field' });
  // `hold` is always YOUR chance (a fort you attack: the defender holding is your loss).
  const hold = attacking ? 1 - (v.odds?.holdChance ?? 1) : (v.odds?.holdChance ?? 0);
  const pct = Math.round(hold * 100);
  // An empty city on Auto (cityAssault.js): its defences take the attack; it falls only when its HP reaches 0.
  const c = v.odds?.city;
  const odds = v.odds?.undefended
    ? { undefended: true, hold, text: c ? t('bt.def.noDefendUndefended', { a: c.hpBefore, b: c.hpAfter, max: c.maxHp, likely: hold < 0.5 ? t('bt.def.likelyFalls') : '', pct }) : t('bt.def.noRegiment') }
    : { undefended: false, hold, text: t(attacking ? 'bt.def.autoWins' : 'bt.def.autoHolds', { pct, avg: city && v.odds?.avgDamage != null ? t('bt.def.avgLost', { n: v.odds.avgDamage }) : '', note: city && !attacking ? t('bt.def.garrisonFirst') : '' }), verdict: attacking ? (hold >= 0.65 ? t('bt.pre.likelyWin') : hold >= 0.35 ? t('bt.def.vClose') : t('bt.pre.likelyLoss')) : (hold >= 0.65 ? t('bt.def.vLikelyHold') : hold >= 0.35 ? t('bt.def.vClose') : t('bt.def.vLikelyLost')) };
  // The same range the attack card shows, seen from the attacker like every odds: flipped to read as yours when you defend.
  const r = v.odds?.range;
  const range = r ? rangeLine({ range: attacking ? r : { win: [1 - r.win[1], 1 - r.win[0]], attackerMen: r.defenderMen, defenderMen: r.attackerMen } }) : null;
  const plural = /[^s]s$/.test(enemyShort);
  const verb = KIND_VERB[kind] ? KIND_VERB[kind][plural ? 0 : 1] : plural ? 'attack' : 'attacks';
  const withdrawTo = city && fallbackId ? nameNow('city', null, state.regions?.[fallbackId]?.name || fallbackId) : null;
  // I011: a defence Auto almost never holds says so before the choice, with what losing costs, and
  // pre-selects Withdraw when there is somewhere to go. A mode the player set in Settings (Command
  // or Auto) is still the one chosen: an intentional Command stays playable.
  const hopeless = !attacking && !odds.undefended && hold < HOPELESS_HOLD;
  const warning = hopeless
    ? t('bt.def.warning', { pct, body: city ? t('bt.def.warnCity', { place }) : t('bt.def.warnField'), withdraw: withdrawTo ? t('bt.def.warnWithdraw', { to: withdrawTo }) : '' })
    : null;
  const setting = state.battleSettings?.defaultMode;
  const preferred = setting === 'auto' || setting === 'command' ? setting : hopeless && withdrawTo ? 'withdraw' : 'command';
  const suggested = commandBlocked && preferred === 'command' ? 'auto' : preferred;
  const militiaMen = militia.reduce((s, u) => s + u.strength, 0);
  const militiaOnly = city && !attacking && !commandBlocked && !(v.defenderUnits || []).length && militiaMen > 0;
  return {
    kind,
    city,
    place,
    name: nameNow('battle', null, v.name),
    attacking,
    eyebrow: attacking
      ? agreed(def.fort ? 'bt.def.eyeStoppedFort' : 'bt.def.eyeStopped', { enemy: enemyShort, place }, () => `Your army is stopped by ${enemyShort}${def.fort ? "' fort" : ''} near ${place}`.replace(/([^s])' fort/, "$1's fort"))
      : agreed(`bt.def.eye.${KIND_VERB[kind] || kind === 'field' || kind === 'naval' ? kind : 'defense'}`, { enemy: enemyShort, place }, () => `${enemyShort} ${verb} ${KIND_OBJECT[kind] || ''}${place}`),
    enemy,
    theirs: { ...theirs, title: attacking ? (def.fort ? t('bt.def.inFort') : t('bt.def.defenders')) : kind === 'raid' || kind === 'sack' ? t('bt.def.raiders') : t('bt.def.attackers'), note: t('bt.def.plainSight') },
    yours: { ...yours, title: attacking ? t('bt.def.yourArmy') : militiaOnly ? t('bt.def.militiaOnly') : oursTitle(kind), militia: militiaMen },
    walls,
    size,
    odds,
    hopeless,
    warning,
    suggested,
    withdraw: city
      ? (fallbackId
        ? { ok: true, to: withdrawTo, text: t('bt.def.giveUp', { place, ours: oursLower(kind), to: withdrawTo, morale: WITHDRAW_MORALE_LOSS, men: Math.round(WITHDRAW_STRENGTH_LOSS * 100), enemy: enemyShort }) }
        : { ok: false, text: t('bt.def.nowhere') })
      : null,
    noMansLand,
    commandBlocked,
    command: `${militiaOnly ? t('bt.def.commandMilitia', { place }) : ''}${city ? t('bt.def.commandCity', { cap: size.cap, walls: walls?.level ? t('bt.def.wallsFight') : '', houses: walls?.houses ?? 0, housing: walls?.housing ?? 0, min: size.minutes }) : t('bt.def.commandField', { cap: size.cap, min: size.minutes })}`,
    auto: `${t('bt.def.autoText', { odds: odds.text })}${range ? ` ${range}` : ''}`
  };
};
