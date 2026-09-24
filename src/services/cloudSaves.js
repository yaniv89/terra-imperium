// src/services/cloudSaves.js
// Phase F/M0.5: cloud saves against the `saves` table (supabase/migrations/0001_cloud_saves.sql +
// 0003_accounts_saves_admin.sql). Every function takes a Supabase client explicitly rather than
// importing getSupabaseClient() itself, so callers decide what "not configured" means for their
// own UI (and so these are trivially unit-testable against a fake client with no env vars or
// network involved).
import { encodeSave, decodeSave, saveMetadata } from './saveCodec';

const TABLE = 'saves';
export const SAVE_SLOTS = ['autosave', 'slot1', 'slot2', 'slot3'];

export class ConflictError extends Error {
  constructor(serverRow) {
    super('This slot was saved from elsewhere since you last synced it.');
    this.name = 'ConflictError';
    this.serverRow = serverRow;
  }
}

// Metadata only — never downloads/decodes `state`/`state_gz`, so browsing slots is cheap
// regardless of how large the underlying game state has grown.
export const listSaves = async (client, userId) => {
  const { data, error } = await client
    .from(TABLE)
    .select('id, slot_name, nation_id, nation_name, turn_number, game_year, age_id, game_status, size_bytes, origin, original_owner_id, device_label, revision, saved_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return data;
};

// Optimistic-concurrency write: if `expectedRevision` is given and doesn't match the row currently
// on the server, this throws ConflictError with the server's own metadata rather than silently
// overwriting whatever was saved from another device — src/hooks/useCloudSync.js's conflict
// chooser is what decides which side wins from there.
export const writeSlot = async (client, userId, slot, payload, { expectedRevision, origin = 'played', originalOwnerId = null, deviceLabel = null, appVersion = null } = {}) => {
  const encoded = await encodeSave(payload);
  const metadata = saveMetadata(payload.state);
  const row = {
    user_id: userId, slot_name: slot, version: payload.version,
    ...encoded, ...metadata,
    origin, original_owner_id: originalOwnerId, device_label: deviceLabel, app_version: appVersion
  };

  if (expectedRevision != null) {
    const { data, error } = await client
      .from(TABLE)
      .update(row)
      .eq('user_id', userId).eq('slot_name', slot).eq('revision', expectedRevision)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    // 0 rows matched: either the slot moved to a different revision (a real conflict) or it
    // doesn't exist yet (nothing to conflict with) — those need different responses.
    const current = await readSlotMeta(client, userId, slot);
    if (current) throw new ConflictError(current);
    // fall through to insert below
  }

  const { data, error } = await client
    .from(TABLE)
    .upsert({ ...row, revision: 1 }, { onConflict: 'user_id,slot_name' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

const readSlotMeta = async (client, userId, slot) => {
  const { data, error } = await client
    .from(TABLE)
    .select('id, slot_name, nation_id, nation_name, turn_number, game_year, revision, saved_at')
    .eq('user_id', userId).eq('slot_name', slot)
    .maybeSingle();
  if (error) throw error;
  return data;
};

// Reads and decodes a slot's full state, then runs it through the caller-supplied `migrate`
// function (saveMigrations.migrateSave) — decodeSave only reverses the storage transport, it
// never migrates on its own.
export const readSlot = async (client, userId, slot, migrate) => {
  const { data, error } = await client
    .from(TABLE)
    .select('id, version, state, state_gz, revision, saved_at')
    .eq('user_id', userId).eq('slot_name', slot)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const payload = await decodeSave(data);
  const migrated = migrate(payload);
  return migrated ? { ...migrated, revision: data.revision, savedAt: data.saved_at } : null;
};

export const deleteSlot = async (client, userId, slot) => {
  const { error } = await client.from(TABLE).delete().eq('user_id', userId).eq('slot_name', slot);
  if (error) throw error;
};
