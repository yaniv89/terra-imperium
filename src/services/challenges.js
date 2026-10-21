// src/services/challenges.js
// U36: the weekly challenge's server calls. Every function takes the Supabase client (null when
// the build has no cloud keys) and answers { connected: false } instead of throwing, so the
// screens can show a clear "not connected" state and the game works offline.
export const fetchLeaderboard = async (client, weekId) => {
  if (!client) return { connected: false, rows: [] };
  try {
    const { data, error } = await client.from('challenge_leaderboard').select('display_name, score').eq('week_id', weekId).order('score', { ascending: false }).limit(50);
    return error ? { connected: false, rows: [] } : { connected: true, rows: data };
  } catch (e) { return { connected: false, rows: [] }; }
};

/** { ok: true } or { ok: false, reason: 'offline' | 'signin' | <server message> }. The server only queues it; the verifier decides later. */
export const submitChallenge = async (client, user, submission) => {
  if (!client) return { ok: false, reason: 'offline' };
  if (!user) return { ok: false, reason: 'signin' };
  try {
    const { error } = await client.functions.invoke('submit-challenge', { body: submission });
    return error ? { ok: false, reason: String(error.message || error) } : { ok: true };
  } catch (e) { return { ok: false, reason: 'offline' }; }
};
