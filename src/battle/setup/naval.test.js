// Sea battles (playtest issues 1 and 2): ships on water only, no land units, and the fleets meet.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from './buildBattleSetup';
import { TILE } from './mapgen';
import { createWorld } from '../sim/world';
import { runHeadless } from '../sim/headless';
import { step } from '../sim/step';
import { battleLimitTicks } from '../sim/constants';

const fleet = (prefix, lines, strength, generalId) => lines.map((navalLine, i) => ({ id: `${prefix}${i}`, classId: 'naval', navalLine, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: i === 0 ? generalId : null, domain: 'naval', xp: 0 }));
const GENERALS = { g_att: { id: 'g_att', name: 'A', martial: 4, shock: 4, fire: 3, maneuver: 3 }, g_def: { id: 'g_def', name: 'D', martial: 3, shock: 3, fire: 3, maneuver: 3 } };
const seaSetup = (ageId, seed) => buildSetupFromArmies({
  regionId: `sea-test-${seed}`, terrain: 'sea', battleType: 'naval', seed,
  attackerUnits: fleet('a', ['warship', 'warship', 'warship', 'raider', 'transport'], 1000, 'g_att'),
  defenderUnits: fleet('d', ['warship', 'warship', 'raider', 'transport'], 900, 'g_def'),
  generals: GENERALS, powers: [[], []], attackerAgeId: ageId, defenderAgeId: ageId, controllers: ['player', 'ai']
});

describe('sea battle', () => {
  ['classical', 'information'].forEach((ageId) => {
    it(`${ageId}: every ship starts on open water and nothing but ships sails`, () => {
      const setup = seaSetup(ageId, 7);
      const w = createWorld(setup);
      const { map } = setup;
      expect(w.squads.length).toBeGreaterThan(9);
      w.squads.forEach((q) => {
        expect(q.classId).toBe('naval');
        if (!q.onField) return;
        expect(map.tiles[Math.floor(q.y / 256) * map.w + Math.floor(q.x / 256)]).toBe(TILE.OPEN);
      });
      expect(setup.structures.every((s) => s.passive)).toBe(true);
    });

    // BC 47 (U9): a destroyer was lost before any order; the fleets form up out of reach.
    it(`${ageId}: no ship is hit before tick 60`, () => {
      const w = createWorld(commandedSetup(seaSetup(ageId, 3)));
      for (let i = 0; i < 60; i++) { step(w, []); w.events.length = 0; }
      w.squads.filter((q) => q.onField).forEach((q) => expect(q.strength).toBe(q.startStrength));
    });

    it(`${ageId}: with the player idle, the AI fleet comes on and the battle ends before the clock`, () => {
      const setup = seaSetup(ageId, 11);
      const { result, world } = runHeadless(setup);
      expect(world.ended.tick).toBeLessThan(battleLimitTicks(setup));
      expect(world.ended.reason).not.toBe('timeLimit');
      expect(result).toBeTruthy();
    });
  });
});
