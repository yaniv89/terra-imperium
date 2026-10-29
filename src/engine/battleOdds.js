// src/engine/battleOdds.js
// "What are my chances?" for the battle choice sheet (Tactical Battles plan §13): runs the real
// auto-resolve (resolveBattle) with the real inputs over many seeds, and applies the real siege
// rule to each result, so the numbers shown are exactly what pressing Auto-resolve does. Also
// explains WHY — the multipliers each side fights under (numbers, matchups, terrain, walls, age)
// — so the calculation isn't a black box. Pure and fast (~a few ms for 200 samples).
import { resolveAutoBattle } from './autoBattle';
import { battleInputs, reinforcementSources } from './battleInputs';
import { createRng } from '../utils/rng';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs, validateAmphibious, getAmphibiousBattleContext } from './invasion';
import { validateFieldAttack, getFieldBattleContext, getFieldResolveArgs } from './fieldBattle';
import { validateFleetAttack, getFleetBattleContext, getFleetResolveArgs } from './navalBattle';
import { resolveSiegeControlDamage, hasMeleeUnitDeployed, isGarrisonBroken } from './siege';
import { getDefenseArmies, getDefenseBattleContext } from './defense';
import { cityFell } from './capture';
import { getCounterMultiplier, getRosterCombatMultiplier, unitAgeWeight } from '../data/unitClasses';
import { getTerrainCombatModifier } from '../data/terrain';
import { menOf } from './battleLedger';
import { canSeeTile } from './sight';
import { canSeeRegionDetails } from './intel';
import { withAirSupport } from './airPower';
import { unitTile } from './armies';
import parity from '../data/autoParity.json';

const sumStrength = (units) => units.reduce((s, u) => s + Math.max(0, u.strength), 0);

// How well one army's classes match up against the other's, strength-weighted (1 = even).
const matchup = (from, to) => {
  const total = sumStrength(from) * sumStrength(to);
  if (!total) return 1;
  let acc = 0;
  from.forEach((a) => to.forEach((d) => { acc += a.strength * d.strength * getCounterMultiplier(a.classId, d.classId); }));
  return acc / total;
};

// How a side's own units weigh at its age, strength-weighted (units keep the age they were built in:
// a bronze ship in a kingdoms navy fights at a fraction; 1 = all of the side's age).
const unitsAge = (units, ageId) => {
  const total = sumStrength(units);
  return total ? units.reduce((s, u) => s + Math.max(0, u.strength) * unitAgeWeight(u, ageId), 0) / total : 1;
};

// The multipliers the attacker fights under, as readable lines (value > 1 favours you).
export const explainInvasion = (v, ctx) => {
  const att = sumStrength(v.attackerUnits); const def = sumStrength(v.defenderUnits);
  const lines = [
    { id: 'numbers', label: 'Numbers', value: def ? att / def : 1, detail: `${att} vs ${def}` },
    { id: 'matchup', label: 'Unit matchups', value: matchup(v.attackerUnits, v.defenderUnits) / Math.max(0.01, matchup(v.defenderUnits, v.attackerUnits)) },
    { id: 'terrain', label: 'Terrain', value: getTerrainCombatModifier(ctx.terrain).attackerMult, detail: ctx.terrain },
    { id: 'walls', label: 'Walls & forts', value: ctx.defenderDamageReductionMultiplier ?? 1 },
    { id: 'age', label: 'Technology', value: getRosterCombatMultiplier(ctx.attackerAgeId, ctx.defenderAgeId) / Math.max(0.01, getRosterCombatMultiplier(ctx.defenderAgeId, ctx.attackerAgeId)) },
    { id: 'units', label: "Units' age", value: unitsAge(v.attackerUnits, ctx.attackerAgeId) / Math.max(0.01, unitsAge(v.defenderUnits, ctx.defenderAgeId)) }
  ];
  if (ctx.attackerPenaltyMultiplier && ctx.attackerPenaltyMultiplier !== 1) lines.push({ id: ctx.river ? 'river' : 'landing', label: ctx.river ? 'Crossing a river' : 'Landing from the sea', value: ctx.attackerPenaltyMultiplier });
  return lines.map((l) => ({ ...l, value: Math.round(l.value * 100) / 100 }));
};

// Auto's auxiliaries change the numbers it fights at (playtest 40651416284 step 237: 14,900 against
// 10,000 on the card, 21,820 against 31,640 auxiliaries in the fight): a factor of their own.
export const withAuxiliaries = (factors, att, def, aux) => {
  if (!aux || !(aux.attacker || aux.defender) || !att || !def) return factors;
  const value = Math.round(((att + aux.attacker) / (def + aux.defender)) / (att / def) * 100) / 100;
  return [...factors, { id: 'aux', label: 'Auxiliaries', value, detail: `${aux.attacker} vs ${aux.defender}` }];
};

// The factors that moved the odds most, biggest effect first (how far from 1, as a ratio), at most three; a factor of
// exactly 1 changes nothing and is left out.
export const rankReasons = (factors, cap = 3) => factors
  .map((f) => ({ f, effect: Math.max(f.value, 1 / Math.max(0.01, f.value)) - 1 }))
  .filter((x) => x.effect > 0)
  .sort((a, b) => b.effect - a.effect)
  .slice(0, cap)
  .map((x) => x.f);

// 10th to 90th percentile of a list (nearest rank), widened to hold `mid` so the range always contains the estimate.
export const spread = (values, mid) => {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return [mid, mid];
  const at = (q) => v[Math.min(v.length - 1, Math.floor(q * v.length))];
  return [Math.min(at(0.1), mid), Math.max(at(0.9), mid)];
};

/** The committed parity record of a battle kind (parityEco type: field, assault, town, raid, sack, sally, landing, fort), or null when none was recorded. */
export const autoParityOf = (kind) => parity[kind] || null;

// Runs the real auto-resolve + siege rule `samples` times for an attack described by `v`
// ({ attackerUnits, defenderUnits, targetRegion }) with resolveBattle `args` and context `ctx`.
export const simulate = (state, v, args, ctx, samples, spec) => {
  const inputs = battleInputs(state, { attackerUnits: args.attackerUnits, defenderUnits: args.defenderUnits, cityId: spec.kind === 'field' || spec.kind === 'naval' ? null : spec.cityId, fromRegionId: spec.fromRegionId, naval: spec.kind === 'naval' });
  const attStart = sumStrength(v.attackerUnits); const defStart = sumStrength(inputs.defenderUnits); // the militia stand with the garrison
  const tally = { attacker: 0, defender: 0, stalemate: 0 };
  let attLoss = 0; let defLoss = 0; let captures = 0; let controlLeft = 0;
  const wins = []; const attLosses = []; const defLosses = [];
  let autoRule = null; let hpAfter = 0; let cityAttack = null;
  let auxA = 0; let auxD = 0; // the auxiliaries Auto trains from the battle economy (autoBattle.js), counted on the card too
  for (let i = 1; i <= samples; i++) {
    const r = resolveAutoBattle(state, args, spec, createRng(Math.imul(i, 2654435761) >>> 0), inputs);
    tally[r.outcome] += 1;
    auxA += r.report?.auxiliaries?.[0]?.fielded || 0; auxD += r.report?.auxiliaries?.[1]?.fielded || 0;
    wins.push(r.outcome === 'attacker' ? 1 : 0);
    attLosses.push(attStart - sumStrength(r.attackerUnits));
    defLosses.push(defStart - sumStrength(r.defenderUnits));
    attLoss += attLosses[i - 1];
    defLoss += defLosses[i - 1];
    const hasMeleeUnit = hasMeleeUnitDeployed(r.attackerUnits.filter((u) => u.strength > 0 && !u.routed));
    const siege = resolveSiegeControlDamage({
      currentControl: v.targetRegion.control,
      outcome: r.outcome,
      hasMeleeUnit,
      garrisonBroken: isGarrisonBroken(r.defenderUnits)
    });
    // The same reading as the outcome service (decision 40, capture.js cityFell; on Auto the
    // garrison-first rule and the attack on an empty city's defences, cityAssault.js).
    if (r.report?.cityAttack) {
      autoRule = 'attack'; cityAttack = r.report.cityAttack; hpAfter += r.report.cityAttack.hpAfter;
      if (r.report.cityAttack.falls && hasMeleeUnit) captures += 1;
    } else if (r.report?.garrisonFirst) autoRule = 'garrison';
    else if (cityFell(r, { occupier: hasMeleeUnit, fell: siege.captured })) captures += 1;
    controlLeft += siege.nextControl;
  }
  const auxiliaries = { attacker: Math.round(auxA / samples), defender: Math.round(auxD / samples) };
  const factors = withAuxiliaries(explainInvasion({ ...v, defenderUnits: inputs.defenderUnits }, ctx), attStart, defStart, auxiliaries);
  return {
    auxiliaries,
    // How Auto treats this city: 'garrison' (it fights the units inside and never takes the city),
    // 'attack' (an empty city: it batters the defences, `city` the HP before and expected after).
    autoRule,
    city: cityAttack ? { hpBefore: cityAttack.hpBefore, hpAfter: Math.round(hpAfter / samples), maxHp: cityAttack.maxHp, walls: cityAttack.walls, attack: cityAttack.attack, defence: cityAttack.defence } : null,
    attacker: tally.attacker / samples,
    defender: tally.defender / samples,
    stalemate: tally.stalemate / samples,
    // The chance this one attack takes the province (it also needs infantry or cavalry to hold it).
    capture: captures / samples,
    expectedControl: Math.round(controlLeft / samples),
    hasMelee: hasMeleeUnitDeployed(v.attackerUnits),
    attackerLossShare: attStart ? attLoss / samples / attStart : 0,
    defenderLossShare: defStart ? defLoss / samples / defStart : 0,
    attackerStrength: attStart,
    defenderStrength: defStart,
    factors,
    reasons: rankReasons(factors),
    // What Auto expects as a range (KTD11): the attacker's win chance by batches of 20 samples, and each side's men lost.
    range: {
      win: spread(Array.from({ length: Math.floor(samples / 20) }, (_, b) => wins.slice(b * 20, b * 20 + 20).reduce((x, y) => x + y, 0) / 20), tally.attacker / samples),
      attackerMen: spread(attLosses.map(menOf), menOf(attLoss / samples)),
      defenderMen: spread(defLosses.map(menOf), menOf(defLoss / samples))
    },
    parity: autoParityOf(spec.kind)
  };
};

// An empty city is no longer walked into (the user's rule of 14 October): Auto attacks its
// defences (cityAssault.js), so it is simulated like any other city battle.
export const estimateInvasionOdds = (state, fromRegionId, targetRegionId, samples = 200) => {
  const v = validateInvasion(state, fromRegionId, targetRegionId, { ignoreCost: true });
  if (!v.ok) return null;
  const ctx = getInvasionBattleContext(state, { targetRegionId, targetRegion: v.targetRegion, defenderUnits: v.defenderUnits });
  return simulate(state, v, getResolveBattleArgs(v, ctx), ctx, samples, { kind: 'invasion', cityId: targetRegionId, fromRegionId });
};

/**
 * The odds of a march to attack before it starts (playtest 40651416284 step 286: "March to Zafar"
 * walked 10k men into 228k with no warning): the stack's land units against the city's garrison
 * as the assault would find it today, through the same `simulate`. Only what the player knows: the
 * city's tile in sight or intel on its owner, else { known: false }. Null when no land unit marches.
 */
export const estimateMarchOdds = (state, attackerUnits, cityId, samples = 100) => {
  const city = state.regions?.[cityId];
  const land = attackerUnits.filter((u) => u.domain === 'land' && u.strength > 0);
  if (!city || !land.length) return null;
  if (!canSeeTile(state, city.tile) && !canSeeRegionDetails(state, cityId)) return { known: false };
  const defenderUnits = Object.values(state.units).filter((u) => u.regionId === cityId && u.domain === 'land' && u.classId !== 'settler' && u.ownerId !== state.playerNationId);
  // Aircraft in range join each side, as validateInvasion adds them (airPower.js).
  const v = { attackerUnits: withAirSupport(state, state.playerNationId, city.tile, land, defenderUnits), defenderUnits: withAirSupport(state, city.owner, city.tile, defenderUnits, land), targetRegion: city };
  const ctx = getInvasionBattleContext(state, { targetRegionId: cityId, targetRegion: city, defenderUnits: v.defenderUnits });
  const r = simulate(state, v, getResolveBattleArgs(v, ctx), ctx, samples, { kind: 'invasion', cityId, fromRegionId: land[0].regionId });
  const standby = seenStandby(state, cityId);
  return { known: true, cityId, turn: state.turnNumber, capture: r.capture, attacker: r.attacker, autoRule: r.autoRule, city: r.city, standbyStrength: standby.strength, standbyAllies: standby.allies, auxiliaries: r.auxiliaries, attackerStrength: r.attackerStrength, defenderStrength: r.defenderStrength, range: r.range, reasons: r.reasons };
};

/**
 * The one chance every card shows for a city attack (the march line, the attack card's verdict and its
 * hopeless line): a garrison is a battle to win (Auto never takes it in one), a city held by its militia
 * alone falls only when its walls break, so its chance is the capture (lead playtest 29 Oct, Blidaru:
 * the march said "Hopeless on Auto", the card "Likely win" from beating the militia). Field and sea: the win.
 */
export const autoChance = (odds) => (odds.autoRule === 'garrison' ? odds.attacker : odds.capture);

/**
 * The troops a commanded assault on `cityId` would call in (the same reinforcementSources as the
 * pending battle), as far as the player sees them: a 1,600-man garrison with 20,000 beside it is
 * not a weak city (newcomer playtest, round 3). Auto fights without them. `allies`: the owner's
 * co-belligerents among them, [{ id, name, strength }] (round 3b: huge armies, no reason shown).
 */
export const seenStandby = (state, cityId) => {
  const owner = state.regions?.[cityId]?.owner;
  const units = reinforcementSources(state, cityId, owner, state.playerNationId)
    .flatMap((src) => src.unitIds.map((id) => state.units[id])).filter((u) => u && canSeeTile(state, unitTile(state, u)));
  const allies = new Map();
  units.forEach((u) => { if (u.ownerId !== owner) allies.set(u.ownerId, (allies.get(u.ownerId) || 0) + Math.max(0, u.strength)); });
  return { strength: sumStrength(units), allies: [...allies].map(([id, strength]) => ({ id, name: state.nations?.[id]?.name || id, strength })) };
};

// The land battle of an amphibious landing (the naval interception, if any, is fought first and
// isn't part of these odds).
// A field battle (fieldBattle.js): no province to take, so `capture` is the chance of a win.
export const estimateFieldOdds = (state, fromRegionId, tile, samples = 200) => {
  const v = validateFieldAttack(state, fromRegionId, tile, { ignoreCost: true });
  if (!v.ok) return null;
  const ctx = getFieldBattleContext(state, v);
  const r = simulate(state, { ...v, targetRegion: { control: 100 } }, getFieldResolveArgs(v, ctx), ctx, samples, { kind: 'field', fromRegionId });
  return { ...r, capture: r.attacker, field: true };
};

/** The odds of a fleet attack from `fromTile` on the enemy fleets on `tile` (navalBattle.js). */
export const estimateFleetOdds = (state, fromTile, tile, samples = 200) => {
  const v = validateFleetAttack(state, fromTile, tile, { ignoreCost: true });
  if (!v.ok) return null;
  const ctx = getFleetBattleContext(state, v);
  const r = simulate(state, { ...v, targetRegion: { control: 100 } }, getFleetResolveArgs(v, ctx), ctx, samples, { kind: 'naval' });
  return { ...r, capture: r.attacker, field: true, naval: true };
};

/**
 * The Under-Attack sheet's odds for a city assault on the player, from the same `simulate` as the
 * attack card (200 runs, `range`). `holdChance` is the garrison holding (an empty city: not falling),
 * `avgDamage` the average control lost, `range` seen from the attacker like every odds.
 */
export const estimateDefenseOdds = (state, def, samples = 200) => {
  const armies = getDefenseArmies(state, def);
  if (!armies.attackerUnits.length) return { undefended: false, holdChance: 1, avgDamage: 0 };
  const ctx = getDefenseBattleContext(state, def);
  const region = state.regions[def.regionId];
  const args = { ...armies, terrain: ctx.terrain, isAttackingFortification: ctx.isAttackingFortification, generals: ctx.generals, attackerAgeId: ctx.attackerAgeId, defenderAgeId: ctx.defenderAgeId, defenderDamageReductionMultiplier: ctx.defenderDamageReductionMultiplier };
  const r = simulate(state, { ...armies, targetRegion: region }, args, ctx, samples, { kind: 'defense', cityId: def.regionId, fromRegionId: def.fromRegionId });
  const empty = r.autoRule === 'attack';
  return {
    undefended: empty,
    holdChance: 1 - (empty ? r.capture : r.attacker),
    avgDamage: empty ? null : Math.max(0, Math.round((region.control ?? 0) - r.expectedControl)),
    city: r.city && { hpBefore: r.city.hpBefore, hpAfter: r.city.hpAfter, maxHp: r.city.maxHp },
    hasMelee: r.hasMelee, // the attackers bring foot or horse to take the city (simulate's own reading)
    range: r.range,
    reasons: r.reasons,
    auxiliaries: r.auxiliaries
  };
};

export const estimateLandingOdds =(state, navalUnitId, targetRegionId, samples = 200) => {
  const v = validateAmphibious(state, navalUnitId, targetRegionId, { ignoreCost: true });
  if (!v.ok) return null;
  const ctx = getAmphibiousBattleContext(state, v, v.defenderLandUnits);
  const battle = { attackerUnits: v.embarkedLandUnits, defenderUnits: v.defenderLandUnits, targetRegion: v.targetRegion };
  return simulate(state, battle, { ...ctx, attackerUnits: battle.attackerUnits, defenderUnits: battle.defenderUnits }, ctx, samples, { kind: 'landing', cityId: targetRegionId, fromRegionId: v.navalUnit.regionId });
};
