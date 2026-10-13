// One "Idle N" chip that cycles, and the same stacking for the other kinds (playtest audit I157).
import { describe, it, expect } from 'vitest';
import { stackPrompts, nextInStack, stackLabel, stackHint, stackKeyOf } from './promptStack';

const single = (p) => `one ${p.kind}`;
const prompts = [
  { id: 'research', kind: 'research' },
  { id: 'city:a', kind: 'city' },
  { id: 'city:b', kind: 'city' },
  { id: 'settler:s1', kind: 'settler', tile: 1 },
  { id: 'army:10', kind: 'army', tile: 10 },
  { id: 'army:20', kind: 'army', tile: 20 },
  { id: 'unrest:a', kind: 'unrest' },
  { id: 'supply:10', kind: 'supply', tile: 10 }
];

describe('promptStack', () => {
  it('armies and settlers are one Idle chip; cities stack; the rest stand alone, in first-seen order', () => {
    const stacks = stackPrompts(prompts);
    expect(stacks.map((s) => [s.key, s.kind, s.count])).toEqual([
      ['research', 'research', 1], ['city', 'city', 2], ['idle', 'idle', 3], ['unrest', 'unrest', 1], ['supply', 'supply', 1]
    ]);
    expect(stacks[2].items.map((p) => p.id)).toEqual(['settler:s1', 'army:10', 'army:20']);
    expect(stackPrompts([])).toEqual([]);
    expect(stackPrompts(null)).toEqual([]);
  });

  it('each tap goes to the next idle unit and wraps', () => {
    const idle = stackPrompts(prompts).find((s) => s.key === 'idle');
    let last = null;
    const visited = [];
    for (let i = 0; i < 4; i += 1) { const p = nextInStack(idle, last); visited.push(p.id); last = p.id; }
    expect(visited).toEqual(['settler:s1', 'army:10', 'army:20', 'settler:s1']);
  });

  it('a unit that got its orders drops out and the cycle goes on from the start', () => {
    const idle = stackPrompts(prompts.filter((p) => p.id !== 'army:10')).find((s) => s.key === 'idle');
    expect(nextInStack(idle, 'army:10').id).toBe('settler:s1');
    expect(nextInStack(idle, 'settler:s1').id).toBe('army:20');
    expect(nextInStack({ items: [] })).toBe(null);
  });

  it('labels: one keeps its own words, several read as a count', () => {
    const [research, city, idle] = stackPrompts(prompts);
    expect(stackLabel(research, single)).toBe('one research');
    expect(stackLabel(city, single)).toBe('2 cities can build');
    expect(stackLabel(idle, single)).toBe('Idle 3');
    expect(stackLabel(stackPrompts([prompts[4]])[0], single)).toBe('one army');
    expect(stackHint(idle, single)).toBe('2 armies can still move, 1 settler waits for a destination. Each tap goes to the next one');
    expect(stackHint(research, single)).toBe(null);
    expect(stackLabel(stackPrompts([{ id: 'supply:1', kind: 'supply' }, { id: 'supply:2', kind: 'supply' }])[0], single)).toBe('2 armies low on supply');
    expect(stackLabel(stackPrompts([{ id: 'unrest:1', kind: 'unrest' }, { id: 'unrest:2', kind: 'unrest' }])[0], single)).toBe('2 cities restless');
  });

  it('the key is the idle stack, the kind, or the prompt itself', () => {
    expect(stackKeyOf({ id: 'army:3', kind: 'army' })).toBe('idle');
    expect(stackKeyOf({ id: 'city:x', kind: 'city' })).toBe('city');
    expect(stackKeyOf({ id: 'peace', kind: 'peace' })).toBe('peace');
  });
});
