import { describe, it, expect } from 'vitest';
import { isolateSigned, messageOf } from './messageText';

const L = '⁦'; const P = '⁩';

describe('signed numbers in a Hebrew line (playtest issue 17: "11g+")', () => {
  it('isolates each signed number left to right, only in Hebrew', () => {
    expect(isolateSigned('הכנסות: +11g', 'he')).toBe(`הכנסות: ${L}+11g${P}`);
    expect(isolateSigned('אחזקה: -5g (צבא 5g)', 'he')).toBe(`אחזקה: ${L}-5g${P} (צבא 5g)`);
    expect(isolateSigned('מאז -5000)', 'he')).toBe(`מאז ${L}-5000${P})`);
    expect(isolateSigned('+15%', 'he')).toBe(`${L}+15%${P}`);
    expect(isolateSigned('Income: +11g', 'en')).toBe('Income: +11g');
  });
  it('leaves a dash between numbers and numbers already isolated alone', () => {
    expect(isolateSigned('5-10 תורות', 'he')).toBe('5-10 תורות');
    expect(isolateSigned(`${L}+3${P}`, 'he')).toBe(`${L}+3${P}`);
  });
  it('the income line reads right in Hebrew', () => {
    expect(messageOf('m.turn.income', { gold: 11 }, 'he')).toContain(`${L}+11g${P}`);
  });
});
