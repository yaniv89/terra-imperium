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
      },
      keyframes: {
        bannerIn: {
          '0%': { opacity: '0', transform: 'translate(-50%, -1rem)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0)' },
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
  plugins: [],
}
