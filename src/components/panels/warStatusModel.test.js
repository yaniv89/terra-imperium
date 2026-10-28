import { describe, it, expect } from 'vitest';
import { warStatus } from './warStatusModel';
import { PEACE_SCORE_ENFORCE_THRESHOLD } from '../../engine/diplomacy';

const world = (war) => ({ playerNationId: 'me', regions: { c1: { id: 'c1', name: 'Jericho', owner: 'me' } }, wars: [{ id: 'w', active: true, ...war }] });

describe('war status on the enemy card (lane wars-8)', () => {
  it('names the war goal from the right side and reads the score as the player sees it', () => {
    const s = warStatus(world({ aggressor: 'them', enemy: 'me', score: 75, goal: { type: 'capture_region', regionId: 'c1' } }), 'them');
    expect(s.score).toBe(-75);
    expect(s.goal).toEqual({ key: 'ws.goalCityThem', vars: { city: 'Jericho' }, done: false });
    expect(s.outlook).toMatchObject({ key: 'ws.danger', tone: 'danger', vars: { at: PEACE_SCORE_ENFORCE_THRESHOLD } });
  });

  it('even, losing and winning bands; no war, no status', () => {
    const at = (score) => warStatus(world({ aggressor: 'me', enemy: 'them', score, goal: { type: 'destroy_military' } }), 'them');
    expect(at(0).outlook.key).toBe('ws.even');
    expect(at(0).goal.key).toBe('ws.goalArmyYou');
    expect(at(-40).outlook.key).toBe('ws.losing');
    expect(at(45).outlook.key).toBe('ws.winning');
    expect(warStatus(world({ aggressor: 'a', enemy: 'b' }), 'them')).toBeNull();
  });
});
