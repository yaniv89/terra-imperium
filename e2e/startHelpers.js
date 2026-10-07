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
