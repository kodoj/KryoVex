import autoprefixer from 'autoprefixer';

/**
 * Tailwind is handled by `@tailwindcss/vite` in `vite.config.ts`.
 * PostCSS only runs for other tooling that may invoke it; keep autoprefixer for plain CSS.
 */
export default {
  plugins: [autoprefixer],
};
