// e2e/stoneStart.spec.js
// Eight ages plan U46: a new game on the phone (844x390) starts in the Stone Age as a band, picks
// its first research and founds its first village from the band prompt.
import { test, expect } from '@playwright/test';
import { beginGame } from './startHelpers';

const click = (locator) => locator.dispatchEvent('click');

test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

test('Stone start on the phone: research, then the band founds a village', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; });
  await page.goto('/');
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await beginGame(page);
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  expect(await page.evaluate(() => document.documentElement.dataset.age)).toBe('stone');

  // The research sheet asks first; the advisor picks a Stone tech.
  await page.getByTestId('research-let-advisor').waitFor({ timeout: 30000 });
  await click(page.getByTestId('research-let-advisor'));

  // The band waits in the idle chip (armies and settlers, promptStack.js): tap through to its tile
  // and found the village there.
  const idle = page.getByTestId('idle-chip');
  const found = page.getByTestId('found-city');
  await idle.waitFor({ timeout: 30000 });
  const idleBefore = Number(await idle.getAttribute('data-count'));
  for (let i = 0; i < 4 && !(await found.isVisible().catch(() => false)); i++) { await click(idle); await page.waitForTimeout(500); }
  await expect(found).toBeEnabled({ timeout: 30000 });
  await click(found);
  // The band is gone into its village: one idle unit fewer, no found button left, and the village
  // makes science.
  await expect(found).toHaveCount(0, { timeout: 30000 });
  if (await idle.count()) expect(Number(await idle.getAttribute('data-count'))).toBeLessThan(idleBefore);
  await expect(page.getByRole('button', { name: /^Science [1-9][0-9]* a turn/ })).toBeVisible();
  expect(errors).toEqual([]);
});
