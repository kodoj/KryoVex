import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createHtmlPlugin } from 'vite-plugin-html';
import { visualizer } from 'rollup-plugin-visualizer'; // FIXED: Use rollup-plugin-visualizer instead of vite-bundle-visualizer (which is a CLI tool, not a plugin)
import { resolve } from 'path';
import { ViteEjsPlugin } from 'vite-plugin-ejs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDevelopment = mode === 'development';
  const isDebugProd = env.DEBUG_PROD === 'true';
  const packageJson = require('./package.json') as { version: string };

  const plugins: import('vite').PluginOption[] = [
    react(),
    tsconfigPaths({ projects: ['../../tsconfig.renderer.json'] }),
    ViteEjsPlugin((_viteConfig) => ({
      isDevelopment,
      env: mode,
      nodeModules: resolve(__dirname, 'node_modules'),
    })),
    createHtmlPlugin({
      template: 'index.html',
      minify: true,
      inject: {
        data: {
          isBrowser: true,
          env: mode,
          isDevelopment,
          nodeModules: resolve(__dirname, 'node_modules'),
          tags: [],
        },
      },
    }),
    mode === 'production' && env.OPEN_ANALYZER === 'true' ? visualizer({ open: true }) : null,
  ].filter(Boolean);

  return {
    plugins,
    root: 'src/renderer',
    build: {
      outDir: process.env.BUILD_TARGET === 'prod' ? '../../release/app/dist/renderer' : '../../dist/renderer',
      emptyOutDir: true,
      sourcemap: isDebugProd ? 'inline' : false,
      minify: 'terser',
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
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
    base: './',
    server: {
      port: 1212,
      strictPort: true,
      open: false,
      host: 'localhost',
      proxy: {},
      headers: isDevelopment ? {
        // Dev CSP: allow fetching CS2 image map + Steam/CDN images.
        // Keep 'unsafe-eval' for Vite/HMR in dev only.
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:1212 ws://localhost:1212 'unsafe-inline' 'unsafe-eval'",
          "connect-src 'self' http://localhost:1212 ws://localhost:1212 https://raw.githubusercontent.com https://community.akamai.steamstatic.com https://steamcommunity-a.akamaihd.net https://cdn.steamstatic.com",
          "img-src 'self' data: blob: https://raw.githubusercontent.com https://community.akamai.steamstatic.com https://steamcommunity-a.akamaihd.net https://cdn.steamstatic.com https:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        ].join('; ')
      } : {},
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
      alias: {
        events: 'events',
        '_': 'lodash',
        global: 'globalThis',
      },
      mainFields: ['module', 'main'],
    },
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
      postcss: './postcss.config.mjs',
    },
    cacheDir: 'node_modules/.vite/renderer-dev',
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.DEBUG_PROD': JSON.stringify(isDebugProd),
      __KRYOVEX_VERSION__: JSON.stringify(packageJson.version),
    },
  };
});