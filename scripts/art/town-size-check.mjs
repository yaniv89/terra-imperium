// scripts/art/town-size-check.mjs
// Map town size budget (eight ages plan KTD16, U97): each age added by the plan (Stone,
// Information, Future) at most 65 MB of town files and 2 MB per file; src/assets/map/towns at
// most 850 MB in all. The five older ages predate the budget and only count toward the total.
//   node scripts/art/town-size-check.mjs   (exit 1 when over budget)
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export const TOWNS_DIR = 'src/assets/map/towns';
const MB = 1024 * 1024;
export const BUDGET = { newAges: ['stone', 'information', 'future'], perAgeMb: 65, perFileMb: 2, totalMb: 850 };

/** files: [{ name, bytes }]. Returns per-age totals in MB, the total, and every budget broken. */
export const townSizeReport = (files, budget = BUDGET) => {
  const ages = {}; let total = 0; const problems = [];
  for (const { name, bytes } of files) {
    const age = name.split('-')[0];
    ages[age] = (ages[age] || 0) + bytes / MB;
    total += bytes / MB;
    if (budget.newAges.includes(age) && bytes > budget.perFileMb * MB) problems.push(`${name} is ${(bytes / MB).toFixed(2)} MB (max ${budget.perFileMb})`);
  }
  budget.newAges.forEach((a) => { if ((ages[a] || 0) > budget.perAgeMb) problems.push(`${a} towns ${ages[a].toFixed(1)} MB (max ${budget.perAgeMb})`); });
  if (total > budget.totalMb) problems.push(`towns total ${total.toFixed(1)} MB (max ${budget.totalMb})`);
  return { ages, total, problems };
};

export const townFiles = (dir = TOWNS_DIR) => fs.readdirSync(dir).map((name) => ({ name, bytes: fs.statSync(path.join(dir, name)).size }));

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ages, total, problems } = townSizeReport(townFiles());
  Object.entries(ages).forEach(([a, mb]) => console.log(`${a.padEnd(12)} ${mb.toFixed(1)} MB`));
  console.log(`total        ${total.toFixed(1)} MB`);
  problems.forEach((p) => console.log(`OVER: ${p}`));
  console.log(problems.length ? 'FAIL' : 'PASS');
  process.exit(problems.length ? 1 : 0);
}
