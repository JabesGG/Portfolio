# Moto Log

Motorcycle service intervals, renewal dates and running costs.
React 18 + TypeScript + Tailwind + shadcn/ui (Radix primitives), bundled by Parcel.

Ships three ways from one codebase:

| Target | Entry | Notes |
|--------|-------|-------|
| **Installable PWA** | `index.html` | Live at `/moto/`, deployed with the portfolio. Offline via service worker. |
| **Single-file artifact** | `index-single.html` | One self-contained HTML file for claude.ai. No worker, no manifest. |
| **Native app shell** | `index-native.html` | Capacitor. Prepared for the stores; not submitted. |

## Install it (PWA)

- **Android / Chrome** — open the site, then *Install app* from the address bar or menu.
- **iPhone / Safari** — open the site, Share → *Add to Home Screen*.

Either way it gets its own icon, opens without browser chrome, and works with no signal.
Long-pressing the icon offers *Log fuel* and *Log service* shortcuts, which deep-link
straight into that form.

## Files

| Path | What it is |
|------|------------|
| `src/lib/` | Pure logic — calculations, formatting, storage, reminders. No UI, no framework. |
| `src/views/` | The four tabs. |
| `src/components/ui/` | shadcn. |
| `src/main.tsx` / `main-single.tsx` / `main-native.tsx` | One entry per target. Only the native one imports Capacitor. |
| `icons/`, `manifest.webmanifest` | PWA assets. Icons are generated — see `tools/make-icons.cjs`. |
| `tools/make-icons.cjs` | Renders the app icons as PNGs with no image dependencies (raw pixels + zlib). The mark is a seven-segment odometer readout. |
| `tools/make-sw.cjs` | Writes `sw.js` **after** the build, once asset hashes are known. |
| `tools/serve.cjs` | Serves `public/moto` locally under the *real* CSP, read out of `public/_headers`. |
| `verify.ts` | 57 assertions over the calculations, reminder scheduling and backup age. |
| `bundle.html` / `artifact.html` | Single-file builds. `artifact.html` is `bundle.html` with the outer `<!DOCTYPE>/<html>/<body>` stripped, because the artifact host supplies its own skeleton. |

## Run it locally

```bash
node 008_Builds/artifacts/2026-08-11-moto-log/tools/serve.cjs   # from the repo root
```

Then open <http://localhost:4173/moto/>. localhost counts as a secure context, so the
service worker registers exactly as it does on Netlify — stop the server and reload to
confirm offline still works.

## Verify

```bash
bash ./node_modules/.bin/jiti verify.ts
```

Covers full-to-full fuel economy, interval urgency (km vs months, whichever is closer),
month-end date clamping, category totals, and which reminders a book implies at a fixed
clock. All pure functions — no DOM, no mocking.

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

## Native app — prepared, not submitted

`capacitor.config.ts` plus `index-native.html` and `src/main-native.tsx` are enough to build
an Android or iOS shell. Two things changed to make that viable:

**Storage is pluggable.** `src/lib/storage.ts` defaults to `localStorage` and accepts a
backend. The native entry injects Capacitor Preferences, which maps to SharedPreferences /
UserDefaults: app-private, included in device backups, and *not* evictable the way WKWebView
`localStorage` is. Losing a maintenance record to storage pressure is not acceptable.

**Reminders are real notifications.** `src/lib/reminders.ts` computes what a book implies —
pure and tested — and the native entry supplies a scheduler backed by local notifications.
Only date-driven items are scheduled: renewals, and services with a month interval. Distance-
driven ones (chain lube every 500 km) depend on how much you ride, so they stay as tell-tales
rather than becoming notifications that would be guesses.

### Why neither file imports Capacitor

Importing the bridge directly pulled it into the *web* bundle, which made Parcel emit an
inline `<script type="importmap">` to resolve its lazy chunks — and the site's
`script-src 'self'` blocks inline scripts outright. A blocked import map is a latent failure,
so the native pieces are injected at startup by the native entry instead. The web bundle
carries no bridge, no import map, and is ~11 kB smaller.

```bash
# native web assets
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
  bash ./node_modules/.bin/parcel build index-native.html \
  --public-url ./ --dist-dir dist-native --no-source-maps
mv dist-native/index-native.html dist-native/index.html
npx cap add android      # regenerates android/, which is gitignored
npx cap sync android
```

### What is still needed to actually ship

Engineering is not the blocker. In rough order of effort:

- **Google Play** — US$25 once. New *personal* developer accounts must run a closed test with
  a group of testers for a continuous period before production access; check the current rule
  when you register, it has changed before. Needs a privacy policy URL and a Data Safety
  declaration (this app collects nothing and sends nothing, which makes that form short).
- **Apple App Store** — US$99/year, and a Mac or a cloud builder since the dev machine is
  Windows. Expect scrutiny under App Review guideline 4.2 (minimum functionality): a WebView
  around a website gets rejected. The local notifications above are the substantive answer to
  that; a home-screen widget would strengthen it further.
- **Icons and splash** for both platforms, generated into the native projects.
- **Signing keys**, and somewhere safe to keep them.

Neither store account can be created from here — fees and identity verification are yours.

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
bash ./node_modules/.bin/jiti verify.ts
BUILD_STAMP="$(date -u '+%Y-%m-%d %H:%M UTC')" \
  MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
  bash ./node_modules/.bin/parcel build index.html \
  --public-url /moto/ --dist-dir dist --no-source-maps
node tools/make-sw.cjs                          # must run after the build
cp -r dist/. ../../../public/moto/
```

`BUILD_STAMP` is shown at the bottom of the Bike tab. Forgetting it is not fatal —
the stamp falls back to `dev` — but then nobody can tell whether a phone has
picked up the new build, which is the whole point of it.

### Why the web build is not a single file

The site's CSP is `script-src 'self'` with **no** `'unsafe-inline'`, so an inlined bundle is
blocked outright. Parcel's normal output — external, same-origin `.js` and `.css` — satisfies
it as-is. Anything that injects an inline script breaks the page.

### A CSP violation that is expected

Opening a sheet logs `Applying inline style violates ... style-src 'self'`. That is Radix
injecting a `<style>` tag to lock background scroll, which the policy blocks. It is benign:
`body.sheet-open { overflow: hidden }` in `index.css` does the same job from an external
stylesheet. The console noise is Radix retrying; the behaviour is correct. Do not "fix" it by
adding `'unsafe-inline'` — that would weaken the policy for the whole site to silence a log line.

### Service worker

Generated after the build so its precache list holds the real hashed filenames, and the cache
name changes exactly when the app does. It deliberately does **not** call `skipWaiting()`: a new
build takes over on next launch rather than reloading the page while you are part-way through
an entry. Registration is kept out of the bundler's dependency graph
(`new URL('sw.js', document.baseURI)`), since Parcel would otherwise try to bundle it itself.

## Data

On startup the app calls `navigator.storage.persist()`, which asks the browser to exempt this
origin from eviction under storage pressure. Chrome grants it silently for installed apps and
declines for a casual tab; Safari does not implement it. The Bike tab reports which state you
are actually in rather than assuming, alongside how long ago you last exported — that reminder
turns amber past 90 days, or immediately if there are entries and no backup at all. A CSV
export deliberately does **not** count as a backup, since it cannot be restored from.

Stored under `motolog.v1` — `localStorage` on the web, native Preferences in the app shell.
**Per browser and per origin**: the installed PWA, the hosted claude.ai artifact and a local
`bundle.html` each keep their own separate book, and a native build would keep a fourth. Pick
one as the real log. Back it up from the Bike tab; the JSON export is also the migration path
onto a native build.
