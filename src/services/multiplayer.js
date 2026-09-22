// src/services/multiplayer.js
// Phase G: lobby management + turn ownership against the `games`/`game_players` tables
// (supabase/migrations/0002_multiplayer.sql). Same convention as cloudSaves.js: every function
// takes a Supabase client explicitly rather than importing getSupabaseClient() itself, so this is
// trivially unit-testable against a fake client with no env vars or network involved.
//
// What this does NOT do: actually resolve a turn once every seat has submitted. That's
// supabase/functions/resolve-turn (Task 41) — this module's job stops at "is everyone ready to
// advance", which whatever calls the Edge Function checks via allPlayersSubmitted() below before
// invoking it, then calls resetTurnSubmissions() to open the next round.
const GAMES_TABLE = 'games';
const PLAYERS_TABLE = 'game_players';

export const createGame = async (client, hostUserId, { gameSpeed = 'normal', difficultyId = 'prince', maxPlayers = 4 } = {}) => {
  const { data, error } = await client
    .from(GAMES_TABLE)
    .insert({ created_by: hostUserId, game_speed: gameSpeed, difficulty_id: difficultyId, max_players: maxPlayers })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// Claims a seat in a lobby as a given nation. The host still has to call this separately after
// createGame() to actually be a player in their own match — creating a game and joining it are
// different actions (a host could, in principle, create a game for others without playing).
export const joinGame = async (client, gameId, userId, nationId) => {
  const { data, error } = await client
    .from(PLAYERS_TABLE)
    .insert({ game_id: gameId, user_id: userId, nation_id: nationId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const leaveGame = async (client, gameId, userId) => {
  const { error } = await client.from(PLAYERS_TABLE).delete().eq('game_id', gameId).eq('user_id', userId);
  if (error) throw error;
};

export const setReady = async (client, gameId, userId, isReady) => {
  const { error } = await client
    .from(PLAYERS_TABLE)
    .update({ is_ready: isReady })
    .eq('game_id', gameId)
    .eq('user_id', userId);
  if (error) throw error;
};

// Every open lobby a player could join — RLS (0002_multiplayer.sql) already restricts this to
// status='lobby' rows for anyone signed in, so no extra filtering is needed here.
export const listOpenGames = async (client) => {
  const { data, error } = await client
    .from(GAMES_TABLE)
    .select('id, created_by, game_speed, difficulty_id, max_players, created_at')
    .eq('status', 'lobby')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getGamePlayers = async (client, gameId) => {
  const { data, error } = await client
    .from(PLAYERS_TABLE)
    .select('id, user_id, nation_id, is_ready, turn_submitted_at, joined_at')
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data;
};

// Every seated player ready to start (the lobby -> active transition) — not itself a status
// change; the caller decides when to actually flip games.status to 'active' once this is true.
export const allPlayersReady = async (client, gameId) => {
  const players = await getGamePlayers(client, gameId);
  return players.length > 0 && players.every((p) => p.is_ready);
};

export const startGame = async (client, gameId, initialState) => {
  const { data, error } = await client
    .from(GAMES_TABLE)
    .update({ status: 'active', state: initialState, current_turn_number: 0 })
    .eq('id', gameId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// Marks this seat's actions in for the current turn — turn ownership's write side.
export const submitTurn = async (client, gameId, userId) => {
  const { error } = await client
    .from(PLAYERS_TABLE)
    .update({ turn_submitted_at: new Date().toISOString() })
    .eq('game_id', gameId)
    .eq('user_id', userId);
  if (error) throw error;
};

// Turn ownership's read side: true once every seat has called submitTurn() this round. Whatever
// orchestrates resolution (a client, or a server-side scheduler) polls or reacts to this before
// actually resolving the turn.
export const allPlayersSubmitted = async (client, gameId) => {
  const players = await getGamePlayers(client, gameId);
  return players.length > 0 && players.every((p) => p.turn_submitted_at !== null);
};

// Called once a turn has actually been resolved (the new `state`/`current_turn_number` written to
// `games`) to open the next round — every seat's turn_submitted_at goes back to null so
// allPlayersSubmitted() is false again until the new round's actions come in.
export const resetTurnSubmissions = async (client, gameId) => {
  const { error } = await client
    .from(PLAYERS_TABLE)
    .update({ turn_submitted_at: null })
    .eq('game_id', gameId);
  if (error) throw error;
};

export const updateGameState = async (client, gameId, state, currentTurnNumber) => {
  const { data, error } = await client
    .from(GAMES_TABLE)
    .update({ state, current_turn_number: currentTurnNumber })
    .eq('id', gameId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
