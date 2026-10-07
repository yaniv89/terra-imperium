// e2e/landscape.spec.js
// Phones play in landscape (src/hooks/useLayoutMode.js): a slim top bar, a tab rail on the right
// edge with docked panels beside it, the map kept usable in the middle. A phone held upright plays
// the empire view (map on top, half sheets below) with a soft, dismissible hint to turn the phone.
import { test, expect } from '@playwright/test';
import { answerBlockers } from './endTurnHelpers';
import { beginGame } from './startHelpers';

// See playability.spec.js: dispatchEvent avoids simulated pointer travel across the WebGL globe.
const click = (locator) => locator.dispatchEvent('click');

const startGame = async (page, nation = 'Akkad') => {
  await page.fill('input[aria-label="Search peoples"]', nation);
  const nationButtons = page.locator('[data-people]');
  await click(nationButtons.first());
  await beginGame(page);
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
};

const box = (locator) => locator.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
});

test.describe('phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('slim top bar, tab rail and docked panels leave the map usable', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; });
    await page.goto('/');
    await expect(page.getByTestId('rotate-overlay')).toHaveCount(0);
    await startGame(page);

    expect(await page.evaluate(() => document.documentElement.dataset.layout)).toBe('phone-landscape');

    // One slim top bar (plans/UI-DESIGN.md: 36 px), End Turn bottom right in thumb reach, left of the rail.
    const header = page.locator('header');
    await expect(header).toBeVisible();
    expect((await box(header)).height).toBeLessThanOrEqual(52);
    const endTurn = page.getByTestId('end-turn');
    const et = await box(endTurn);
    expect(et.right).toBeLessThanOrEqual(844 - 52);
    expect(et.bottom).toBeLessThanOrEqual(390);
    expect(et.top).toBeGreaterThanOrEqual(390 / 2);
    expect(et.height).toBeGreaterThanOrEqual(44);

    // The rail sits on the right edge; no bottom tab bar, no floating log button.
    const rail = page.getByTestId('landscape-rail');
    await expect(rail).toBeVisible();
    const railBox = await box(rail);
    expect(railBox.right).toBeGreaterThanOrEqual(843);
    expect(railBox.width).toBeLessThanOrEqual(70);
    await expect(page.getByRole('button', { name: 'Open event log' })).toHaveCount(1);

    // A tab docks its panel beside the rail; the map keeps at least 40% of the width.
    await click(rail.getByRole('button', { name: 'Empire' }));
    await expect(page.getByTestId('landscape-dock')).toBeVisible();
    const docked = await box(rail);
    expect(844 - docked.width).toBeGreaterThanOrEqual(844 * 0.4);
    // Tapping the open tab again closes it.
    await click(rail.getByRole('button', { name: 'Empire' }));
    await expect(page.getByTestId('landscape-dock')).toHaveCount(0);

    // The log opens as a side panel from the rail.
    await click(page.getByRole('button', { name: 'Open event log' }));
    const closeLog = page.getByRole('button', { name: 'Close log' }).first();
    await expect(closeLog).toBeVisible();
    await click(closeLog);

    // A turn still plays.
    const year = header.getByText(/^-?\d+ (BCE|CE)$/);
    const before = await year.textContent();
    await answerBlockers(page); // End Turn names what must be answered first (endTurnHelpers.js)
    await click(endTurn);
    // The first turn may still wait for the turn worker to load its engine (prewarmed by TurnDock).
    await expect(year).not.toHaveText(before, { timeout: 30000 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(844);
    expect(errors).toEqual([]);
  });
});

test.describe('phone held upright', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('asks to rotate on every screen, the map included', async ({ page }) => {
    await page.goto('/');
    // The layout is set once the app's code has loaded (after the world grid): wait for it.
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.layout), { timeout: 60000 }).toBe('phone-portrait');
    const gate = page.getByTestId('rotate-gate');
    await expect(gate).toBeVisible();
    await expect(gate).toContainText('Rotate your phone to play');
  });
});

test.describe('tablet held sideways', () => {
  test.use({ viewport: { width: 960, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('the landscape shell with a wider dock', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; });
    await page.goto('/');
    await startGame(page);
    expect(await page.evaluate(() => document.documentElement.dataset.layout)).toBe('tablet');
    const rail = page.getByTestId('landscape-rail');
    await expect(rail).toBeVisible();
    await click(rail.getByRole('button', { name: 'Empire' }));
    const dock = page.getByTestId('landscape-dock');
    await expect(dock).toBeVisible();
    expect((await box(dock)).width).toBeGreaterThanOrEqual(400);
    expect(960 - (await box(rail)).width).toBeGreaterThanOrEqual(960 * 0.4);
    await click(rail.getByRole('button', { name: 'Empire' }));
    await expect(dock).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(960);
    expect(errors).toEqual([]);
  });
});
