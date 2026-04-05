const { TextDecoder, TextEncoder } = require('node:util');

/** Same symbol Vite injects in `vite.config.ts` — required before importing `appMeta.ts`. */
const pkg = require('./package.json');
globalThis.__KRYOVEX_VERSION__ = pkg.version;

if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;

if (typeof window !== 'undefined' && !window.electron) {
  const noop = () => undefined;
  const noopAsync = async () => undefined;

  const ipcBase = {
    on: noop,
    off: noop,
    once: noop,
    removeListener: noop,
    removeAllListeners: noop,
    send: noop,
    invoke: noopAsync,
    getCurrencyRate: noopAsync,
    getAppVersion: async () => '0.0.0',
  };

  window.electron = {
    ipcRenderer: new Proxy(ipcBase, {
      get(target, prop) {
        if (typeof prop === 'string' && prop in target) return target[prop];
        if (typeof prop === 'string') return noopAsync;
        return target[prop];
      },
    }),
    store: {
      get: noopAsync,
      set: noopAsync,
      delete: noopAsync,
    },
  };
}

