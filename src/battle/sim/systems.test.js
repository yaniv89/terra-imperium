// src/battle/sim/systems.test.js
// Tactical Battles T6/T7 (design/rts-battles-implementation-plan.md §8–9): fog of war and intel,
// ambush, territory attrition and supply wagons, generals' and perk abilities, commander powers,
// reinforcements from neighbouring provinces, and the parity harness against auto-resolve.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies, reinforcementEdge } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { step } from './step';
import { runHeadless } from './headless';
import { updateFog, canSeeSquad } from './fog';
import { applySupplyAndAttrition } from './support';
import { activateAbility, effectMult, firePower, processImpacts } from './effects';
import { applyOrder } from './orders';
import { garrisonRoom, resolveStructureFire, updateGarrisons } from './objectives';
import { buildSpatialHash } from './pathing';
import { enterReserves } from './movement';
import { Q } from './constants';
import { resolveBattle } from '../../engine/battle';
import { createRng } from '../../utils/rng';

const mk = (p, cls, strength = 1000, extra = {}) => cls.map((c, i) => ({ id: `${p}${i}`, classId: c, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', ...extra }));
const setup = (over = {}) => buildSetupFromArmies({
  regionId: 'systems-test', terrain: 'plains', seed: 5,
  attackerUnits: mk('a', ['infantry', 'infantry', 'cavalry', 'ranged']),
  defenderUnits: mk('d', ['infantry', 'ranged']),
  controllers: ['ai', 'ai'], ...over
});
const place = (q, tx, ty) => { q.x = tx * Q + 128; q.y = ty * Q + 128; };

describe('fog of war & intel', () => {
  it('without intel the attacker cannot see a defender far beyond its sight', () => {
    const w = createWorld(setup({ intel: { attackerSeesDefender: false } }));
    updateFog(w);
    const def = w.squads.find((q) => q.side === 1 && q.onField);
    expect(canSeeSquad(w, 0, def)).toBe(false);
    // ...but the defender, on home ground, sees its own territory
    const att = w.squads.find((q) => q.side === 0 && q.onField);
    place(att, w.map.keep.x - 8, w.map.keep.y);
    w.tick = 5; updateFog(w);
    expect(canSeeSquad(w, 1, att)).toBe(true);
  });

  it('with intel the attacker gets a scouting report: everything visible at the start', () => {
    const w = createWorld(setup({ intel: { attackerSeesDefender: true } }));
    updateFog(w);
    expect(canSeeSquad(w, 0, w.squads.find((q) => q.side === 1 && q.onField))).toBe(true);
  });

  it('an ambush hides squads inside sight until enemy cavalry comes close', () => {
    const w = createWorld(setup({ intel: { attackerSeesDefender: true }, defenderUnits: mk('d', ['infantry', 'ranged'], 1000, { commanderId: 'g1' }), generals: { g1: { id: 'g1', personality: 'cautious', martial: 3, shock: 3, fire: 3, maneuver: 3 } } }));
    const def = w.squads.find((q) => q.side === 1 && q.onField);
    expect(activateAbility(w, def, 'ambush')).toBe(true);
    w.revealUntil[0] = -1; w.tick = 5; updateFog(w);
    const att = w.squads.find((q) => q.side === 0 && q.classId === 'infantry');
    place(att, Math.floor(def.x / Q) - 5, Math.floor(def.y / Q));
    w.tick = 10; updateFog(w);
    expect(canSeeSquad(w, 0, def)).toBe(false);
    const cav = w.squads.find((q) => q.side === 0 && q.classId === 'cavalry');
    place(cav, Math.floor(def.x / Q) - 2, Math.floor(def.y / Q));
    expect(canSeeSquad(w, 0, def)).toBe(true);
  });
});

describe('territory attrition & supply wagons', () => {
  const inTerritory = (w, q) => place(q, w.map.keep.x - 6, w.map.keep.y + 3);
  it('an unsupplied attacker inside enemy territory bleeds strength; a wagon stops it', () => {
    const w = createWorld(setup({ attackerUnits: mk('a', ['infantry', 'support']) }));
    const inf = w.squads.find((q) => q.side === 0 && q.classId === 'infantry');
    const wagon = w.squads.find((q) => q.side === 0 && q.classId === 'support');
    inTerritory(w, inf); place(wagon, 2, 2);
    w.tick = 20; applySupplyAndAttrition(w);
    const bled = inf.strength;
    expect(bled).toBeLessThan(1000);
    place(wagon, Math.floor(inf.x / Q) - 1, Math.floor(inf.y / Q));
    w.tick = 40; applySupplyAndAttrition(w);
    expect(inf.strength).toBeGreaterThanOrEqual(bled); // no more bleeding — the wagon even patches it up
    expect(inf.strength).toBeLessThanOrEqual(1000);     // but never above what it brought
  });

  it('forager units are immune to attrition', () => {
    const w = createWorld(setup({ attackerUnits: mk('a', ['infantry'], 1000, { promotions: ['forager'] }) }));
    const inf = w.squads.find((q) => q.side === 0);
    inTerritory(w, inf);
    w.tick = 20; applySupplyAndAttrition(w);
    expect(inf.strength).toBe(1000);
  });
});

describe('abilities', () => {
  const general = (personality) => ({ g1: { id: 'g1', personality, martial: 3, shock: 3, fire: 3, maneuver: 3 } });
  it('Forced March speeds up everyone near the general, then goes on cooldown', () => {
    const w = createWorld(setup({ attackerUnits: mk('a', ['infantry', 'infantry'], 1000, { commanderId: 'g1' }), generals: general('reckless') }));
    const [g, other] = w.squads.filter((q) => q.side === 0);
    expect(activateAbility(w, g, 'forcedMarch')).toBe(true);
    expect(effectMult(w, other, 'speed')).toBe(1.5);
    expect(activateAbility(w, g, 'forcedMarch')).toBe(false); // cooldown
  });

  it('personality abilities belong to the right generals; Entrench needs own ground for an attacker', () => {
    const w = createWorld(setup({ attackerUnits: mk('a', ['infantry'], 1000, { commanderId: 'g1' }), generals: general('cautious') }));
    const g = w.squads.find((q) => q.side === 0);
    expect(activateAbility(w, g, 'charge')).toBe(false); // reckless only
    expect(activateAbility(w, g, 'entrench')).toBe(false); // attacker, no held point
    expect(activateAbility(w, g, 'shieldWall')).toBe(true); // cautious: anywhere
  });

  it('Volley Fire (legendary archers) doubles the rate of fire for a few seconds', () => {
    const w = createWorld(setup({ attackerUnits: mk('a', ['ranged'], 1000, { promotions: ['volleyFire'] }) }));
    const r = w.squads.find((q) => q.side === 0);
    expect(activateAbility(w, r, 'volley')).toBe(true);
    expect(effectMult(w, r, 'selfRate')).toBe(2);
  });
});

describe('commander powers', () => {
  it('Rally Cry restores morale and un-routs the side', () => {
    const w = createWorld(setup());
    const q = w.squads.find((s) => s.side === 0 && s.onField);
    q.morale = 10; q.routed = true;
    w.supply[0] = 500;
    expect(firePower(w, 0, 'rallyCry', 0, 0)).toBe(true);
    expect(q.routed).toBe(false);
    expect(q.morale).toBe(40);
    expect(firePower(w, 0, 'rallyCry', 0, 0)).toBe(false); // cooldown
  });

  it('an arrow storm hits only enemies; a missile hits everyone and its uses run out', () => {
    const s = setup({ powers: [[{ id: 'arrowStorm' }, { id: 'missileTactical', uses: 1 }], []] });
    const w = createWorld(s);
    w.supply[0] = 1000;
    const def = w.squads.find((q) => q.side === 1 && q.onField);
    const att = w.squads.find((q) => q.side === 0 && q.onField);
    place(att, Math.floor(def.x / Q) - 1, Math.floor(def.y / Q)); // right next to the target
    expect(firePower(w, 0, 'arrowStorm', def.x, def.y)).toBe(true);
    w.tick += 200; processImpacts(w);
    expect(def.strength).toBeLessThan(1000);
    expect(att.strength).toBe(1000); // precision: friendly squads untouched
    expect(firePower(w, 0, 'missileTactical', def.x, def.y)).toBe(true);
    w.tick += 200; processImpacts(w);
    expect(att.strength).toBeLessThan(1000); // a missile doesn't care whose side you're on
    expect(firePower(w, 0, 'missileTactical', def.x, def.y)).toBe(false); // no missiles left
    expect(w.powersUsed[0]).toMatchObject({ arrowStorm: 1, missileTactical: 1 });
  });

  it('a power not brought to the battle cannot be used', () => {
    const w = createWorld(setup({ powers: [[{ id: 'rallyCry' }], []] }));
    w.supply[0] = 1000;
    expect(firePower(w, 0, 'nuclearStrike', 0, 0)).toBe(false);
  });
});

describe('reinforcements from neighbouring provinces', () => {
  it('wait off-map, march in from their edge when called, and only then count in the result', () => {
    const s = setup({ controllers: ['player', 'player'], reinforcements: [[{ regionId: 'n1', name: 'North', edge: 'N', units: mk('r', ['cavalry', 'infantry']) }], []] });
    const w = createWorld(s);
    const rein = w.squads.filter((q) => q.reinforcement);
    expect(rein).toHaveLength(2);
    expect(rein.every((q) => q.reserve && !q.onField)).toBe(true);
    w.supply[0] = 1000;
    applyOrder(w, { side: 0, type: 'callReserve', squads: [rein[0].idx] });
    expect(w.supply[0]).toBe(880);
    w.tick = rein[0].enterTick; enterReserves(w);
    expect(rein[0].onField).toBe(true);
    expect(rein[0].y).toBe(Q); // north edge
    // Battle Supply starts at 100 (+1/s); a reinforcement costs 120, so the call waits for income.
    const { result } = runHeadless(s, { orders: [{ tick: 420, side: 0, type: 'callReserve', squads: [rein[0].idx] }], maxTicks: 1000 });
    expect(result.report.tactical.joinedReinforcements).toEqual(['r0']);
    expect(result.attackerUnits.some((u) => u.id === 'r0')).toBe(true);
    expect(result.attackerUnits.some((u) => u.id === 'r1')).toBe(false);
  });

  it('bearings: the origin province is west; the others keep their real direction around it', () => {
    // Paris region attacked from the west (Brittany side): a neighbour to the north enters N.
    expect(reinforcementEdge('fr-75', 'fr-92', 'fr-92', 0)).toBe('W');
    expect(['N', 'S', 'W']).toContain(reinforcementEdge('fr-75', 'fr-92', 'fr-93', 0));
    expect(reinforcementEdge('fr-75', 'fr-92', 'fr-93', 1)).not.toBe('W');
  });
});

describe('parity with auto-resolve (casualty exchange rate)', () => {
  // A commanded battle is fought to the finish while auto-resolve is one exchange per turn, so win
  // rates aren't comparable — who bleeds more per unit of damage dealt is. AI-vs-AI in the sim must
  // stay in the same band as auto-resolve across matchups, so command mode isn't free wins.
  const exchange = (att, def) => {
    let tA = 0; let tD = 0; let aA = 0; let aD = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const { result } = runHeadless(setup({ seed, regionId: `parity-${seed}`, terrain: 'mixed', attackerUnits: mk('a', att), defenderUnits: mk('d', def), deposits: [], powers: [[], []] }));
      const lost = (units, start) => start.reduce((x, u) => x + u.strength, 0) - units.reduce((x, u) => x + u.strength, 0);
      tA += lost(result.attackerUnits, mk('a', att)); tD += lost(result.defenderUnits, mk('d', def));
      const auto = resolveBattle({ attackerUnits: mk('a', att), defenderUnits: mk('d', def), terrain: 'mixed', isAttackingFortification: false, rng: createRng(seed * 97) });
      aA += lost(auto.attackerUnits, mk('a', att)); aD += lost(auto.defenderUnits, mk('d', def));
    }
    return { tactical: tA / Math.max(1, tD), auto: aA / Math.max(1, aD) };
  };
  [
    [['infantry', 'infantry', 'ranged'], ['infantry', 'infantry', 'ranged']],
    [['infantry', 'infantry', 'infantry', 'cavalry', 'ranged'], ['infantry', 'ranged']],
    [['cavalry', 'cavalry'], ['ranged', 'ranged']]
  ].forEach(([att, def]) => {
    it(`${att.join('+')} vs ${def.join('+')}: exchange rate within a factor of 2 of auto-resolve`, () => {
      const { tactical, auto } = exchange(att, def);
      expect(tactical).toBeGreaterThan(auto / 2 - 0.05);
      expect(tactical).toBeLessThan(auto * 2 + 0.05);
    });
  });
});

describe('determinism holds with every system active', () => {
  it('replays identically with abilities, powers and reinforcements in play', () => {
    const s = () => setup({
      seed: 17, terrain: 'forest', intel: { attackerSeesDefender: false },
      attackerUnits: mk('a', ['infantry', 'cavalry', 'ranged', 'support'], 1000, { commanderId: 'g1' }),
      defenderUnits: mk('d', ['infantry', 'infantry', 'ranged'], 1000, { commanderId: 'g2' }),
      generals: { g1: { id: 'g1', personality: 'reckless', martial: 4, shock: 4, fire: 2, maneuver: 3 }, g2: { id: 'g2', personality: 'cautious', martial: 3, shock: 3, fire: 3, maneuver: 3 } },
      powers: [[{ id: 'rallyCry' }, { id: 'arrowStorm' }], [{ id: 'rallyCry' }, { id: 'arrowStorm' }]],
      reinforcements: [[{ regionId: 'x', name: 'X', edge: 'S', units: mk('r', ['cavalry']) }], [{ regionId: 'y', name: 'Y', edge: 'N', units: mk('s', ['infantry']) }]],
      fortLevel: 2, deposits: ['iron']
    });
    const one = runHeadless(s(), { checkpointEvery: 200 });
    const two = runHeadless(s(), { checkpointEvery: 200 });
    expect(two.checkpoints).toEqual(one.checkpoints);
    expect(two.result).toEqual(one.result);
    expect(one.world.ended).toBeTruthy();
  });

  it('keeps stepping without errors through a long, busy battle', () => {
    const w = createWorld(setup({ terrain: 'hills', fortLevel: 4, deposits: ['iron', 'copper'] }));
    for (let i = 0; i < 3000 && !w.ended; i++) step(w);
    expect(w.squads.every((q) => Number.isInteger(q.strength) && q.strength >= 0)).toBe(true);
  });
});

describe('garrisons (plan §8.10)', () => {
  const fortified = (over = {}) => createWorld(setup({ fortLevel: 2, controllers: ['player', 'player'], ...over }));
  const walkIn = (w, idx, si = 0) => {
    applyOrder(w, { side: 1, type: 'garrison', squads: [idx], structure: si });
    for (let i = 0; i < 400 && w.squads[idx].inside < 0; i++) step(w, []);
    return w.squads[idx];
  };

  it('a defender squad walks into the fortified keep, vanishes from the enemy and can\'t be hit', () => {
    const w = fortified();
    const d = w.squads.find((q) => q.side === 1 && q.classId === 'ranged');
    walkIn(w, d.idx);
    expect(d.inside).toBe(0);
    expect(canSeeSquad(w, 0, d)).toBe(false);
    const hp = d.strength;
    firePower(w, 0, 'rallyCry', 0, 0); // harmless; now bombard the keep itself
    w.impacts = [{ at: w.tick, x: d.x, y: d.y, radius: 4 * Q, damage: 0.5, side: 0, power: 'arrowStorm' }];
    processImpacts(w);
    expect(d.strength).toBe(hp);
  });

  it('the garrison adds its firepower to the building\'s shots', () => {
    const shotDamage = (garrison) => {
      const w = fortified();
      const d = w.squads.find((q) => q.side === 1 && q.classId === 'ranged');
      if (garrison) walkIn(w, d.idx);
      const a = w.squads.find((q) => q.side === 0);
      const keep = w.structures[0];
      place(a, Math.floor(keep.x / Q) - 4, Math.floor(keep.y / Q));
      a.onField = true; keep.cooldown = 0;
      w.squads.forEach((q) => { if (q !== a && q.side === 0) q.onField = false; });
      buildSpatialHash(w);
      const before = a.strength;
      resolveStructureFire(w);
      return before - a.strength;
    };
    expect(shotDamage(true)).toBeGreaterThan(shotDamage(false) * 1.5);
  });

  it('a failing building throws its garrison out with -20 morale; a move order walks out freely', () => {
    const w = fortified();
    const [d1, d2] = w.squads.filter((q) => q.side === 1);
    walkIn(w, d1.idx); walkIn(w, d2.idx);
    expect([d1.inside, d2.inside]).toEqual([0, 0]);
    applyOrder(w, { side: 1, type: 'move', squads: [d2.idx], x: d2.x - 3 * Q, y: d2.y });
    expect(d2.inside).toBe(-1);
    const morale = d1.morale;
    w.structures[0].hp = Math.floor(w.structures[0].maxHp * 0.2);
    updateGarrisons(w);
    expect(d1.inside).toBe(-1);
    expect(d1.morale).toBe(morale - 20);
  });

  it('no garrisons in an unwalled town, and never for the attacker', () => {
    const open = createWorld(setup({ fortLevel: 0, controllers: ['player', 'player'] }));
    expect(garrisonRoom(open, 0)).toBe(0);
    const w = fortified();
    const a = w.squads.find((q) => q.side === 0);
    applyOrder(w, { side: 0, type: 'garrison', squads: [a.idx], structure: 0 });
    expect(a.order.type).not.toBe('garrison');
  });

  it('a prince+ AI defender mans its keep with a ranged squad', () => {
    const w = createWorld(setup({ fortLevel: 2, difficultyId: 'king', defenderUnits: mk('d', ['infantry', 'infantry', 'ranged', 'ranged']) }));
    for (let i = 0; i < 600; i++) step(w, []);
    const inside = w.squads.filter((q) => q.side === 1 && q.inside >= 0);
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.length).toBeLessThanOrEqual(2); // at least half stay in the field
  });
});
