# Moto Log

Motorcycle service intervals, renewal dates and running costs.
React 18 + TypeScript + Tailwind + shadcn/ui (Radix primitives), bundled by Parcel,
shipped as an installable PWA.

**Live at `/moto/`** — deployed with the portfolio, because the built app lives in
`portfolio/public/moto/` and Astro copies `public/` verbatim.

## Install it

- **Android / Chrome** — open the site, then *Install app* from the address bar or menu.
- **iPhone / Safari** — open the site, Share → *Add to Home Screen*.

Either way it gets its own icon, opens without browser chrome, and works with no signal.
Long-pressing the icon offers *Log fuel* and *Log service* shortcuts, which deep-link
straight into that form.

## Files

| Path | What it is |
|------|------------|
| `src/` | Source. `lib/` is pure logic, `views/` are the four tabs, `components/ui/` is shadcn. |
| `icons/`, `manifest.webmanifest` | PWA assets. Icons are generated, not drawn by hand — see below. |
| `tools/make-icons.cjs` | Renders the app icons as PNGs with no image dependencies (raw pixels + zlib). The mark is a seven-segment odometer readout. |
| `tools/make-sw.cjs` | Writes `sw.js` **after** the build, once asset hashes are known. |
| `tools/serve.cjs` | Serves `public/moto` locally under the *real* CSP, read out of `public/_headers`. |
| `verify.ts` | 30 assertions over the calculations against a worked dataset. |
| `index-single.html`, `src/main-single.tsx` | Entry for the single-file build — same app, minus the service worker, which has nothing to register against on a one-page origin. |
| `bundle.html` / `artifact.html` | Single-file builds from the same source, for the claude.ai artifact. `artifact.html` is `bundle.html` with the outer `<!DOCTYPE>/<html>/<body>` stripped, because the artifact host supplies its own skeleton. |

## Run it locally

```bash
node 008_Builds/artifacts/2026-08-11-moto-log/tools/serve.cjs   # from the repo root
```

Then open <http://localhost:4173/moto/>. localhost counts as a secure context, so the
service worker registers exactly as it does on Netlify — stop the server and reload to
confirm offline still works.

## Design

Factory workshop manual crossed with an instrument cluster. Saturated colour is reserved
**exclusively** for tell-tale lamps — nothing else on the page is red, amber or green.
The odometer is both the hero and the primary control: every interval and every cost-per-km
derives from it. Lamps that aren't lit don't show, so the dash only ever displays what needs you.

Type is Bahnschrift / DIN Alternate / Roboto Condensed — a real condensed industrial face on
Windows, iOS/macOS and Android respectively, with monospace for all figures. No webfonts, so
nothing to silently fall back or trip the CSP.

The palette is defined once as HSL triples on `:root` and mapped onto shadcn's own token names,
so Radix components inherit the design instead of being overridden. Note `--accent` in shadcn is
a hover ground, not a brand hue — the blue lives on `--ring`.

## Verify

```bash
bash ./node_modules/.bin/jiti verify.ts
```

## Rebuild

Four environment gotchas, all hit during the original build:

1. **Vite does not run on this machine.** Node 24 fails to resolve Vite's own
   `#module-sync-enabled` import on both v7 and v8, so the build uses Parcel instead.
2. **Parcel fails at long paths.** It emits a malformed `C:\?\C:\...` prefix and dies with
   ENOENT. Build from a short directory such as `C:\Users\<you>\AppData\Local\Temp\mlb`.
   The same class of bug stops `astro build` running from inside Google Drive at all
   (`Invalid package config \\?\G:\...`) — that is pre-existing and only affects local
   builds; Netlify builds on Linux and is unaffected.
3. **Git Bash rewrites `/moto/`** into `C:/Program Files/Git/moto/`. Prefix the command with
   `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'`.
4. **Parcel can't resolve Radix's `exports` subpaths** by default:
   `"@parcel/resolver-default": { "packageExports": true }` in `package.json`.

```bash
pnpm install
node tools/make-icons.cjs                       # only when the icon changes
bash ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
  bash ./node_modules/.bin/parcel build index.html \
  --public-url /moto/ --dist-dir dist --no-source-maps
node tools/make-sw.cjs                          # must run after the build
cp -r dist/. ../../../public/moto/
```

### Why the build output is not a single file

The site's CSP is `script-src 'self'` with **no** `'unsafe-inline'`, so an inlined bundle is
blocked outright. Parcel's normal output — external, same-origin `.js` and `.css` — satisfies
it as-is. Anything that injects an inline script will break the page: that is why
`build.modulePreload.polyfill` is off in `vite.config.ts`, kept for reference.

### Service worker

Generated after the build so its precache list holds the real hashed filenames, and the cache
name changes exactly when the app does. It deliberately does **not** call `skipWaiting()`: a new
build takes over on next launch rather than reloading the page while you are part-way through
an entry. Registration is deliberately kept out of the bundler's dependency graph
(`new URL('sw.js', document.baseURI)`), since Parcel would otherwise try to bundle it itself.

## Data

Everything is in `localStorage` under `motolog.v1`, **per browser and per origin**. The installed
PWA, the hosted claude.ai artifact and a local `bundle.html` each keep their own separate book.
Pick one as the real log. Back it up from the Bike tab.
