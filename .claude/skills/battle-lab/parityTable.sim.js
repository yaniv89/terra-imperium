// .claude/skills/battle-lab/parityTable.sim.js
// Writes src/data/autoParity.json (read by src/engine/battleOdds.js autoParityOf) from a parityEco run:
// per battle kind, how many matchups fell inside the guardrail and the spread of tactical/auto ratios.
// Rerun after each sibling parity unit; the same BASE gives the same bytes.
//   (N=32 npx vitest run -c ... parityEco > parity.txt)  BASE=parity.txt npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/parityTable
import { it } from 'vitest';
import fs from 'node:fs';

export const parityTable = (text) => {
  const out = {};
  text.split('\n').filter((l) => l.startsWith('PARITY ') && !l.startsWith('PARITY cmd=')).forEach((l) => {
    const type = l.split(' ')[1];
    const ratio = Number(/ratio=([\d.]+)x/.exec(l)[1]);
    const t = out[type] || (out[type] = { matchups: 0, inside: 0, seeds: Number(/seeds=(\d+)/.exec(l)[1]), ratioLow: Infinity, ratioHigh: 0 });
    t.matchups += 1;
    if (/ IN /.test(l)) t.inside += 1;
    t.ratioLow = Math.min(t.ratioLow, ratio);
    t.ratioHigh = Math.max(t.ratioHigh, ratio);
  });
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
};

it('writes src/data/autoParity.json', () => {
  fs.writeFileSync('src/data/autoParity.json', `${JSON.stringify(parityTable(fs.readFileSync(process.env.BASE, 'utf8')), null, 2)}\n`);
});
