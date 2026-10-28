// .claude/skills/battle-lab/aiDuel-prep.mjs
// Copies the tactical AI (tacticalAI.js, economyAI.js) of a git ref into <outDir> with its relative
// imports pointed at this checkout's src/battle/sim, so aiDuel.sim.js can fight the old AI against
// the new one in the same sim.   node .claude/skills/battle-lab/aiDuel-prep.mjs <ref> <outDir>
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [ref, out] = process.argv.slice(2);
if (!ref || !out) { console.error('usage: aiDuel-prep.mjs <ref> <outDir>'); process.exit(1); }
const sim = resolve('src/battle/sim');
mkdirSync(out, { recursive: true });
['tacticalAI.js', 'economyAI.js'].forEach((f) => {
  let src = execSync(`git show ${ref}:src/battle/sim/${f}`, { encoding: 'utf8', maxBuffer: 1 << 24 });
  src = src.replace(/from '\.\/(?!economyAI')([^']+)'/g, `from '${sim}/$1'`).replace(/from '\.\.\/([^']+)'/g, `from '${resolve('src/battle')}/$1'`);
  writeFileSync(resolve(out, f), src);
});
console.log(`old AI of ${ref} in ${resolve(out)}`);
