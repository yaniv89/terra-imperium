import { describe, it, expect, vi } from 'vitest';
import { listPlayers, listAllSaves, inspectSave, exportSaveJson, deleteSave, listAuditLog } from './admin';

// One response queue per table name — every function under test hits each table it touches
// exactly once per call, so popping FIFO per table (regardless of which chain methods ran first)
// is enough to fake the whole round trip, including the admin_actions audit-log write every
// inspect/export/delete makes alongside its main query.
const makeFakeClient = (responses) => {
  const queues = {};
  Object.entries(responses).forEach(([table, arr]) => { queues[table] = [...arr]; });
  const from = vi.fn((table) => {
    const chain = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      or: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(queues[table].shift())),
      then: (resolve, reject) => Promise.resolve(queues[table].shift()).then(resolve, reject)
    };
    return chain;
  });
  return { from };
};

const sampleSaveRow = (overrides = {}) => ({
  id: 'save1', user_id: 'user1', state_gz: null,
  state: {
    version: 1,
    state: {
      playerNationId: 'fr', turnNumber: 30, year: 1600, age: 'gunpowder', gameStatus: 'ACTIVE',
      nations: { fr: { name: 'France' } },
      regions: { 'fr-75': { owner: 'fr' }, 'de-be': { owner: 'de' } },
      resources: { gold: 5000 },
      wars: [{ attacker: 'fr', defender: 'de', active: true }],
      techTree: { researched: ['tech_a', 'tech_b'] }
    }
  },
  ...overrides
});

describe('listPlayers', () => {
  it('lists profiles ordered by join date', async () => {
    const rows = [{ id: 'u1' }, { id: 'u2' }];
    const client = makeFakeClient({ profiles: [{ data: rows, error: null }] });
    await expect(listPlayers(client)).resolves.toEqual(rows);
  });

  it('propagates the underlying error', async () => {
    const client = makeFakeClient({ profiles: [{ data: null, error: new Error('nope') }] });
    await expect(listPlayers(client)).rejects.toThrow('nope');
  });
});

describe('listAllSaves', () => {
  it('reads from the admin_saves view', async () => {
    const rows = [{ id: 's1', email: 'a@b.com' }];
    const client = makeFakeClient({ admin_saves: [{ data: rows, error: null }] });
    await expect(listAllSaves(client)).resolves.toEqual(rows);
  });
});

describe('inspectSave', () => {
  it('decodes the save and returns a summary, and logs an inspect_save action', async () => {
    const row = sampleSaveRow();
    const client = makeFakeClient({
      saves: [{ data: row, error: null }],
      admin_actions: [{ error: null }]
    });
    const summary = await inspectSave(client, 'admin1', 'save1');
    expect(summary).toEqual({
      nationId: 'fr', nationName: 'France', turnNumber: 30, year: 1600, age: 'gunpowder', gameStatus: 'ACTIVE',
      regionsOwned: 1, treasury: 5000, activeWars: 1, techsResearched: 2
    });
  });

  it('propagates a failed audit-log write rather than silently skipping it', async () => {
    const client = makeFakeClient({
      saves: [{ data: sampleSaveRow(), error: null }],
      admin_actions: [{ error: new Error('rls denied') }]
    });
    await expect(inspectSave(client, 'admin1', 'save1')).rejects.toThrow('rls denied');
  });
});

describe('exportSaveJson', () => {
  it('returns the decoded payload as pretty JSON and logs an export_save action', async () => {
    const row = sampleSaveRow();
    const client = makeFakeClient({
      saves: [{ data: row, error: null }],
      admin_actions: [{ error: null }]
    });
    const json = await exportSaveJson(client, 'admin1', 'save1');
    expect(JSON.parse(json)).toEqual(row.state);
  });
});

describe('deleteSave', () => {
  it('deletes the row and logs a delete_save action', async () => {
    const client = makeFakeClient({
      saves: [{ error: null }],
      admin_actions: [{ error: null }]
    });
    await expect(deleteSave(client, 'admin1', 'save1', 'user1')).resolves.toBeUndefined();
  });
});

describe('listAuditLog', () => {
  it('lists the most recent admin actions', async () => {
    const rows = [{ id: 1, action: 'inspect_save' }];
    const client = makeFakeClient({ admin_actions: [{ data: rows, error: null }] });
    await expect(listAuditLog(client)).resolves.toEqual(rows);
  });
});
