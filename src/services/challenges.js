// src/services/challenges.js
// U36: the weekly challenge's server calls. Every function takes the Supabase client (null when
// the build has no cloud keys) and answers { connected: false } instead of throwing, so the
// screens can show a clear "not connected" state and the game works offline.
// Menu side only: the engine never reads a clock (determinismGuard.test.js).
/** '2026-W43': the ISO week of a Date (UTC). */
export const isoWeekId = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // the Thursday of this week
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

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
