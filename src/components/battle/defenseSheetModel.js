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

const OURS = { defense: 'garrison', field: 'army', naval: 'fleet' };
const KIND_OBJECT = { defense: '', field: 'your army near ', naval: 'your fleet near ' };

export const defenseSheetModel = (state, def, { samples = 30, view = null } = {}) => {
  if (!def) return null;
  const v = view || queuedBattleView(state, def, samples);
  const kind = queuedKind(def);
  const city = kind === 'defense';
  const region = state.regions?.[def.regionId];
  const enemy = state.nations?.[def.aggressorId]?.name || def.aggressorId;
  const enemyShort = enemy.replace(/^The /, '').replace(/^(Kingdom|Empire|Republic|Tribes?|Chiefdom|City-state|Confederation) of /i, '');
  const place = city ? region?.name || def.regionId : (v.name || '').replace(/^(Battle|Siege) (of|near|off) /, '');
  const myAge = getEffectiveAgeId(state.age, state.techAgeId);
  const theirAge = getEffectiveAgeId(state.age, getTechAgeId(state, def.aggressorId));
  const militia = city ? cityMilitia(state, def.regionId) : [];
  const yours = armyView([...(v.defenderUnits || []), ...militia], { ageId: myAge, hiredCommanders: state.hiredCommanders || {} });
  const theirs = armyView(v.attackerUnits || [], { ageId: theirAge, hiredCommanders: {} });
  const walls = city ? cityWallsView(state, def.regionId) : null;
  const fallbackId = city ? getWithdrawalTarget(state, def.regionId) : null;
  const terrain = def.tile != null ? legacyTerrainOf(getTiles(), def.tile) : 'mixed';
  const size = battleSize({ regiments: yours.regiments, terrain, kind: city ? 'defense' : 'field' });
  const hold = v.odds?.holdChance ?? 0;
  const pct = Math.round(hold * 100);
  const odds = v.odds?.undefended
    ? { undefended: true, hold: 0, text: 'No one defends it: on Auto it falls.' }
    : { undefended: false, hold, text: `Auto holds ${pct}% of the time${city && v.odds?.avgDamage != null ? `, about ${v.odds.avgDamage} control lost on average` : ''}.`, verdict: hold >= 0.65 ? 'Likely hold' : hold >= 0.35 ? 'Close' : 'Likely lost' };
  return {
    kind,
    city,
    place,
    name: v.name,
    eyebrow: `${enemyShort} ${/[^s]s$/.test(enemyShort) ? 'attack' : 'attacks'} ${KIND_OBJECT[kind]}${place}`,
    enemy,
    theirs: { ...theirs, title: 'Attackers', note: 'In plain sight: these numbers are exact.' },
    yours: { ...yours, title: OURS[kind][0].toUpperCase() + OURS[kind].slice(1), militia: militia.reduce((s, u) => s + u.strength, 0) },
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
