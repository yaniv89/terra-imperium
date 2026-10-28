// e2e/battle.spec.js
// Playtest audit X15: the tactical battle in a real browser, at the reference phone screen
// (844x390, landscape). Opens the battle sandbox, waits for the first frame, selects the army and
// gives an order through the HUD, checks the sim advances with no page errors, then retreats
// and sees the result screen.
import { test, expect } from '@playwright/test';

const click = (locator) => locator.dispatchEvent('click');

test.describe('tactical battle', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

  test('select, order, advance, retreat, result screen', async ({ page }) => {
    test.setTimeout(260000);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/WebGL|GPU stall|ReadPixels/i.test(msg.text())) errors.push(msg.text()); });
    await page.addInitScript(() => { window.__E2E_BATTLE_TEST__ = true; });

    await page.goto('/?battleSandbox&autostart');
    // The first frame: the sim exposes its tick once the battlefield is up.
    await page.waitForFunction(() => Number.isFinite(window.__battleTest?.tick()), null, { timeout: 60000 });
    const start = page.getByTestId('battle-start');
    await start.waitFor({ state: 'visible', timeout: 30000 });
    await click(start);
    // A fresh device shows the first-battle tips, and they hold the clock until closed (battle-feedback lane).
    await expect(page.getByTestId('battle-coach-hold')).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => window.__battleTest.tick())).toBe(0);
    await click(page.getByTestId('battle-coach-skip'));
    await expect(page.getByTestId('battle-coach')).toBeHidden();
    await page.waitForFunction(() => window.__battleTest?.tick() > 0, null, { timeout: 60000 });

    // Select the whole army, then give an order from the command row.
    await click(page.getByTestId('battle-select-all'));
    await expect(page.getByTestId('battle-selection')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('battle-commands')).toBeVisible();
    await click(page.getByTestId('battle-hold'));
    await expect(page.getByTestId('battle-selection')).toBeVisible();

    // The battle advances.
    const t0 = await page.evaluate(() => window.__battleTest.tick());
    await page.waitForFunction((t) => window.__battleTest?.tick() > t + 20, t0, { timeout: 60000 });

    // Pause menu, then Retreat and confirm. The army walks off at 3x, then the result screen shows.
    await click(page.getByTestId('battle-pause'));
    await click(page.getByTestId('battle-pause-sheet').getByRole('radio', { name: 'Speed 3' }));
    await click(page.getByTestId('battle-leave'));
    await expect(page.getByTestId('battle-retreat-confirm')).toBeVisible();
    await click(page.getByTestId('battle-retreat-all'));
    const resume = page.getByTestId('battle-resume');
    await resume.waitFor({ state: 'visible', timeout: 10000 });
    await click(resume);
    await expect(page.getByTestId('battle-result')).toBeVisible({ timeout: 170000 });
    await expect(page.getByTestId('battle-verdict')).not.toBeEmpty();

    expect(errors).toEqual([]);
  });
});
