import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import StartScreen, { matchPeople, newWorldSeed } from './StartScreen';
import { PEOPLES, PEOPLES_LIST } from '../../data/peoples';

describe('the start screen (phase W0)', () => {
  it('renders the three world sizes as a radio group, Standard checked, and all 150 peoples', () => {
    const html = renderToStaticMarkup(React.createElement(StartScreen, { onStart: vi.fn() }));
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="true"[^>]*data-testid="world-size-standard"/);
    expect(html.match(/data-people="/g)).toHaveLength(150);
    expect(html).toContain('Begin as Akkad');
    expect(html).not.toContain('World seed');
    expect(html).not.toContain('Full world');
  });

  it('keeps Begin out of the scrolling details, pinned under them (plans/ui/fix-mobile, bug 1)', () => {
    const html = renderToStaticMarkup(React.createElement(StartScreen, { onStart: vi.fn() }));
    // the people and the options scroll in their own box; Begin comes after that box closes
    const details = html.indexOf('data-testid="start-details"');
    const begin = html.indexOf('data-testid="begin-game"');
    expect(details).toBeGreaterThan(0);
    expect(begin).toBeGreaterThan(details);
    const between = html.slice(details, begin);
    expect(between).toContain('data-testid="guided-start"');
    expect(html.slice(html.lastIndexOf('<div', details), details)).toMatch(/overflow-y-auto/);
    expect(html.slice(html.lastIndexOf('<button', begin), html.indexOf('>', begin))).toMatch(/shrink-0/);
    // one grid row the height of the screen, so a column never grows past the fold
    expect(html).toContain('sm:grid-rows-[minmax(0,1fr)]');
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
