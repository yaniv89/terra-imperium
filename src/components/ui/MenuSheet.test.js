// The menu hub (human playtest issue 3): the entries it lists and the handlers they call.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import MenuSheet, { menuEntries } from './MenuSheet';

const handlers = () => ({ save: vi.fn(() => true), load: vi.fn(), help: vi.fn(), glossary: vi.fn(), settings: vi.fn(), title: vi.fn() });

describe('MenuSheet', () => {
  it('lists save, load, help, glossary, settings and back to title; the help view only help and glossary', () => {
    const html = renderToStaticMarkup(React.createElement(MenuSheet, { open: true, onClose: () => {}, on: handlers() }));
    for (const id of ['save', 'load', 'help', 'glossary', 'settings', 'title']) expect(html).toContain(`data-testid="menu-${id}"`);
    expect(html).toContain('data-testid="menu-autosave"');
    expect(html).not.toMatch(/\{turn\}|hub\./);
    const help = renderToStaticMarkup(React.createElement(MenuSheet, { open: true, view: 'help', onClose: () => {}, on: handlers() }));
    expect(help).toContain('menu-help');
    expect(help).toContain('menu-glossary');
    expect(help).not.toContain('menu-save');
    expect(renderToStaticMarkup(React.createElement(MenuSheet, { open: false, onClose: () => {}, on: handlers() }))).toBe('');
  });

  it('each entry runs its own handler (save and load are wired)', () => {
    const on = handlers();
    for (const e of menuEntries('all', on)) e.run();
    for (const fn of Object.values(on)) expect(fn).toHaveBeenCalledTimes(1);
    expect(menuEntries('help', on).map((e) => e.id)).toEqual(['help', 'glossary']);
  });
});
