// src/components/admin/AdminPage.jsx
// Plan §M0.5: the in-game surface that lets an admin account (profiles.role = 'admin', granted
// only via one-time SQL — see supabase/SETUP.md) verify who owns a given save. Every read/write
// here only succeeds because the database's RLS already allows it for this signed-in user
// (supabase/migrations/0003_accounts_saves_admin.sql's is_admin() policies) — this page has no
// privilege of its own, it just exposes tables/views only an admin's own query can actually see.
import React, { useEffect, useState } from 'react';
import { X, Users, Database, ScrollText, Eye, Download, Trash2 } from 'lucide-react';
import { listPlayers, listAllSaves, inspectSave, exportSaveJson, deleteSave, listAuditLog } from '../../services/admin';

const TABS = ['players', 'saves', 'audit'];

const AdminPage = ({ open, onClose, client, adminId }) => {
  const [tab, setTab] = useState('players');
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState([]);
  const [saves, setSaves] = useState([]);
  const [audit, setAudit] = useState([]);
  const [inspecting, setInspecting] = useState(null); // { row, summary } | null
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    if (tab === 'players') listPlayers(client, { search }).then(setPlayers).catch((e) => setError(e.message));
    if (tab === 'saves') listAllSaves(client, { search }).then(setSaves).catch((e) => setError(e.message));
    if (tab === 'audit') listAuditLog(client).then(setAudit).catch((e) => setError(e.message));
  };

  useEffect(() => { if (open) load(); }, [open, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const handleInspect = async (row) => {
    try {
      const summary = await inspectSave(client, adminId, row.id);
      setInspecting({ row, summary });
    } catch (e) {
      setError(e.message);
    }
  };

  const handleExport = async (row) => {
    try {
      const json = await exportSaveJson(client, adminId, row.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `save-${row.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete this save (${row.nation_name || row.nation_id}, turn ${row.turn_number}) belonging to ${row.email}?`)) return;
    try {
      await deleteSave(client, adminId, row.id, row.user_id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h2 className="text-white font-bold text-lg">Admin</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 p-2 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            {t === 'players' && <Users className="w-3.5 h-3.5 inline mr-1.5" />}
            {t === 'saves' && <Database className="w-3.5 h-3.5 inline mr-1.5" />}
            {t === 'audit' && <ScrollText className="w-3.5 h-3.5 inline mr-1.5" />}
            {t}
          </button>
        ))}
        {tab !== 'audit' && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            placeholder="Search email / display name..."
            className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
          />
        )}
      </div>

      {error && <p className="px-4 py-2 text-xs text-red-400">{error}</p>}

      <div className="flex-1 overflow-auto p-4">
        {tab === 'players' && (
          <table className="w-full text-sm text-left">
            <thead className="text-slate-500 text-xs uppercase">
              <tr><th className="p-2">Display Name</th><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Joined</th><th className="p-2">Last seen</th></tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-t border-slate-800 text-slate-200">
                  <td className="p-2">{p.display_name}</td>
                  <td className="p-2 text-slate-400">{p.email}</td>
                  <td className="p-2">{p.role}</td>
                  <td className="p-2 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-slate-500">{new Date(p.last_seen_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'saves' && (
          <table className="w-full text-sm text-left">
            <thead className="text-slate-500 text-xs uppercase">
              <tr>
                <th className="p-2">Owner</th><th className="p-2">Slot</th><th className="p-2">Nation</th>
                <th className="p-2">Turn</th><th className="p-2">Year</th><th className="p-2">Origin</th>
                <th className="p-2">Saved</th><th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {saves.map((s) => (
                <tr key={s.id} className="border-t border-slate-800 text-slate-200">
                  <td className="p-2">{s.display_name} <span className="text-slate-500">({s.email})</span></td>
                  <td className="p-2">{s.slot_name}</td>
                  <td className="p-2">{s.nation_name || s.nation_id}</td>
                  <td className="p-2">{s.turn_number}</td>
                  <td className="p-2">{s.game_year}</td>
                  <td className="p-2">{s.origin === 'imported' ? `imported from ${s.original_owner_id || '?'}` : 'played'}</td>
                  <td className="p-2 text-slate-500">{new Date(s.saved_at).toLocaleString()}</td>
                  <td className="p-2 flex gap-1">
                    <button onClick={() => handleInspect(s)} title="Inspect" className="p-1.5 rounded bg-slate-700 hover:bg-slate-600"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleExport(s)} title="Download JSON" className="p-1.5 rounded bg-slate-700 hover:bg-slate-600"><Download className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(s)} title="Delete" className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'audit' && (
          <table className="w-full text-sm text-left">
            <thead className="text-slate-500 text-xs uppercase">
              <tr><th className="p-2">When</th><th className="p-2">Action</th><th className="p-2">Target Save</th><th className="p-2">Target User</th></tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-slate-800 text-slate-200">
                  <td className="p-2 text-slate-500">{new Date(a.at).toLocaleString()}</td>
                  <td className="p-2">{a.action}</td>
                  <td className="p-2 text-slate-400">{a.target_save_id || '—'}</td>
                  <td className="p-2 text-slate-400">{a.target_user_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {inspecting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" onClick={() => setInspecting(null)}>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-3">Save Summary</h3>
            <dl className="text-sm space-y-1 text-slate-300">
              {Object.entries(inspecting.summary).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
            <button onClick={() => setInspecting(null)} className="mt-4 w-full px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
