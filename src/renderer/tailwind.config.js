/** @type {import('tailwindcss').Config} */
export default {
  // Vite builds from `src/renderer` as root; keep globs relative to this folder.
  content: [
    './**/*.{html,js,jsx,ts,tsx}',
    '!./**/*.{test,spec}.{ts,tsx}',
    '!./**/__tests__/**',
    '!./**/*.d.ts',
    '../shared/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'dark-level-one': '#121212',
        'dark-level-two': '#181818',
        'dark-level-three': '#282828',
        'dark-level-four': '#404040',
        'dark-level-five': '#2B303D',
        'dark-white': '#d6d3cd',
        'regal-blue': '#243c5a',
        /** KryoVex logo — must match root theme; renderer build uses THIS config only (@config in index.css). */
        kryo: {
          navy: {
            950: '#020d18',
            900: '#051a2e',
            800: '#0a2744',
            700: '#0e3a5c',
            600: '#135178',
          },
          /** UI accents (inputs, checkboxes) — Tailwind cyan family. */
          ice: {
            500: '#06b6d4',
            400: '#22d3ee',
            300: '#67e8f9',
            200: '#a5f3fc',
            100: '#cffafe',
          },
          /**
           * Wordmark crescent — electric cyan (~#00D4FF), not cobalt web-blue.
           * Primary button should use this, not `ice` (slightly different hue) or old `glow`.
           */
          arc: {
            900: '#06222a',
            800: '#0a4a5c',
            700: '#007e96',
            600: '#00a8c4',
            500: '#00c0e8',
            400: '#00d4ff',
            300: '#7aebff',
          },
        },
      },
      fill: {
        current: 'currentColor',
      },
      borderColor: {
        DEFAULT: 'var(--color-gray-200, currentColor)',
      },
      ringWidth: {
        DEFAULT: '3px',
      },
      spacing: {
        px: '1px',
      },
      fontSize: {
        base: '1rem',
      },
    },
  },
  plugins: [],
};

