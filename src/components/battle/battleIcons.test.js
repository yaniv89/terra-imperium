// I186: every picture the build sheet shows is asked for when the battle opens; I185: why a unit
// cannot be queued is said with the same checks as the battle's order.
import { describe, it, expect } from 'vitest';
import { battleIconUrls } from './battleIcons';
import { trainBlock, stockAfter } from './EconomyHud';
import { buildableFor, BUILDINGS, QUEUE_MAX } from '../../battle/data/economy';
import { iconUrl } from '../../data/icons';

describe('battle icons and training words', () => {
  it('preloads every build tile of the age, the four stocks and the glyphs', () => {
    const urls = battleIconUrls('bronze');
    buildableFor('bronze').forEach((id) => expect(urls).toContain(iconUrl('battle', BUILDINGS[id].icon)));
    ['stock-food', 'stock-wood', 'stock-stone', 'stock-gold', 'close', 'stop-working'].forEach((id) => expect(urls).toContain(iconUrl('battle', id)));
  });

  it('a full queue and a shortfall are said', () => {
    expect(trainBlock('infantry', [100, 100, 0, 0], 0)).toBeNull();
    expect(trainBlock('infantry', [100, 10, 0, 0], 0)).toBe('Needs 20 more wood');
    expect(trainBlock('infantry', [100, 100, 0, 0], QUEUE_MAX)).toBe(`The queue is full (${QUEUE_MAX})`);
  });

  it('orders waiting for Resume are counted against the stock (RTS-03)', () => {
    expect(stockAfter([200, 100, 0, 0], ['infantry', 'worker'])).toEqual([90, 70, 0, 0]);
    expect(stockAfter([200, 100, 0, 0])).toEqual([200, 100, 0, 0]);
    expect(trainBlock('infantry', stockAfter([100, 100, 0, 0], ['infantry']), 1)).toBe('Needs 20 more food');
  });
});
