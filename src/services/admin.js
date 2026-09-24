// src/services/admin.js
// Phase F/M0.5: the in-game Admin page's data layer. Every function here only works because the
// database's row-level security (supabase/migrations/0003_accounts_saves_admin.sql's is_admin()
// policies) actually allows it for the calling user — nothing here elevates privilege client-side,
// it just calls tables/views/RPCs that are only readable/writable by an admin account in the first
// place. A non-admin calling these gets empty results or a permission error from Postgres itself.
import { decodeSave } from './saveCodec';

const logAction = async (client, adminId, action, { targetSaveId = null, targetUserId = null, details = null } = {}) => {
  const { error } = await client.from('admin_actions').insert({
    admin_id: adminId, action, target_save_id: targetSaveId, target_user_id: targetUserId, details
  });
  if (error) throw error;
};

export const listPlayers = async (client, { search = '', page = 0, pageSize = 50 } = {}) => {
  let query = client.from('profiles').select('*').order('created_at', { ascending: false });
  if (search) query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  const { data, error } = await query.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return data;
};

export const listAllSaves = async (client, { search = '', page = 0, pageSize = 50 } = {}) => {
  let query = client.from('admin_saves').select('*').order('saved_at', { ascending: false });
  if (search) query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%,nation_name.ilike.%${search}%`);
  const { data, error } = await query.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return data;
};

// A short, human-readable summary of one save's contents — not the raw state, so an admin can
// verify a report ("my save is missing region X") without the UI having to render a full game.
export const inspectSave = async (client, adminId, saveId) => {
  const { data: row, error } = await client.from('saves').select('*').eq('id', saveId).single();
  if (error) throw error;
  const payload = await decodeSave(row);
  const { state } = payload;
  const regions = Object.values(state.regions || {});
  const summary = {
    nationId: state.playerNationId,
    nationName: state.nations?.[state.playerNationId]?.name,
    turnNumber: state.turnNumber,
    year: state.year,
    age: state.age,
    gameStatus: state.gameStatus,
    regionsOwned: regions.filter((r) => r.owner === state.playerNationId).length,
    treasury: state.resources?.gold ?? null,
    activeWars: (state.wars || []).filter((w) => w.active !== false && (w.attacker === state.playerNationId || w.defender === state.playerNationId)).length,
    techsResearched: (state.techTree?.researched || []).length
  };
  await logAction(client, adminId, 'inspect_save', { targetSaveId: saveId, targetUserId: row.user_id });
  return summary;
};

export const exportSaveJson = async (client, adminId, saveId) => {
  const { data: row, error } = await client.from('saves').select('*').eq('id', saveId).single();
  if (error) throw error;
  const payload = await decodeSave(row);
  await logAction(client, adminId, 'export_save', { targetSaveId: saveId, targetUserId: row.user_id });
  return JSON.stringify(payload, null, 2);
};

export const deleteSave = async (client, adminId, saveId, targetUserId) => {
  const { error } = await client.from('saves').delete().eq('id', saveId);
  if (error) throw error;
  await logAction(client, adminId, 'delete_save', { targetSaveId: saveId, targetUserId });
};

export const listAuditLog = async (client, { limit = 200 } = {}) => {
  const { data, error } = await client.from('admin_actions').select('*').order('at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
};
