// U36 security checks on the server-side text (never run against a project): the workflow and the migration.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyInChild } from '../../scripts/verifyChallenges.mjs';

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

describe('challenge verifier', () => {
  it('the replay child gets no environment, so a hostile log can never reach the key', () => {
    const file = path.join(os.tmpdir(), `chal-env-${process.pid}.mjs`);
    writeFileSync(file, 'export const verifyChallenge = () => ({ env: Object.keys(process.env) });');
    process.env.CHALLENGE_VERIFIER_KEY = 'secret';
    try { expect(verifyInChild(file, {}, 10000, 1000)).toEqual({ env: [] }); } finally { delete process.env.CHALLENGE_VERIFIER_KEY; }
  });
  it('a second verified run of a user in a week is ignored, not a 409 that stalls the queue', () => {
    expect(read('scripts/verifyChallenges.mjs')).toMatch(/challenge_leaderboard\?on_conflict=user_id,week_id/);
  });
});

describe('submit-challenge function', () => {
  it('answers the browser preflight, or every submit from the site fails', () => {
    const fn = read('supabase/functions/submit-challenge/index.ts');
    expect(fn).toMatch(/req\.method === 'OPTIONS'/);
    expect(fn).toMatch(/Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'/);
  });
});

describe('challenge migration', () => {
  it('the weekly cap holds under parallel inserts, and the leaderboard hides user ids', () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtextextended\(new\.user_id::text \|\| new\.week_id, 0\)\)/);
    expect(sql).not.toMatch(/grant select on public\.challenge_leaderboard/);
  });
  it('the verifier may post only a pending submission, under its own user and claimed score', () => {
    expect(sql).not.toMatch(/to verifier with check \(true\)/);
    expect(sql).toMatch(/s\.status = 'pending' and s\.user_id = challenge_leaderboard\.user_id/);
  });
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
