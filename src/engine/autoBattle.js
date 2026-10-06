// src/engine/autoBattle.js
// The honest auto-resolve (master plan 6.1; RTS plan 10.2). A battle fought on Auto is the same
// battle as the commanded one: the same campaign inputs (battleInputs.js: the armies after the air
// turn-back and the turn's desertion, supply, starvation, plague, the city's militia, the walls'
// remaining HP) feed resolveBattle (battle.js), and the result has the same shape and goes through
// the same outcome service (battleOutcome.js).
//
// What the real-time battle has that a round-based exchange does not, modelled here:
//   walls        a siege that battered the walls (hpRatio) keeps half their effect at 0 HP
//                (battleInputs.js batteredReduction); the real-time keep starts at the same HP share
//   economy      every land battle has the battle economy (R1): both sides train local auxiliaries
//                that demobilise after it. They join the auto-resolve as reserves in units of
//                AUX_UNIT strength: AUX_TRAINED[kind] x TRAIN_STRENGTH x AUX_EFFECT, times the
//                side's stockpile multiplier (R1's stockMult from supply and development), the
//                defender of a city at most its housing over its garrison. A city with no garrison
//                (its militia alone) fights no economy and holds no gate: it is walked into. Their losses are not
//                campaign losses; they are taken out of the result.
//   walls        a walled city (fort level WALLS_FORT_LEVEL or more), or a manned fort in a field
//                battle (forts.js), without a siege engine in the
//                attacking army holds its gate: the attacker's blows count WALLS_NO_SIEGE_MULT,
//                fading as a siege battered the walls (hpRatio), as the real-time walls block an
//                army that has nothing to breach them with
//   the city     an assault fought on Auto damages the real city as the real-time one does
//                (autoCityDamage, measured with parityEco: the real-time AI fights the keep, the
//                towers and the town hall, not the houses): a tower falls (CITY_TOWER_REPELLED of the
//                time when the assault failed, else it is damaged), the town hall falls when the
//                attacker broke in (else damaged CITY_HALL_REPELLED of the time). The outcome service
//                carries it to the map under the 50% rule.
//   decisive     a field battle (6.9): the loser's units that broke are run down unless they reach
//                an exit: each routed unit escapes with AUTO_ESCAPE_CHANCE (AUTO_ESCAPE_PURSUED when
//                the winner has cavalry to pursue), else it is 'field' (still on the field: destroyed);
//                a loser still unbroken at the end withdraws by an exit ('fled'). The same rule as a
//                commanded battle's dispositions (src/battle/sim/result.js).
// Deterministic: every roll comes from the caller's rng, after resolveBattle's own. Pure.
import { resolveBattle, MAX_BATTLE_ROUNDS } from './battle';
import { battleInputs, batteredReduction } from './battleInputs';
import { stockMult, TRAIN_STRENGTH } from '../battle/data/economy';
import { cityManifestOf } from './cityManifest';

export const AUX_UNIT = 1000;
export const AUX_EFFECT = 1.6;
// Auxiliaries a side trains in a battle of this kind, [attacker, defender] (measured in the
// real-time battle with the parity harness, .claude/skills/battle-lab/parityEco.sim.js).
export const AUX_TRAINED = { field: [8, 8], assault: [12, 12] };
export const AUX_ROUNDS = 0; // extra auto-resolve rounds per auxiliary unit (the time to fight them)
export const WALLS_FORT_LEVEL = 2;
export const WALLS_NO_SIEGE_MULT = 0.7;
export const AUX_CLOSENESS = 1.5; // the auxiliaries x min(1, this x weaker / stronger army); 0 = off
// Raids and sacks (measured with parityEco TYPES=raid,sack): raiders do not fight for the field,
// they burn and run. In a raid their blows count RAID_MULT x min(1, defenders / raiders) (the more
// they outnumber the defenders, the more of them are busy looting while a few hold the defenders
// off); in a sack, where the garrison must be broken first, SACK_MULT. Beaten in a raid's fight,
// they still burned the loot and got away RAID_SLIP_BASE of the time plus RAID_SLIP times the share
// of cavalry in the party (fast riders slip past to the targets): a raid is hard to stop (the
// real-time raiders win 15 or 16 of 16 against the AI). A sack must break the garrison: no slip.
export const RAID_MULT = 0.4;
export const SACK_MULT = 0.4;
export const RAID_SLIP_BASE = 0.7;
export const RAID_SLIP = 0.5;
export const AUTO_TUNE = { AUX_ROUNDS, AUX_UNIT, AUX_EFFECT, AUX_TRAINED, WALLS_NO_SIEGE_MULT, AUX_CLOSENESS, RAID_MULT, SACK_MULT, RAID_SLIP_BASE, RAID_SLIP };

/** The raiders' damage multiplier in an auto-resolved raid or sack (see RAID_MULT). */
export const raidMult = (kind, ins, tune = AUTO_TUNE) => {
  if (kind === 'sack') return tune.SACK_MULT ?? SACK_MULT;
  if (kind !== 'raid') return 1;
  const own = (list) => (list || []).reduce((s, u) => s + Math.max(0, u.strength || 0), 0);
  const a = own(ins.attackerUnits); const d = own(ins.defenderUnits);
  return (tune.RAID_MULT ?? RAID_MULT) * (a > 0 ? Math.min(1, d / a) : 1);
};
export const CITY_TOWER_REPELLED = 0.5;
export const CITY_HALL_REPELLED = 0.3;

/** The real city's damage from an auto-resolved assault: { destroyed: [manifest id], damaged: [manifest id] }. */
export const autoCityDamage = (manifest, battle, defenderLossShare, rng) => {
  if (!manifest?.structures?.length) return null;
  const broke = battle.outcome === 'attacker';
  const towers = manifest.structures.filter((s) => s.kind === 'tower').map((s) => s.id);
  const hall = manifest.structures.find((s) => s.kind === 'townhall')?.id || null;
  const destroyed = []; const damaged = [];
  if (towers.length) {
    const tower = towers[Math.floor(rng.next() * towers.length)];
    if (broke || rng.next() < CITY_TOWER_REPELLED) destroyed.push(tower); else damaged.push(tower);
  }
  if (hall) { if (broke) destroyed.push(hall); else if (rng.next() < CITY_HALL_REPELLED) damaged.push(hall); }
  return { destroyed, damaged };
};

const ASSAULT_KINDS = new Set(['invasion', 'landing', 'defense', 'assault']);
// Raids and sacks (raidBattle.js): the one light battle, no battle economy, no gate held.
export const RAID_KINDS = new Set(['raid', 'sack']);

/** The auxiliaries a side brings into an auto-resolved battle: reserve units, never campaign units. */
export const auxiliariesFor = (kind, side, ins, tune = AUTO_TUNE) => {
  const k = ASSAULT_KINDS.has(kind) ? 'assault' : kind === 'field' ? 'field' : null;
  if (!k) return [];
  const supply = ins.economyInputs?.supply?.[side] ?? 1;
  const development = ins.economyInputs?.development?.[side] ?? 0;
  // A lopsided battle is over before much is trained: the auxiliaries scale with how even it is.
  const own = (list) => (list || []).reduce((s, u) => s + Math.max(0, u.strength || 0), 0);
  const a = own(ins.attackerUnits); const d = own(ins.defenderUnits);
  const even = a > 0 && d > 0 ? Math.min(a, d) / Math.max(a, d) : 1;
  const closeness = tune.AUX_CLOSENESS > 0 ? Math.min(1, tune.AUX_CLOSENESS * even) : 1;
  let total = Math.round(tune.AUX_TRAINED[k][side] * TRAIN_STRENGTH * tune.AUX_EFFECT * stockMult(supply, development) * closeness);
  if (k === 'assault' && side === 1 && ins.housing > 0) total = Math.min(total, Math.max(0, ins.housing - (ins.defenderUnits?.length || 0)) * TRAIN_STRENGTH * tune.AUX_EFFECT);
  const out = [];
  for (let i = 0; total > 0; i++) {
    const strength = Math.min(tune.AUX_UNIT, total);
    total -= strength;
    out.push({ id: `aux_${side}_${i}`, classId: 'infantry', domain: 'land', strength, maxStrength: strength, morale: 80, promotions: [], commanderId: null, auxiliary: true });
  }
  return out;
};

export const AUTO_ESCAPE_CHANCE = 0.5;
export const AUTO_ESCAPE_PURSUED = 0.3;

/** Dispositions for a field battle's units (6.9), from the auto-resolve's result. */
export const autoDispositions = (battle, rng) => {
  const loser = battle.outcome === 'attacker' ? 'defender' : battle.outcome === 'defender' ? 'attacker' : null;
  const winnerUnits = loser === 'attacker' ? battle.defenderUnits : loser === 'defender' ? battle.attackerUnits : [];
  const pursued = winnerUnits.some((u) => u.classId === 'cavalry' && u.strength > 0 && !u.routed);
  const mark = (list, side) => list.map((u) => {
    if (!(u.strength > 0)) return { ...u, disposition: 'dead' };
    if (side !== loser) return { ...u, disposition: u.routed ? 'fled' : 'field' };
    if (!u.routed) return { ...u, disposition: 'fled' }; // unbroken at the end: an orderly withdrawal
    return { ...u, disposition: rng.next() < (pursued ? AUTO_ESCAPE_PURSUED : AUTO_ESCAPE_CHANCE) ? 'fled' : 'field' };
  });
  return { ...battle, attackerUnits: mark(battle.attackerUnits, 'attacker'), defenderUnits: mark(battle.defenderUnits, 'defender') };
};

/**
 * Fight a battle on Auto. `args`: resolveBattle's arguments from the kind's context (invasion.js,
 * fieldBattle.js, navalBattle.js, defense.js) without the rng; `spec`: { kind, cityId,
 * fromRegionId, naval, militia } for battleInputs; `inputs` (optional) when the caller already
 * computed them. Returns resolveBattle's shape plus `inputs` (the militia among them).
 */
export const resolveAutoBattle = (state, args, spec, rng, inputs = null) => {
  const kind = spec?.kind || 'invasion';
  const naval = kind === 'naval' || !!spec?.naval;
  const cityId = naval || kind === 'field' ? null : spec?.cityId ?? null;
  const ins = inputs || battleInputs(state, { attackerUnits: args.attackerUnits, defenderUnits: args.defenderUnits, cityId, fromRegionId: spec?.fromRegionId ?? null, naval, militia: spec?.militia ?? null });
  const battle = autoFromInputs(args, ins, kind, rng);
  if (!cityId || !ASSAULT_KINDS.has(kind)) return battle;
  // The real city takes its damage as in a commanded battle (row 20 of master plan 6.7).
  const start = ins.defenderUnits.reduce((s, u) => s + Math.max(0, u.strength), 0);
  const end = battle.defenderUnits.reduce((s, u) => s + Math.max(0, u.strength), 0);
  const cityDamage = autoCityDamage(cityManifestOf(state, cityId), battle, start > 0 ? (start - end) / start : 0, rng);
  return cityDamage ? { ...battle, report: { ...battle.report, cityDamage } } : battle;
};

/**
 * The auto-resolve from inputs already gathered (battleInputs.js shape: { attackerUnits,
 * defenderUnits, hpRatio, economyInputs, housing }), without a game state: the parity harness
 * (.claude/skills/battle-lab/parityEco.sim.js) feeds the same armies to this and to the sim.
 */
export const autoFromInputs = (args, ins, kind, rng, tune = AUTO_TUNE) => {
  // A city with no garrison (its militia only) is walked into: no battle economy, no gate held.
  const contested = !ASSAULT_KINDS.has(kind) || ins.defenderUnits.some((u) => !u.militia && u.strength > 0);
  const auxA = contested ? auxiliariesFor(kind, 0, ins, tune) : [];
  const auxD = contested ? auxiliariesFor(kind, 1, ins, tune) : [];
  // A field battle against a manned fort (forts.js: a walled keep on the battle map) holds its gate too.
  const walled = contested && ((ASSAULT_KINDS.has(kind) && (ins.walled ?? (args.fortLevel ?? 0) >= WALLS_FORT_LEVEL)) || (kind === 'field' && !!args.isAttackingFortification));
  const noSiege = walled && !ins.attackerUnits.some((u) => u.classId === 'siege' && u.strength > 0);
  const wallsMult = noSiege ? 1 - (1 - tune.WALLS_NO_SIEGE_MULT) * Math.max(0, Math.min(1, ins.hpRatio ?? 1)) : 1;
  let battle = resolveBattle({
    ...args,
    attackerUnits: [...ins.attackerUnits, ...auxA],
    defenderUnits: [...ins.defenderUnits, ...auxD],
    attackerPenaltyMultiplier: (args.attackerPenaltyMultiplier ?? 1) * wallsMult * raidMult(kind, ins, tune),
    maxRounds: MAX_BATTLE_ROUNDS + Math.max(auxA.length, auxD.length) * (tune.AUX_ROUNDS ?? AUX_ROUNDS),
    defenderDamageReductionMultiplier: batteredReduction(args.defenderDamageReductionMultiplier ?? 1, ins.hpRatio),
    rng
  });
  // The auxiliaries demobilise: out of the result (RTS plan 6.5), only counted in the report.
  const strip = (list) => list.filter((u) => !u.auxiliary);
  const kept = (ids) => ids.filter((id) => !id.startsWith('aux_'));
  const auxiliaries = [auxA, auxD].map((list, side) => ({ fielded: list.reduce((s, u) => s + u.strength, 0), standing: (side ? battle.defenderUnits : battle.attackerUnits).filter((u) => u.auxiliary).reduce((s, u) => s + Math.max(0, u.strength), 0) }));
  battle = {
    ...battle,
    attackerUnits: strip(battle.attackerUnits),
    defenderUnits: strip(battle.defenderUnits),
    report: { ...battle.report, deployedAttackerIds: kept(battle.report.deployedAttackerIds), deployedDefenderIds: kept(battle.report.deployedDefenderIds), auxiliaries, wallsMult }
  };
  // Raiders beaten in the fight may still have burned the loot and got away (the raid's objective).
  if (kind === 'raid' && battle.outcome !== 'attacker') {
    const alive = battle.attackerUnits.filter((u) => u.strength > 0);
    const cav = alive.length ? alive.filter((u) => u.classId === 'cavalry').length / alive.length : 0;
    if (alive.length && rng.next() < (tune.RAID_SLIP_BASE ?? RAID_SLIP_BASE) + (tune.RAID_SLIP ?? RAID_SLIP) * cav) battle = { ...battle, outcome: 'attacker', report: { ...battle.report, outcome: 'attacker', slipped: true } };
  }
  // Decisive field battles (6.9); a raid's beaten raiders are run down the same way unless they get
  // away (battleOutcome.js raidAdapter destroys only the raiders still on the field).
  if (kind === 'field' || RAID_KINDS.has(kind)) battle = autoDispositions(battle, rng);
  return { ...battle, report: { ...battle.report, mode: 'auto' }, inputs: ins };
};
