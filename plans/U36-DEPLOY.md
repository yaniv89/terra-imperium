# U36 deploy steps (weekly challenge and leaderboard)

Nothing in this repo touches a live Supabase project or GitHub settings. Until you do the steps
below, the challenge still plays offline and the leaderboard shows "Not connected".

Files to review first: `supabase/migrations/0004_challenges.sql`, `supabase/functions/submit-challenge/index.ts`,
`.github/workflows/verify-challenges.yml`, `scripts/verifyChallenges.mjs`.

## Steps (all yours, in this order)

1. Merge this branch to `main` (the workflow only runs from `main`).
2. Supabase project: run `0004_challenges.sql` after 0001 to 0003 (SQL Editor, or `supabase db push`).
   It creates the two tables, row-level security, a size cap, a 3-per-week rate limit and the
   `verifier` role.
3. Deploy the edge function: `supabase functions deploy submit-challenge`.
4. Make the verifier key. In the dashboard (Project Settings, JWT keys) sign a JWT with
   payload `{"role":"verifier","iss":"supabase"}` and a long expiry, using the project JWT secret.
   Never use the `service_role` key. Keep the token out of the repo and out of chat.
5. GitHub repo, Settings, Secrets and variables, Actions:
   - Secret `CHALLENGE_VERIFIER_KEY` = the verifier JWT.
   - Variable `SUPABASE_URL` = `https://<project>.supabase.co`.
   - Variable `SUPABASE_ANON_KEY` = the project's anon (public) key. The API gateway only takes a
     project key as `apikey`; the verifier JWT goes in the `Authorization` header.
6. Game build env (already used by cloud saves): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
7. Run the workflow once by hand (Actions, Verify challenges, Run workflow) and watch the log.

## Rules to keep

- Bump `ENGINE_BUILD` in `src/data/challenges.js` whenever a change alters how a game replays.
  A client on another build is told the challenge is closed.
- The first verified score of a user in a week is the one on the board.
- Rotate the verifier key by repeating step 4 and 5.
