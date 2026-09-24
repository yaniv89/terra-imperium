// src/components/modals/AccountModal.jsx
// Plan §M0.5: replaces SettingsModal.jsx. Guests can play with exactly today's local save/export —
// nothing here gates that. Signing in additionally unlocks CLOUD saves (an autosave slot kept in
// sync by src/hooks/useCloudSync.js, plus 3 manual slots here), because a cloud save has to belong
// to a verified account — that's the whole point of requiring sign-in for it.
import React, { useEffect, useState } from 'react';
import { X, Cloud, CloudOff, LogIn, LogOut, UploadCloud, DownloadCloud, Trash2, ShieldCheck } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { getSupabaseClient, isCloudSaveConfigured } from '../../services/supabaseClient';
import {
  signIn, signUp, signOut, getCurrentUser, onAuthStateChange, onPasswordRecovery,
  sendPasswordReset, updatePassword, resendConfirmation, deleteMyAccount,
  getProfile, updateDisplayName, friendlyAuthError
} from '../../services/auth';
import { listSaves, writeSlot, readSlot, deleteSlot, SAVE_SLOTS } from '../../services/cloudSaves';
import { migrateSave } from '../../engine/saveMigrations';

const SLOT_LABELS = { autosave: 'Autosave', slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3' };

const formatWhen = (iso) => {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
};

const AccountModal = ({ open, onClose, onOpenAdmin }) => {
  const { state, dispatch } = useGame();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authView, setAuthView] = useState('signIn'); // 'signIn' | 'signUp' | 'recovery'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [slots, setSlots] = useState(null);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');

  const client = isCloudSaveConfigured ? getSupabaseClient() : null;

  useEffect(() => {
    if (!client) return undefined;
    getCurrentUser(client).then(setUser).catch(() => {});
    const unsubscribeAuth = onAuthStateChange(client, setUser);
    const unsubscribeRecovery = onPasswordRecovery(client, () => setAuthView('recovery'));
    return () => { unsubscribeAuth(); unsubscribeRecovery(); };
  }, [client]);

  useEffect(() => {
    if (!client || !user) { setProfile(null); return; }
    getProfile(client, user.id).then((p) => { setProfile(p); setNewDisplayName(p.display_name); }).catch(() => {});
  }, [client, user]);

  const refreshSlots = () => {
    if (!client || !user) return;
    listSaves(client, user.id).then((rows) => {
      const bySlot = {};
      rows.forEach((r) => { bySlot[r.slot_name] = r; });
      setSlots(bySlot);
    }).catch(() => {});
  };

  useEffect(refreshSlots, [client, user]);

  if (!open) return null;

  const runAction = async (action) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    runAction(async () => {
      if (authView === 'signUp') {
        await signUp(client, email, password, displayName);
        setMessage('Account created — check your inbox to confirm your email, then sign in.');
      } else {
        await signIn(client, email, password);
      }
    });
  };

  const handleForgotPassword = () => runAction(async () => {
    await sendPasswordReset(client, email, window.location.href);
    setMessage('Password reset email sent — check your inbox.');
  });

  const handleResendConfirmation = () => runAction(async () => {
    await resendConfirmation(client, email);
    setMessage('Confirmation email resent.');
  });

  const handleSetNewPassword = (e) => {
    e.preventDefault();
    runAction(async () => {
      await updatePassword(client, password);
      setAuthView('signIn');
      setMessage('Password updated — you\'re signed in.');
    });
  };

  const handleSignOut = () => runAction(() => signOut(client));

  const handleUpdateDisplayName = () => runAction(async () => {
    const updated = await updateDisplayName(client, newDisplayName);
    setProfile(updated);
    setMessage('Display name updated.');
  });

  const handleDeleteAccount = () => runAction(async () => {
    await deleteMyAccount(client);
    setConfirmDelete('');
  });

  const handleSaveToSlot = (slot) => runAction(async () => {
    const payload = { version: 1, state };
    const existing = slots?.[slot];
    await writeSlot(client, user.id, slot, payload, { expectedRevision: existing?.revision });
    setMessage(`Saved to ${SLOT_LABELS[slot]}.`);
    refreshSlots();
  });

  const handleLoadFromSlot = (slot) => runAction(async () => {
    const migrated = await readSlot(client, user.id, slot, migrateSave);
    if (!migrated) { setError('That save could not be loaded — it may be from a newer or incompatible version.'); return; }
    dispatch({ type: ActionTypes.LOAD_GAME, payload: migrated.state });
    setMessage(`Loaded ${SLOT_LABELS[slot]}.`);
  });

  const handleDeleteSlot = (slot) => runAction(async () => {
    await deleteSlot(client, user.id, slot);
    setMessage(`${SLOT_LABELS[slot]} deleted.`);
    refreshSlots();
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 rounded-xl border-2 border-slate-700 max-w-md w-full shadow-2xl p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            {isCloudSaveConfigured ? <Cloud className="w-5 h-5 text-blue-400" /> : <CloudOff className="w-5 h-5 text-slate-500" />}
            Account & Cloud Saves
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
        ) : authView === 'recovery' ? (
          <form onSubmit={handleSetNewPassword} className="space-y-3">
            <p className="text-slate-400 text-sm">Choose a new password.</p>
            <input
              type="password" required minLength={8} placeholder="New password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500"
            />
            <button type="submit" disabled={busy} className="w-full px-4 py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg disabled:opacity-50">
              Set New Password
            </button>
          </form>
        ) : user ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-slate-400 text-xs uppercase tracking-wide font-semibold">Profile</p>
              <div className="flex items-center gap-2">
                <input
                  value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
                <button onClick={handleUpdateDisplayName} disabled={busy || newDisplayName === profile?.display_name} className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-40">
                  Save
                </button>
              </div>
              <p className="text-slate-500 text-xs">{user.email}</p>
              {profile?.role === 'admin' && (
                <button onClick={onOpenAdmin} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" /> Open Admin Page
                </button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-slate-400 text-xs uppercase tracking-wide font-semibold">Saves</p>
              {SAVE_SLOTS.map((slot) => {
                const row = slots?.[slot];
                return (
                  <div key={slot} className="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-700 rounded-lg p-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200">{SLOT_LABELS[slot]}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {row ? `${row.nation_name || row.nation_id} · Turn ${row.turn_number} · ${formatWhen(row.saved_at)}` : 'Empty'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleSaveToSlot(slot)} disabled={busy} title="Save here" className="p-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white disabled:opacity-40">
                        <UploadCloud className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleLoadFromSlot(slot)} disabled={busy || !row} title="Load" className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40">
                        <DownloadCloud className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteSlot(slot)} disabled={busy || !row} title="Delete" className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-40">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={handleSignOut} disabled={busy} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              {confirmDelete !== 'DELETE' ? (
                <button onClick={() => setConfirmDelete('confirming')} className="w-full text-xs text-red-500/80 hover:text-red-400 underline">
                  Delete account
                </button>
              ) : null}
              {confirmDelete === 'confirming' && (
                <div className="space-y-2">
                  <p className="text-xs text-red-400">This permanently deletes your account and every save. Type DELETE to confirm.</p>
                  <input
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    className="w-full bg-slate-800 border border-red-500/50 rounded-lg p-2 text-sm text-white"
                  />
                </div>
              )}
              {confirmDelete === 'DELETE' && (
                <button onClick={handleDeleteAccount} disabled={busy} className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50">
                  Permanently Delete Account
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {authView === 'signUp' && (
              <input
                type="text" required minLength={3} maxLength={24} placeholder="Display name"
                value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500"
              />
            )}
            <input
              type="email" required placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500"
            />
            <input
              type="password" required minLength={8} placeholder="Password (min. 8 characters)"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500"
            />
            <button
              type="submit" disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {authView === 'signUp' ? 'Create Account' : 'Sign In'}
            </button>
            <button type="button" onClick={() => setAuthView(authView === 'signUp' ? 'signIn' : 'signUp')} className="w-full text-xs text-slate-400 hover:text-slate-200 underline">
              {authView === 'signUp' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
            {authView === 'signIn' && (
              <div className="flex justify-between text-[11px]">
                <button type="button" onClick={handleForgotPassword} disabled={busy || !email} className="text-slate-500 hover:text-slate-300 underline disabled:opacity-40">
                  Forgot password?
                </button>
                <button type="button" onClick={handleResendConfirmation} disabled={busy || !email} className="text-slate-500 hover:text-slate-300 underline disabled:opacity-40">
                  Resend confirmation
                </button>
              </div>
            )}
          </form>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        {message && <p className="mt-3 text-xs text-green-400">{message}</p>}
      </div>
    </div>
  );
};

export default AccountModal;
