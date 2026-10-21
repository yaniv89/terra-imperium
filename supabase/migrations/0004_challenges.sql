-- U36 (differentiation plan KTD16): weekly challenge submissions and the leaderboard.
-- REVIEW ONLY: not applied to any project. See plans/U36-DEPLOY.md before running it.
--
-- Model: a signed-in client may only INSERT its own pending submission (size cap, rate limit,
-- user_id and display_name set by a trigger, never by the client). A scheduled verifier
-- (scripts/verifyChallenges.mjs, key for the `verifier` role, never service_role) reads PENDING
-- rows only, replays them, and writes the verdict and the leaderboard row. Everyone may read the
-- leaderboard; nobody but the verifier may write it. Idempotent: safe to re-run.

create table if not exists public.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  week_id text not null check (week_id ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  build text not null check (char_length(build) between 1 and 32),
  claimed_hash text not null check (claimed_hash ~ '^[0-9a-f]{16}$'),
  claimed_score integer not null check (claimed_score between 0 and 100000000),
  log jsonb not null check (pg_column_size(log) <= 262144),   -- same cap as MAX_LOG_BYTES
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'closed')),
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists challenge_submissions_pending on public.challenge_submissions (created_at) where status = 'pending';

create table if not exists public.challenge_leaderboard (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.challenge_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  week_id text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_id)   -- the first verified result of a week stands
);
create index if not exists challenge_leaderboard_rank on public.challenge_leaderboard (week_id, score desc);

-- The client never names its own user or display name; at most 3 submissions per user per week.
create or replace function public.challenge_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  if new.user_id is null then raise exception 'sign in to submit'; end if;
  -- A name that is just the start of the email (the 0003 default) is never shown: use "Player" plus a short stable id.
  select case when nullif(p.display_name, '') is null or p.display_name = split_part(p.email, '@', 1)
              then 'Player ' || left(p.id::text, 4) else p.display_name end
    into new.display_name from public.profiles p where p.id = new.user_id;
  new.status := 'pending'; new.reason := null;
  -- One insert per user and week at a time, so parallel requests cannot all pass the count below.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || new.week_id, 0));
  if (select count(*) from public.challenge_submissions where user_id = new.user_id and week_id = new.week_id) >= 3 then
    raise exception 'too many submissions this week';
  end if;
  return new;
end; $$;
drop trigger if exists challenge_before_insert on public.challenge_submissions;
create trigger challenge_before_insert before insert on public.challenge_submissions
  for each row execute function public.challenge_before_insert();

-- The verifier role: the JWT the Actions secret holds carries role = 'verifier'. It is not a login role.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'verifier') then create role verifier nologin noinherit; end if;
end $$;
grant verifier to authenticator;
grant usage on schema public to verifier;

alter table public.challenge_submissions enable row level security;
alter table public.challenge_leaderboard enable row level security;

-- Start from nothing, then grant exactly what each role needs (column-level for writes).
revoke all on public.challenge_submissions, public.challenge_leaderboard from anon, authenticated, verifier;
grant insert (week_id, build, claimed_hash, claimed_score, log) on public.challenge_submissions to authenticated;
grant select (id, week_id, status, reason, created_at) on public.challenge_submissions to authenticated;
grant select (display_name, week_id, score, created_at) on public.challenge_leaderboard to anon, authenticated;   -- no user ids in public
grant select (id, user_id, display_name, week_id, build, claimed_hash, claimed_score, log, status, created_at) on public.challenge_submissions to verifier;
grant update (status, reason) on public.challenge_submissions to verifier;
grant insert on public.challenge_leaderboard to verifier;

drop policy if exists "submissions: insert own" on public.challenge_submissions;
create policy "submissions: insert own" on public.challenge_submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "submissions: read own" on public.challenge_submissions;
create policy "submissions: read own" on public.challenge_submissions for select to authenticated using (user_id = auth.uid());
drop policy if exists "submissions: verifier reads pending" on public.challenge_submissions;
create policy "submissions: verifier reads pending" on public.challenge_submissions for select to verifier using (status = 'pending');
drop policy if exists "submissions: verifier judges pending" on public.challenge_submissions;
create policy "submissions: verifier judges pending" on public.challenge_submissions for update to verifier
  using (status = 'pending') with check (status in ('verified', 'rejected', 'closed'));

drop policy if exists "leaderboard: public read" on public.challenge_leaderboard;
create policy "leaderboard: public read" on public.challenge_leaderboard for select to anon, authenticated using (true);
drop policy if exists "leaderboard: verifier inserts" on public.challenge_leaderboard;
-- Only a still-pending submission, under its own user, week, name and claimed score: a leaked
-- verifier key cannot post a score for someone who never submitted it.
create policy "leaderboard: verifier inserts" on public.challenge_leaderboard for insert to verifier with check (exists (
  select 1 from public.challenge_submissions s
  where s.id = challenge_leaderboard.submission_id and s.status = 'pending' and s.user_id = challenge_leaderboard.user_id
    and s.week_id = challenge_leaderboard.week_id and s.display_name = challenge_leaderboard.display_name and s.claimed_score = challenge_leaderboard.score));
