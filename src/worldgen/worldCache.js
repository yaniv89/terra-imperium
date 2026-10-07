// src/worldgen/worldCache.js
// Generated worlds kept in IndexedDB (plans/MAP-VARIATIONS-PLAN.md 3.3), never in git or the save:
// key = specKey (generator version, seed, params); value = { tiles (the encoded binary), land
// (the hex coast features), report, worldHash, usedAt }. The last KEEP worlds stay (the oldest by
// use is dropped). Every call is best effort: with storage denied (a private window) everything
// still works by regenerating, and a failure here never stops a game.
const DB = 'terra-imperium-worlds';
const STORE = 'worlds';
export const KEEP = 3;

// Safari has been seen to leave indexedDB.open (and a transaction) hanging with no event at all:
// past these the cache counts as missing (the world is regenerated), so a load never stalls on it.
export const OPEN_TIMEOUT_MS = 4000;
export const TX_TIMEOUT_MS = 8000;

const open = () => new Promise((resolve) => {
  let settled = false;
  const finish = (db) => { if (settled) { try { db?.close(); } catch { /* closed */ } return; } settled = true; clearTimeout(timer); resolve(db); };
  const timer = setTimeout(() => finish(null), OPEN_TIMEOUT_MS);
  try {
    if (typeof indexedDB === 'undefined') { finish(null); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => finish(req.result);
    req.onerror = () => finish(null);
    req.onblocked = () => finish(null);
  } catch { finish(null); }
});

const run = async (mode, fn) => {
  const db = await open();
  if (!db) return null;
  try {
    return await new Promise((resolve) => {
      setTimeout(() => resolve(null), TX_TIMEOUT_MS);
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

const sizeOf = (v) => (v == null ? 0 : typeof v.byteLength === 'number' ? v.byteLength : typeof v.size === 'number' ? v.size : typeof v === 'string' ? v.length : 0);
/** { count, bytes } of the cached worlds (Settings: the space they use), { count: 0, bytes: 0 } when none or unavailable. */
export const cacheInfo = async () => (await run('readonly', (store, done) => {
  const req = store.getAll();
  req.onsuccess = () => {
    const rows = req.result || [];
    done({ count: rows.length, bytes: rows.reduce((a, r) => a + sizeOf(r?.tiles) + sizeOf(r?.picture) + (r?.land ? JSON.stringify(r.land).length : 0), 0) });
  };
})) || { count: 0, bytes: 0 };
