// scripts/postcss-app-viewport.js
// A PostCSS plugin (postcss.config.js): viewport-height units become shares of --app-vh, the
// visible area's height / 100 that src/utils/appViewport.js keeps on <html> (iOS Safari's address
// bar, tab bar and keyboard take height that 100vh and even 100dvh do not always leave out).
//   max-h-[55vh]               -> max-height: calc(55 * var(--app-vh, 1vh))
//   calc(100dvh - 2.5rem)      -> calc(calc(100 * var(--app-vh, 1vh)) - 2.5rem)
// svh (the small viewport, already clear of the bars) and custom properties are left alone, and so
// are media and supports queries (only declarations are rewritten).
const UNIT = /(-?(?:\d+\.?\d*|\.\d+))(?:d|l)?vh\b/g;

export const rewriteViewportUnits = (value) => value.replace(UNIT, (m, n) => `calc(${n} * var(--app-vh, 1vh))`);

const appViewportUnits = () => ({
  postcssPlugin: 'app-viewport-units',
  Declaration(decl) {
    if (decl.prop.startsWith('--') || decl.value.includes('--app-vh')) return;
    UNIT.lastIndex = 0;
    if (!UNIT.test(decl.value)) return;
    decl.value = rewriteViewportUnits(decl.value);
  }
});
appViewportUnits.postcss = true;

export default appViewportUnits;
