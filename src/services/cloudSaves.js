// src/services/cloudSaves.js
// Phase F: cloud saves against the `saves` table (supabase/migrations/0001_cloud_saves.sql).
// Every function takes a Supabase client explicitly rather than importing getSupabaseClient()
// itself, so callers decide what "not configured" means for their own UI (and so these are
// trivially unit-testable against a fake client with no env vars or network involved).
//
// The payload shape — { version, state, savedAt } — is deliberately identical to
// src/context/GameContext.jsx's local save format (exportSave/importSave), so a save can move
// between local and cloud storage without any translation step.
const TABLE = 'saves';

export const saveToCloud = async (client, userId, slotName, { version, state }) => {
  const { data, error } = await client
    .from(TABLE)
    .upsert({ user_id: userId, slot_name: slotName, version, state }, { onConflict: 'user_id,slot_name' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const loadFromCloud = async (client, userId, slotName) => {
  const { data, error } = await client
    .from(TABLE)
    .select('id, version, state, saved_at')
    .eq('user_id', userId)
    .eq('slot_name', slotName)
    .maybeSingle();
  if (error) throw error;
  return data; // null if no save exists in this slot yet — not an error
};

export const listCloudSaves = async (client, userId) => {
  const { data, error } = await client
    .from(TABLE)
    .select('id, slot_name, version, saved_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const deleteCloudSave = async (client, saveId) => {
  const { error } = await client.from(TABLE).delete().eq('id', saveId);
  if (error) throw error;
};
