// qa-report/harness/viewports.mjs
// The viewport list for the QA audit. Phones and tablets get hasTouch + isMobile so the app
// picks its touch layouts (src/hooks/useLayoutMode.js). Note: 1024 px wide counts as 'desktop' there, so
// tablet-land gets the desktop shell with touch input. 844x390 is the project's reference phone screen.

export const VIEWPORTS = {
  'desktop':          { width: 1920, height: 1080, hasTouch: false, isMobile: false, deviceScaleFactor: 1, expectLayout: 'desktop' },
  'laptop':           { width: 1366, height: 768,  hasTouch: false, isMobile: false, deviceScaleFactor: 1, expectLayout: 'desktop' },
  'tablet-land':      { width: 1024, height: 768,  hasTouch: true,  isMobile: true,  deviceScaleFactor: 2, expectLayout: 'desktop' },
  'tablet-port':      { width: 768,  height: 1024, hasTouch: true,  isMobile: true,  deviceScaleFactor: 2, expectLayout: 'tablet-portrait' },
  'phone-land':       { width: 844,  height: 390,  hasTouch: true,  isMobile: true,  deviceScaleFactor: 2, expectLayout: 'phone-landscape' },
  'phone-land-small': { width: 667,  height: 375,  hasTouch: true,  isMobile: true,  deviceScaleFactor: 2, expectLayout: 'phone-landscape' },
  'phone-port':       { width: 390,  height: 844,  hasTouch: true,  isMobile: true,  deviceScaleFactor: 2, expectLayout: 'phone-portrait' }
};

export const VIEWPORT_NAMES = Object.keys(VIEWPORTS);

export const isTouch = (name) => !!VIEWPORTS[name]?.hasTouch;

export const getViewport = (name) => {
  const v = VIEWPORTS[name];
  if (!v) throw new Error(`Unknown viewport "${name}". Known: ${VIEWPORT_NAMES.join(', ')}`);
  return v;
};
