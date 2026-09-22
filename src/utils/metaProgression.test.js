import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMeta, saveMeta } from './metaProgression';

const META_KEY = 'terra-imperium-meta-v1';

// This project's vitest environment is plain 'node' (vitest.config.js) — no browser globals, so
// there's no real localStorage to test against. A minimal in-memory stand-in, backed by a real
// Storage-like prototype (so `Storage.prototype.setItem` can be monkey-patched below the same way
// a real browser's would), is enough to exercise metaProgression.js's actual read/write logic.
class FakeStorage {
  #data = new Map();
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null; }
  setItem(key, value) { this.#data.set(key, String(value)); }
  removeItem(key) { this.#data.delete(key); }
  clear() { this.#data.clear(); }
}
globalThis.Storage = FakeStorage;
globalThis.localStorage = new FakeStorage();

describe('loadMeta', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns hasSeenOnboarding: false for a genuinely fresh browser (no meta key at all)', () => {
    expect(loadMeta().hasSeenOnboarding).toBe(false);
  });

  it('defaults hasSeenOnboarding to true for meta saved before onboarding existed', () => {
    // A real returning player from before this field existed — must not see onboarding land on
    // them retroactively, which is why this default differs from the fresh-browser case above.
    localStorage.setItem(META_KEY, JSON.stringify({ unlockedAchievements: ['first_conquest'], selectedDoctrine: 'none' }));
    expect(loadMeta().hasSeenOnboarding).toBe(true);
  });

  it('respects a real persisted hasSeenOnboarding value either way', () => {
    localStorage.setItem(META_KEY, JSON.stringify({ hasSeenOnboarding: false }));
    expect(loadMeta().hasSeenOnboarding).toBe(false);

    localStorage.setItem(META_KEY, JSON.stringify({ hasSeenOnboarding: true }));
    expect(loadMeta().hasSeenOnboarding).toBe(true);
  });

  it('falls back to the full default shape when storage holds corrupt JSON', () => {
    localStorage.setItem(META_KEY, 'not json');
    expect(loadMeta()).toEqual({ unlockedAchievements: [], selectedDoctrine: 'none', difficulty: 'prince', hasSeenOnboarding: false });
  });
});

describe('saveMeta', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists whatever is passed, round-trippable via loadMeta', () => {
    const meta = { unlockedAchievements: ['a1'], selectedDoctrine: 'conqueror', difficulty: 'king', hasSeenOnboarding: true };
    saveMeta(meta);
    expect(loadMeta()).toEqual(meta);
  });

  it('never throws when storage is unavailable', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => { throw new Error('quota exceeded'); });
    expect(() => saveMeta({ hasSeenOnboarding: true })).not.toThrow();
    Storage.prototype.setItem = original;
  });
});
