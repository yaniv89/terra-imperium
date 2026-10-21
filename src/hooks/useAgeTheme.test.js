// U43: <html data-age> follows the player's age. No DOM in the test env: a stub document and an
// effect runner stand in.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react', () => ({ useEffect: (fn) => fn() }));
globalThis.document = { documentElement: { dataset: {} } };

const { useAgeTheme } = await import('./useAgeTheme');

describe('useAgeTheme (U43)', () => {
  it('writes the age and clears it with no player', () => {
    useAgeTheme('stone');
    expect(document.documentElement.dataset.age).toBe('stone');
    useAgeTheme('bronze');
    expect(document.documentElement.dataset.age).toBe('bronze');
    useAgeTheme(null);
    expect(document.documentElement.dataset.age).toBeUndefined();
  });
});
