# Supabase setup (plan §M0.5)

One-time steps against the live project (`https://visxnnbemirhpigvwiry.supabase.co`). Nothing here
needs repeating per deploy — the app picks up `.env.production`'s `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` automatically.

## 1. Run the SQL migrations

In the Supabase dashboard's SQL Editor, run, in order:
1. `supabase/migrations/0001_cloud_saves.sql`
2. `supabase/migrations/0002_multiplayer.sql`
3. `supabase/migrations/0003_accounts_saves_admin.sql`

All three are idempotent (`if not exists` / `create or replace` throughout), so re-running the
whole set after a future migration is added is always safe.

## 2. Auth settings (dashboard → Authentication)

- **Providers → Email**: enabled. "Confirm email" **ON**. Minimum password length **8**.
- **URL Configuration → Site URL**: `https://yaniv89.github.io/terra-imperium/`
- **URL Configuration → Redirect URLs**, add:
  - `https://yaniv89.github.io/terra-imperium/**`
  - `http://localhost:5173/**`
  - `http://localhost:3000/**` (this repo's dev server port, see `vite.config.js`)

## 3. Make yourself admin

Sign up once in the running game first (so your `profiles` row exists), then in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = '<your email>';
```

There is intentionally no UI or API path to grant admin — only this one-time SQL statement.

## 4. Manual RLS checklist (no Postgres test runner in this repo — run this by hand once)

With two test accounts, A and B, both signed in (e.g. two browser profiles):

1. A cannot list or read B's saves (`select * from saves` as A never returns B's rows).
2. A non-admin player cannot promote themselves:
   `update profiles set role = 'admin' where id = auth.uid()` fails with a permission error
   (column privileges revoke this for everyone but the SQL editor's own service role).
3. A non-admin querying `admin_saves` gets 0 rows.
4. An admin account (after step 3 above) sees every row in `admin_saves` and can delete any save.
5. Calling `select delete_my_account()` as A removes A's `auth.users` row and, via cascade, A's
   `profiles` and `saves` rows.

If any of these doesn't hold, do not ship — it means a policy above didn't apply as written.
