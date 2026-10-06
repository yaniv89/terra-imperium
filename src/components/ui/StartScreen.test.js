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
