// The late peoples arrive on the old 10-tech clock (ageRefs.js arrivalYear), not the screen's year
// label (displayYear.js, changed for follow-up 18): same seed, same arrival turns as before.
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { arrivalYear } from './ageRefs';
import { labelYear } from './displayYear';
import { getTechsForAge } from '../data/techTree';

const TURNS = Number(process.env.ARRIVAL_TURNS || 60);

describe('late peoples keep their clock (follow-up 18)', () => {
  it('arrivalYear is the old label: the age over its 10 techs', () => {
    const ids = (age, n) => getTechsForAge(age).slice(0, n).map((t) => t.id);
    expect(arrivalYear('bronze', [...ids('stone', 10), ...ids('bronze', 5)])).toBe(-1400);
    expect(labelYear('bronze', [...ids('stone', 10), ...ids('bronze', 5)])).not.toBe(-1400);
  });

  it('the arrival turns of seed 11 are the ones measured before the label changed', () => {
    let s = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
    s = { ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { defaultMode: 'auto', autoDefend: true }, research: { ...s.research, auto: true } };
    const arrived = [];
    for (let t = 0; t < TURNS; t++) {
      const before = s.scenario.lateArrivals || {};
      if (s.pendingPeaceOffer) s = { ...s, pendingPeaceOffer: null };
      if (s.pendingDefenses?.length) s = { ...s, pendingDefenses: [] };
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      Object.keys(before).filter((id) => !(id in (s.scenario.lateArrivals || {}))).sort().forEach((id) => arrived.push(`${id}@${s.turnNumber}`));
    }
    if (process.env.PRINT_ARRIVALS) console.log('ARRIVALS', JSON.stringify(arrived));
    expect(arrived).toEqual(EXPECTED);
  }, 300000);
});
const EXPECTED = ['lapita@54']; // measured on claude/integration (old label) with this loop
