// An attack on an enemy building by a group is an attack-move to it (selection.js buildingAttackOrders):
// the lead's check of 28 Oct (All, Enemy, Attack it on their keep) lost the whole army for a third of theirs.
import { describe, it, expect } from 'vitest';
import { buildingAttackOrders } from './selection';
import { buildSetupFromArmies, commandedSetup } from '../setup/buildBattleSetup';
import { createWorld } from '../sim/world';
import { step } from '../sim/step';
import { TICK_HZ } from '../sim/constants';

const mk = (p, str) => ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged', 'siege', 'infantry']
  .map((classId, i) => ({ id: `${p}${i}`, classId, strength: str, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', xp: 0 }));

// The sandbox's default fight (kingdoms, mixed, fort 2, the economy on), the player's army sent at the keep every minute.
const fight = (orderFor) => {
  const w = createWorld(commandedSetup(buildSetupFromArmies({
    regionId: 'sandbox-mixed-7', terrain: 'mixed', seed: 7, attackerUnits: mk('a', 1000), defenderUnits: mk('d', 900),
    powers: [[], []], reinforcements: [[], []], attackerAgeId: 'kingdoms', defenderAgeId: 'kingdoms', fortLevel: 2, isCapital: false,
    infrastructure: 5, deposits: [], controllers: ['player', 'ai'], economy: true
  })));
  const keep = w.structures[0];
  for (let i = 0; i <= w.setup.limitTicks && !w.ended; i++) {
    const army = w.squads.filter((q) => q.side === 0 && q.alive && q.onField && !q.fled && !q.worker).map((q) => q.idx);
    step(w, i >= TICK_HZ && (i - TICK_HZ) % (60 * TICK_HZ) === 0 ? orderFor(army, keep).map((o) => ({ side: 0, ...o })) : []);
    w.events.length = 0;
  }
  return w.ended;
};

describe('an attack on a building', () => {
  it('a group attack-moves to it; one squad keeps the plain attack', () => {
    const target = { kind: 'structure', index: 0 };
    expect(buildingAttackOrders([1, 2], target, 10, 20)).toEqual([{ type: 'attackMove', squads: [1, 2], x: 10, y: 20 }]);
    expect(buildingAttackOrders([3], target, 10, 20)).toEqual([{ type: 'attack', squads: [3], target }]);
  });

  it('the army sent at their keep takes it instead of dying at the walls', () => {
    const blind = fight((squads) => [{ type: 'attack', squads, target: { kind: 'structure', index: 0 } }]);
    const sent = fight((squads, keep) => buildingAttackOrders(squads, { kind: 'structure', index: 0 }, keep.x, keep.y));
    expect(blind.outcome).toBe('defender'); // the old order: the whole army lost (sandboxTrace 0 of 8 seeds)
    expect(sent).toMatchObject({ outcome: 'attacker', reason: 'baseDestroyed' });
  });
});
