import { describe, it, expect, vi } from 'vitest';
import { listSaves, writeSlot, readSlot, deleteSlot, ConflictError } from './cloudSaves';

// A fake of supabase-js's chainable query builder flexible enough for cloudSaves.js's several
// distinct call shapes (a plain select-and-await, an update/upsert followed by .select().single()
// or .maybeSingle(), and a delete). Only update/upsert/delete pick the response queue explicitly
// (`verb`) — a bare `.select()` with no prior mutating call is what a genuine read query is, so it
// defaults to the 'select' queue. Each verb has its own FIFO queue so a single writeSlot call that
// hits several `.from(...)` chains in sequence (e.g. a failed update, then a metadata read, then an
// insert) gets the right canned result at each step.
const makeFakeClient = ({ select = [], update = [], upsert = [], del = [] } = {}) => {
  const queues = { select: [...select], update: [...update], upsert: [...upsert], delete: [...del] };
  const from = vi.fn(() => {
    let verb = null;
    const chain = {
      select: vi.fn(() => { if (!verb) verb = 'select'; return chain; }),
      update: vi.fn(() => { verb = 'update'; return chain; }),
      upsert: vi.fn(() => { verb = 'upsert'; return chain; }),
      delete: vi.fn(() => { verb = 'delete'; return chain; }),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(queues[verb].shift())),
      maybeSingle: vi.fn(() => Promise.resolve(queues[verb].shift())),
      then: (resolve, reject) => Promise.resolve(queues[verb].shift()).then(resolve, reject)
    };
    return chain;
  });
  return { from };
};

const samplePayload = (overrides = {}) => ({
  version: 1,
  state: {
    playerNationId: 'fr', turnNumber: 10, year: 1500, age: 'kingdoms', gameStatus: 'ACTIVE',
    nations: { fr: { name: 'France' } },
    ...overrides
  }
});

describe('listSaves', () => {
  it('returns metadata rows ordered by most recently saved, without ever selecting state', async () => {
    const rows = [{ id: 's2', slot_name: 'slot1' }, { id: 's1', slot_name: 'autosave' }];
    const client = makeFakeClient({ select: [{ data: rows, error: null }] });
    const result = await listSaves(client, 'u1');
    expect(client.from).toHaveBeenCalledWith('saves');
    expect(result).toEqual(rows);
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const client = makeFakeClient({ select: [{ data: null, error: new Error('permission denied') }] });
    await expect(listSaves(client, 'u1')).rejects.toThrow('permission denied');
  });
});

describe('writeSlot', () => {
  it('inserts via upsert when no expectedRevision is given (first save to a slot)', async () => {
    const inserted = { id: 's1', slot_name: 'autosave', revision: 1 };
    const client = makeFakeClient({ upsert: [{ data: inserted, error: null }] });
    const result = await writeSlot(client, 'u1', 'autosave', samplePayload());
    expect(result).toEqual(inserted);
  });

  it('updates in place when expectedRevision matches the server row', async () => {
    const updated = { id: 's1', slot_name: 'autosave', revision: 4 };
    const client = makeFakeClient({ update: [{ data: updated, error: null }] });
    const result = await writeSlot(client, 'u1', 'autosave', samplePayload(), { expectedRevision: 3 });
    expect(result).toEqual(updated);
  });

  it('throws ConflictError with the server\'s current metadata when the revision no longer matches', async () => {
    const serverRow = { id: 's1', slot_name: 'autosave', revision: 5, turn_number: 20 };
    const client = makeFakeClient({
      update: [{ data: null, error: null }],       // 0 rows matched: someone else already moved the revision
      select: [{ data: serverRow, error: null }]    // the follow-up metadata read
    });
    let caught = null;
    try {
      await writeSlot(client, 'u1', 'autosave', samplePayload(), { expectedRevision: 3 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    expect(caught.serverRow).toEqual(serverRow);
  });

  it('falls through to inserting when the update matched nothing because the slot does not exist yet', async () => {
    const inserted = { id: 's1', slot_name: 'slot1', revision: 1 };
    const client = makeFakeClient({
      update: [{ data: null, error: null }],
      select: [{ data: null, error: null }],   // readSlotMeta finds no existing row either
      upsert: [{ data: inserted, error: null }]
    });
    const result = await writeSlot(client, 'u1', 'slot1', samplePayload(), { expectedRevision: 1 });
    expect(result).toEqual(inserted);
  });

  it('propagates an import\'s origin/originalOwnerId into the written row', async () => {
    const inserted = { id: 's1' };
    const client = makeFakeClient({ upsert: [{ data: inserted, error: null }] });
    await writeSlot(client, 'u1', 'slot2', samplePayload(), { origin: 'imported', originalOwnerId: 'other-user' });
    // Inspect what was actually upserted via the chain the fake `from` produced.
    const chain = client.from.mock.results[0].value;
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'imported', original_owner_id: 'other-user', user_id: 'u1', slot_name: 'slot2' }),
      { onConflict: 'user_id,slot_name' }
    );
  });
});

describe('readSlot', () => {
  it('decodes the row and runs it through the provided migrate function, attaching revision/savedAt', async () => {
    const payload = samplePayload();
    const row = { id: 's1', version: 1, state: payload, state_gz: null, revision: 7, saved_at: '2024-01-01' };
    const client = makeFakeClient({ select: [{ data: row, error: null }] });
    const migrate = vi.fn((p) => ({ version: p.version, state: p.state }));
    const result = await readSlot(client, 'u1', 'autosave', migrate);
    expect(migrate).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ version: 1, state: payload.state, revision: 7, savedAt: '2024-01-01' });
  });

  it('returns null when the slot has no save yet, without calling migrate', async () => {
    const client = makeFakeClient({ select: [{ data: null, error: null }] });
    const migrate = vi.fn();
    await expect(readSlot(client, 'u1', 'slot1', migrate)).resolves.toBeNull();
    expect(migrate).not.toHaveBeenCalled();
  });

  it('returns null when migrate rejects the payload (e.g. a save newer than this build)', async () => {
    const row = { id: 's1', version: 1, state: samplePayload(), state_gz: null, revision: 1, saved_at: 'x' };
    const client = makeFakeClient({ select: [{ data: row, error: null }] });
    const result = await readSlot(client, 'u1', 'autosave', () => null);
    expect(result).toBeNull();
  });
});

describe('deleteSlot', () => {
  it('deletes by user and slot name', async () => {
    const client = makeFakeClient({ del: [{ error: null }] });
    await deleteSlot(client, 'u1', 'slot1');
    const chain = client.from.mock.results[0].value;
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(chain.eq).toHaveBeenCalledWith('slot_name', 'slot1');
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const client = makeFakeClient({ del: [{ error: new Error('not found') }] });
    await expect(deleteSlot(client, 'u1', 'missing')).rejects.toThrow('not found');
  });
});
