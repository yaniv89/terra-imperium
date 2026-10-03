// e2e/guidedStart.spec.js
// The guided Dawn start as Egypt (plans/civ-map-rework.md E9): the start screen's guided button
// opens a game as Egypt whose next-prompt pill shows the guide's first step, and one turn later
// the guide is still there (it ends after ten turns or when every step is done).
import { test, expect } from '@playwright/test';

const click = (locator) => locator.dispatchEvent('click');

test('the guided start plays as Egypt with the guide in the next prompt', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; });
  await page.goto('/');
  await click(page.getByTestId('guided-start'));
  const prompt = page.getByTestId('next-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveAttribute('data-kind', 'guide');
  await expect(prompt).toContainText('Guide 1/6');
  const firstOption = page.locator('.border-amber-500 button').first();
  while (await firstOption.isVisible().catch(() => false)) { await click(firstOption); await page.waitForTimeout(50); }
  await click(page.getByRole('button', { name: 'End Turn' }));
  await expect(prompt).toHaveAttribute('data-kind', 'guide');
  expect(errors).toEqual([]);
});
