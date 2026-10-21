// Remove worktrees whose HEAD is already in claude/integration and that have no tracked changes.
// The node_modules junction is unlinked first so `git worktree remove --force` never follows it.
// Usage: node prune-worktrees.mjs [--go]   (dry run without --go)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'C:/GitWotkspace/terra-imperium';
const go = process.argv.includes('--go');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();
const KEEP_BRANCHES = /^claude\/(art-future|art-information|art-modern20|integration)$/;

const list = git('worktree', 'list', '--porcelain').split(/\r?\n\r?\n/).map((b) => {
  const wt = /^worktree (.+)$/m.exec(b)?.[1];
  const head = /^HEAD (\w+)$/m.exec(b)?.[1];
  const branch = /^branch refs\/heads\/(.+)$/m.exec(b)?.[1] || null;
  return { wt, head, branch, prunable: /^prunable/m.test(b) };
}).filter((w) => w.wt && path.resolve(w.wt) !== path.resolve(REPO));

let removed = 0;
for (const w of list) {
  if (w.prunable || !fs.existsSync(w.wt)) continue;
  if (w.branch && KEEP_BRANCHES.test(w.branch)) { console.log('keep (held)', w.wt); continue; }
  let merged = false;
  try { git('merge-base', '--is-ancestor', w.head, 'claude/integration'); merged = true; } catch { /* not merged */ }
  if (!merged) { console.log('keep (unmerged)', w.wt, w.branch); continue; }
  const dirty = execFileSync('git', ['-C', w.wt, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
  if (dirty) { console.log('keep (tracked changes)', w.wt); continue; }
  console.log(go ? 'remove' : 'would remove', w.wt, w.branch || '(detached)');
  if (!go) continue;
  const nm = path.join(w.wt, 'node_modules');
  if (fs.existsSync(nm) && fs.lstatSync(nm).isSymbolicLink()) execFileSync('cmd', ['/c', 'rmdir', nm.replace(/\//g, '\\')]);
  if (fs.existsSync(nm) && fs.lstatSync(nm).isSymbolicLink()) { console.log('  junction still there, skip'); continue; }
  try { git('worktree', 'remove', '--force', w.wt); removed++; } catch (e) { console.log('  failed:', e.message.split('\n')[0]); }
}
if (go) { git('worktree', 'prune'); console.log('removed', removed); }
