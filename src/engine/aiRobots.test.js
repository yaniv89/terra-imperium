// Future AI (eight ages U72): AI cities build robots up to ROBOT_SHARE, and a robot army keeps its human.
import { describe, it, expect } from 'vitest';
import { peoplesWorld, rivalOf, cap } from './testWorld';
import { unitChoices } from './aiProduction';
import { wantsRobot, ROBOT_SHARE } from './robots';
import { siegeParty } from './aiOperations';
import { ROBOT_TECH } from '../data/unitClasses';

const BASE = peoplesWorld({ seed: 11 });
const ai = rivalOf(BASE, 0);
const city = BASE.regions[cap(ai)];
const unit = (id, extra = {}) => ({ id, ownerId: ai, regionId: city.id, homeRegionId: city.id, tile: city.tile, domain: 'land', classId: 'infantry', ageId: 'future', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [], commanderId: null, ...extra });

describe('Future AI armies', () => {
  it('an AI city tries robots while they are under ROBOT_SHARE of its army, then humans', () => {
    expect(wantsRobot({ landUnits: 1, robots: 0 })).toBe(true);
    expect(wantsRobot({ landUnits: 4, robots: Math.ceil(ROBOT_SHARE * 5) })).toBe(false);
    expect(unitChoices(['ranged', 'infantry'], true, 'future', [ROBOT_TECH, 'military_powered_exoskeletons'])).toEqual([
      { kind: 'unit', classId: 'ranged', robot: true }, { kind: 'unit', classId: 'ranged' },
      { kind: 'unit', classId: 'infantry', robot: true }, { kind: 'unit', classId: 'infantry' }
    ]);
    expect(unitChoices(['infantry'], true, 'future', [])).toEqual([{ kind: 'unit', classId: 'infantry' }]);
    expect(unitChoices(['infantry'], false, 'future', [ROBOT_TECH])).toEqual([{ kind: 'unit', classId: 'infantry' }]);
  });

  it('a siege party leaving its city takes its only human with the robots', () => {
    const units = [unit('h1', { strength: 100 }), unit('r1', { robot: true }), unit('r2', { robot: true })];
    const party = siegeParty(BASE, units, city.tile, city.id);
    expect(party.some((u) => !u.robot)).toBe(true);
    expect(party).toHaveLength(2);
  });
});
