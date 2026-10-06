// scripts/blender/validate_model.test.mjs
// The validator's Wave 0 kinds (plans/ART-MODELS-PLAN.md D1, D2) on tiny fixture files: the kind is
// read from the game path, budgets apply per object (the HQ roles get theirs), sockets may use
// reserved words, one-level kinds need no LOD children, units allow only the unit materials.
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { kitGlb } from '../../src/components/map/closeView/glbFixture.js';

const hasPython = spawnSync('python3', ['--version']).status === 0;
const dir = mkdtempSync(join(tmpdir(), 'ti-validate-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const file = (rel, objects) => { const p = join(dir, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, kitGlb(objects)); return p; };
const run = (path, kind = 'auto') => {
  const out = join(dir, 'out');
  const r = spawnSync('python3', ['scripts/blender/validate_model.py', path, out, kind], { encoding: 'utf8' });
  const name = path.split('/').pop().replace(/\.glb$/, '');
  return { ok: r.status === 0, report: JSON.parse(readFileSync(join(out, `${name}.validation.json`), 'utf8')), stdout: r.stdout };
};

describe.skipIf(!hasPython)('validate_model.py Wave 0 kinds', () => {
  it('reads the kind from the path and passes a good battle building file', () => {
    const r = run(file('src/assets/battle/rts/rts-bronze.glb', [{ name: 'barracks', size: 1.4, sockets: { 'socket-banner': [0, 1, 0], 'socket-door': [0, 0, 0.7] } }, { name: 'town-hall', size: 2 }]));
    expect(r.stdout).toMatch(/kind from the path: prefab/);
    expect(r.ok).toBe(true);
    expect(r.report.checks.no_reserved_words).toBe(true);
  });

  it('takes one-level projectiles and fails a unit made with map materials', () => {
    expect(run(file('src/assets/battle/projectiles/bronze.glb', [{ name: 'arrow', size: 0.08, lods: false }])).ok).toBe(true);
    const unit = run(file('src/assets/units/signature/israel.glb', [{ name: 'spearman', size: 0.3, lods: false }]));
    expect(unit.report.checks.material_names).toBe(false);
    expect(unit.ok).toBe(false);
  });

  it('wants LOD children on kit pieces', () => {
    const r = run(file('src/assets/battle/city/walls-bronze.glb', [{ name: 'wall-straight', size: 1 }, { name: 'tower', size: 0.6, lods: false }]));
    expect(r.report.objects['wall-straight'].missing_lods).toEqual([]);
    expect(r.report.objects.tower.missing_lods).toEqual(['LOD0', 'LOD1', 'LOD2']);
    expect(r.ok).toBe(false);
  });
});

