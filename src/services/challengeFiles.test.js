// U36 security checks on the server-side text (never run against a project): the workflow and the migration.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const wf = read('.github/workflows/verify-challenges.yml');
const sql = read('supabase/migrations/0004_challenges.sql');

describe('challenge workflow', () => {
  it('has no pull request trigger, runs on main only, and uses the scoped secret', () => {
    expect(wf).not.toMatch(/pull_request/);
    expect(wf).toMatch(/github\.ref == 'refs\/heads\/main'/);
    expect(wf).toMatch(/secrets\.CHALLENGE_VERIFIER_KEY/);
    expect(wf).not.toMatch(/service_role/i);
  });
});

describe('challenge migration', () => {
  it('turns on row-level security and never lets a client write the leaderboard', () => {
    expect(sql).toMatch(/challenge_submissions enable row level security/);
    expect(sql).toMatch(/challenge_leaderboard enable row level security/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*challenge_leaderboard to [^;]*(anon|authenticated)/);
    expect(sql).not.toMatch(/to anon[^;]*insert|grant insert[^;]*submissions to anon/);
  });
  it('the verifier reads pending rows only and cannot read other tables', () => {
    expect(sql).toMatch(/for select to verifier using \(status = 'pending'\)/);
    expect(sql).not.toMatch(/to verifier[^;]*profiles/);
  });
  it('a client cannot name its own user, status or display name', () => {
    expect(sql).toMatch(/grant insert \(week_id, build, claimed_hash, claimed_score, log\) on public\.challenge_submissions to authenticated/);
    expect(sql).toMatch(/new\.user_id := auth\.uid\(\)/);
  });
  it('no key is written in the repo', () => {
    expect(sql + wf + read('supabase/functions/submit-challenge/index.ts') + read('scripts/verifyChallenges.mjs')).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });
});
