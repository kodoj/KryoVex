/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
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
        /** KryoVex: navy + logo arc (electric cyan ~#00D4FF); ice = general UI accent */
        kryo: {
          navy: {
            950: '#020d18',
            900: '#051a2e',
            800: '#0a2744',
            700: '#0e3a5c',
            600: '#135178',
          },
          ice: {
            500: '#06b6d4',
            400: '#22d3ee',
            300: '#67e8f9',
            200: '#a5f3fc',
            100: '#cffafe',
          },
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
        current: 'currentColor',  // Keeps v3 behavior
      },
      // Preserve v3 border/ring defaults if needed (v4 changes them)
      borderColor: {
        DEFAULT: 'var(--color-gray-200, currentColor)',
      },
      ringWidth: {
        DEFAULT: '3px',  // v4 defaults to 1px; revert for consistency
      },
      // v4 is rem-first, but px works too
      spacing: {
        'px': '1px',
      },
      fontSize: {
        base: '1rem',
      },
    },
  },
  plugins: [],
};