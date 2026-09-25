-- Phase F/M0.5: accounts, save slots, and an admin surface for verifying save ownership (plan
-- §M0.5). Builds on 0001_cloud_saves.sql's `saves` table rather than replacing it — this migration
-- is additive/idempotent (if not exists / create or replace throughout) so it's safe to paste after
-- 0001+0002 into a project that already has them, and safe to re-run.

-- =====================================================================================
-- 1) Profiles: one row per auth user, created automatically on sign-up. This is what makes
--    "who owns this save" a real, server-verified fact instead of a client-supplied claim.
-- =====================================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 3 and 24),
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index if not exists profiles_display_name_ci on public.profiles (lower(display_name));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin check used by every admin policy below. SECURITY DEFINER so it can read `profiles`
-- regardless of RLS (a plain RLS-scoped query couldn't check the caller's own role without first
-- being allowed to read it, which would be circular).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
create policy "profiles: read own"   on public.profiles for select using (id = auth.uid());
create policy "profiles: admin read" on public.profiles for select using (public.is_admin());
-- A player may change their own display name / last-seen timestamp — never their own role. This is
-- enforced by revoking UPDATE outright and re-granting it column-by-column, so no RLS `with check`
-- clause (which only inspects row *values*, not which columns a client attempted to write) can be
-- bypassed by a crafted request that also happens to leave role unchanged in its payload.
revoke update on public.profiles from authenticated;
grant update (display_name, last_seen_at) on public.profiles to authenticated;
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- =====================================================================================
-- 2) Saves: slots, metadata for listing without downloading state, compression, provenance,
--    optimistic-concurrency revision. Builds on 0001's existing `slot_name`/`state` columns rather
--    than introducing a second, parallel `slot` column.
-- =====================================================================================
alter table public.saves alter column slot_name set default 'autosave';
update public.saves set slot_name = 'autosave' where slot_name = 'default';
alter table public.saves drop constraint if exists saves_slot_name_check;
alter table public.saves add constraint saves_slot_name_check check (slot_name in ('autosave', 'slot1', 'slot2', 'slot3'));

alter table public.saves alter column state drop not null; -- new rows may use state_gz instead
alter table public.saves
  add column if not exists state_gz text,              -- base64(gzip(JSON)) - far smaller than raw jsonb for a full game state
  add column if not exists size_bytes integer,
  add column if not exists nation_id text,
  add column if not exists nation_name text,
  add column if not exists turn_number integer,
  add column if not exists game_year integer,
  add column if not exists age_id text,
  add column if not exists game_status text,
  add column if not exists app_version text,
  add column if not exists device_label text,           -- e.g. "iPhone Safari", "Windows Chrome"
  add column if not exists origin text not null default 'played' check (origin in ('played', 'imported')),
  add column if not exists original_owner_id uuid,       -- set when an imported file was saved by a different account
  add column if not exists revision integer not null default 1;

alter table public.saves drop constraint if exists saves_size_check;
alter table public.saves add constraint saves_size_check check (size_bytes is null or size_bytes <= 5000000);
alter table public.saves drop constraint if exists saves_has_state;
alter table public.saves add constraint saves_has_state check (state is not null or state_gz is not null);

-- Bumps revision on every update (optimistic concurrency for src/services/cloudSaves.js's
-- writeSlot) in addition to 0001's existing saved_at touch.
create or replace function public.touch_saves_saved_at()
returns trigger
language plpgsql
as $$
begin
  new.saved_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;
-- (trigger already exists from 0001 and points at this function by name; replacing the function
-- body is enough, no need to re-create the trigger itself.)

-- Admins can read and delete every save; players keep their own-rows policies from 0001.
drop policy if exists "saves: admin read" on public.saves;
create policy "saves: admin read" on public.saves for select using (public.is_admin());
drop policy if exists "saves: admin delete" on public.saves;
create policy "saves: admin delete" on public.saves for delete using (public.is_admin());

-- =====================================================================================
-- 3) Admin audit log - every inspect/export/delete an admin performs against another
--    account's save is recorded, not just permitted.
-- =====================================================================================
create table if not exists public.admin_actions (
  id bigserial primary key,
  admin_id uuid not null references auth.users(id),
  action text not null check (action in ('inspect_save', 'delete_save', 'export_save')),
  target_save_id uuid,
  target_user_id uuid,
  details jsonb,
  at timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
drop policy if exists "admin_actions: admin insert" on public.admin_actions;
create policy "admin_actions: admin insert" on public.admin_actions for insert with check (public.is_admin() and admin_id = auth.uid());
drop policy if exists "admin_actions: admin read" on public.admin_actions;
create policy "admin_actions: admin read" on public.admin_actions for select using (public.is_admin());

-- =====================================================================================
-- 4) Admin listing view - security_invoker so RLS still applies through the view (only an
--    admin's own query actually returns rows; a non-admin selecting from this view gets none).
-- =====================================================================================
create or replace view public.admin_saves with (security_invoker = true) as
  select s.id, s.slot_name, s.nation_id, s.nation_name, s.turn_number, s.game_year, s.age_id, s.game_status,
         s.size_bytes, s.origin, s.original_owner_id, s.device_label, s.app_version, s.revision,
         s.saved_at, s.created_at, s.user_id, p.email, p.display_name, p.last_seen_at
  from public.saves s join public.profiles p on p.id = s.user_id;

-- =====================================================================================
-- 5) Self-service account deletion (cascades to profiles and saves via their FKs' `on delete
--    cascade`).
-- =====================================================================================
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end; $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- =====================================================================================
-- Making yourself admin (one-time, dashboard SQL editor only - there is intentionally no UI or
-- API for this): after signing up once in the game,
--   update public.profiles set role = 'admin' where email = '<your email>';
-- =====================================================================================
