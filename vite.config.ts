import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
/** Avoid `require()` so Node/Vite can cache the config module without re-evaluating CJS. */
const packageVersion = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')).version as string;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const isDevelopment = mode === 'development';
  const isDebugProd = env.DEBUG_PROD === 'true';

  const plugins: import('vite').PluginOption[] = [
    // Tailwind via Vite (faster dev than PostCSS pipeline alone).
    tailwindcss(),
    react(),
    mode === 'production' && env.OPEN_ANALYZER === 'true' ? visualizer({ open: true }) : null,
  ].filter(Boolean);

  return {
    plugins,
    root: 'src/renderer',
    // Relative base breaks Vite dev asset URLs when opened from Electron; keep absolute root in dev.
    base: isDevelopment ? '/' : './',
    build: {
      outDir: '../../dist/renderer',
      emptyOutDir: true,
      sourcemap: isDebugProd ? 'inline' : false,
      /** Gzip reporting is pure overhead for local/production CI builds here. */
      reportCompressedSize: false,
      /** esbuild minify is much faster than terser; fine for modern Electron/Chromium. */
      minify: 'esbuild',
      rollupOptions: {
        input: resolve(repoRoot, 'src/renderer/index.html'),
        output: {
          format: 'es',
          entryFileNames: 'renderer.js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      assetsInlineLimit: 10000,
      target: 'chrome127',
      cssMinify: true,
      commonjsOptions: { include: /node_modules/ },
    },
    server: {
      port: 1212,
      strictPort: true,
      open: false,
      host: 'localhost',
      /** Fewer fs checks; renderer only needs the repo tree. */
      fs: {
        allow: [repoRoot],
      },
      proxy: {},
      // Do not inject CSP in dev: it can block Vite's client / dynamic imports in Electron and yields a blank window.
      watch: {
        // Vite `root` is `src/renderer`; avoid watching Electron main, releases, and build output (faster dev boot on Windows).
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '../../dist/**',
          '../../release/**',
          '../../src/main/**',
          '../../.erb/**',
        ],
      },
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': resolve(repoRoot, 'src/renderer'),
        renderer: resolve(repoRoot, 'src/renderer'),
        shared: resolve(repoRoot, 'src/shared'),
        events: 'events',
        _: 'lodash',
        global: 'globalThis',
      },
      mainFields: ['module', 'main'],
    },
    optimizeDeps: {
      holdUntilCrawlEnd: false,
      // Keep this list tight: each entry is esbuild'd before HTTP "ready". Chart.js and dnd
      // load on-demand with their lazy routes (smaller cold start; first visit may pre-bundle).
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-router-dom',
        '@reduxjs/toolkit',
        'react-redux',
        'redux-persist',
        'redux-persist/es/storage',
        '@headlessui/react',
      ],
      esbuildOptions: {
        target: 'esnext',
        legalComments: 'none',
      },
    },
    css: {
      devSourcemap: false,
      modules: {
        localsConvention: 'camelCase',
      },
      // Tailwind is handled by `@tailwindcss/vite`; Lightning CSS already prefixes. Skip autoprefixer in dev only.
      postcss: isDevelopment ? { plugins: [] } : './postcss.config.mjs',
    },
    cacheDir: 'node_modules/.vite/renderer-dev',
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.DEBUG_PROD': JSON.stringify(isDebugProd),
      __KRYOVEX_VERSION__: JSON.stringify(packageVersion),
    },
  };
});
