// src/components/battle/defenseSheetModel.js
// W14 "You are attacked" (plans/UI-DESIGN.md): what the interrupt shows for the first battle in
// the queue (src/engine/battleQueue.js): who attacks what, both forces (the attackers march in
// plain sight, so their numbers are exact), your garrison with the city's militia, houses, battle
// housing and walls, the honest Auto's odds, and the three ways: Command, Auto, Withdraw (a city
// only, when there is somewhere to fall back to). Pure.
import { getEffectiveAgeId } from '../../data/ages';
import { getTechAgeId } from '../../engine/nationState';
import { queuedBattleView, queuedKind } from '../../engine/battleQueue';
import { getWithdrawalTarget, WITHDRAW_MORALE_LOSS, WITHDRAW_STRENGTH_LOSS } from '../../engine/defense';
import { cityMilitia } from '../../engine/battleInputs';
import { legacyTerrainOf } from '../../engine/world/registry';
import { getTiles } from '../../data/geo/tiles';
import { plainPlace } from '../../engine/grammar';
import { isNoMansLand, NO_MANS_LAND_TEXT } from '../../engine/hostility';
import { armyView, battleSize, cityWallsView } from './warModel';

const OURS = { defense: 'garrison', field: 'army', naval: 'fleet', raid: 'troops', sack: 'town', intercept: 'fleet', landing: 'garrison' };
const KIND_OBJECT = { defense: '', field: 'your army near ', naval: 'your fleet near ', raid: 'your land near ', sack: '', intercept: 'your fleet near ', landing: '' };
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
  const noMansLand = (kind === 'field' || kind === 'raid') && isNoMansLand(state, def.tile, state.playerNationId, foeId) ? NO_MANS_LAND_TEXT : null;
  const enemy = state.nations?.[foeId]?.name || foeId || 'The enemy';
  const enemyShort = enemy.replace(/^The /, '').replace(/^(Kingdom|Empire|Republic|Tribes?|Chiefdom|City-state|Confederation) of /i, '');
  const place = city ? region?.name || def.regionId : plainPlace(v.name);
  const myAge = getEffectiveAgeId(state.age, state.techAgeId);
  const theirAge = foeId && state.nations?.[foeId] ? getEffectiveAgeId(state.age, getTechAgeId(state, foeId)) : myAge;
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
    ? { undefended: true, hold, text: c ? `No one defends it: on Auto the attack takes its defences from ${c.hpBefore} to about ${c.hpAfter} of ${c.maxHp} HP${hold < 0.5 ? ', and it likely falls' : ''}. It holds ${pct}% of the time.` : 'No one defends it.' }
    : { undefended: false, hold, text: `Auto ${attacking ? 'wins' : 'holds'} ${pct}% of the time${city && v.odds?.avgDamage != null ? `, about ${v.odds.avgDamage} control lost on average` : ''}.${city && !attacking ? ' On Auto your garrison is fought first: the city is not taken while units stand in it.' : ''}`, verdict: attacking ? (hold >= 0.65 ? 'Likely win' : hold >= 0.35 ? 'Close' : 'Likely loss') : (hold >= 0.65 ? 'Likely hold' : hold >= 0.35 ? 'Close' : 'Likely lost') };
  const plural = /[^s]s$/.test(enemyShort);
  const verb = KIND_VERB[kind] ? KIND_VERB[kind][plural ? 0 : 1] : plural ? 'attack' : 'attacks';
  const withdrawTo = city && fallbackId ? state.regions?.[fallbackId]?.name || fallbackId : null;
  // I011: a defence Auto almost never holds says so before the choice, with what losing costs, and
  // pre-selects Withdraw when there is somewhere to go. A mode the player set in Settings (Command
  // or Auto) is still the one chosen: an intentional Command stays playable.
  const hopeless = !attacking && !odds.undefended && hold < HOPELESS_HOLD;
  const warning = hopeless
    ? `Badly outnumbered: Auto holds only ${pct}% of the time. ${city ? `If ${place} falls, it is taken and your defenders still in it are lost.` : 'If you lose, the regiments still on the field at the end are lost.'}${withdrawTo ? ` Withdraw keeps the men: they fall back to ${withdrawTo}.` : ''}`
    : null;
  const setting = state.battleSettings?.defaultMode;
  const suggested = setting === 'auto' || setting === 'command' ? setting : hopeless && withdrawTo ? 'withdraw' : 'command';
  return {
    kind,
    city,
    place,
    name: v.name,
    attacking,
    eyebrow: attacking ? `Your army is stopped by ${enemyShort}${def.fort ? "' fort" : ''} near ${place}`.replace(/([^s])' fort/, "$1's fort") : `${enemyShort} ${verb} ${KIND_OBJECT[kind] || ''}${place}`,
    enemy,
    theirs: { ...theirs, title: attacking ? (def.fort ? 'In their fort' : 'Defenders') : kind === 'raid' || kind === 'sack' ? 'Raiders' : 'Attackers', note: 'In plain sight: these numbers are exact.' },
    yours: { ...yours, title: attacking ? 'Your army' : (OURS[kind] || 'army')[0].toUpperCase() + (OURS[kind] || 'army').slice(1), militia: militia.reduce((s, u) => s + u.strength, 0) },
    walls,
    size,
    odds,
    hopeless,
    warning,
    suggested,
    withdraw: city
      ? (fallbackId
        ? { ok: true, to: state.regions?.[fallbackId]?.name || fallbackId, text: `Give up ${place}: your ${OURS[kind]} falls back to ${state.regions?.[fallbackId]?.name || fallbackId} (-${WITHDRAW_MORALE_LOSS} morale, -${Math.round(WITHDRAW_STRENGTH_LOSS * 100)}% men) and ${enemyShort} takes the city without a fight.` }
        : { ok: false, text: 'Nowhere to fall back to.' })
      : null,
    noMansLand,
    command: `Real time, ${size.cap} a side at most. ${city ? `${walls?.level ? 'Walls and towers fight for you. ' : ''}${walls?.houses ?? 0} houses and the town hall: battle housing ${walls?.housing ?? 0}; burned houses stop your training.` : 'The ground as it is on the map.'} About ${size.minutes} minutes; pause any time.`,
    auto: `Instant result by the same rules and the same armies. ${odds.text}`
  };
};
