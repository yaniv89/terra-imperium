// src/worldgen/worldCache.js
// Generated worlds kept in IndexedDB (plans/MAP-VARIATIONS-PLAN.md 3.3), never in git or the save:
// key = specKey (generator version, seed, params); value = { tiles (the encoded binary), land
// (the hex coast features), report, worldHash, usedAt }. The last KEEP worlds stay (the oldest by
// use is dropped). Every call is best effort: with storage denied (a private window) everything
// still works by regenerating, and a failure here never stops a game.
const DB = 'terra-imperium-worlds';
const STORE = 'worlds';
export const KEEP = 3;

const open = () => new Promise((resolve) => {
  try {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  } catch { resolve(null); }
});

const run = async (mode, fn) => {
  const db = await open();
  if (!db) return null;
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result = null;
      Promise.resolve(fn(store, (v) => { result = v; })).catch(() => {});
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  } catch { return null; } finally { try { db.close(); } catch { /* closed */ } }
};

/** The cached world under `key`, or null. */
export const cacheGet = (key) => run('readonly', (store, done) => {
  const req = store.get(key);
  req.onsuccess = () => done(req.result || null);
});

/** Stores a world and drops the oldest beyond KEEP (never `key` itself). */
export const cachePut = (key, value) => run('readwrite', (store) => {
  store.put({ ...value, usedAt: Date.now() }, key); // determinism-ok: cache bookkeeping (which world to drop first), never game state
  const keys = store.getAllKeys();
  keys.onsuccess = () => {
    const all = store.getAll();
    all.onsuccess = () => {
      const rows = keys.result.map((k, i) => ({ k, usedAt: all.result[i]?.usedAt || 0 })).filter((r) => r.k !== key);
      rows.sort((a, b) => b.usedAt - a.usedAt);
      rows.slice(KEEP - 1).forEach((r) => store.delete(r.k));
    };
  };
});

/** Forgets every cached world (Settings: Clear cached worlds). */
export const cacheClear = () => run('readwrite', (store) => { store.clear(); });
