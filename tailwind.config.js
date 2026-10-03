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
        }
      }
    },
  },
  plugins: [
    // `pl:` = the landscape shell: a phone or a tablet held sideways (src/hooks/useLayoutMode.js
    // sets <html data-layout>); `tb:` = the tablet alone (its wider dock).
    plugin(({ addVariant }) => { addVariant('pl', ':is([data-layout="phone-landscape"], [data-layout="tablet"]) &'); addVariant('tb', '[data-layout="tablet"] &'); })
  ],
}
