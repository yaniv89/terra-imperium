import { describe, it, expect, vi } from 'vitest';
import { saveToCloud, loadFromCloud, listCloudSaves, deleteCloudSave } from './cloudSaves';

// A minimal fake of supabase-js's chainable query builder. Every intermediate method (upsert,
// select, eq, order, delete) returns the SAME chain object, which is itself awaitable (via
// `.then`) so a caller can either keep chaining or `await` at any point — exactly like the real
// PostgrestFilterBuilder. `.single()`/`.maybeSingle()` are always terminal, matching how
// cloudSaves.js actually calls them, so those return a real Promise instead of the chain.
const makeFakeClient = (finalResult) => {
  const chain = {
    upsert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(finalResult)),
    maybeSingle: vi.fn(() => Promise.resolve(finalResult)),
    then: (resolve, reject) => Promise.resolve(finalResult).then(resolve, reject)
  };
  return { from: vi.fn(() => chain), chain };
};

describe('saveToCloud', () => {
  it('upserts on (user_id, slot_name) with the exact local-save payload shape', async () => {
    const saved = { id: 's1', user_id: 'u1', slot_name: 'default', version: 1, state: { year: -2000 } };
    const { from, chain } = makeFakeClient({ data: saved, error: null });
    const result = await saveToCloud({ from }, 'u1', 'default', { version: 1, state: { year: -2000 } });
    expect(from).toHaveBeenCalledWith('saves');
    expect(chain.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', slot_name: 'default', version: 1, state: { year: -2000 } },
      { onConflict: 'user_id,slot_name' }
    );
    expect(result).toEqual(saved);
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const { from } = makeFakeClient({ data: null, error: new Error('permission denied') });
    await expect(saveToCloud({ from }, 'u1', 'default', { version: 1, state: {} })).rejects.toThrow('permission denied');
  });
});

describe('loadFromCloud', () => {
  it('scopes the query to the given user and slot', async () => {
    const row = { id: 's1', version: 1, state: { year: -1000 }, saved_at: '2024-01-01' };
    const { from, chain } = makeFakeClient({ data: row, error: null });
    const result = await loadFromCloud({ from }, 'u1', 'default');
    expect(from).toHaveBeenCalledWith('saves');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(chain.eq).toHaveBeenCalledWith('slot_name', 'default');
    expect(result).toEqual(row);
  });

  it('returns null rather than throwing when no save exists in that slot yet', async () => {
    const { from } = makeFakeClient({ data: null, error: null });
    await expect(loadFromCloud({ from }, 'u1', 'default')).resolves.toBeNull();
  });
});

describe('listCloudSaves', () => {
  it('orders by most recently saved', async () => {
    const rows = [{ id: 's2', slot_name: 'b' }, { id: 's1', slot_name: 'a' }];
    const { from, chain } = makeFakeClient({ data: rows, error: null });
    const result = await listCloudSaves({ from }, 'u1');
    expect(chain.order).toHaveBeenCalledWith('saved_at', { ascending: false });
    expect(result).toEqual(rows);
  });
});

describe('deleteCloudSave', () => {
  it('deletes by save id', async () => {
    const { from, chain } = makeFakeClient({ error: null });
    await deleteCloudSave({ from }, 's1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 's1');
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const { from } = makeFakeClient({ error: new Error('not found') });
    await expect(deleteCloudSave({ from }, 'missing')).rejects.toThrow('not found');
  });
});
