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
import { armyView, battleSize, cityWallsView } from './warModel';

const OURS = { defense: 'garrison', field: 'army', naval: 'fleet', raid: 'troops', sack: 'town', intercept: 'fleet', landing: 'garrison' };
const KIND_OBJECT = { defense: '', field: 'your army near ', naval: 'your fleet near ', raid: 'your land near ', sack: '', intercept: 'your fleet near ', landing: '' };
// What the attackers do, by kind (R3): a raid plunders, a sack hits a weak town, a landing comes ashore.
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
  const enemy = state.nations?.[foeId]?.name || foeId || 'The enemy';
  const enemyShort = enemy.replace(/^The /, '').replace(/^(Kingdom|Empire|Republic|Tribes?|Chiefdom|City-state|Confederation) of /i, '');
  const place = city ? region?.name || def.regionId : (v.name || '').replace(/^(Battle|Siege) (of|near|off) /, '');
  const myAge = getEffectiveAgeId(state.age, state.techAgeId);
  const theirAge = foeId && state.nations?.[foeId] ? getEffectiveAgeId(state.age, getTechAgeId(state, foeId)) : myAge;
  const militia = city ? cityMilitia(state, def.regionId) : [];
  const mine = attacking ? v.attackerUnits || [] : [...(v.defenderUnits || []), ...militia];
  const yours = armyView(mine, { ageId: myAge, hiredCommanders: state.hiredCommanders || {} });
  const theirs = armyView(attacking ? v.defenderUnits || [] : v.attackerUnits || [], { ageId: theirAge, hiredCommanders: {} });
  const walls = city ? cityWallsView(state, def.regionId) : null;
  const fallbackId = city ? getWithdrawalTarget(state, def.regionId) : null;
  const terrain = def.tile != null ? legacyTerrainOf(getTiles(), def.tile) : 'mixed';
  const size = battleSize({ regiments: yours.regiments, terrain, kind: city && walls?.level > 0 ? 'defense' : 'field' }); // an open town: the field's clock
  // `hold` is always YOUR chance (a fort you attack: the defender holding is your loss).
  const hold = attacking ? 1 - (v.odds?.holdChance ?? 1) : (v.odds?.holdChance ?? 0);
  const pct = Math.round(hold * 100);
  const odds = v.odds?.undefended
    ? { undefended: true, hold: 0, text: 'No one defends it: on Auto it falls.' }
    : { undefended: false, hold, text: `Auto ${attacking ? 'wins' : 'holds'} ${pct}% of the time${city && v.odds?.avgDamage != null ? `, about ${v.odds.avgDamage} control lost on average` : ''}.`, verdict: attacking ? (hold >= 0.65 ? 'Likely win' : hold >= 0.35 ? 'Close' : 'Likely loss') : (hold >= 0.65 ? 'Likely hold' : hold >= 0.35 ? 'Close' : 'Likely lost') };
  const plural = /[^s]s$/.test(enemyShort);
  const verb = KIND_VERB[kind] ? KIND_VERB[kind][plural ? 0 : 1] : plural ? 'attack' : 'attacks';
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
    withdraw: city
      ? (fallbackId
        ? { ok: true, to: state.regions?.[fallbackId]?.name || fallbackId, text: `Give up ${place}: your ${OURS[kind]} falls back to ${state.regions?.[fallbackId]?.name || fallbackId} (-${WITHDRAW_MORALE_LOSS} morale, -${Math.round(WITHDRAW_STRENGTH_LOSS * 100)}% men) and ${enemyShort} takes the city without a fight.` }
        : { ok: false, text: 'Nowhere to fall back to.' })
      : null,
    command: `Real time, ${size.cap} a side at most. ${city ? `${walls?.level ? 'Walls and towers fight for you. ' : ''}${walls?.houses ?? 0} houses and the town hall: battle housing ${walls?.housing ?? 0}; burned houses stop your training.` : 'The ground as it is on the map.'} About ${size.minutes} minutes; pause any time.`,
    auto: `Instant result by the same rules and the same armies. ${odds.text}`
  };
};
