import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';
export default {
  plugins: [
    tailwindcss({
      // Vite builds renderer from `src/renderer` as root; be explicit so Tailwind
      // still picks up the project config (darkMode + custom colors + content globs).
      config: './src/renderer/tailwind.config.js',
    }),
    autoprefixer,
  ],
};