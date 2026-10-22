// Report rank 7: a player's city with Auto build on picks its next build the AI's way when its list
// is empty (resolveTurn's cities phase, aiProduction.js); on by default for every city but the capital.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { peoplesWorld, addCity } from './testWorld';
import { autoBuildOn } from './world/cities';
import { idleCities } from './turnBlockers';
import { HISTORICAL_EVENTS } from '../data/events';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const empty = (c) => ({ ...c, production: { ...(c.production || {}), current: null, queue: [] } });

describe('Auto build (rank 7)', () => {
  const base = quiet(peoplesWorld({ seed: 11 }));
  const ME = base.playerNationId;
  const { state: grown, cityId } = addCity(base, ME, { size: 3 });
  const capId = base.nations[ME].capitalRegionId;
  const s = { ...grown, regions: { ...grown.regions, [cityId]: empty(grown.regions[cityId]), [capId]: empty(grown.regions[capId]) } };

  it('is on for a new city and off for the capital until the player says otherwise', () => {
    expect(autoBuildOn(s.regions[cityId])).toBe(true);
    expect(autoBuildOn(s.regions[capId])).toBe(false);
    expect(idleCities(s).map((c) => c.id)).not.toContain(cityId);
  });

  it('fills an empty list in a turn; switched off, the city waits for the player', () => {
    const next = resolveTurn(s);
    expect(next.regions[cityId].production?.current || next.regions[cityId].production?.lastCompleted).toBeTruthy();
    expect(next.regions[capId].production?.current ?? null).toBeNull();
    const off = gameReducer(s, { type: ActionTypes.SET_CITY_AUTO_BUILD, payload: { cityId, on: false } });
    expect(off.regions[cityId].autoBuild).toBe(false);
    expect(resolveTurn(off).regions[cityId].production?.current ?? null).toBeNull();
  }, 30000);
});
