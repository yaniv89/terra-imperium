import { describe, it, expect } from 'vitest';
import { liveUsd } from './claudeJob.mjs';
import { TOOLS, AREAS, BATTLE_AREAS, BATTLE_SETUPS, SIZES, parseAction, parseFlags, stepWorstUsd, reportWorstUsd, imageTokens, systemPrompt, PERSONAS, isBlankShot, toolsFor, battleUrl } from './human-playtest.mjs';
import sharp from 'sharp';

const mood = { thought: 'the city should open', fun: 3, frustration: 2, area: AREAS[2] };
const use = (name, input) => ({ type: 'tool_use', id: 't', name, input: { ...mood, ...input } });

describe('human-playtest action parser', () => {
  it('maps every tool to its gesture arguments', () => {
    expect(parseAction(use('tap', { x: 100.4, y: 200.6 }))).toMatchObject({ name: 'tap', args: { x: 100, y: 201 }, fun: 3, frustration: 2, area: AREAS[2] });
    expect(parseAction(use('drag', { x1: 0, y1: 0, x2: 843, y2: 389 })).args).toEqual({ x1: 0, y1: 0, x2: 843, y2: 389 });
    expect(parseAction(use('pinch', { x: 400, y: 200, scale: 2 })).args).toEqual({ x: 400, y: 200, scale: 2 });
    expect(parseAction(use('key', { name: 'Escape' })).args).toEqual({ name: 'Escape' });
    expect(parseAction(use('wait', { ms: 2000 })).args).toEqual({ ms: 2000 });
    expect(parseAction(use('note', { kind: 'bug', severity: 3, text: 'End Turn does nothing' })).args).toEqual({ kind: 'bug', severity: 3, text: 'End Turn does nothing' });
    expect(parseAction(use('done', { summary: 'ok' })).name).toBe('done');
  });

  it('refuses taps off the screen, unknown tools, bad keys and bad notes', () => {
    expect(() => parseAction(use('tap', { x: 900, y: 10 }))).toThrow(/outside/);
    expect(parseAction(use('tap', { x: 900, y: 10 }), SIZES.desktop).args.x).toBe(900);
    expect(() => parseAction(use('tap', { x: '5', y: 10 }))).toThrow(/number/);
    expect(() => parseAction(use('pinch', { x: 1, y: 1, scale: 9 }))).toThrow(/scale/);
    expect(() => parseAction(use('key', { name: 'rm -rf' }))).toThrow(/key/);
    expect(() => parseAction(use('note', { kind: 'bug', severity: 5, text: 'x' }))).toThrow(/severity/);
    expect(() => parseAction({ type: 'tool_use', name: 'eval', input: {} })).toThrow(/known/);
    expect(() => parseAction(undefined)).toThrow(/known/);
  });

  it('every tool is strict and asks for thought, fun, frustration and area', () => {
    TOOLS.forEach((t) => {
      expect(t.strict).toBe(true);
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(t.input_schema.required).toEqual(expect.arrayContaining(['thought', 'fun', 'frustration', 'area']));
      expect(Object.keys(t.input_schema.properties).sort()).toEqual([...t.input_schema.required].sort());
    });
    Object.keys(PERSONAS).forEach((p) => expect(systemPrompt(p, SIZES.phone, 'en')).toContain(AREAS[14]));
  });
});

describe('human-playtest spend math', () => {
  it('prices live usage with cache writes at 1.25x and reads at 0.1x', () => {
    expect(liveUsd('claude-sonnet-5-5', { input_tokens: 1e6 })).toBeCloseTo(2);
    expect(liveUsd('claude-sonnet-5-5', { cache_creation_input_tokens: 1e6 })).toBeCloseTo(2.5);
    expect(liveUsd('claude-sonnet-5-5', { cache_read_input_tokens: 1e6 })).toBeCloseTo(0.2);
    expect(liveUsd('claude-opus-5-5', { output_tokens: 1e6 })).toBeCloseTo(20);
    expect(() => liveUsd('claude-unknown', {})).toThrow(/price/);
  });

  it('a step worst case covers two screenshots and max_tokens, and 40 phone steps plus the report fit $1.5', () => {
    expect(imageTokens(SIZES.phone)).toBe(439);
    const one = stepWorstUsd('x'.repeat(8000), SIZES.phone);
    expect(one).toBeGreaterThan(0.04); // 4000 output tokens alone are $0.04
    expect(one).toBeLessThan(0.06);
    expect(stepWorstUsd('', SIZES.desktop)).toBeGreaterThan(stepWorstUsd('', SIZES.phone));
    expect(reportWorstUsd('x'.repeat(40 * 200))).toBeLessThan(0.5);
  });

  it('reads the flags: --limit is MAX_STEPS, hebrew-speaker plays in Hebrew, slices are checked', () => {
    expect(parseFlags(['--max-usd', '1.5', '--limit', '40'], { PERSONA: 'newcomer-phone' })).toMatchObject({ maxSteps: 40, maxUsd: 1.5, sizeId: 'phone', lang: 'en', slices: [] });
    expect(parseFlags([], { PERSONA: 'hebrew-speaker', SIZE: 'desktop' })).toMatchObject({ lang: 'he', size: SIZES.desktop, maxSteps: 60 });
    expect(parseFlags([], { SLICES: 'bronze, modern' }).slices).toEqual(['bronze', 'modern']);
    expect(() => parseFlags([], { SLICES: 'medieval' })).toThrow(/slice/);
    expect(() => parseFlags([], { PERSONA: 'troll' })).toThrow(/persona/);
    expect(() => parseFlags(['--limit', '0'], {})).toThrow(/MAX_STEPS/);
  });
});

describe('human-playtest battle scene', () => {
  it('reads --scene and BATTLE_AGES: all eight ages by default, bad ages and scenes refused, slices ignored', () => {
    expect(parseFlags([], {})).toMatchObject({ scene: 'campaign', battleAges: [] });
    const b = parseFlags(['--scene', 'battle'], { PERSONA: 'battle-commander', SLICES: 'stone' });
    expect(b).toMatchObject({ scene: 'battle', persona: 'battle-commander', slices: [] });
    expect(b.battleAges).toEqual(['stone', 'bronze', 'classical', 'kingdoms', 'gunpowder', 'modern', 'information', 'future']);
    expect(parseFlags([], { SCENE: 'battle', BATTLE_AGES: 'bronze, future' }).battleAges).toEqual(['bronze', 'future']);
    expect(() => parseFlags([], { SCENE: 'battle', BATTLE_AGES: 'iron' })).toThrow(/battle age/);
    expect(() => parseFlags([], { SCENE: 'arena' })).toThrow(/scene/);
  });

  it('opens the sandbox in each age with the setups in turn', () => {
    expect(battleUrl('http://x/terra-imperium/', 'stone', 0)).toBe('http://x/terra-imperium/?battleSandbox&age=stone&fort=0');
    expect(battleUrl('http://x/', 'bronze', 1)).toBe(`http://x/?battleSandbox&age=bronze${BATTLE_SETUPS[1].query}`);
    expect(battleUrl('http://x/?lang=he', 'future', 6)).toBe(`http://x/?lang=he&battleSandbox&age=future${BATTLE_SETUPS[2].query}`);
  });

  it('battle tools and prompt use the battle checklist', () => {
    const area = BATTLE_AREAS[1];
    expect(toolsFor(BATTLE_AREAS)[0].input_schema.properties.area.enum).toEqual(BATTLE_AREAS);
    expect(parseAction(use('tap', { x: 1, y: 1, area }), SIZES.phone, BATTLE_AREAS).area).toBe(area);
    expect(parseAction(use('tap', { x: 1, y: 1, area })).area).toBe(null);
    const p = systemPrompt('rts-commander', SIZES.phone, 'he', 'battle');
    expect(p).toContain('battle sandbox');
    BATTLE_AREAS.forEach((a) => expect(p).toContain(a));
    expect(p).not.toContain(AREAS[0]);
    expect(p).toContain('Hebrew');
  });
});

describe('human-playtest blank screen check', () => {
  const jpg = (raw) => sharp(raw, { raw: { width: 64, height: 32, channels: 3 } }).jpeg().toBuffer();
  it('calls a black screen blank and a drawn one not', async () => {
    expect(await isBlankShot(await jpg(Buffer.alloc(64 * 32 * 3)))).toBe(true);
    const drawn = Buffer.alloc(64 * 32 * 3);
    for (let i = 0; i < drawn.length; i++) drawn[i] = (i * 37) % 256;
    expect(await isBlankShot(await jpg(drawn))).toBe(false);
  });
});
