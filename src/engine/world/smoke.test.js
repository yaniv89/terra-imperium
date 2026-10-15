import { it, expect } from 'vitest';
import { resolveTurn } from '../resolveTurn';
import { auditGameState } from '../stateAudit';
import { REGIONS_DATA, getNationCapital, getNeighborIds } from '../../data/regions';
import { peoplesWorld } from '../testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;

it('smoke: a new game on the tile world runs 5 turns', () => {
  let s = peoplesWorld({ seed: 7 });
  const cap = getNationCapital(FR);
  expect(cap).toBeTruthy();
  expect(s.regions[cap].owner).toBe(FR);
  expect(Object.keys(s.regions).length).toBe(Object.keys(s.nations).length); // one city each at the start
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
