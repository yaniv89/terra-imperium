import { describe, it, expect } from 'vitest';
import { isCloudSaveConfigured, getSupabaseClient } from './supabaseClient';

// This repo ships no .env file setting VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, so the test
// environment IS the "not configured" case — exactly the state most players will actually be in
// (cloud saves are opt-in), and the one behavior that matters most: importing/using this module
// must never throw or attempt a network call just because cloud saves aren't set up.
describe('supabaseClient (unconfigured — no env vars set)', () => {
  it('reports cloud saves as not configured', () => {
    expect(isCloudSaveConfigured).toBe(false);
  });

  it('returns null instead of throwing or attempting to construct a client', () => {
    expect(() => getSupabaseClient()).not.toThrow();
    expect(getSupabaseClient()).toBeNull();
  });
});
