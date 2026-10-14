// scripts/lib/browserLaunch.mjs
// One place for the Chromium flags of every real-browser script (Playwright). The default is the
// real GPU: on this Windows machine headless Chrome runs the WebGL map and battles at full speed
// (SwiftShader, the software fallback, runs them at 1 to 2 frames a second). Pass --swgl (or
// --swiftshader, or set SWGL=1) to fall back to software rendering, e.g. on a machine without a GPU.
// A script's own GPU flags are dropped here, so every script gets the same mode; its other args
// (--disable-dev-shm-usage and the like) pass through unchanged.
import { chromium } from '@playwright/test';

const GPU_FLAG = /^--(use-angle|use-gl|enable-gpu|enable-unsafe-swiftshader|ignore-gpu-blocklist|enable-webgl)(=|$)/;
const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
const GPU = [
  '--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []), '--enable-webgl'
];

// 'swiftshader' when the software fallback is asked for, else 'gpu'
export const browserMode = () => (process.argv.includes('--swgl') || process.argv.includes('--swiftshader') || process.env.SWGL === '1'
  ? 'swiftshader' : 'gpu');

// The mode's GPU flags (for launch options that Playwright reads itself, such as playwright.config.js)
export const browserArgs = () => (browserMode() === 'swiftshader' ? [...SWIFTSHADER] : [...GPU]);

// chromium.launch with the mode's flags; the script's other options and args are kept
export const launchBrowser = (opts = {}) => {
  const { args = [], ...rest } = opts;
  return chromium.launch({ headless: true, ...rest, args: [...browserArgs(), ...args.filter((a) => !GPU_FLAG.test(a))] });
};
