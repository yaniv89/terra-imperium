// src/components/battle/preBattleModel.js
// W11 Pre-battle (plans/UI-DESIGN.md): everything the sheet says before one of your attacks, in
// one pure function so it can be tested without React. The attack is validated exactly as the
// reducer will (invasion, landing, field or fleet), and the odds come from the real auto-resolve
// (battleOdds.js) with where they come from (rule 4): exact with a spy report or open ground in
// sight, else the scouts' guess, a band and a range of men, never a number.
import { REGIONS_DATA } from '../../data/regions';
import { getRegionTerrain } from '../../data/terrain';
import { getEffectiveAgeId } from '../../data/ages';
import { ACTION_COSTS } from '../../data/actionCosts';
import { getTiles } from '../../data/geo/tiles';
import { getTechAgeId } from '../../engine/nationState';
import { estimateInvasionOdds, estimateLandingOdds, estimateFieldOdds, estimateFleetOdds } from '../../engine/battleOdds';
import { battleName } from '../../engine/battleNames';
import { validateInvasion, validateAmphibious } from '../../engine/invasion';
import { validateFieldAttack } from '../../engine/fieldBattle';
import { validateFleetAttack } from '../../engine/navalBattle';
import { legacyTerrainOf } from '../../engine/world/registry';
import { getRegionModifier } from '../../engine/modifiers/sheet';
import { canSeeRegionDetails } from '../../engine/intel';
import { describeAttackBlock } from '../../utils/attackAvailability';
import { canAfford } from '../../utils/helpers';
import { scoutsEstimate } from './battleReportView';
import { armyView, battleSize, cityWallsView, oddsSource, scoutsRange } from './warModel';

const nationLabel = (state, id) => (id === 'rebels' ? 'the rebels' : state.nations?.[id]?.name || 'the enemy');
const verb = (name, one, many) => (/[^s]s$/.test(name) ? many : one);
const possessive = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
const shortName = (name) => (name || '').replace(/^The /, '').replace(/^(Kingdom|Empire|Republic|Tribes?|Chiefdom|City-state|Confederation) of /i, '');

/** `samples`: auto-resolve runs for the odds (200 in the game, fewer in tests). */
export const preBattleModel = (state, { fromRegionId = null, targetRegionId = null, navalUnitId = null, tile = null, fromTile = null }, { samples = 200 } = {}) => {
  const landing = !!navalUnitId;
  const fleet = tile != null && fromTile != null;
  const field = tile != null;
  const kind = landing ? 'amphibious' : fleet ? 'naval' : field ? 'field' : 'invasion';
  const origin = landing ? state.units?.[navalUnitId]?.regionId : fromRegionId;
  const v = landing ? validateAmphibious(state, navalUnitId, targetRegionId)
    : fleet ? validateFleetAttack(state, fromTile, tile)
    : field ? validateFieldAttack(state, fromRegionId, tile)
    : validateInvasion(state, fromRegionId, targetRegionId);
  const blockedReason = describeAttackBlock(v);
  const affordable = canAfford(state.resources, landing ? ACTION_COSTS.amphibiousAssault : fleet ? ACTION_COSTS.navalEngagement : ACTION_COSTS.launchInvasion);
  // An enemy fleet off the beach must be fought at sea first, which is always auto-resolved.
  const blockedAtSea = landing && Object.values(state.units || {}).some((u) => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
  const source = oddsSource(state, { targetRegionId, field });
  const hasIntel = field || canSeeRegionDetails(state, targetRegionId);
  const odds = v.ok ? (landing ? estimateLandingOdds(state, navalUnitId, targetRegionId, samples)
    : fleet ? estimateFleetOdds(state, fromTile, tile, samples)
    : field ? estimateFieldOdds(state, fromRegionId, tile, samples)
    : estimateInvasionOdds(state, fromRegionId, targetRegionId, samples)) : null;

  const region = field ? null : state.regions?.[targetRegionId];
  const terrain = fleet ? 'sea' : field ? legacyTerrainOf(getTiles(), tile) : getRegionTerrain(targetRegionId, REGIONS_DATA);
  const fortTier = field ? 0 : (region?.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total;
  const myAge = getEffectiveAgeId(state.age, state.techAgeId);
  const enemyId = field ? v?.defenderNationId : region?.owner;
  const theirAge = enemyId && enemyId !== 'rebels' ? getEffectiveAgeId(state.age, getTechAgeId(state, enemyId)) : state.age;
  const mineUnits = v?.ok ? (landing ? v.embarkedLandUnits : v.attackerUnits) : [];
  const theirUnits = v?.ok ? (landing ? v.defenderLandUnits : v.defenderUnits) : [];
  const yours = armyView(mineUnits, { ageId: myAge, hiredCommanders: state.hiredCommanders || {} });
  const theirs = armyView(theirUnits, { ageId: theirAge, hiredCommanders: state.hiredCommanders || {} });
  // The militia stand with the garrison: the odds' defender strength counts them.
  const theirMen = odds?.defenderStrength ?? theirs.men;
  const enemy = nationLabel(state, enemyId);
  const me = state.nations?.[state.playerNationId]?.name || 'You';
  const place = fleet ? 'the open sea' : field ? (getTiles().names?.[tile] || REGIONS_DATA[origin]?.name || 'the field') : (REGIONS_DATA[targetRegionId]?.name || region?.name || targetRegionId);
  const knownEmpty = !field && hasIntel && v?.ok && theirUnits.length === 0;
  // Only a walled city is a siege assault with the long clock (battleType.js); an open town is fought on the field's.
  const size = battleSize({ regiments: yours.regiments, terrain, kind: field || (!landing && fortTier <= 0) ? 'field' : 'assault' });
  const walls = !field && !fleet ? cityWallsView(state, targetRegionId) : null;

  let chance = null;
  if (odds && !odds.undefended) {
    if (source.exact) {
      chance = {
        exact: true, source: source.label, win: odds.attacker, take: odds.capture, lose: odds.defender, draw: odds.stalemate,
        verdict: odds.attacker >= 0.65 ? 'Likely win' : odds.attacker >= 0.35 ? 'Even fight' : 'Likely loss',
        losses: `Expected losses: yours ${Math.round(odds.attackerLossShare * 100)}%, theirs ${Math.round(odds.defenderLossShare * 100)}%.`,
        factors: (odds.factors || []).filter((f) => Math.abs(f.value - 1) >= 0.02)
      };
    } else {
      const band = scoutsEstimate(odds.attacker);
      // A band on the bar, not a point: a third of the bar centred on the real chance.
      const lo = Math.max(0, Math.min(0.67, odds.attacker - 0.17));
      chance = { exact: false, source: source.label, verdict: band.label, bandId: band.id, hint: band.hint, band: [lo, lo + 0.33] };
    }
  }

  return {
    kind, field, fleet, landing, origin,
    name: battleName(state, { kind, targetRegionId, tile }),
    subtitle: (() => {
      const who = shortName(me); const them = shortName(enemy);
      if (fleet) return `${who} ${verb(who, 'attacks', 'attack')} ${possessive(them)} fleet`;
      if (field) return `${who} ${verb(who, 'attacks', 'attack')} ${possessive(them)} army near ${place}`;
      return `${who} ${landing ? verb(who, 'lands on', 'land on') : verb(who, 'attacks', 'attack')} ${place} · ${them} ${verb(them, 'holds', 'hold')} it`;
    })(),
    turn: state.turnNumber,
    v, blockedReason, affordable, blockedAtSea, knownEmpty,
    hasIntel,
    terrain, fortTier,
    yours: { ...yours, title: landing ? 'Landing party' : fleet ? 'Your fleet' : 'Your army' },
    theirs: {
      ...theirs,
      men: theirMen,
      title: fleet ? 'Their fleet' : field ? 'Their army' : 'Garrison',
      total: hasIntel ? theirMen : scoutsRange(theirMen).text,
      note: hasIntel ? (source.exact ? `${source.label}: these numbers are exact.` : '') : 'Your scouts only: a spy report gives the real numbers.'
    },
    size,
    walls,
    chance,
    command: `You lead ${size.cap} a side at most in real time. ${size.waves ? `${size.front} regiments fight at once; the other ${size.waves} enter as a second wave.` : 'Everyone is on the field at once.'} About ${size.minutes} minutes. Pause any time.`,
    auto: knownEmpty ? 'No garrison: your army marches in and takes it now.' : `Instant, by the same rules${chance?.exact ? ' and the odds above' : ", your scouts' guess above"}. Break the whole garrison and ${field || fleet ? 'the field is yours' : 'the city is yours'}.`
  };
};
