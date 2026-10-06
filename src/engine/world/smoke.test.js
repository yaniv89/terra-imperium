import { it, expect } from 'vitest';
import { createInitialState } from '../gameReducer';
import { resolveTurn } from '../resolveTurn';
import { auditGameState } from '../stateAudit';
import { REGIONS_DATA, getNationCapital, getNeighborIds } from '../../data/regions';

it('smoke: a new game on the tile world runs 5 turns', () => {
  let s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  const cap = getNationCapital('fr');
  expect(cap).toBeTruthy();
  expect(s.regions[cap].owner).toBe('fr');
  expect(Object.keys(s.regions).length).toBe(240 - s.scenario.dormantNationIds.length); // less the nations with no room (settle-rules R4)
  expect(REGIONS_DATA[cap].name).toBeTruthy();
  console.log('fr capital', cap, REGIONS_DATA[cap].name, 'neighbours', getNeighborIds(cap), 'tiles', s.regions[cap].tiles.length, 'units', Object.keys(s.units).length);
  expect(auditGameState(s)).toEqual([]);
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) { s = resolveTurn({ ...s, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } }); if (s.activeEventId) s = { ...s, activeEventId: null }; }
  console.log('5 turns ms', Math.round(performance.now() - t0), 'gold', s.resources.gold, 'size', s.regions[cap].size, 'food', s.regions[cap].food, 'tiles', s.regions[cap].tiles.length, 'dev', JSON.stringify(s.regions[cap].dev), 'yields', JSON.stringify(s.regions[cap].lastYields));
  const issues = auditGameState(s);
  if (issues.length) console.log(JSON.stringify(issues.slice(0, 5)));
  expect(issues).toEqual([]);
});
