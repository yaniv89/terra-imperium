import { describe, it, expect } from 'vitest';
import { getLayoutMode } from './useLayoutMode';

describe('getLayoutMode', () => {
  it('phones held sideways get the landscape layout', () => {
    expect(getLayoutMode(844, 390)).toBe('phone-landscape');
    expect(getLayoutMode(932, 430)).toBe('phone-landscape');
    expect(getLayoutMode(667, 375)).toBe('phone-landscape');
  });

  it('phones held upright ask to rotate unless portrait was allowed', () => {
    expect(getLayoutMode(390, 844)).toBe('phone-portrait');
    expect(getLayoutMode(390, 844, true)).toBe('tablet');
  });

  it('tablets and narrow windows keep the tablet layout', () => {
    expect(getLayoutMode(768, 1024)).toBe('tablet');
    expect(getLayoutMode(1023, 700)).toBe('tablet');
  });

  it('desktops, including short wide windows, stay desktop', () => {
    expect(getLayoutMode(1280, 720)).toBe('desktop');
    expect(getLayoutMode(1440, 450)).toBe('desktop');
    expect(getLayoutMode(1024, 1366)).toBe('desktop');
  });
});
