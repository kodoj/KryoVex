import { defineConfig } from 'tsup';

export default defineConfig(() => {
  const isProd = process.env.BUILD_TARGET === 'prod';
  const outDir = isProd ? 'release/app/dist/main' : 'dist/main';
  const shouldClean = isProd; // Never clean in dev/watch; it races electronmon.
  const shouldSourceMap = false; // Sourcemaps are expensive; keep dev fast.
  const skipNodeModulesBundle = true;

  // Electron can be picky about ESM preloads. We build `main` as ESM and `preload` as CJS
  // so `webPreferences.preload` can always load reliably in dev+prod.
  return [
    {
      entry: ['src/main/main.ts'],
      format: ['esm'],
      outDir,
      target: 'node24',
      sourcemap: shouldSourceMap,
      clean: shouldClean,
      // Speed up builds: don't bundle huge node_modules into main/preload.
      // Electron runs with node_modules available in dev, and we ship node_modules in release/app.
      skipNodeModulesBundle,
      tsconfig: 'tsconfig.main.json',
      outExtension: () => ({ js: '.mjs' }),
      splitting: false,
      esbuildOptions(options) {
        options.minify = false;
        options.minifyIdentifiers = false; // Disable variable renaming
        return options;
      },
      banner: {
        // Shims for CJS deps in ESM
        js: `
          import { createRequire } from 'module';
          const require = createRequire(import.meta.url);
          import { fileURLToPath } from 'url';
          import { dirname as pathDirname } from 'path';
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = pathDirname(__filename);
        `,
      },
      external: [
        'electron',
        '@electron/remote',
        'electron-debug',
        'electron-dl',
        'electron-log',
        'electron-redux',
        'electron-store',
        'electron-updater',
        'axios',
        'form-data',
        'combined-stream',
        'electron-devtools-installer',
      ],
    },
    {
      entry: ['src/main/preload.mjs'],
      format: ['cjs'],
      outDir,
      target: 'node24',
      sourcemap: shouldSourceMap,
      clean: false,
      skipNodeModulesBundle,
      outExtension: () => ({ js: '.cjs' }),
      splitting: false,
      esbuildOptions(options) {
        options.minify = false;
        options.minifyIdentifiers = false;
        return options;
      },
      external: ['electron'],
    },
  ];
});