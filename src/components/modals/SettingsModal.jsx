// src/components/modals/SettingsModal.jsx
// Phase F: cloud saves + account UI. Entirely hidden behind isCloudSaveConfigured — a build with
// no VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY set shows a short explanatory line and nothing
// else, so local-only play (GameHeader's existing Export/Import buttons) is completely unaffected
// whether or not this modal even opens. The default cloud save slot is fixed at 'default',
// matching the app's existing single-slot autosave model (GameContext.jsx's STORAGE_KEY) — this
// is one cloud slot per account, not a full save-browser (src/services/cloudSaves.js already
// supports multiple named slots for later, once there's a UI reason to expose them).
import React, { useEffect, useState } from 'react';
import { X, Cloud, CloudOff, LogIn, LogOut, UploadCloud, DownloadCloud } from 'lucide-react';
import { getSupabaseClient, isCloudSaveConfigured } from '../../services/supabaseClient';
import { signIn, signUp, signOut, getCurrentUser, onAuthStateChange } from '../../services/auth';
import { saveToCloud, loadFromCloud } from '../../services/cloudSaves';

const SAVE_SLOT = 'default';

const SettingsModal = ({ open, onClose, exportSave, importSave }) => {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const client = isCloudSaveConfigured ? getSupabaseClient() : null;

  useEffect(() => {
    if (!client) return undefined;
    getCurrentUser(client).then(setUser).catch(() => {});
    return onAuthStateChange(client, setUser);
  }, [client]);

  if (!open) return null;

  const runAction = async (action) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    runAction(async () => {
      if (mode === 'signUp') {
        await signUp(client, email, password);
        setMessage('Account created — check your email to confirm, then sign in.');
      } else {
        await signIn(client, email, password);
      }
    });
  };

  const handleSignOut = () => runAction(() => signOut(client));

  const handleSaveToCloud = () => runAction(async () => {
    const { version, state } = JSON.parse(exportSave());
    await saveToCloud(client, user.id, SAVE_SLOT, { version, state });
    setMessage('Saved to the cloud.');
  });

  const handleLoadFromCloud = () => runAction(async () => {
    const row = await loadFromCloud(client, user.id, SAVE_SLOT);
    if (!row) { setError('No cloud save found yet — save to the cloud first.'); return; }
    const ok = importSave(JSON.stringify({ version: row.version, state: row.state }));
    if (!ok) { setError('That cloud save could not be loaded.'); return; }
    setMessage('Loaded from the cloud.');
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border-2 border-slate-700 max-w-sm w-full shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            {isCloudSaveConfigured ? <Cloud className="w-5 h-5 text-blue-400" /> : <CloudOff className="w-5 h-5 text-slate-500" />}
            Cloud Saves
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isCloudSaveConfigured ? (
          <p className="text-slate-400 text-sm">
            Cloud saves aren&apos;t set up for this build. Local export/import (the header&apos;s download/upload
            buttons) still work as always.
          </p>
        ) : user ? (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              Signed in as <span className="text-slate-200 font-semibold">{user.email}</span>
            </p>
            <button
              onClick={handleSaveToCloud}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                         bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                         text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud className="w-4 h-4" />
              Save to Cloud
            </button>
            <button
              onClick={handleLoadFromCloud}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                         bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all active:scale-95
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadCloud className="w-4 h-4" />
              Load from Cloud
            </button>
            <button
              onClick={handleSignOut}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs
                         bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                         bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                         text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4" />
              {mode === 'signUp' ? 'Create Account' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
              className="w-full text-xs text-slate-400 hover:text-slate-200 underline"
            >
              {mode === 'signUp' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        {message && <p className="mt-3 text-xs text-green-400">{message}</p>}
      </div>
    </div>
  );
};

export default SettingsModal;
