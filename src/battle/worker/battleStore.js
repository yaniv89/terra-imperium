// src/battle/worker/battleStore.js
// Mid-battle checkpoints (Tactical Battles plan §12.3): every 10 s the battle's order log is saved
// under its battle id, so closing the app — or the OS killing it — never loses a battle: it
// replays the log (6 minutes of battle re-simulates in well under a second) and carries on.
// A battle that has ended keeps its end record (`ended`: result, log, hash) until the player
// continues, so its result is handed to the campaign as it was even if the app closes first.
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

// Writes and deletes run one after another in the order they were asked for: each save opens its
// own transaction, and two in flight (the 10 s checkpoint and the one saved as the page hides) could
// land out of order, leaving an older checkpoint as the one a reload resumes (playtest 4 H2).
let queue = Promise.resolve();
const inOrder = (fn) => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };

export const saveBattleCheckpoint = (battleId, checkpoint) => inOrder(() => writeCheckpoint(battleId, checkpoint));
const writeCheckpoint = async (battleId, checkpoint) => {
  // setupKey: which battle it belongs to (buildBattleSetup.js setupKeyOf); ids repeat between games.
  const record = { tick: checkpoint.tick, hash: checkpoint.hash, log: checkpoint.log, setupVersion: checkpoint.setupVersion, setupKey: checkpoint.setupKey ?? null, savedAt: checkpoint.savedAt, ...(checkpoint.ended ? { ended: checkpoint.ended } : {}) };
  try {
    await withStore('readwrite', (s) => s.put(record, battleId));
    try { localStorage.removeItem(LS_PREFIX + battleId); } catch { /* an older fallback copy must not outlive this one */ }
  } catch {
    try { localStorage.setItem(LS_PREFIX + battleId, JSON.stringify(record)); } catch { /* storage full or blocked */ }
  }
};

export const loadBattleCheckpoint = (battleId) => inOrder(() => readCheckpoint(battleId));
// Both places are read: a save that fell back to localStorage is newer than the IndexedDB copy it
// could not replace. The newer one is resumed (an end record over any checkpoint).
const readCheckpoint = async (battleId) => {
  let db = null; let ls = null;
  try { db = (await withStore('readonly', (s) => s.get(battleId))) || null; } catch { /* none there */ }
  try { const raw = localStorage.getItem(LS_PREFIX + battleId); ls = raw ? JSON.parse(raw) : null; } catch { ls = null; }
  return newerCheckpoint(db, ls);
};
export const newerCheckpoint = (a, b) => {
  if (!a || !b) return a || b || null;
  if (!!a.ended !== !!b.ended) return a.ended ? a : b;
  return (b.savedAt ?? 0) > (a.savedAt ?? 0) ? b : a;
};

export const clearBattleCheckpoint = (battleId) => inOrder(() => removeCheckpoint(battleId));
const removeCheckpoint = async (battleId) => {
  try { await withStore('readwrite', (s) => s.delete(battleId)); } catch { /* ignore */ }
  try { localStorage.removeItem(LS_PREFIX + battleId); } catch { /* ignore */ }
};
