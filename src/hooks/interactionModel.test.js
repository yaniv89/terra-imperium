// The one priority registry for cards, panels and notices (playtest audit X16, I151 to I153).
import { describe, it, expect } from 'vitest';
import {
  emptyInteractions, openInteraction, closeInteraction, promoteInteraction, tuckInteraction,
  relabelInteraction, shownIds, isShown, waitingChips, PRIORITY, EXCLUSIVE_BELOW_WIDTH
} from './interactionModel';

const WIDE = EXCLUSIVE_BELOW_WIDTH;
const LAPTOP = 1280;
const dock = { id: 'tabs', kind: 'panel', priority: PRIORITY.panel };
const city = { id: 'province', kind: 'panel', priority: PRIORITY.panel };
const event = { id: 'event', kind: 'card', priority: PRIORITY.event, label: 'An event' };
const defense = { id: 'defense', kind: 'card', priority: PRIORITY.defense, label: '1 under attack' };
const report = { id: 'turn-report', kind: 'card', priority: PRIORITY.report, label: 'Turn 12' };
const preBattle = { id: 'pre-battle', kind: 'card', priority: PRIORITY.preBattle, label: 'Attack on Susa' };
const tribute = { id: 'tribute', kind: 'card', priority: PRIORITY.tribute, label: 'Gutium demand tribute' };
const contact = { id: 'contact', kind: 'notice', priority: PRIORITY.notice, label: 'You met Elam' };
// A phone or a tablet (compact) and a desktop at a width.
const phone = (s) => [...shownIds(s, 844, true)].sort();
const desk = (s, w = LAPTOP) => [...shownIds(s, w, false)].sort();
const chips = (s) => waitingChips(s, 844, true).map((c) => c.id);
const run = (...steps) => steps.reduce((s, f) => f(s), emptyInteractions());
const open = (e, o) => (s) => openInteraction(s, e, o);
const close = (id) => (s) => closeInteraction(s, id);

describe('interactionModel, a phone or a tablet', () => {
  it('a card the player opens from a sheet keeps the sheet under it (Invade from the city sheet, lane battle-hud-9)', () => {
    let s = run(open(city, { user: true }), open(preBattle, { user: true, keepOpener: true }));
    expect(phone(s)).toEqual(['pre-battle', 'province']); // the card lives inside the sheet: closing it took the card too
    s = closeInteraction(s, 'pre-battle');
    expect(phone(s)).toEqual(['province']);
    // without the flag (a card the game opens, or any other) the one-thing rule holds
    expect(phone(run(open(city, { user: true }), open(preBattle, { user: true })))).toEqual(['pre-battle']);
  });

  it('shows one thing: a decision that arrives tucks the dock and gives it back', () => {
    let s = run(open(dock, { user: true }), open(tribute));
    expect(phone(s)).toEqual(['tribute']);
    expect(chips(s)).toEqual([]); // a tucked panel has no chip
    s = closeInteraction(s, 'tribute');
    expect(phone(s)).toEqual(['tabs']);
  });

  it('battle arrival, tribute, first contact and an event: one readable card, the rest wait as chips', () => {
    let s = run(open(dock, { user: true }), open(contact), open(tribute), open(preBattle), open(event));
    expect(phone(s)).toEqual(['event']);
    expect(chips(s)).toEqual(['pre-battle', 'tribute', 'contact']);
    s = closeInteraction(s, 'event');
    expect(phone(s)).toEqual(['pre-battle']);
    s = closeInteraction(s, 'tribute'); // answered from somewhere else: the pre-battle card stays
    expect(phone(s)).toEqual(['pre-battle']);
    s = closeInteraction(s, 'pre-battle');
    expect(phone(s)).toEqual(['tabs']);
    s = closeInteraction(s, 'tabs');
    expect(phone(s)).toEqual(['contact']);
  });

  it('an arrival never replaces a card of the same or higher priority', () => {
    const s = run(open(defense), open(preBattle), open({ ...defense, id: 'defense-2' }));
    expect(phone(s)).toEqual(['defense']);
    expect(chips(s)).toEqual(['defense-2', 'pre-battle']);
  });

  it('what the player opens takes the screen, and the card it covered comes back after', () => {
    let s = run(open(defense), open(dock, { user: true }));
    expect(phone(s)).toEqual(['tabs']);
    expect(waitingChips(s, 844, true).map((c) => c.label)).toEqual(['1 under attack']);
    s = closeInteraction(s, 'tabs');
    expect(phone(s)).toEqual(['defense']);
  });

  it('a card set aside stays a chip until it is asked for', () => {
    let s = run(open(dock, { user: true }), open(defense), (x) => tuckInteraction(x, 'defense'));
    expect(phone(s)).toEqual(['tabs']);
    s = closeInteraction(s, 'tabs');
    expect(phone(s)).toEqual([]);
    expect(chips(s)).toEqual(['defense']);
    s = promoteInteraction(s, 'defense');
    expect(phone(s)).toEqual(['defense']);
  });

  it('a notice does not take the screen from an open panel', () => {
    const s = run(open(dock, { user: true }), open(contact));
    expect(phone(s)).toEqual(['tabs']);
    expect(chips(s)).toEqual(['contact']);
  });

  it('closing something that waits leaves the active one alone', () => {
    expect(phone(run(open(event), open(tribute), close('tribute')))).toEqual(['event']);
  });
});

describe('interactionModel, a desktop or laptop (as before the registry)', () => {
  it('the two side panels take turns below the wide width and share a wide screen', () => {
    const s = run(open(dock, { user: true }), open(city, { user: true }));
    expect(desk(s)).toEqual(['province']);
    expect(desk(closeInteraction(s, 'province'))).toEqual(['tabs']);
    expect(desk(promoteInteraction(s, 'tabs'))).toEqual(['tabs']);
    expect(desk(s, WIDE)).toEqual(['province', 'tabs']);
  });

  it('a card sits beside the open dock instead of tucking it', () => {
    const s = run(open(dock, { user: true }), open(tribute));
    expect(desk(s)).toEqual(['tabs', 'tribute']);
  });

  it('the attack to answer and the turn report show together; an arrival waits for both', () => {
    let s = run(open(report), open(defense), open(preBattle), open(tribute));
    expect(desk(s)).toEqual(['defense', 'turn-report']);
    expect(waitingChips(s, LAPTOP, false).map((c) => c.id)).toEqual(['pre-battle', 'tribute']);
    s = run(() => s, close('defense'), close('turn-report'));
    expect(desk(s)).toEqual(['pre-battle']);
    expect(desk(closeInteraction(s, 'pre-battle'))).toEqual(['tribute']);
  });

  it('a sheet the player opened shows with the pressing card it was opened over', () => {
    const settings = { id: 'settings', kind: 'card', priority: PRIORITY.sheet, label: 'Settings' };
    const s = run(open(defense), open(settings, { user: true }));
    expect(desk(s)).toEqual(['defense', 'settings']);
  });

  it('a notice shows beside a panel and waits for a card', () => {
    expect(desk(run(open(dock, { user: true }), open(contact)))).toEqual(['contact', 'tabs']);
    expect(desk(run(open(contact), open(tribute)))).toEqual(['tribute']);
  });
});

describe('interactionModel, bookkeeping', () => {
  it('an unknown id shows (it has not registered yet), a registered one follows the rules', () => {
    const s = run(open(event), open(tribute));
    expect(isShown(s, 'nobody', 844, true)).toBe(true);
    expect(isShown(s, 'tribute', 844, true)).toBe(false);
    expect(isShown(s, 'event', 844, true)).toBe(true);
  });

  it('opening again keeps the place in line; relabel changes only the words', () => {
    let s = run(open(event), open(tribute), open(tribute));
    expect(s.entries.length).toBe(2);
    expect(relabelInteraction(s, 'tribute', { label: tribute.label })).toBe(s);
    s = relabelInteraction(s, 'tribute', { label: 'Two demands' });
    expect(waitingChips(s, 844, true)[0].label).toBe('Two demands');
    expect(closeInteraction(s, 'nobody')).toBe(s);
  });
});

describe('corner sheets (H-18)', () => {
  const army = { id: 'army-sheet', kind: 'panel', priority: PRIORITY.panel };
  const tile = { id: 'tile-sheet', kind: 'panel', priority: PRIORITY.panel };
  it('on a phone the army card replaces the Research dock, and the dock is back when it closes', () => {
    const s = run(open(dock, { user: true }), open(army, { user: true }));
    expect(phone(s)).toEqual(['army-sheet']);
    expect(phone(close('army-sheet')(s))).toEqual(['tabs']);
  });
  it('a tile sheet and an army card never show together on a phone, the newest wins', () => {
    const s = run(open(tile, { user: true }), open(army, { user: true }));
    expect(phone(s)).toEqual(['army-sheet']);
  });
});
