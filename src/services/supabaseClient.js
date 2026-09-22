// src/services/supabaseClient.js
// Phase F (plan §10, "Backend"): cloud saves + auth via Supabase. Deliberately optional — a
// player who never configures these env vars gets exactly today's behavior (local-only saves,
// src/context/GameContext.jsx's STORAGE_KEY), never a crash or a silent network attempt. That's
// why this exports a getter that returns null rather than a top-level client instance: importing
// this module must never throw just because cloud saves aren't set up for a given build.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const isCloudSaveConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let cachedClient = null;

// Returns the shared Supabase client, or null if VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY aren't
// set. Every caller in src/services/cloudSaves.js checks for null before using it — cloud saves
// are a pure enhancement, so the app must keep working with local saves alone when this is null.
export const getSupabaseClient = () => {
  if (!isCloudSaveConfigured) return null;
  if (!cachedClient) cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cachedClient;
};
