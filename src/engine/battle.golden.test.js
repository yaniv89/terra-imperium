// src/engine/battle.golden.test.js
// Locks resolveBattle's exact behavior (Tactical Battles plan §5.1): 500 seeded, varied matchups
// whose full results were recorded BEFORE the multiplier stack was split out for the tactical
// sim. Any refactor of battle.js must keep every one of them byte-identical. Regenerate only when a
// balance change is intended: GEN_BATTLE_GOLDEN=1 npx vitest run src/engine/battle.golden.test.js
import { it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';
import { generateGeneral } from '../data/generals';
import { ALL_PERKS, CLASS_CAPSTONES } from '../data/promotions';

const FIXTURE = path.join(__dirname, '__fixtures__', 'battle-golden.json');
const CLASSES = ['infantry', 'cavalry', 'ranged', 'siege', 'air', 'support'];
const TERRAINS = ['plains', 'mixed', 'desert', 'urban', 'forest', 'island', 'hills', 'mountains', 'arctic'];
const AGES = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];
const PERK_IDS = [...ALL_PERKS.map((p) => p.id), ...Object.values(CLASS_CAPSTONES).map((c) => c.id)];

const pick = (rng, arr) => arr[Math.floor(rng.next() * arr.length)];

export const buildGoldenCases = () => {
  const rng = createRng(20260930);
  const generals = {};
  for (let g = 0; g < 8; g++) generals[`g_${g}`] = generateGeneral(rng, `g_${g}`, 'x');
  const makeSide = (prefix) => Array.from({ length: 1 + Math.floor(rng.next() * 9) }, (_, i) => ({
    id: `${prefix}${i}`,
    classId: pick(rng, CLASSES),
    strength: 100 + Math.floor(rng.next() * 900),
    maxStrength: 1000,
    morale: 20 + Math.floor(rng.next() * 81),
    promotions: rng.next() < 0.4 ? [pick(rng, PERK_IDS), ...(rng.next() < 0.3 ? [pick(rng, PERK_IDS)] : [])] : [],
    commanderId: rng.next() < 0.25 ? `g_${Math.floor(rng.next() * 8)}` : null
  }));
  return Array.from({ length: 500 }, (_, n) => ({
    seed: 1000 + n * 7919,
    attackerUnits: makeSide('a'),
    defenderUnits: makeSide('d'),
    terrain: pick(rng, TERRAINS),
    isAttackingFortification: rng.next() < 0.3,
    generals,
    attackerPenaltyMultiplier: rng.next() < 0.2 ? 0.75 : 1,
    defenderDamageReductionMultiplier: rng.next() < 0.3 ? 0.8 : 1,
    attackerAgeId: pick(rng, AGES),
    defenderAgeId: pick(rng, AGES)
  }));
};

const run = (input) => resolveBattle({ ...input, rng: createRng(input.seed) });
// A SHA-256 of the full JSON result: as strict as deep equality (any byte of any field changes it)
// without committing megabytes of fixture. The outcome is kept in the clear for readable failures.
// report.timeline (strength after each round, for the replay and the report chart) is display
// data added after the fixture was recorded; leaving it out keeps the fixture proving that the
// battle itself is unchanged.
const withoutDisplay = (result) => ({ ...result, report: (({ timeline, battleType, ...rest }) => rest)(result.report || {}) }); // eslint-disable-line no-unused-vars -- battleType is a label; its odds are in the numbers
const fingerprint = (result) => ({ outcome: result.outcome, sha: crypto.createHash('sha256').update(JSON.stringify(withoutDisplay(result))).digest('hex').slice(0, 24) });

it('resolveBattle results stay identical to the recorded golden set', () => {
  const cases = buildGoldenCases();
  if (process.env.GEN_BATTLE_GOLDEN) {
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify(cases.map((c) => fingerprint(run(c)))));
    return;
  }
  const expected = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  expect(expected).toHaveLength(cases.length);
  cases.forEach((input, i) => expect(fingerprint(run(input)), `golden case ${i}`).toEqual(expected[i]));
});
