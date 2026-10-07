// A game on a generated world from the start screen (plans/MAP-VARIATIONS-PLAN.md MV5): the World
// step's Map block, Generated world, a shape, Begin; the page boots into that world, turns pass with
// no console errors, and a reload comes back to the same world and the same turn.
import { test, expect } from '@playwright/test';
import { endTurn } from './endTurnHelpers';
import { beginGame } from './startHelpers';

const click = (locator) => locator.dispatchEvent('click');
const resolveAnyPendingEvent = async (page) => {
  const firstOption = page.locator('.border-amber-500 button').first();
  while (await firstOption.isVisible().catch(() => false)) { await click(firstOption); await page.waitForTimeout(50); }
};

test('a generated world: chosen on the start screen, played for turns, saved and reloaded', async ({ page }) => {
  test.setTimeout(300000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; });
  await page.goto('/?generatedWorlds');
  const people = page.locator('[data-people]');
  await people.first().waitFor({ state: 'attached', timeout: 60000 });
  await click(people.first());
  await click(page.getByTestId('start-step-world'));
  await click(page.getByTestId('map-generated'));
  await click(page.getByTestId('map-shape').getByRole('button', { name: 'Pangaea' }));
  await expect(page.getByTestId('map-preview-status')).toContainText('continent', { timeout: 120000 });
  const code = await page.getByTestId('map-code').textContent();
  expect(code).toMatch(/^G2-30-AT-NP-/);
  await beginGame(page);

  // the page reloads into the generated world, then the game starts
  const yearLabel = page.locator('header').getByText(/^-?\d+ (BCE|CE)$/);
  await expect(yearLabel).toBeVisible({ timeout: 180000 });
  const world = await page.evaluate(() => JSON.parse(localStorage.getItem('terra-imperium-world') || 'null'));
  expect(world).toMatchObject({ kind: 'generated', generatorVersion: 2, params: { shape: 'pangaea' } });
  const startYear = await yearLabel.textContent();
  for (let i = 0; i < 5; i++) { await resolveAnyPendingEvent(page); await endTurn(page); }
  const year = await yearLabel.textContent();
  expect(year).not.toBe(startYear);

  // the autosave brings the same world and turn back after a reload
  await page.reload();
  const continueBtn = page.getByRole('button', { name: /^Continue/ });
  if (await continueBtn.isVisible({ timeout: 30000 }).catch(() => false)) await click(continueBtn);
  await expect(yearLabel).toHaveText(year, { timeout: 180000 });
  const again = await page.evaluate(() => JSON.parse(localStorage.getItem('terra-imperium-world') || 'null'));
  expect(again.seed).toBe(world.seed);
  expect(errors, errors.join('\n')).toEqual([]);
});
