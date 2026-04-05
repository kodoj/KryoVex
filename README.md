# KryoVex

**KryoVex** is a desktop application for **Counter-Strike 2** that helps you move items in and out of **Storage Units** in bulk, inspect inventory and storage, view values, run trade-ups, and more. It connects to Steam using [steam-user](https://github.com/DoctorMcKay/node-steam-user) and [globaloffensive](https://github.com/DoctorMcKay/node-globaloffensive) to talk to the CS2 game coordinator.

---

## Relation to Casemove

KryoVex is a **revival and continuation** of the open-source app previously known as **Casemove**, whose last public tree is [nombersDev/casemove](https://github.com/nombersDev/casemove). **Active development continues in this repository** under the **GNU General Public License v3** (see [`LICENSE`](LICENSE)); the KryoVex fork is maintained independently of that upstream snapshot.

**Versioning:** KryoVex **1.x** is a **new release series**. Version numbers are **not** a continuation of Casemove **2.x**.

### What changed from the old project

| Area | Casemove ([upstream](https://github.com/nombersDev/casemove)) | KryoVex (this repo) |
| --- | --- | --- |
| **Status** | Last release on upstream repo (see link above); not the active line for this codebase | Active development; releases on [Credskiz/KryoVex](https://github.com/Credskiz/KryoVex) |
| **Runtime / stack** | Older Node / webpack-centric Electron React Boilerplate | **Node 20+**, **npm 10+**, **Electron 37.x**, **React 19.x** — **tsup** for **main + preload**, **Vite** for the **renderer** |
| **UI** | Earlier Tailwind / layout | **Tailwind v4**, updated overview / inventory / trade-up views, KryoVex branding |
| **Ship artifacts** | Prior installer set | **Windows:** NSIS installer + **portable** `.exe`; **macOS:** `.dmg` + `.zip` (x64 & arm64); **Linux:** `.deb` + **AppImage** |
| **Updates** | Old repo / IDs | **electron-updater** + `package.json` → `build.publish` for **Credskiz/KryoVex** |
| **Data paths** | Casemove-only layout | **KryoVex** paths with **migration** from legacy Casemove backup / store names where needed |

### Build stack (what was replaced)

The archived **Casemove** tree was built on **Electron React Boilerplate**–style tooling: **webpack** bundles for the main and renderer processes, renderer **dev DLL**, webpack-centric configs under `.erb`, and an older **Node** / **Tailwind v2** / **PostCSS** pipeline.

**KryoVex** replaces that with a smaller, faster toolchain:

| Layer | Before (typical Casemove / ERB) | Now (KryoVex) |
| --- | --- | --- |
| **Node / npm** | Old LTS (e.g. 14.x era in upstream docs) | **Node 20+** and **npm 10+** (`package.json` → `engines`) |
| **Electron** | Older major | **Electron 37.x** |
| **TypeScript** | Older 4.x stack | **TypeScript 5.9.x** (`npm run typecheck` → `tsc --noEmit`) |
| **Electron main + preload** | Webpack | **[tsup](https://tsup.egoist.dev/)** — ESM **main** (`.mjs`), CJS **preload** (`.cjs`); large `node_modules` left external; **production** output in `release/app/dist/main` (**development** output in `dist/main`) |
| **Renderer (React)** | Webpack + Babel-style chain | **[Vite 7.x](https://vitejs.dev/)** with `@vitejs/plugin-react`, `vite-tsconfig-paths`, `vite-plugin-html`, `vite-plugin-ejs` (see `vite.config.ts`) |
| **CSS** | Tailwind 2 + PostCSS via webpack | **Tailwind CSS v4** with `@tailwindcss/postcss` |
| **Lint** | Legacy `.eslintrc` | **ESLint 9** flat config (`eslint.config.mjs`) |
| **Tests** | Jest (prior setup) | **Jest** 30.x with **`ts-jest`**, **`jsdom`** test environment (see `package.json` → `jest`) |
| **Packaging** | electron-builder (older recipe) | **electron-builder 26.x** — Windows **x64** NSIS + **portable**; macOS **DMG** + **ZIP** (**x64** & **arm64**); Linux **`.deb`** + **AppImage**; `build.publish` → **GitHub** `Credskiz` / **`KryoVex`** |
| **Dev loop** | Webpack dev server + main rebuild | **`npm run dev`** → **`scripts/dev-fast.mjs`** (initial tsup build, then scoped **`tsup --watch`**, **Vite** dev server, Electron via **`wait-electron-dev.mjs`**); **`npm run dev:watch`** → **concurrently** runs full-repo **`tsup --watch`** + **`vite`** |

**Commands (this repo):** `npm run build` runs **`build:main`** (tsup) and **`build:renderer`** (vite) **in parallel** via `concurrently`. **`npm run package:compile`** (used by **`package:*`**) runs **`.erb/scripts/clean.js dist`** (deletes the root **`dist/`** directory only), then **`npm run build`**, then **`npm install --production`** in **`release/app`**; **`package:local`** and platform scripts then run **`electron-builder`** (see **How to build** below).

---

## Download

Installers and portable builds are published on [GitHub Releases](https://github.com/Credskiz/KryoVex/releases).

---

## Support

Community Discord (historically used by Casemove users): https://discord.gg/4dSBdt4uJ3

---

## Features

- Overview of account inventory and storage
- Log in with refresh token / browser flow / shared secret where supported
- Inventory and storage views with sort, search, and filters
- Estimated values (e.g. Steam Community Market and cached pricing)
- Bulk move items between inventory and storage units
- Rename storage units
- Export data (e.g. CSV)
- Multiple accounts
- Trade-up flow with outcomes and estimated EV

---

## How to use

1. Download KryoVex from [releases](https://github.com/Credskiz/KryoVex/releases).
2. Open the app and sign in to Steam.
3. Load storage units and use Transfer / Inventory as needed.

---

## Common questions

### Can I be VAC banned?

The app does not inject into the CS2 client. It uses the same kind of Steam / coordinator connection as many automation tools. Use at your own risk; see also [ArchiSteamFarm’s FAQ on security](https://github.com/JustArchiNET/ArchiSteamFarm/wiki/FAQ#security--privacy--vac--bans--tos).

### Does KryoVex store my information?

KryoVex stores data locally only as needed to run (settings, optional remembered login material via OS secure storage, caches). It does not send your inventory to third-party servers except services you use through Steam or pricing sources you configure.

### Browser / client login

Some flows use a one-time token from Steam (e.g. [clientjstoken](https://steamcommunity.com/chat/clientjstoken)) so you do not have to type your password into the app for that method.

---

## Built with

- **Node.js** 20+ and **npm** 10+ (`package.json` → `engines`)
- **Electron** 37.x, **React** 19.x, **Tailwind CSS** 4.x

---

## How to build

From the repository root (Node **20+** and npm **10+**; see `engines` in `package.json`):

```bash
npm install
npm run build
```

**Packaging** (outputs go to `release/build/`; do not commit them — attach to [GitHub Releases](https://github.com/Credskiz/KryoVex/releases)):

| Command | Output (examples) |
| --- | --- |
| `npm run package:local` | All targets for the **current OS** (Windows: NSIS + portable; macOS: DMG + ZIP; Linux: `.deb` + AppImage) |
| `npm run package:win` | Windows x64 only |
| `npm run package:mac` | macOS x64 + arm64 |
| `npm run package:linux` | Linux `.deb` + **AppImage** (CPU arch matches the build machine unless you customize `electron-builder`) |
| `npm run package` | Same as local, with `publish: always` for CI |

Run `npm run icon:sync` before packaging if you change `assets/kv-icon.png`.

Cross-compiling (e.g. building `.dmg` on Windows) is not supported by default; use a macOS runner for Mac artifacts.

Your local checkout folder may still be named `casemove`; the product and GitHub project are **KryoVex** (`Credskiz/KryoVex`).

---

## License and legal notices

### This program (KryoVex)

KryoVex is **free software** under the **GNU General Public License v3.0 or later**. The complete license text is in the [`LICENSE`](LICENSE) file in this repository.

This program is distributed in the hope that it will be useful, but **without any warranty**; without even the implied warranty of **merchantability** or **fitness for a particular purpose**. See the GNU General Public License for more details.

### Upstream lineage (Casemove)

KryoVex incorporates and modifies code originally distributed as **Casemove** ([nombersDev/casemove](https://github.com/nombersDev/casemove)) under **GPL-3.0**. You may obtain the corresponding source for KryoVex from this repository; you may inspect the historical Casemove source at the upstream repository linked above.

### Third-party components

Bundled **npm dependencies** (including **Electron**, **React**, and other libraries) are © their respective authors and are used under each package’s SPDX / `license` field (see **`package-lock.json`** and **`node_modules/<package>/package.json`** for pinned versions). **No warranty** is made for third-party code.

For a machine-readable overview of dependency licenses (optional):

```bash
npx license-checker --summary
```

(Install or run via `npx` as needed; output is indicative and does not replace the license files in `node_modules`.)

### SPDX

- **Project license:** `GPL-3.0-or-later` (see `LICENSE`).
