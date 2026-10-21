import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { grantDecree } from '../../engine/decrees';
import { walletOf } from '../../utils/costs';
import { costLine, shortfallLine } from './empireText';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const me = base.playerNationId;
const withGold = (gold) => ({ ...base, resources: { ...base.resources, gold } });

describe('the cost line (U9)', () => {
  it('writes gold only, decrees only and both, in one line', () => {
    expect(costLine({ gold: 150 })).toBe('150 Gold');
    expect(costLine({ decrees: 1 })).toBe('1 decree');
    expect(costLine({ decrees: 2, gold: 300 })).toBe('2 decrees, 300 Gold');
  });

  it('names only what is missing, with what you hold', () => {
    const s = withGold(100);
    const empty = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], ruler: { ...s.nations[me].ruler, decrees: 0 } } } };
    expect(shortfallLine(walletOf(empty), { gold: 100, decrees: 1 })).toBe('1 decree (have 0)');
    expect(shortfallLine(walletOf(empty), { gold: 150, decrees: 1 })).toBe('150 Gold (have 100), 1 decree (have 0)');
    const one = { ...empty, nations: { ...empty.nations, [me]: grantDecree(empty.nations[me], 'warWon', 1) } };
    expect(shortfallLine(walletOf(one), { decrees: 2 })).toBe('2 decrees (have 1)');
    expect(shortfallLine(walletOf(one), { gold: 50, decrees: 1 })).toBe('');
  });
});
