// The world generator in a browser worker gives the same bytes as in Node (plans/MAP-VARIATIONS-
// PLAN.md 4.4): `/?worldLab` builds seeds 1 to 3 in the worldgen worker and the hashes must equal
// the golden hashes of generator version 2 (the default shape) (src/worldgen/worldgen.test.js). Run it on WebKit too
// when it is installed: the iPhone's engine is the one that matters.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const golden = Object.fromEntries(/continents: \[([^\]]*)\]/.exec(readFileSync('src/worldgen/worldgen.test.js', 'utf8'))[1].split(',').map((h, i) => [String(i + 1), h.trim().replace(/'/g, '')]));

test('a generated world hashes the same in a browser worker as in Node', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/?worldLab&seeds=1,2,3');
  await page.waitForFunction(() => Array.isArray(window.__worldLab), null, { timeout: 200000 });
  const results = await page.evaluate(() => window.__worldLab);
  expect(results.map((r) => [String(r.seed), r.hash])).toEqual(Object.entries(golden));
  results.forEach((r) => expect(r.landFeatures).toBeGreaterThan(0));
});
