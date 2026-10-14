// Three taps on the "Idle N" chip open three army sheets, one tile each. (panels-shots.mjs used to
// look for the words "Army at", which only a stack standing in a city reads; the others read
// "Army near X" or "in the land of X", so two of three taps looked empty to the script.)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { stackPrompts, nextInStack } from './promptStack';
import { goToPrompt } from './promptActions';
import { SELECT_ARMY } from '../map/marchEvents';

describe('idle chip taps', () => {
  const opened = [];
  beforeEach(() => {
    opened.length = 0;
    const target = new EventTarget();
    globalThis.window = target;
    target.addEventListener(SELECT_ARMY, (e) => opened.push(e.detail));
  });
  afterEach(() => { delete globalThis.window; });

  it('every tap selects the next idle army tile, and wraps', () => {
    const idle = stackPrompts([
      { id: 'army:10', kind: 'army', tile: 10 }, { id: 'army:20', kind: 'army', tile: 20 }, { id: 'army:30', kind: 'army', tile: 30 }
    ])[0];
    let last = null;
    for (let i = 0; i < 4; i += 1) { const p = nextInStack(idle, last); last = p.id; goToPrompt({}, p); }
    expect(opened).toEqual([10, 20, 30, 10]);
  });
});
