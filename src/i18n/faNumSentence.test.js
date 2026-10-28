// src/i18n/faNumSentence.test.js
// fa-num forces left to right, so a whole translated sentence inside it reads backwards in Hebrew
// ("2,200 2,200 מתוך", lead check 28 Oct). Only the number itself may carry fa-num; t() already
// isolates signed numbers in Hebrew.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// an element whose className has fa-num and whose first child is a t(...) call (or a ternary of them)
const WRAPPED = /className=(?:"[^"]*|\{`[^`]*|\{[^}]*)\bfa-num\b[^<]*?>\s*\{\s*(?:[^{}]*\?\s*)?t\(/g;
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.jsx') ? [p] : [];
});

describe('fa-num wraps numbers, never a translated sentence', () => {
  it('no element with fa-num starts with a t() call', () => {
    const hits = walk('src').flatMap((f) => {
      const s = readFileSync(f, 'utf8');
      return [...s.matchAll(WRAPPED)].map((m) => `${f}:${s.slice(0, m.index).split('\n').length}`);
    });
    expect(hits).toEqual([]);
  });
  it('the pattern catches the old result screen line', () => {
    const old = `<span className="fa-num">{t('bt.result.ofMen', { a: 1, b: 2 })}</span>`;
    expect(old.match(WRAPPED)).not.toBeNull();
    expect(`<span className="fa-num">{menText(n)}</span>`.match(WRAPPED)).toBeNull();
  });
});
