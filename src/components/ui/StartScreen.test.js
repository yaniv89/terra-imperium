import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import StartScreen, { matchPeople, newWorldSeed, startKeyAction, START_STEPS } from './StartScreen';
import { PEOPLES, PEOPLES_LIST } from '../../data/peoples';

const render = () => renderToStaticMarkup(React.createElement(StartScreen, { onStart: vi.fn() }));
// The markup of one step's panel (the panels are siblings, so the next panel or the footer ends it).
const panel = (html, id) => {
  const at = html.indexOf(`data-step-panel="${id}"`);
  const start = html.lastIndexOf('<section', at);
  const ends = START_STEPS.map((s) => html.indexOf(`data-step-panel="${s.id}"`)).filter((i) => i > at).map((i) => html.lastIndexOf('<section', i));
  return html.slice(start, ends.length ? Math.min(...ends) : html.indexOf('<footer'));
};

describe('the start screen in steps (W01, plans/UI-DESIGN.md section 8)', () => {
  it('opens on step 1 with the people, every other step mounted but hidden', () => {
    const html = render();
    expect(html).toContain('data-step="people"');
    expect(html.match(/data-people="/g)).toHaveLength(150);
    expect(panel(html, 'people')).not.toMatch(/^<section hidden/);
    for (const id of ['world', 'rules', 'ready']) expect(panel(html, id)).toMatch(/^<section hidden=""/);
    // the step indicator: four buttons, the first is the current step
    expect(html.match(/data-testid="start-step-/g)).toHaveLength(4);
    expect(html).toMatch(/aria-current="step"[^>]*data-testid="start-step-people"/);
    expect(html).not.toContain('World seed');
    expect(html).not.toContain('Full world');
  });

  it('keeps the fast path: Begin as the default people, and the guided start, on step 1', () => {
    const html = render();
    expect(html.match(/Begin as /g)).toHaveLength(1);
    expect(html).toContain('Begin as Akkad');
    expect(html).toContain('data-testid="start-next"');
    expect(html).not.toContain('data-testid="start-back"');
    const people = panel(html, 'people');
    expect(people).toContain('data-testid="guided-start"');
    expect(people).toContain('aria-label="Search peoples"');
    expect(people).toContain('Standard world, Normal speed, Prince.');
    // Begin sits in the bar under the steps, never inside a scrolling step
    expect(html.indexOf('data-testid="begin-game"')).toBeGreaterThan(html.indexOf('<footer'));
  });

  it('puts the map and the world size in World, speed, difficulty and Explored world in Rules', () => {
    const html = render();
    const world = panel(html, 'world');
    expect(world).toContain('data-testid="map-earth"');
    expect(world).toMatch(/aria-checked="true"[^>]*data-testid="world-size-standard"/);
    expect(world.match(/role="radio"/g)).toHaveLength(5); // the map (Real Earth, Generated world) and the three sizes
    const rules = panel(html, 'rules');
    expect(rules).toMatch(/aria-checked="true"[^>]*data-testid="game-speed-normal"/);
    expect(rules).toMatch(/aria-pressed="true"[^>]*data-testid="difficulty-prince"/);
    expect(rules).toContain('data-testid="explored-world"');
    const ready = panel(html, 'ready');
    for (const key of ['map', 'world', 'speed', 'difficulty', 'explored']) expect(ready).toContain(`data-summary="${key}"`);
  });

  it('Enter goes on and Escape goes back, except in a field or on a button', () => {
    const div = { tagName: 'DIV' };
    expect(startKeyAction('Enter', div)).toBe('next');
    expect(startKeyAction('Escape', div)).toBe('back');
    expect(startKeyAction('Enter', { tagName: 'INPUT' })).toBe(null);
    expect(startKeyAction('Escape', { tagName: 'INPUT' })).toBe(null);
    expect(startKeyAction('Enter', { tagName: 'BUTTON' })).toBe(null);
    expect(startKeyAction('Escape', { tagName: 'BUTTON' })).toBe('back');
    expect(startKeyAction('Enter', div, { modifier: true })).toBe(null);
    expect(startKeyAction('a', div)).toBe(null);
  });

  it('search matches the name, the capital and the modern land', () => {
    const found = (q) => PEOPLES_LIST.filter((p) => matchPeople(p, q)).map((p) => p.id);
    expect(found('iraq')).toContain('akkad');
    expect(found('jerusalem')).toEqual(['israel']);
    expect(found('Akkad')).toContain('akkad');
    expect(matchPeople(PEOPLES.akkad, '')).toBe(true);
  });

  it('draws a fresh 32-bit world seed', () => {
    const a = newWorldSeed();
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(2 ** 32);
  });
});
