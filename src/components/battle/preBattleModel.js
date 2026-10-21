// src/components/battle/preBattleModel.js
// W11 Pre-battle (plans/UI-DESIGN.md): everything the sheet says before one of your attacks, in
// one pure function so it can be tested without React. The attack is validated exactly as the
// reducer will (invasion, landing, field or fleet), and the odds come from the real auto-resolve
// (battleOdds.js) with where they come from (rule 4): exact with a spy report or open ground in
// sight, else the scouts' guess, a band and a range of men, never a number.
import { REGIONS_DATA } from '../../data/regions';
import { getRegionTerrain } from '../../data/terrain';
import { ACTION_COSTS } from '../../data/actionCosts';
import { getTiles } from '../../data/geo/tiles';
import { ageOf } from '../../engine/nationState';
import { autoParityOf, estimateInvasionOdds, estimateLandingOdds, estimateFieldOdds, estimateFleetOdds } from '../../engine/battleOdds';
import { battleName } from '../../engine/battleNames';
import { validateInvasion, validateAmphibious } from '../../engine/invasion';
import { validateFieldAttack } from '../../engine/fieldBattle';
import { validateFleetAttack } from '../../engine/navalBattle';
import { legacyTerrainOf } from '../../engine/world/registry';
import { getRegionModifier } from '../../engine/modifiers/sheet';
import { canSeeRegionDetails } from '../../engine/intel';
import { cityMilitia } from '../../engine/battleInputs';
import { isNoMansLand } from '../../engine/hostility';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { agreed } from './battleText';
import { terrainWord } from '../../i18n/gameText';
import { describeAttackBlock } from '../../utils/attackAvailability';
import { scoutsEstimate } from './battleReportView';
import { armyView, battleSize, cityWallsView, oddsSource, scoutsRange, siegeAdvice } from './warModel';
import { sideAgeOf } from '../../engine/ageRefs';
import { canPay } from '../../utils/costs';
import { consequenceLines } from './consequenceText';

const nationLabel = (state, id) => (id === 'rebels' ? t('bt.pre.rebels') : state.nations?.[id]?.name ? nameNow('people', id, state.nations[id].name) : t('bt.pre.theEnemy'));
const verb = (name, one, many) => (/[^s]s$/.test(name) ? many : one);
const possessive = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
const shortName = (name) => (name || '').replace(/^The /, '').replace(/^(Kingdom|Empire|Republic|Tribes?|Chiefdom|City-state|Confederation) of /i, '');

/** `samples`: auto-resolve runs for the odds (200 in the game, fewer in tests). */
// The odds factors of battleOdds.js (English labels and details) in the current language.
const factorText = (f) => {
  const label = t(`mx.odds.${f.id}`);
  if (f.id === 'terrain') return { ...f, label, detail: terrainWord(f.detail) };
  const vs = f.id === 'numbers' ? /^(d+) vs (d+)$/.exec(f.detail || '') : null;
  return { ...f, label, detail: vs ? t('mx.odds.vs', { a: vs[1], b: vs[2] }) : f.detail };
};

// Which committed parity record (autoParity.json) speaks for each card kind; a sea battle has none.
const PARITY_KIND = { invasion: 'assault', field: 'field', amphibious: 'landing' };
const span = (lo, hi, fmt) => (lo === hi ? fmt(lo) : t('bt.pre.rangeTo', { a: fmt(lo), b: fmt(hi) }));

/** "Auto: win 55 to 70%. You lose 300 to 600 men..." or null when the odds carry no range. */
export const rangeLine = (odds) => {
  const r = odds?.range;
  if (!r) return null;
  const win = span(Math.round(r.win[0] * 100), Math.round(r.win[1] * 100), String);
  return t('bt.pre.autoRange', { win, mine: span(...r.attackerMen, (n) => n.toLocaleString('en')), theirs: span(...r.defenderMen, (n) => n.toLocaleString('en')) });
};

/** How often Auto matched real time for this kind in the committed record, or null (never a made-up number). */
export const parityLine = (parityKind) => {
  const p = parityKind ? autoParityOf(parityKind) : null;
  return p?.matchups ? t('bt.pre.autoParity', { n: p.inside, of: p.matchups }) : null;
};

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
  const affordable = canPay(state, landing ? ACTION_COSTS.amphibiousAssault : fleet ? ACTION_COSTS.navalEngagement : ACTION_COSTS.launchInvasion);
  // An enemy fleet off the beach must be fought at sea first, which is always auto-resolved.
  const blockedAtSea = landing && Object.values(state.units || {}).some((u) => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
  // Decision 41: a clash outside both sides' borders is fought on Auto only (sea battles are not covered).
  const noMansLand = field && !fleet && !!v?.ok && isNoMansLand(state, tile, state.playerNationId, v.defenderNationId) ? t('bt.pre.noMansText') : null;
  const source = oddsSource(state, { targetRegionId, field });
  const hasIntel = field || canSeeRegionDetails(state, targetRegionId);
  const odds = v.ok ? (landing ? estimateLandingOdds(state, navalUnitId, targetRegionId, samples)
    : fleet ? estimateFleetOdds(state, fromTile, tile, samples)
    : field ? estimateFieldOdds(state, fromRegionId, tile, samples)
    : estimateInvasionOdds(state, fromRegionId, targetRegionId, samples)) : null;

  const region = field ? null : state.regions?.[targetRegionId];
  const terrain = fleet ? 'sea' : field ? legacyTerrainOf(getTiles(), tile) : getRegionTerrain(targetRegionId, REGIONS_DATA);
  const fortTier = field ? 0 : (region?.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total;
  const myAge = ageOf(state, state.playerNationId);
  const enemyId = field ? v?.defenderNationId : region?.owner;
  const theirAge = enemyId && enemyId !== 'rebels' ? sideAgeOf(state, enemyId) : ageOf(state, region?.owner ?? state.playerNationId); // rebels fight at their host's age
  const mineUnits = v?.ok ? (landing ? v.embarkedLandUnits : v.attackerUnits) : [];
  const theirUnits = v?.ok ? (landing ? v.defenderLandUnits : v.defenderUnits) : [];
  const yours = armyView(mineUnits, { ageId: myAge, hiredCommanders: state.hiredCommanders || {} });
  const theirs = armyView(theirUnits, { ageId: theirAge, hiredCommanders: state.hiredCommanders || {} });
  // The militia stand with the garrison: the odds' defender strength counts them.
  const theirMen = odds?.defenderStrength ?? theirs.men;
  const enemy = nationLabel(state, enemyId);
  const me = state.nations?.[state.playerNationId]?.name ? nameNow('people', state.playerNationId, state.nations[state.playerNationId].name) : t('bt.pre.you');
  const placeEn = fleet ? null : field ? (getTiles().names?.[tile] || REGIONS_DATA[origin]?.name) : (REGIONS_DATA[targetRegionId]?.name || region?.name || targetRegionId);
  const place = fleet ? t('bt.pre.openSea') : placeEn ? nameNow('city', null, placeEn) : t('bt.pre.theField');
  const knownEmpty = !field && hasIntel && v?.ok && theirUnits.length === 0;
  // DEF-01 / siege offer: a city seen to hold nobody (no garrison and no militia) has no battle to
  // command; the card says so before the tap (BEGIN_TACTICAL_BATTLE would fight it on Auto).
  const commandBlocked = knownEmpty && !landing && !cityMilitia(state, targetRegionId).length
    ? t('bt.pre.noDefenders')
    : null;
  const size = battleSize({ regiments: yours.regiments, terrain, kind: field ? 'field' : 'assault' });
  const walls = !field && !fleet ? cityWallsView(state, targetRegionId) : null;

  let chance = null;
  if (odds && !odds.undefended) {
    if (source.exact) {
      chance = {
        exact: true, source: source.label, win: odds.attacker, take: odds.capture, lose: odds.defender, draw: odds.stalemate,
        verdict: odds.attacker >= 0.65 ? t('bt.pre.likelyWin') : odds.attacker >= 0.35 ? t('bt.pre.evenFight') : t('bt.pre.likelyLoss'),
        losses: t('bt.pre.expectedLosses', { a: Math.round(odds.attackerLossShare * 100), b: Math.round(odds.defenderLossShare * 100) }),
        factors: (odds.factors || []).filter((f) => Math.abs(f.value - 1) >= 0.02).map(factorText),
        reasons: (odds.reasons || []).filter((f) => Math.abs(f.value - 1) >= 0.02).map(factorText),
        range: rangeLine(odds),
        parity: parityLine(PARITY_KIND[kind])
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
    name: nameNow('battle', null, battleName(state, { kind, targetRegionId, tile })),
    subtitle: (() => {
      const who = shortName(me); const them = shortName(enemy);
      const vars = { who, them, place };
      if (fleet) return agreed('bt.pre.subFleet', vars, () => `${who} ${verb(who, 'attacks', 'attack')} ${possessive(them)} fleet`);
      if (field) return agreed('bt.pre.subField', vars, () => `${who} ${verb(who, 'attacks', 'attack')} ${possessive(them)} army near ${place}`);
      return agreed(landing ? 'bt.pre.subLanding' : 'bt.pre.subAttack', vars, () => `${who} ${landing ? verb(who, 'lands on', 'land on') : verb(who, 'attacks', 'attack')} ${place} · ${them} ${verb(them, 'holds', 'hold')} it`);
    })(),
    turn: state.turnNumber,
    v, blockedReason, affordable, blockedAtSea, knownEmpty, noMansLand, commandBlocked,
    hasIntel,
    terrain, fortTier,
    yours: { ...yours, title: landing ? t('bt.pre.landingParty') : fleet ? t('bt.pre.yourFleet') : t('bt.pre.yourArmy') },
    theirs: {
      ...theirs,
      men: theirMen,
      title: fleet ? t('bt.pre.theirFleet') : field ? t('bt.pre.theirArmy') : t('bt.pre.garrison'),
      total: hasIntel ? theirMen : scoutsRange(theirMen).text,
      note: hasIntel ? (source.exact ? t('bt.pre.exactNote', { src: source.label }) : '') : t('bt.pre.scoutsOnly')
    },
    size,
    walls,
    consequences: field || fleet || !v.ok ? [] : consequenceLines(state, targetRegionId),
    chance,
    // I213: a walled city and no siege engine in the army.
    siegeAdvice: walls ? siegeAdvice({ wallLevel: walls.level, units: mineUnits, ageId: myAge }) : null,
    command: t('bt.pre.command', { prefix: field || fleet ? '' : t('bt.pre.winTake'), cap: size.cap, text: size.text, min: size.minutes }),
    // The two ways differ against a city (the user's rule of 14 October, cityAssault.js).
    cityRule: field || fleet ? null : odds?.autoRule || (theirUnits.length ? 'garrison' : 'attack'),
    auto: autoText({ field, fleet, knownEmpty, odds, exact: !!chance?.exact })
  };
};

/** What Auto does here, in one or two sentences (the pre-battle card's Auto line). */
export const autoText = ({ field = false, fleet = false, knownEmpty = false, odds = null, exact = false }) => {
  const how = t(exact ? 'bt.pre.autoHowExact' : 'bt.pre.autoHowGuess');
  if (field || fleet) return t('bt.pre.autoBreak', { how });
  const rule = t('bt.pre.autoRule');
  const c = odds?.city;
  if (knownEmpty && c) {
    return t('bt.pre.autoEmpty', { a: c.hpBefore, b: c.maxHp, c: c.hpAfter, take: (odds.capture || 0) >= 0.5 ? t('bt.pre.autoTakes') : t('bt.pre.autoNeedsMore'), rule });
  }
  return t('bt.pre.autoCity', { rule, how });
};
