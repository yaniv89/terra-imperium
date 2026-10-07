// src/battle/worker/battleStore.js
// Mid-battle checkpoints (Tactical Battles plan §12.3): every 10 s the battle's order log is saved
// under its battle id, so closing the app — or the OS killing it — never loses a battle: it
// replays the log (6 minutes of battle re-simulates in well under a second) and carries on.
// IndexedDB when available, localStorage otherwise; every call is best-effort and never throws.
const DB = 'terra-imperium-battles';
const STORE = 'checkpoints';
const LS_PREFIX = 'terra-imperium-battle:';

const openDb = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const withStore = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

export const saveBattleCheckpoint = async (battleId, checkpoint) => {
  // setupKey: which battle it belongs to (buildBattleSetup.js setupKeyOf); ids repeat between games.
  const record = { tick: checkpoint.tick, hash: checkpoint.hash, log: checkpoint.log, setupVersion: checkpoint.setupVersion, setupKey: checkpoint.setupKey ?? null, savedAt: checkpoint.savedAt };
  try { await withStore('readwrite', (s) => s.put(record, battleId)); } catch {
    try { localStorage.setItem(LS_PREFIX + battleId, JSON.stringify(record)); } catch { /* storage full or blocked */ }
  }
};

export const loadBattleCheckpoint = async (battleId) => {
  try { const r = await withStore('readonly', (s) => s.get(battleId)); if (r) return r; } catch { /* fall through */ }
  try { const raw = localStorage.getItem(LS_PREFIX + battleId); return raw ? JSON.parse(raw) : null; } catch { return null; }
};

export const clearBattleCheckpoint = async (battleId) => {
  try { await withStore('readwrite', (s) => s.delete(battleId)); } catch { /* ignore */ }
  try { localStorage.removeItem(LS_PREFIX + battleId); } catch { /* ignore */ }
};
