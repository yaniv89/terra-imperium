import { describe, it, expect, vi } from 'vitest';
import {
  createGame, joinGame, leaveGame, setReady, listOpenGames, getGamePlayers,
  allPlayersReady, startGame, submitTurn, allPlayersSubmitted, resetTurnSubmissions, updateGameState
} from './multiplayer';

// Same fake chainable/thenable Supabase client pattern as cloudSaves.test.js — every intermediate
// method returns the same chain object, which itself resolves via `.then`, matching the real
// PostgrestFilterBuilder closely enough for these services' actual call shapes.
const makeFakeClient = (finalResult) => {
  const chain = {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(finalResult)),
    then: (resolve, reject) => Promise.resolve(finalResult).then(resolve, reject)
  };
  return { from: vi.fn(() => chain), chain };
};

describe('createGame', () => {
  it('inserts a lobby row hosted by the given user', async () => {
    const game = { id: 'g1', created_by: 'u1', status: 'lobby', game_speed: 'fast', difficulty_id: 'king', max_players: 6 };
    const { from, chain } = makeFakeClient({ data: game, error: null });
    const result = await createGame({ from }, 'u1', { gameSpeed: 'fast', difficultyId: 'king', maxPlayers: 6 });
    expect(from).toHaveBeenCalledWith('games');
    expect(chain.insert).toHaveBeenCalledWith({ created_by: 'u1', game_speed: 'fast', difficulty_id: 'king', max_players: 6 });
    expect(result).toEqual(game);
  });

  it('defaults game_speed/difficulty/max_players when not given', async () => {
    const { from, chain } = makeFakeClient({ data: {}, error: null });
    await createGame({ from }, 'u1');
    expect(chain.insert).toHaveBeenCalledWith({ created_by: 'u1', game_speed: 'normal', difficulty_id: 'prince', max_players: 4 });
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const { from } = makeFakeClient({ data: null, error: new Error('permission denied') });
    await expect(createGame({ from }, 'u1')).rejects.toThrow('permission denied');
  });
});

describe('joinGame', () => {
  it('seats a user as a chosen nation', async () => {
    const seat = { id: 'p1', game_id: 'g1', user_id: 'u2', nation_id: 'fr' };
    const { from, chain } = makeFakeClient({ data: seat, error: null });
    const result = await joinGame({ from }, 'g1', 'u2', 'fr');
    expect(from).toHaveBeenCalledWith('game_players');
    expect(chain.insert).toHaveBeenCalledWith({ game_id: 'g1', user_id: 'u2', nation_id: 'fr' });
    expect(result).toEqual(seat);
  });

  it('throws when the game is already full (the max-players trigger rejecting the insert)', async () => {
    const { from } = makeFakeClient({ data: null, error: new Error('game g1 already has its max 4 players') });
    await expect(joinGame({ from }, 'g1', 'u2', 'fr')).rejects.toThrow('already has its max');
  });
});

describe('leaveGame', () => {
  it('deletes the caller\'s own seat', async () => {
    const { from, chain } = makeFakeClient({ error: null });
    await leaveGame({ from }, 'g1', 'u2');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('game_id', 'g1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u2');
  });
});

describe('setReady', () => {
  it('updates only the caller\'s own seat', async () => {
    const { from, chain } = makeFakeClient({ error: null });
    await setReady({ from }, 'g1', 'u2', true);
    expect(chain.update).toHaveBeenCalledWith({ is_ready: true });
    expect(chain.eq).toHaveBeenCalledWith('game_id', 'g1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u2');
  });
});

describe('listOpenGames', () => {
  it('filters to lobby-status games, most recent first', async () => {
    const rows = [{ id: 'g2' }, { id: 'g1' }];
    const { from, chain } = makeFakeClient({ data: rows, error: null });
    const result = await listOpenGames({ from });
    expect(chain.eq).toHaveBeenCalledWith('status', 'lobby');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual(rows);
  });
});

describe('getGamePlayers', () => {
  it('returns every seat for a game, joined-order', async () => {
    const rows = [{ user_id: 'u1' }, { user_id: 'u2' }];
    const { from, chain } = makeFakeClient({ data: rows, error: null });
    const result = await getGamePlayers({ from }, 'g1');
    expect(chain.eq).toHaveBeenCalledWith('game_id', 'g1');
    expect(result).toEqual(rows);
  });
});

describe('allPlayersReady', () => {
  it('is true only once every seated player is ready', async () => {
    const allReady = makeFakeClient({ data: [{ is_ready: true }, { is_ready: true }], error: null });
    await expect(allPlayersReady({ from: allReady.from }, 'g1')).resolves.toBe(true);

    const oneNotReady = makeFakeClient({ data: [{ is_ready: true }, { is_ready: false }], error: null });
    await expect(allPlayersReady({ from: oneNotReady.from }, 'g1')).resolves.toBe(false);
  });

  it('is false for an empty lobby (nobody to be ready)', async () => {
    const empty = makeFakeClient({ data: [], error: null });
    await expect(allPlayersReady({ from: empty.from }, 'g1')).resolves.toBe(false);
  });
});

describe('startGame', () => {
  it('flips the game to active with the given initial state', async () => {
    const state = { year: -2000, playerNationId: 'fr' };
    const updated = { id: 'g1', status: 'active', state, current_turn_number: 0 };
    const { from, chain } = makeFakeClient({ data: updated, error: null });
    const result = await startGame({ from }, 'g1', state);
    expect(chain.update).toHaveBeenCalledWith({ status: 'active', state, current_turn_number: 0 });
    expect(result).toEqual(updated);
  });
});

describe('submitTurn', () => {
  it('stamps turn_submitted_at for the caller\'s own seat', async () => {
    const { from, chain } = makeFakeClient({ error: null });
    await submitTurn({ from }, 'g1', 'u2');
    const [payload] = chain.update.mock.calls[0];
    expect(typeof payload.turn_submitted_at).toBe('string');
    expect(chain.eq).toHaveBeenCalledWith('game_id', 'g1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u2');
  });
});

describe('allPlayersSubmitted', () => {
  it('is true only once every seat has a non-null turn_submitted_at', async () => {
    const allIn = makeFakeClient({ data: [{ turn_submitted_at: '2024-01-01' }, { turn_submitted_at: '2024-01-02' }], error: null });
    await expect(allPlayersSubmitted({ from: allIn.from }, 'g1')).resolves.toBe(true);

    const oneMissing = makeFakeClient({ data: [{ turn_submitted_at: '2024-01-01' }, { turn_submitted_at: null }], error: null });
    await expect(allPlayersSubmitted({ from: oneMissing.from }, 'g1')).resolves.toBe(false);
  });
});

describe('resetTurnSubmissions', () => {
  it('clears turn_submitted_at for every seat in the game', async () => {
    const { from, chain } = makeFakeClient({ error: null });
    await resetTurnSubmissions({ from }, 'g1');
    expect(chain.update).toHaveBeenCalledWith({ turn_submitted_at: null });
    expect(chain.eq).toHaveBeenCalledWith('game_id', 'g1');
  });
});

describe('updateGameState', () => {
  it('writes the new authoritative state and turn number', async () => {
    const state = { year: -1960 };
    const updated = { id: 'g1', state, current_turn_number: 1 };
    const { from, chain } = makeFakeClient({ data: updated, error: null });
    const result = await updateGameState({ from }, 'g1', state, 1);
    expect(chain.update).toHaveBeenCalledWith({ state, current_turn_number: 1 });
    expect(result).toEqual(updated);
  });
});
