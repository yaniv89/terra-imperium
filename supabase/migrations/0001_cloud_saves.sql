-- Phase F: cloud saves (plan §10 / roadmap "Backend").
--
-- One save slot per (user, slot_name) — matching the app's existing single-slot autosave model
-- (src/context/GameContext.jsx's STORAGE_KEY) generalized to let a signed-in player keep a named
-- slot per device/campaign rather than exactly one. `state` holds the whole plain-JSON game state
-- object, byte-for-byte what GameContext.jsx's exportSave()/importSave() already produce and
-- accept for local saves — this table is a second transport for the identical payload, not a new
-- save format.
create table if not exists public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_name text not null default 'default',
  version integer not null,
  state jsonb not null,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, slot_name)
);

create index if not exists saves_user_id_idx on public.saves (user_id);

alter table public.saves enable row level security;

-- A player can only ever see or touch their own saves — cloud saves are private by default, with
-- no sharing/spectating mechanism (that's multiplayer/Phase G territory, a different feature).
create policy "Users can view their own saves"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saves"
  on public.saves for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own saves"
  on public.saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own saves"
  on public.saves for delete
  using (auth.uid() = user_id);

-- Keeps saved_at accurate on every UPDATE without the client having to remember to set it —
-- mirrors the local save path's `savedAt: Date.now()` (GameContext.jsx), computed server-side
-- instead so a client with a wrong clock can't backdate/misdate a cloud save.
create or replace function public.touch_saves_saved_at()
returns trigger
language plpgsql
as $$
begin
  new.saved_at = now();
  return new;
end;
$$;

drop trigger if exists saves_touch_saved_at on public.saves;
create trigger saves_touch_saved_at
  before update on public.saves
  for each row
  execute function public.touch_saves_saved_at();
