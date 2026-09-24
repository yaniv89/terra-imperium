// src/hooks/useCloudSync.js
// Plan §M0.5: the autosave/sync engine behind the header's cloud status icon. Guests are never
// synced at all (no autosave, no slots, no export) — signing in is what turns this on. Everything
// that decides WHETHER two saves conflict lives in the pure, framework-free resolveSyncState below
// so it's unit-testable without a DOM; the hook itself is intentionally thin glue around it plus
// src/services/cloudSaves.js.
import { useCallback, useEffect, useRef, useState } from 'react';
import { listSaves, writeSlot, readSlot } from '../services/cloudSaves';
import { migrateSave } from '../engine/saveMigrations';

export const AUTOSAVE_SLOT = 'autosave';

const localCacheKey = (userId) => `terra-imperium-save-v1:${userId}`;

// localMeta: { syncedRevision, syncedTurnNumber, turnNumber } — the last cloud revision/turn this
// device's cache was built from, and the turn its local play is at *now* (which may have moved on
// via offline play since that last sync). cloudMeta: { revision, turnNumber } — the server's
// current autosave row, or null if the account has never saved one.
//
// 'ask' only when BOTH sides moved past that last common point — one side alone moving is never a
// real conflict, it just means the other side is stale and should be overwritten.
export const resolveSyncState = (localMeta, cloudMeta) => {
  if (!cloudMeta) return 'useLocal';
  if (!localMeta) return 'useCloud';
  const cloudChanged = cloudMeta.revision !== localMeta.syncedRevision;
  const localChanged = localMeta.turnNumber !== localMeta.syncedTurnNumber;
  if (cloudChanged && localChanged) return 'ask';
  if (cloudChanged) return 'useCloud';
  return 'useLocal';
};

const readLocalCache = (userId) => {
  try {
    const raw = localStorage.getItem(localCacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeLocalCache = (userId, payload, syncedRevision) => {
  try {
    localStorage.setItem(localCacheKey(userId), JSON.stringify({
      ...payload,
      syncedRevision,
      syncedTurnNumber: payload.state.turnNumber
    }));
  } catch {
    // best-effort only — a full/blocked localStorage never blocks cloud sync itself
  }
};

// `getPayload()` returns the CURRENT { version, state } to sync (a ref-style getter, not a value,
// so the hook always sends whatever is newest at upload time rather than a stale closed-over
// state). `onAdoptState(state)` is called when a cloud (or conflict-resolved) save should become
// the live game state — the caller wires this to its own LOAD_GAME dispatch.
export const useCloudSync = ({ client, user, getPayload, onAdoptState }) => {
  const [status, setStatus] = useState(user ? 'idle' : 'guest');
  const [conflict, setConflict] = useState(null); // { local: meta, cloud: meta } | null
  const [lastSyncedTurn, setLastSyncedTurn] = useState(null);
  const revisionRef = useRef(null); // the autosave row's current revision, once known
  const uploadingRef = useRef(false);
  const pendingRef = useRef(null); // the newest payload queued while an upload is in flight

  const flushPending = useCallback(async () => {
    if (uploadingRef.current || !pendingRef.current || !client || !user) return;
    const payload = pendingRef.current;
    pendingRef.current = null;
    uploadingRef.current = true;
    setStatus('syncing');
    try {
      const saved = await writeSlot(client, user.id, AUTOSAVE_SLOT, payload, { expectedRevision: revisionRef.current });
      revisionRef.current = saved.revision;
      writeLocalCache(user.id, payload, saved.revision);
      setLastSyncedTurn(payload.state.turnNumber);
      setStatus('synced');
    } catch (err) {
      if (err.name === 'ConflictError') {
        setConflict({
          local: { turnNumber: payload.state.turnNumber, savedAt: Date.now() },
          cloud: err.serverRow
        });
        setStatus('conflict');
      } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        pendingRef.current = payload; // keep it queued for the next online retry
        setStatus('offline');
      } else {
        setStatus('error');
      }
    } finally {
      uploadingRef.current = false;
      if (pendingRef.current) flushPending();
    }
  }, [client, user]);

  // Called after every End Turn. Only the NEWEST payload is ever kept queued — an upload in
  // flight is never cancelled, but a second/third turn ending before it finishes just replaces
  // what's waiting rather than piling up a backlog of uploads to send one after another.
  const syncNow = useCallback((payload) => {
    if (!client || !user) return;
    pendingRef.current = payload;
    flushPending();
  }, [client, user, flushPending]);

  // Initial reconciliation: on sign-in (or app start already signed in), compare this device's
  // local cache against the account's cloud autosave and decide whether to push, pull, or ask.
  useEffect(() => {
    if (!client || !user) { setStatus('guest'); return; }
    let cancelled = false;
    (async () => {
      setStatus('syncing');
      try {
        const rows = await listSaves(client, user.id);
        const cloudRow = rows.find((r) => r.slot_name === AUTOSAVE_SLOT) || null;
        const localCache = readLocalCache(user.id);
        const decision = resolveSyncState(
          localCache ? { syncedRevision: localCache.syncedRevision, syncedTurnNumber: localCache.syncedTurnNumber, turnNumber: localCache.state.turnNumber } : null,
          cloudRow ? { revision: cloudRow.revision, turnNumber: cloudRow.turn_number } : null
        );
        if (cancelled) return;
        revisionRef.current = cloudRow?.revision ?? null;

        if (decision === 'ask') {
          setConflict({ local: { turnNumber: localCache.state.turnNumber }, cloud: cloudRow });
          setStatus('conflict');
        } else if (decision === 'useCloud' && cloudRow) {
          const migrated = await readSlot(client, user.id, AUTOSAVE_SLOT, migrateSave);
          if (migrated) {
            writeLocalCache(user.id, { version: migrated.version, state: migrated.state }, migrated.revision);
            revisionRef.current = migrated.revision;
            onAdoptState(migrated.state);
            setLastSyncedTurn(migrated.state.turnNumber);
          }
          setStatus('synced');
        } else if (localCache) {
          syncNow({ version: localCache.version, state: localCache.state });
        } else {
          setStatus('synced');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per (client,user) pair, like a mount effect scoped to whoever is signed in; syncNow/onAdoptState are stable enough in practice and re-running this on every render would re-fetch on each keystroke elsewhere in the app
  }, [client, user]);

  // Retry a queued upload once the browser comes back online, rather than waiting for the next
  // End Turn to notice.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOnline = () => flushPending();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushPending]);

  const resolveConflict = useCallback(async (choice) => {
    if (!conflict) return;
    if (choice === 'useCloud') {
      const migrated = await readSlot(client, user.id, AUTOSAVE_SLOT, migrateSave);
      if (migrated) {
        writeLocalCache(user.id, { version: migrated.version, state: migrated.state }, migrated.revision);
        revisionRef.current = migrated.revision;
        onAdoptState(migrated.state);
        setLastSyncedTurn(migrated.state.turnNumber);
      }
      setConflict(null);
      setStatus('synced');
    } else {
      // "Keep this device" — push local, overwriting the cloud row regardless of its revision.
      const payload = getPayload();
      setConflict(null);
      revisionRef.current = null; // null expectedRevision -> writeSlot's insert/overwrite path
      syncNow(payload);
    }
  }, [client, user, conflict, getPayload, onAdoptState, syncNow]);

  return { status, conflict, lastSyncedTurn, syncNow, resolveConflict };
};
