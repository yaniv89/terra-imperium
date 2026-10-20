import { describe, it, expect } from 'vitest';
import { declareWarModel } from './warActions';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 3 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);

describe('declare war from anywhere (plan P2.1)', () => {
  const s = peoplesWorld({ seed: 3 });
  it('one model names the cost, the justification and the block', () => {
    const m = declareWarModel(s, DE);
    expect(m.name).toBe(s.nations[DE].name); expect(m.atWar).toBe(false); expect(m.costs).toBeTruthy(); expect(m.label).toContain(`Declare war on ${s.nations[DE].name}`);
    expect(declareWarModel(s, FR)).toBeNull();
    expect(declareWarModel(s, 'rebels')).toBeNull();
    const vassal = { ...s, nations: { ...s.nations, [FR]: { ...s.nations[FR], vassalOf: DE } } };
    expect(declareWarModel(vassal, DE).enabled).toBe(false);
  });
});
