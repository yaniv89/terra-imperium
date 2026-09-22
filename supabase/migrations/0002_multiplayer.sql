-- Phase G: async multiplayer lobbies + turn ownership (plan §10's "Async multiplayer (2-8
-- players, turn-at-your-own-pace)"). Two tables: `games` (one row per match, holding the
-- authoritative state once it starts) and `game_players` (one row per human seat, tracking which
-- nation they control and whether they've submitted their actions for the CURRENT turn).
--
-- "Turn ownership" lives entirely in game_players.turn_submitted_at: a turn only actually
-- advances once every seat's turn_submitted_at is non-null (checked by the client/service layer
-- calling allPlayersSubmitted(), src/services/multiplayer.js), at which point whatever resolves
-- the turn (the resolve-turn Edge Function, supabase/functions/resolve-turn) writes the new
-- `games.state` and resets every player's turn_submitted_at back to null for the next round. This
-- migration only defines the data model; that resolution step itself is Task 41's job.
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished')),
  -- Matches src/data/ages.js's GAME_SPEEDS ids and src/data/difficulty.js's DIFFICULTIES ids —
  -- not foreign keys, since those are static in-code tables, not database rows.
  game_speed text not null default 'normal',
  difficulty_id text not null default 'prince',
  max_players integer not null default 4 check (max_players between 2 and 8),
  -- The whole authoritative game state (src/engine/gameReducer.js's createInitialState shape) —
  -- null while the game is still in its lobby, exactly like a save's `state` column
  -- (0001_cloud_saves.sql) but shared across every seat instead of private to one user.
  state jsonb,
  current_turn_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Which of the 240 nations (src/data/worldNations.js) this seat plays — not a foreign key for
  -- the same reason game_speed/difficulty_id aren't; validated app-side against WORLD_NATIONS.
  nation_id text not null,
  joined_at timestamptz not null default now(),
  is_ready boolean not null default false,
  -- null = hasn't submitted this turn's actions yet. Set when they do, reset to null for every
  -- seat the moment the turn actually resolves — see the file header.
  turn_submitted_at timestamptz,
  unique (game_id, user_id),
  unique (game_id, nation_id)
);

create index if not exists game_players_game_id_idx on public.game_players (game_id);
create index if not exists game_players_user_id_idx on public.game_players (user_id);
create index if not exists games_status_idx on public.games (status);

-- A lobby can't silently accept more players than its own max_players — enforced here rather than
-- only in the client, since RLS alone can't express "count of existing rows" as a check.
create or replace function public.enforce_max_players()
returns trigger
language plpgsql
as $$
declare
  seat_count integer;
  cap integer;
begin
  select max_players into cap from public.games where id = new.game_id;
  select count(*) into seat_count from public.game_players where game_id = new.game_id;
  if seat_count >= cap then
    raise exception 'game % already has its max % players', new.game_id, cap;
  end if;
  return new;
end;
$$;

drop trigger if exists game_players_enforce_max_players on public.game_players;
create trigger game_players_enforce_max_players
  before insert on public.game_players
  for each row
  execute function public.enforce_max_players();

create or replace function public.touch_games_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row
  execute function public.touch_games_updated_at();

alter table public.games enable row level security;
alter table public.game_players enable row level security;

-- Lobbies are discoverable by anyone signed in (so a player can browse open games to join); once
-- a game leaves 'lobby' status, only its own seated players can still read it — an active match's
-- state is a real gameplay secret (fog of war, other nations' private diplomacy) between its
-- participants, not something a browsing stranger should see mid-game.
create policy "Lobby games are visible to any signed-in user, active/finished only to their players"
  on public.games for select
  using (
    status = 'lobby'
    or exists (select 1 from public.game_players gp where gp.game_id = games.id and gp.user_id = auth.uid())
  );

create policy "A signed-in user can create a game they host"
  on public.games for insert
  with check (auth.uid() = created_by);

create policy "Only a game's own seated players can update it"
  on public.games for update
  using (exists (select 1 from public.game_players gp where gp.game_id = games.id and gp.user_id = auth.uid()));

create policy "Only the host can delete their game"
  on public.games for delete
  using (auth.uid() = created_by);

-- Mirrors the games policy above: a lobby's roster is visible while recruiting, an active game's
-- roster only to its own players.
create policy "Lobby rosters are visible to any signed-in user, active/finished only to their players"
  on public.game_players for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_players.game_id
        and (g.status = 'lobby' or exists (select 1 from public.game_players gp2 where gp2.game_id = g.id and gp2.user_id = auth.uid()))
    )
  );

create policy "A user can only seat themselves, never someone else"
  on public.game_players for insert
  with check (auth.uid() = user_id);

create policy "A user can only update their own seat (ready-up, submit their turn)"
  on public.game_players for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "A user can leave a game by deleting their own seat"
  on public.game_players for delete
  using (auth.uid() = user_id);
