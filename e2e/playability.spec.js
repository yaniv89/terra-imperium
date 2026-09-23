// e2e/playability.spec.js
// Plan §13's "Playability" check: "Playwright run per phase — start as a randomly chosen
// country, take 10 turns, assert no errors and that resources/age/turn advance correctly." This
// was previously only ever run ad hoc during development and never committed, so nothing actually
// guarded against a real-browser regression (a crash on mount, a broken start-screen flow, an
// event modal silently blocking every future turn) the way the pure-engine test suite can't.
//
// TURNS_TO_PLAY is 3, not the plan's literal 10 — a real, diagnosed constraint, not an arbitrary
// cut corner. Root cause (Task 48's investigation): GlobeView.jsx's globe auto-rotates by default
// (a deliberate, reduced-motion-respecting "alive menu" touch), and under headless/software-
// rendered (SwiftShader) Chromium the continuous full-scene redraw of 4,482 province polygons this
// causes gets measurably slower and eventually unstable the longer it runs (confirmed via a trace:
// "GL Driver Message... GPU stall due to ReadPixels"; reproduced on GitHub Actions' own runners
// too, not just a dev sandbox) — a synchronous layout query as ordinary as `locator.boundingBox()`
// on the live canvas can hang and take the page down with it. window.__E2E_DISABLE_GLOBE_AUTOROTATE__
// (set below, read by GlobeView.jsx) removes the auto-rotate contribution to that without touching
// prefers-reduced-motion (which would also disable the whole animation-effects overlay, defeating
// tests that verify one). It measurably helps but does NOT eliminate the underlying cost — even a
// perfectly static camera still redraws 4,482 polygons every animation frame, confirmed to take
// over a second per frame under this rendering path regardless of camera movement — so TURNS_TO_PLAY
// stays conservative rather than assuming the flag alone makes a long run safe.
import { test, expect } from '@playwright/test';

const TURNS_TO_PLAY = 3;

// dispatchEvent('click') rather than .click() throughout this file: the globe hit-tests every real
// pointer move against thousands of province polygons, and a real .click() first simulates the
// cursor traveling across the page — even a straight line from wherever the mouse last was to a
// header/modal button routinely crosses the visible globe on the way, and under headless/
// software-rendered WebGL that hover cost alone was enough to blow past reasonable timeouts.
// dispatchEvent fires the same click the button's onClick handler sees, with no pointer travel.
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

test('a randomly chosen nation can play several turns with no console errors and visible progress', async ({ page }) => {
  // Generous, not a strict SLA — see the file header on why headless WebGL rendering needs real
  // breathing room here even for a small number of turns.
  test.setTimeout(120000);
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  // See the file header — disables the globe's auto-rotate for this run without touching
  // prefers-reduced-motion, which would also disable the effects overlay this suite might later
  // want to assert on. Must be set before goto() so it exists before the app's own scripts run.
  await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; });
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
  let finalYear = initialYear;
  for (let i = 0; i < TURNS_TO_PLAY; i++) {
    await resolveAnyPendingEvent(page);
    await click(endTurnButton);
    finalYear = await yearLabel.textContent();
  }

  expect(finalYear, `the calendar year never advanced across ${TURNS_TO_PLAY} turns`).not.toBe(initialYear);

  expect(consoleErrors, `browser console/page errors during play:\n${consoleErrors.join('\n')}`).toEqual([]);
});
