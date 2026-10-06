import { describe, it, expect } from 'vitest';
import { getMapPrefs, setMapPrefs } from './mapPrefs';

describe('map and device prefs (W12)', () => {
  it('starts with the globe and the performance overlay off and changes one setting at a time', () => {
    expect(getMapPrefs()).toMatchObject({ renderer: 'webgl', globe: false, perf: false });
    setMapPrefs({ perf: true });
    expect(getMapPrefs()).toMatchObject({ renderer: 'webgl', globe: false, perf: true });
    setMapPrefs({ perf: false });
    expect(getMapPrefs().perf).toBe(false);
  });
});
