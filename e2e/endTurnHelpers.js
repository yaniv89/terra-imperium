// e2e/endTurnHelpers.js
// End Turn is a call to action (src/components/ui/TurnDock.jsx over src/engine/turnBlockers.js):
// while something must be answered it names it and a tap opens it. A scripted playthrough answers
// the usual ones the quick way: an event (its first option), research (the advisor chooses), a
// city with nothing to build (the first item it can build). Anything else stays for the test.
const click = (locator) => locator.dispatchEvent('click');

export const answerBlockers = async (page, rounds = 12) => {
  const btn = page.getByTestId('end-turn');
  for (let i = 0; i < rounds; i++) {
    if (!(await btn.isVisible().catch(() => false))) return;
    if ((await btn.getAttribute('data-mode')) !== 'blocker') return;
    const kind = await btn.getAttribute('data-blocker');
    if (kind === 'event') {
      await click(page.locator('.border-amber-500 button').first());
    } else if (kind === 'research') {
      await click(btn);
      await click(page.getByTestId('research-let-advisor'));
    } else if (kind === 'city') {
      await click(btn);
      await click(page.locator('[data-testid="queue-item"]:not([disabled])').first());
      const close = page.getByRole('button', { name: /^Close/ }).first();
      if (await close.isVisible().catch(() => false)) await click(close);
    } else {
      return;
    }
    await page.waitForTimeout(150);
  }
};

/** Answer what blocks, then press End Turn. */
export const endTurn = async (page) => {
  await answerBlockers(page);
  await click(page.getByTestId('end-turn'));
};
