// The world cache never stalls a load: an IndexedDB that never answers (seen in Safari) counts as
// an empty cache after OPEN_TIMEOUT_MS.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cacheGet, OPEN_TIMEOUT_MS } from './worldCache';

describe('worldCache', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('a hanging indexedDB.open resolves as a miss', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('indexedDB', { open: () => ({}) }); // no event ever fires
    let result = 'waiting';
    cacheGet('k').then((r) => { result = r; });
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS - 1);
    expect(result).toBe('waiting');
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBeNull();
  });

  it('no indexedDB at all is a miss', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await cacheGet('k')).toBeNull();
  });
});
