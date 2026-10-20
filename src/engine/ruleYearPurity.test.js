// No rule reads the year (eight-ages plan KTD3, U11). The year is a display label written once a
// turn by resolveTurn from displayYear.js; engine rule modules may copy it into a log line or a
// record shown to the player, never decide anything by it. This scans the rule modules for reads
// of a state's `.year` and fails by file and line on any that is not a label copy.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOTS = ['src/engine', 'src/data', 'src/utils/aiLogic.js'];
// A state-like object's year: state.year, next.year, s.year, input.year, w.year.
const READ = /\b(state|next|s|input|w|st|prev|view)\.year\b/g;
// A copy into a log line or an input object's `year:` field is the label travelling, not a rule.
const COPY = /\byear: (state|next|s|input|w|st|prev|view)\.year\b/g;
// Reads that are labels by name, each with its reason.
const ALLOWED = [
  ['src/engine/displayYear.js', '', 'the label writer'],
  ['src/engine/saveMigrations.js', 'const year = state.year ?? AGES[FIRST_AGE_ID].startYear;', 'the v13 save step reads the old calendar once, so no nation loses its old age'],
  ['src/engine/resolveTurn.js', 'state.year ?? displayYear(state)', 'the label the turn started with, for its logs'],
  ['src/engine/colonies.js', 'const year = state.year;', 'used only in log lines'],
  ['src/engine/diplomacy.js', 'war_${nationId}_${state.year}', 'part of an id, made unique by a counter'],
  ['src/engine/diplomacy.js', 'startYear: state.year', 'a record shown to the player'],
  ['src/data/satellites.js', '', 'the space race, removed with it (plan U18)'],
  ['src/engine/gameReducer.js', 'canLaunchSatellite(', 'the space race, removed with it (plan U18)'],
  ['src/engine/gameReducer.js', 'launchedYear: state.year', 'the space race, removed with it (plan U18)']
];

const files = (p) => {
  if (p.endsWith('.js')) return [p];
  return fs.readdirSync(p, { withFileTypes: true }).flatMap((d) => {
    const full = path.posix.join(p, d.name);
    if (d.isDirectory()) return d.name === '__fixtures__' ? [] : files(full);
    return d.name.endsWith('.js') && !d.name.endsWith('.test.js') ? [full] : [];
  });
};

describe('no rule reads the year (KTD3)', () => {
  it('rule modules only copy the year label into logs and records', () => {
    const bad = [];
    ROOTS.flatMap(files).forEach((file) => {
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        const reads = (code.match(READ) || []).length - (code.match(COPY) || []).length;
        if (reads <= 0) return;
        if (ALLOWED.some(([f, snippet]) => f === file && (snippet === '' || code.includes(snippet)))) return;
        bad.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    });
    expect(bad).toEqual([]);
  });
});
