# KryoVex

**KryoVex** is a desktop application for **Counter-Strike 2** that helps you move items in and out of **Storage Units** in bulk, inspect inventory and storage, view values, run trade-ups, and more. It connects to Steam using [steam-user](https://github.com/DoctorMcKay/node-steam-user) and [globaloffensive](https://github.com/DoctorMcKay/node-globaloffensive) to talk to the CS2 game coordinator.

**KryoVex 1.x** is its own release line (version numbers are not tied to any earlier public tree). **GPL-3.0-or-later** — see [`LICENSE`](LICENSE). This codebase includes derivative work originally published as open source under GPL; historical source is available at [nombersDev/casemove](https://github.com/nombersDev/casemove).

---

## Toolchain

| Layer | KryoVex (this repo) |
| --- | --- |
| **Runtime** | **Node 20+**, **npm 10+** (`package.json` → `engines`), **Electron 37.x**, **React 19.x** |
| **Main / preload** | **[tsup](https://tsup.egoist.dev/)** — ESM main (`.mjs`), CJS preload (`.cjs`); prod output in `release/app/dist/main` |
| **Renderer** | **[Vite 7.x](https://vitejs.dev/)**, **Tailwind CSS v4**, **`eslint.config.mjs`**, **Jest** + **ts-jest** |
| **Packaging** | **electron-builder** — Windows NSIS + portable; macOS DMG + ZIP; Linux `.deb` + AppImage; publish target **Credskiz/KryoVex** |
| **Dev** | **`npm run dev`** → `scripts/dev-fast.mjs` (tsup watch + Vite + Electron) |

`npm run build` runs **tsup** and **vite** in parallel. **`npm run package:compile`** cleans root `dist/`, builds, then `npm install --production` in `release/app` before **electron-builder**.

---

## Download

Installers and portable builds are published on [GitHub Releases](https://github.com/Credskiz/KryoVex/releases).

---

## Support

Community Discord: https://discord.gg/4dSBdt4uJ3

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

---

## License and legal notices

### This program (KryoVex)

KryoVex is **free software** under the **GNU General Public License v3.0 or later**. The complete license text is in the [`LICENSE`](LICENSE) file in this repository.

This program is distributed in the hope that it will be useful, but **without any warranty**; without even the implied warranty of **merchantability** or **fitness for a particular purpose**. See the GNU General Public License for more details.

### Upstream

KryoVex incorporates and modifies code originally distributed under **GPL-3.0**; you may inspect earlier published source at [nombersDev/casemove](https://github.com/nombersDev/casemove). Corresponding source for KryoVex is this repository.

### Third-party components

Bundled **npm dependencies** (including **Electron**, **React**, and other libraries) are © their respective authors and are used under each package’s SPDX / `license` field (see **`package-lock.json`** and **`node_modules/<package>/package.json`** for pinned versions). **No warranty** is made for third-party code.

For a machine-readable overview of dependency licenses (optional):

```bash
npx license-checker --summary
```

(Install or run via `npx` as needed; output is indicative and does not replace the license files in `node_modules`.)

### SPDX

- **Project license:** `GPL-3.0-or-later` (see `LICENSE`).
