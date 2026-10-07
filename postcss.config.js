import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import appViewportUnits from './scripts/postcss-app-viewport.js';

export default {
  // appViewportUnits: every vh / dvh / lvh in the CSS (Tailwind's h-screen, max-h-[55vh],
  // calc(100dvh - ...)) becomes a share of the visible area that src/utils/appViewport.js measures
  // (iOS Safari's bars, plans/ui/safari).
  plugins: [tailwindcss, appViewportUnits, autoprefixer]
};
