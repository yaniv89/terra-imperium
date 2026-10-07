import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        // Plan §M21 cleanup: AgeAdvanceBanner/NationEliminatedBanner/BattleSummaryToast previously
        // referenced `animate-in fade-in slide-in-from-*` — tailwindcss-animate class names this
        // project never installed the plugin for, so they were silently no-ops (Tailwind drops any
        // class name it doesn't recognize; the banners/toast popped in instantly with no motion).
        'banner-in': 'bannerIn 500ms ease-out',
        'toast-in': 'toastIn 300ms ease-out',
        // Auto-resolve replay (src/components/battle/BattleReplay.jsx): a hard round, a bar taking a hit.
        'battle-shake': 'battleShake 280ms ease-in-out',
        'hit-flash': 'hitFlash 360ms ease-out',
        'stamp-in': 'stampIn 320ms cubic-bezier(0.2, 1.6, 0.4, 1)',
      },
      keyframes: {
        bannerIn: {
          '0%': { opacity: '0', transform: 'translate(-50%, -1rem)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0)' },
        },
        battleShake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        hitFlash: {
          '0%': { filter: 'brightness(2.2)' },
          '100%': { filter: 'brightness(1)' },
        },
        stampIn: {
          '0%': { opacity: '0', transform: 'scale(1.8) rotate(-12deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-8deg)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(0.5rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        slate: {
          950: '#020617',
        },
        // The "Field Atlas" look (plans/UI-DESIGN.md section 2). The same values are CSS variables
        // (--fa-*) in index.css for inline styles and canvases. Brass is the one primary action on
        // a screen and key numbers, never "selected" (selection = raised fill + light outline).
        fa: {
          ink: '#10141A',
          panel: '#1A212B',
          raised: '#232C38',
          hover: '#2B3644',
          line: '#33404F',
          text: '#ECE5D3',
          muted: '#B9B19F',
          brass: '#D8A444',
          'brass-hi': '#E6B65A',
          you: '#5B9BF0',
          enemy: '#EE8A3A',
          indep: '#9C8FD0',
          good: '#6CC28A',
          danger: '#E5604D',
          // danger as small text on a panel (#E5604D is 4.3:1 there, this is 5.6:1)
          'danger-text': '#F2836F',
          food: '#8FA36A',
          science: '#6FA3C8'
        }
      },
      fontFamily: {
        // Spectral SC for headings, Figtree for body, JetBrains Mono for numbers (bundled by
        // @fontsource in src/fonts.js, so the Capacitor build works offline).
        display: ['"Spectral SC"', 'Georgia', 'serif'],
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [
    // `pl:` = the landscape shell: a phone or a tablet held sideways (src/hooks/useLayoutMode.js
    // sets <html data-layout>); `tb:` = the tablet alone (its wider dock).
    plugin(({ addVariant }) => { addVariant('pl', ':is([data-layout="phone-landscape"], [data-layout="tablet"]) &'); addVariant('tb', '[data-layout="tablet"] &'); })
  ],
}
