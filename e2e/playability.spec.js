// e2e/playability.spec.js
// Plan §13's "Playability" check: "Playwright run per phase — start as a randomly chosen
// country, take 10 turns, assert no errors and that resources/age/turn advance correctly." This
// was previously only ever run ad hoc during development and never committed, so nothing actually
// guarded against a real-browser regression (a crash on mount, a broken start-screen flow, an
// event modal silently blocking every future turn) the way the pure-engine test suite can't.
//
// Deliberately never imports app source (e.g. WORLD_NATIONS) — this file runs under Playwright's
// own Node process, not through Vite, so it doesn't get Vite's JSON-import handling the app code
// relies on. Instead it picks randomly among whatever the start screen actually renders, which is
// arguably a more honest "real browser" check anyway.
import { test, expect } from '@playwright/test';

const TURNS_TO_PLAY = 10;

// dispatchEvent('click') rather than .click() throughout this file: the globe (react-globe.gl)
// hit-tests every real pointer move against thousands of province polygons, and a real .click()
// first simulates the cursor traveling across the page — even a straight line from wherever the
// mouse last was to a header/modal button routinely crosses the visible globe on the way. Under
// this sandbox's software-rendered headless WebGL that hover cost is severe enough (confirmed via
// a trace screencast: the app itself was never actually stuck, just too slow to answer Playwright's
// own actionability checks in time) to blow well past any reasonable timeout. dispatchEvent fires
// the same click the button's onClick handler sees, with no synthetic pointer travel at all.
const click = (locator) => locator.dispatchEvent('click');

// A scripted or procedural event can land on any turn, including the very first — its modal
// disables End Turn until resolved (GameHeader.jsx), so a real playthrough (human or this test)
// has to clear it before advancing again. Always picks the first option; which one is irrelevant
// here, only that play can continue.
const resolveAnyPendingEvent = async (page) => {
  const firstOption = page.locator('.border-amber-500 button').first();
  while (await firstOption.isVisible().catch(() => false)) {
    await click(firstOption);
    await page.waitForTimeout(50);
  }
};

test('a randomly chosen nation can play 10 turns with no console errors and visible progress', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('/');

  // 240 real nations, per plan §1 — any one of them has to be a valid, playable start. Picks
  // randomly among whatever the start screen actually renders (unsearched, so all 240 are there).
  const nationButtons = page.locator('section', { has: page.getByRole('heading', { name: 'Choose Your Nation' }) }).locator('button');
  const nationCount = await nationButtons.count();
  expect(nationCount, 'the start screen rendered no nation buttons at all').toBeGreaterThan(0);
  const nationButton = nationButtons.nth(Math.floor(Math.random() * nationCount));
  const nationName = (await nationButton.textContent()).trim();
  await click(nationButton);
  await click(page.getByRole('button', { name: `Begin as ${nationName}` }));

  const yearLabel = page.locator('header').getByText(/^-?\d+ (BCE|CE)$/);
  await expect(yearLabel).toBeVisible();
  const initialYear = await yearLabel.textContent();

  const endTurnButton = page.getByRole('button', { name: 'End Turn' });
  for (let i = 0; i < TURNS_TO_PLAY; i++) {
    await resolveAnyPendingEvent(page);
    await click(endTurnButton);
  }
  await resolveAnyPendingEvent(page);

  const finalYear = await yearLabel.textContent();
  expect(finalYear, 'the calendar year never advanced across 10 turns').not.toBe(initialYear);

  expect(consoleErrors, `browser console/page errors during play:\n${consoleErrors.join('\n')}`).toEqual([]);
});
