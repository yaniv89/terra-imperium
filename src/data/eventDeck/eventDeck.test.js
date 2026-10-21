import { describe, it, expect } from 'vitest';
import { STORIES } from './stories';
import { DECK_DRAWS, DECK_LINKS, linkId } from './index';
import { CARDS, drawCard } from '../../engine/eventDeck';
import { factsUsed, FACTS } from '../../engine/predicates';
import { AGE_ORDER, getAgeIndex } from '../ages';
import { dataTable } from '../../i18n/core';
import { peoplesWorld } from '../../engine/testWorld';
import { AI_DRAWS } from '../eventsAi';
import { PEOPLES } from '../peoples';
import { createRng } from '../../utils/rng';

const he = dataTable('he');
const keyOf = (s, i) => (i === 0 ? `pevt.${s.id}` : `evt.${linkId(s, i)}`);

describe('event deck stories (U27)', () => {
  it('holds 15 stories of four cards, with every age covered, the Stone Age included', () => {
    expect(STORIES).toHaveLength(15);
    STORIES.forEach((s) => expect(s.cards, s.id).toHaveLength(4));
    AGE_ORDER.slice(0, 6).forEach((a) => expect(STORIES.some((s) => s.ages[0] === a), a).toBe(true));
  });

  it('openers use known facts and ages, and every link resolves to a card', () => {
    DECK_DRAWS.forEach((d) => {
      factsUsed(d.requires).forEach((f) => expect(FACTS[f], f).toBeTypeOf('function'));
      expect(CARDS[d.id].kind).toBe('draw');
    });
    STORIES.forEach((s) => s.ages.forEach((a) => expect(getAgeIndex(a)).toBeGreaterThanOrEqual(0)));
    const targets = [...DECK_DRAWS.map((d) => d.build({}, null, { name: 'X' })), ...Object.values(DECK_LINKS)]
      .flatMap((c) => c.options.map((o) => o.effects.spawnFollowUp?.id)).filter(Boolean);
    targets.forEach((id) => expect(CARDS[id]?.kind, id).toBe('link'));
    // each story reaches its last card through the first option of each card
    STORIES.forEach((s) => {
      expect(s.cards.at(-1).options.every((o) => !o.to), s.id).toBe(true);
      s.cards.slice(0, -1).forEach((c) => expect(c.options[0].to, `${s.id} ${c.title}`).toBeGreaterThan(0));
    });
  });

  it('every card has plain English with no em dash, and Hebrew with the same option count', () => {
    STORIES.forEach((s) => s.cards.forEach((c, i) => {
      expect(`${c.title}${c.desc}${c.options.map((o) => o.label).join('')}`, s.id).not.toMatch(/[—–]/);
      expect(he[`${keyOf(s, i)}.title`], keyOf(s, i)).toBeDefined();
      expect(he[`${keyOf(s, i)}.desc`], keyOf(s, i)).toBeDefined();
      c.options.forEach((_, k) => expect(he[`${keyOf(s, i)}.opt${k}`], `${keyOf(s, i)}.opt${k}`).toBeDefined());
      expect(he[`${keyOf(s, i)}.opt${c.options.length}`]).toBeUndefined();
    }));
  });

  it('an opener never comes twice, and names its city', () => {
    const state = { ...peoplesWorld({ seed: 5 }), turnNumber: 50 };
    const seen = [];
    for (let seed = 0; seed < 300; seed++) {
      const e = drawCard({ ...state, eventHistory: Object.fromEntries(seen.map((id) => [`t:${id}`, 0])) }, createRng(seed));
      if (e && DECK_DRAWS.some((d) => d.id === e.templateId)) { expect(seen).not.toContain(e.templateId); seen.push(e.templateId); expect(e.cityId).toBeDefined(); }
    }
  });

  it('the 612 AI cards have Hebrew, safe effects, and only reach their theme', () => {
    expect(AI_DRAWS).toHaveLength(612);
    AI_DRAWS.forEach((d) => {
      const e = d.build();
      expect(he[`pevt.${d.id}.title`], d.id).toBeDefined();
      e.options.forEach((o, k) => {
        expect(he[`pevt.${d.id}.opt${k}`], d.id).toBeDefined();
        expect(o.effects.diplomacyPoints).toBeUndefined();
        expect(o.effects.gold ?? 0).toBeLessThanOrEqual(200);
        expect(o.effects.hr ?? 0).toBeLessThanOrEqual(60);
      });
    });
    const state = { ...peoplesWorld({ seed: 5 }), turnNumber: 50 };
    const theme = PEOPLES[state.playerNationId]?.theme;
    for (let seed = 0; seed < 200; seed++) {
      const e = drawCard(state, createRng(seed));
      const ai = e && AI_DRAWS.find((d) => d.id === e.templateId);
      if (ai) expect(ai.theme).toBe(theme);
    }
  });
});
