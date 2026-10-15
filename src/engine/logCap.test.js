// src/engine/logCap.test.js
// The log keeps only the last LOG_CAP lines after a turn, so a long game's save stops growing.
import { describe, it, expect } from 'vitest';
import { capLogs, LOG_CAP } from './resolveTurn';

describe('log cap', () => {
  it('keeps a short log as it is', () => {
    const logs = [{ message: 'a' }, { message: 'b' }];
    expect(capLogs(logs)).toBe(logs);
  });

  it('keeps the newest LOG_CAP lines of a long log', () => {
    const logs = Array.from({ length: LOG_CAP + 50 }, (_, i) => ({ message: `line ${i}` }));
    const capped = capLogs(logs);
    expect(capped).toHaveLength(LOG_CAP);
    expect(capped[0].message).toBe('line 50');
    expect(capped[capped.length - 1].message).toBe(`line ${LOG_CAP + 49}`);
  });
});
