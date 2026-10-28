// The turn worker's save text (turn.worker.js 'saveText') must be the bytes the page would write:
// the page saves it instead of stringifying the revived state itself (GameContext saveNow).
import { it, expect } from 'vitest';
import { gameReducer } from '../gameReducer';
import { reviveFog } from '../fog';
import { reviveTileMaps } from '../world/tileIndex';
import { peoplesWorld } from '../testWorld';
import { ActionTypes } from '../../data/types';

it('the worker JSON of a turn equals the JSON of the state the page revives', () => {
  const next = gameReducer({ ...peoplesWorld({ seed: 7 }), proceduralEventCooldown: 999999 }, { type: ActionTypes.ADVANCE_TURN });
  const cloned = structuredClone(next); // what postMessage hands the page
  const revived = reviveTileMaps(cloned.fog ? { ...cloned, fog: reviveFog(cloned.fog) } : cloned); // turnClient's revive
  expect(JSON.stringify(revived)).toBe(JSON.stringify(next));
});
