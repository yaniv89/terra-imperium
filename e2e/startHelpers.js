// e2e/startHelpers.js
// The start screen (src/components/ui/StartScreen.jsx) has four steps and Begin only on the last
// one (Ready): go Next through to Ready, then Begin. dispatchEvent clicks, as the specs use (no
// simulated pointer travel across the WebGL map).

/** Press Next until the start screen is on Ready. */
export const goToReady = async (page) => {
  const screen = page.getByTestId('start-screen');
  for (let i = 0; i < 4; i++) {
    const step = await screen.getAttribute('data-step');
    if (step === 'ready') return;
    await page.getByTestId('start-next').dispatchEvent('click');
    await page.locator(`[data-testid="start-screen"]:not([data-step="${step}"])`).waitFor({ timeout: 10000 });
  }
  await page.locator('[data-testid="start-screen"][data-step="ready"]').waitFor({ timeout: 10000 });
};

/** Go to Ready and press Begin (`name`: the button's name, by default any "Begin as ..."). */
export const beginGame = async (page, name = /^Begin as/) => {
  await goToReady(page);
  await page.getByRole('button', { name }).dispatchEvent('click');
};

/** A new game starts in the Stone Age as a band with no city (eight ages plan U46): let the
 *  advisor pick research, then tap through the idle chip to the band and found the first village. */
export const foundFirstCity = async (page) => {
  const click = (locator) => locator.dispatchEvent('click');
  const advisor = page.getByTestId('research-let-advisor');
  await advisor.waitFor({ timeout: 30000 }).catch(() => {});
  if (await advisor.isVisible().catch(() => false)) await click(advisor);
  const idle = page.getByTestId('idle-chip');
  const found = page.getByTestId('found-city');
  await idle.waitFor({ timeout: 30000 });
  for (let i = 0; i < 4 && !(await found.isVisible().catch(() => false)); i++) { await click(idle); await page.waitForTimeout(500); }
  await found.waitFor({ timeout: 30000 });
  await click(found);
  await found.waitFor({ state: 'detached', timeout: 30000 });
  // the tile's sheet stays open over the new village: close it so the map is clear
  const close = page.getByRole('button', { name: 'Close', exact: true }).first();
  if (await page.getByTestId('tile-yields').isVisible().catch(() => false)) await click(close);
};
