import { describe, it, expect } from 'vitest';
import { SPACE_MISSIONS, SPACE_MISSIONS_BY_ID, FINAL_SPACE_MISSION_ID, canLaunchMission } from './spaceMissions';

describe('SPACE_MISSIONS data integrity', () => {
  it('has 9 missions, matching the plan\'s ladder', () => {
    expect(SPACE_MISSIONS.length).toBe(9);
  });

  it('is ordered 0..N-1 with no gaps or duplicates', () => {
    expect(SPACE_MISSIONS.map(m => m.order)).toEqual(SPACE_MISSIONS.map((_, i) => i));
  });

  it('every mission has a real gold/techPoints cost and a positive turn count', () => {
    SPACE_MISSIONS.forEach(m => {
      expect(m.cost.gold).toBeGreaterThan(0);
      expect(m.cost.techPoints).toBeGreaterThan(0);
      expect(m.turns).toBeGreaterThan(0);
    });
  });

  it('cost and turns both rise monotonically up the ladder — later missions are strictly bigger asks', () => {
    for (let i = 1; i < SPACE_MISSIONS.length; i++) {
      expect(SPACE_MISSIONS[i].cost.gold).toBeGreaterThan(SPACE_MISSIONS[i - 1].cost.gold);
      expect(SPACE_MISSIONS[i].turns).toBeGreaterThanOrEqual(SPACE_MISSIONS[i - 1].turns);
    }
  });

  it('asteroid_mining and outer_planets are the only sources of rareMetals/helium3 income', () => {
    const rareMetalsSources = SPACE_MISSIONS.filter(m => m.recurringReward.rareMetalsPerTurn);
    const helium3Sources = SPACE_MISSIONS.filter(m => m.recurringReward.helium3PerTurn);
    expect(rareMetalsSources.map(m => m.id)).toEqual(['asteroid_mining']);
    expect(helium3Sources.map(m => m.id)).toEqual(['outer_planets']);
  });

  it('FINAL_SPACE_MISSION_ID is the last mission in ladder order', () => {
    expect(FINAL_SPACE_MISSION_ID).toBe('interstellar_probe');
    expect(SPACE_MISSIONS_BY_ID[FINAL_SPACE_MISSION_ID].order).toBe(SPACE_MISSIONS.length - 1);
  });
});

describe('canLaunchMission', () => {
  it('allows the first rung (order 0) with no prior completions', () => {
    expect(canLaunchMission('sounding_rocket', [], {})).toBe(true);
  });

  it('rejects a later rung until its predecessor is completed', () => {
    expect(canLaunchMission('first_satellite', [], {})).toBe(false);
    expect(canLaunchMission('first_satellite', ['sounding_rocket'], {})).toBe(true);
  });

  it('rejects a mission already completed', () => {
    expect(canLaunchMission('sounding_rocket', ['sounding_rocket'], {})).toBe(false);
  });

  it('rejects a mission already in progress', () => {
    expect(canLaunchMission('sounding_rocket', [], { sounding_rocket: 2 })).toBe(false);
  });

  it('rejects an unknown mission id', () => {
    expect(canLaunchMission('not_real', [], {})).toBe(false);
  });

  it('enforces the full chain in order — skipping a rung is never allowed', () => {
    expect(canLaunchMission('moon_landing', ['sounding_rocket', 'first_satellite'], {})).toBe(false);
    expect(canLaunchMission('moon_landing', ['sounding_rocket', 'first_satellite', 'crewed_orbit'], {})).toBe(true);
  });
});
