# Moto Log

Motorcycle service intervals, renewal dates and running costs — for one bike or several.
React 19 + TypeScript + Tailwind + shadcn/ui (Radix primitives), bundled by Parcel.

## What it does

| Tab | What is there |
|-----|---------------|
| **Home** | Odometer, whatever needs attention, quick logging, nearest fuel, workshops. |
| **Log** | Every fuel fill, service and expense. Entries can carry receipt photos. |
| **Costs** | Totals, cost per km, 12-month chart, category split, year-by-year table, fuel economy. |
| **Ride** | GPS ride recording: distance, time, speed, a sketch of the route; can add to the odometer. |
| **Tools** | Workshops and fuel finder, fuel-card discounts and pump-price ranking, COE calculator, guides and a symptom troubleshooter, bike passport, level and badges. |
| **Bike** (the gear in the header) | Bike details and COE, renewal dates, service intervals, calendar reminders, account and sync, backup/restore. |

Tap the bike's name in the header to switch bikes or add one.

Everything works offline and stays on the device, with one exception that is **off until
you sign in**: an optional account (Supabase) that syncs your records and receipt photos
between devices. An AI mechanic is written but parked. Both are described under
[Online features](#online-features).

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
| `src/lib/` | Pure logic — calculations, formatting, storage, reminders, COE, ride filtering, XP, passport, record-level sync (`records.ts`) and the Supabase client (`cloud.ts`). No UI, no framework (bar three small React hooks: `ctx`, `locate`, `recorder`). |
| `src/views/` | The six screens: five tabs, plus Bike behind the gear. |
| `src/components/` | Sheets and shared pieces; `tools/` holds the panels of the Tools tab. |
| `src/components/ui/` | shadcn. |
| `src/data/` | Baked-in data: fuel stations, workshops, guides. |
| `server/` | The (parked) AI mechanic Netlify function and its tests. |
| `supabase/schema.sql` | The account database: tables, row-level security, the receipts bucket and `delete_me()`. Paste into Supabase's SQL Editor; safe to run again. |
| `supabase/test-schema.mjs` | 25 checks of that schema in PGlite (in-process Postgres) with stub `auth` and `storage` schemas: isolation between riders, later-edit-wins, photo folders, account deletion. |
| `src/main.tsx` / `main-single.tsx` / `main-native.tsx` | One entry per target. Only the native one imports Capacitor. |
| `icons/`, `manifest.webmanifest` | PWA assets. Icons are generated — see `tools/make-icons.cjs`. |
| `tools/make-icons.cjs` | Renders the app icons as PNGs with no image dependencies (raw pixels + zlib). The mark is a seven-segment odometer readout. |
| `tools/make-sw.cjs` | Writes `sw.js` **after** the build, once asset hashes are known. |
| `tools/serve.cjs` | Serves `public/moto` locally under the *real* CSP, read out of `public/_headers`. |
| `tools/fetch-stations.cjs` | Build-time OpenStreetMap query → `src/data/stations.json`. Re-run occasionally; stations open and close. |
| `tools/fetch-workshops.cjs` | The same for motorcycle workshops and dealers → `src/data/workshops.json`. |
| `tools/check-build.cjs` | Fails the build if a runtime-assembled class was dropped from the stylesheet, or if anything inline ended up in `index.html`. Both have shipped broken before. |
| `verify.ts` | 248 assertions over the calculations, reminders, garage migration and backups, COE, GPS filtering, XP, passport, calendar export, the bundled data, and sync — including two simulated devices against a simulated server with the database's rules. |
| `server/test.mjs` | 23 assertions over the AI function, with a stand-in for the AI API. |
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
pnpm verify        # jiti verify.ts && node server/test.mjs
```

Covers full-to-full fuel economy, interval urgency (km vs months, whichever is closer),
month-end date clamping, category totals, and which reminders a book implies at a fixed
clock — plus everything added with the garage. All pure functions — no DOM, no mocking.

The suite pins its own clock to 11 Aug 2026. It used to read the real date, so the
"in 724 km" and "25 days out" checks started failing as soon as the calendar moved past
the fixtures; a test that only passes during the month it was written is not a test.

## Design

A current mobile app, not a workshop manual. The first version was condensed capitals,
monospace figures and hard corners; it read as dated next to the apps riders already use,
so the look was rebuilt in November 2026 without touching what the app does.

- **Type.** The platform's own interface face — San Francisco, Roboto, Segoe UI — in
  sentence case, with tabular figures. No webfont, so nothing to download, fall back from
  or lose offline.
- **Surfaces.** Rounded cards on a quiet canvas, light and dark. Tinted tiles inside a card
  rather than cards within cards.
- **One accent.** Blue, for actions, links and where you are. Red, amber and green still
  mean exactly one thing — how due something is — and are never decoration.
- **Navigation.** A bottom tab bar on phones (Home, Log, Costs, Ride, Tools), which becomes
  a row of pills under the header on wider screens. Bike details and settings are the gear
  in the header: set up once, visited rarely, and five is what fits a thumb-reach bar.
- **Sheets.** Forms rise from the bottom edge on a phone and are a centred dialog on a
  desktop, with the action pinned to the bottom so it is in reach however long the form is.
  One class, `.sheet`, does both; `src/components/ui/dialog.tsx` just applies it.
- **The odometer.** The one piece of character kept: mechanical barrels in a dark housing
  on the home screen, because every interval and every cost-per-km counts from it.

The palette is defined once as HSL triples on `:root` and mapped onto shadcn's own token
names, so Radix components inherit the design instead of being overridden. `--ml-accent` is
the blue as text and icons; `--ml-fill` is the same blue tuned to carry white text on a
button, and is what shadcn's `--primary` points at. Icons are from `lucide-react`.

Component CSS stays inside `@layer components` so Tailwind utilities in the markup can still
override it — which is also why classes assembled at runtime need the safelist (see gotcha 5).

## Native app — prepared, not submitted

`capacitor.config.ts` plus `index-native.html` and `src/main-native.tsx` are enough to build
an Android or iOS shell. Two things changed to make that viable:

**Storage is pluggable.** `src/lib/storage.ts` defaults to `localStorage` and accepts a
backend. The native entry injects Capacitor Preferences, which maps to SharedPreferences /
UserDefaults: app-private, included in device backups, and *not* evictable the way WKWebView
`localStorage` is. Losing a maintenance record to storage pressure is not acceptable.

**Reminders are real notifications.** `src/lib/reminders.ts` computes what the garage implies —
pure and tested — and the native entry supplies a scheduler backed by local notifications.
Only date-driven items are scheduled: renewals, and services with a month interval. Distance-
driven ones (chain lube every 500 km) depend on how much you ride, so they stay as tell-tales
rather than becoming notifications that would be guesses.

**Still to do for native:** ride recording and the two finders use the browser's geolocation,
which inside the shell needs the location permission declared in the Android manifest and the
iOS `Info.plist` (and `@capacitor/geolocation` with a background mode if rides are to record
with the screen off). The AI mechanic calls `/api/…` relative to the page, which does not
exist inside the shell. Accounts talk to Supabase directly and need no change, but the
email links (confirm, reset password) point at the website, not the app.

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

Five environment gotchas, all hit during the builds so far:

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
5. **Tailwind drops any class it cannot read as a whole word in the source.** The tell-tale
   colours are assembled at runtime (`lamp--${level}`), so `.lamp--red` and friends were
   silently left out of the stylesheet and every lamp rendered colourless in the built app —
   while the code looked right. They are now in `safelist` in `tailwind.config.js`, and
   `tools/check-build.cjs` fails the build if one goes missing again. Write class names out
   in full, or add them to the safelist.

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
node tools/check-build.cjs                      # classes present, nothing inline
cp -r dist/. ../../../public/moto/
```

Old hashed files in `public/moto` are not removed by the copy. They do no harm — nothing
references them and the service worker does not precache them — but clear them out now and
then.

`pnpm build` runs the same typecheck → verify → Parcel → `make-sw` → `check-build` chain in
one go (`pnpm dev`, `pnpm verify`, `pnpm serve` also exist). It does not set `BUILD_STAMP` or
copy into `public/moto` — set the stamp in your shell first and do the
copies yourself.
`vite.config.ts` and the Vite dev dependencies are leftovers from before the switch to
Parcel; nothing in the build uses them.

`BUILD_STAMP` is shown at the bottom of the Bike tab. Forgetting it is not fatal —
the stamp falls back to `dev` — but then nobody can tell whether a phone has
picked up the new build, which is the whole point of it.

### Why the web build is not a single file

The site's CSP is `script-src 'self'` with **no** `'unsafe-inline'`, so an inlined bundle is
blocked outright. Parcel's normal output — external, same-origin `.js` and `.css` — satisfies
it as-is. Anything that injects an inline script breaks the page.

That includes an **import map**. The Supabase library is loaded on demand (`import()`), and
Parcel describes on-demand chunks to the browser with an inline `<script type=importmap>`
whenever every target browser supports `import.meta.resolve`. The `browserslist` in
`package.json` includes iOS/Safari 15, which does not, so Parcel embeds the chunk's URL in
the main script instead. Narrow those targets and the build check fails on the import map.

### Location needs the site's permission header

`public/_headers` sends a `Permissions-Policy`. While it said `geolocation=()` the browser
refused location for the whole site *before asking the rider*, so Nearest fuel could only
ever answer "Location is blocked". It has to read `geolocation=(self)`: this site's own
pages may ask, nothing embedded from elsewhere may. The rider still gets the browser's
prompt each time it matters.

### Nearest fuel

The station list is baked into the bundle at build time rather than queried live —
about 200 Singapore forecourts, 12 kB. Two reasons: the app has to work at a pump with
no signal, which is exactly when you need it; and a live query would mean opening
`connect-src` in the site's CSP for a third-party API. Your GPS position never leaves
the device, because nothing is sent anywhere.

Distances are straight-line, not road distance, so the nearest by air is not always the
shortest ride — stated in the sheet rather than glossed over. Directions hand off to the
phone's maps app, which has the live traffic and routing this cannot.

Refresh the list with `node tools/fetch-stations.cjs`. Overpass rate-limits, so if it
returns 429 or 504, wait a few minutes rather than retrying in a loop.

### Workshops

Same approach as the stations: a list baked in from OpenStreetMap by
`tools/fetch-workshops.cjs`, sorted by straight-line distance on the phone. OSM knows a few
dozen of Singapore's several hundred bike shops and carries no ratings, so the sheet says so
and lets riders save their own under **Mine** — name, phone, area, note — with call,
WhatsApp and map buttons. Saved workshops are suggested when logging a service.

### A CSP violation that is expected

Opening a sheet logs `Applying inline style violates ... style-src 'self'`. That is Radix
injecting a `<style>` tag to lock background scroll, which the policy blocks. It is benign:
`body.sheet-open { overflow: hidden }` in `index.css` does the same job from an external
stylesheet. The console noise is Radix retrying; the behaviour is correct. Do not "fix" it by
adding `'unsafe-inline'` — that would weaken the policy for the whole site to silence a log line.

### Updates

The worker never activates itself — a forced reload could throw away a half-typed entry.
It used to rely solely on every instance being closed, which turned out to be genuinely
hard to achieve on a phone, where backgrounding is not closing; an installed app could sit
on a stale build indefinitely. So the page now watches for a waiting worker and offers a
**Reload** prompt, and `reg.update()` runs on launch so the check does not wait for a
navigation that may never come.

A first visit is not an update. The new worker claims the page as soon as it activates,
which fires the same `controllerchange` an update does — and the page used to answer by
reloading itself about a second after it first appeared, taking anything already typed
with it. It now reloads only when a worker was already in control.

Recovering an app stuck on a build from *before* this change is the one case this cannot
help with: that old worker has no message handler to ask. Back up from the Bike tab, close
every instance, and relaunch twice; failing that, remove and re-add the home-screen app and
restore the backup — note that removing it on iOS deletes its data, hence backing up first.

### Service worker

Generated after the build so its precache list holds the real hashed filenames, and the cache
name changes exactly when the app does. It only handles requests under `/moto/`. Everything
else on the origin goes straight to the network — above all `/api/`, where its cache-first
rule would otherwise have sync serving the same old copy forever. It deliberately does **not** call `skipWaiting()`: a new
build takes over on next launch rather than reloading the page while you are part-way through
an entry. Registration is kept out of the bundler's dependency graph
(`new URL('sw.js', document.baseURI)`), since Parcel would otherwise try to bundle it itself.

## The garage

One book per bike, in the exact shape the single-bike app used, wrapped in a garage:

```ts
Garage { v: 2, active, bikes: Book[], prefs, lastBackup?, updated? }
Book   { id, bike, schedule, dates, entries, rides? }      // = the old State, plus an id
```

Keeping the per-bike shape meant none of the calculations had to change — they still take
one book — and migration is a wrap, not a rewrite. Rider-level things (fuel-card discounts,
pump prices, saved workshops) live in `prefs` and are shared across bikes.

**Migration.** The garage is stored under `motolog.v2`. On first run the old `motolog.v1`
book is read and wrapped as the first bike. The v1 key is never written again and never
deleted, so an older build still finds its data. Backups work the same way: a v2 file
restores the whole garage; a v1 file is recognised and *added as another bike* rather than
replacing everything, after asking.

## Features, and why they work the way they do

**Reminders.** Renewals escalate — 30, 14, 7 and 1 days before, on the day, then the day
after and a week after if nothing was done — at 9am. A custom warning longer than 30 days
adds a stage. Anything landing on the same morning is one notification, and with several
bikes each line says which. A web page cannot schedule notifications without a push server,
so on the web the Bike tab exports the same schedule as a calendar file (`.ics`, with
alarms): the phone's own calendar does the reminding and nothing leaves the device.

**Receipt photos.** Shrunk on the phone and kept in IndexedDB, not in the book — the book
is one JSON string in a small-quota store, and a few photos would start failing saves of
the records themselves. They are held as `data:` URLs because that is what
`img-src 'self' data:` allows; a `blob:` URL is refused, which is also why the picked file
is decoded with `createImageBitmap` rather than an `<img>`. Photos travel in backup files.
Unreferenced ones are dropped a few seconds after launch — but only when storage was read
successfully, so a failed read can never be mistaken for "nothing uses these".

**Fuel-card discounts.** Set the percentage you really get per brand; logging a fill at that
brand then takes the pump total and fills in what you paid. Both figures are kept, so Costs
can say what the cards have saved. **Pump prices** are entered by hand: Singapore has no
public feed of them, and scraping someone's site would be fragile and against their terms.
What the app adds is the ranking after *your* discounts, which no forecourt sign shows.

**COE.** `src/lib/coe.ts`. Renewal is the full PQP for 10 years or half for 5 (once only
for motorcycles). The rebate estimate is LTA's formula — premium paid × unused months ÷
months in the COE, leftover days as a fraction of 30 — and is labelled an estimate.

**Ride recording.** `src/lib/rides.ts` is the filter, `recorder.ts` the store. Phone GPS
drifts at a standstill and jumps under cover, so fixes worse than 35 m are dropped, movement
inside the noise floor is not counted, and a jump implying over 250 km/h is a glitch. The
route is thinned to a point every 25 m. The recorder lives outside React so a recording
survives switching tabs. **Limit:** a browser stops delivering GPS to a backgrounded page or
a locked phone, so the web app records only while open with the screen on (it holds a screen
wake lock where supported). Recording with the screen off needs the native app.

**Bike passport.** `src/lib/passport.ts` builds one plain-data description; the print view
and the downloadable single-page file both render it, so they cannot disagree. Costs and
the fuel log are opt-in. The file has no scripts and escapes everything typed by the owner.

**Level and badges.** Worked out from the log each time, never stored: deleting an entry
takes its XP back, and a restored backup arrives already counted.

**Guides.** `src/data/guides.ts`: four short guides and an eleven-symptom troubleshooter
with a ride / ride-gently / don't-ride flag, all in the bundle. Inspection is yearly from
the bike's third year — the default renewal interval used to say 24 months, which is the
rule for cars. Books coming in from v1 have that default corrected to 12 (`upgradeV1`);
an interval the rider typed themselves is left alone.

**Charts say what dates they cover.** The 12-month chart is headed with its range and
carries the year under the first bar and each January; the economy chart places each tank
at the date it was filled rather than spacing them evenly, so a long gap shows as one; and
the Costs tab states the first and last entry its totals run between.

## Online features

Signed out — the default — the app makes no network requests beyond loading itself, and
does not even download the Supabase library. The AI mechanic is a Netlify function in
`server/`, parked.

### AI mechanic — parked

Written and tested, but **not switched on and not deployed**: `AI_ENABLED` in
`src/lib/ai.ts` is `false`, so the Tools tab does not offer it and the app never calls
`/api/moto-ai`; `server/moto-ai.mjs` is not copied to `netlify/functions/`. To bring it
back: set the flag to `true`, copy the function across, and give the site a key as below.
What follows describes how it works once on.

The app sends the question and four facts about the bike (make, model, year, odometer);
the function adds the API key and forwards it. The key exists only in Netlify's environment
and never reaches a browser. The panel states exactly what is sent.

To switch it on: Netlify → Site configuration → Environment variables →
`ANTHROPIC_API_KEY` (from console.anthropic.com), then redeploy. Optional `MOTO_AI_MODEL`
overrides the model. Until the key is set the function reports that it is off and the app
shows "Not switched on yet" instead of a chat.

Guard rails: answers capped at 700 tokens, history at 12 turns of 1,200 characters, 12
requests a minute per visitor (Netlify rate limiting, in the function's `config`), requests
from other sites' pages refused, upstream errors logged for you but never shown to the
browser. **Set a monthly spend limit in the Anthropic console** — rate limits slow abuse,
a spend limit ends it.

### Account and sync — Supabase

Optional. Email and password, from the **Account** panel in the Bike tab. Project
`uderotopoaxwvjtyigqy`; the client is `src/lib/cloud.ts`, the logic `src/lib/records.ts`,
the database `supabase/schema.sql`.

**What's in the page.** The project URL and its *publishable* key. That key is meant to be
public: alone it can only sign in, and every table and the photo bucket are guarded by
row-level security, so a rider can only ever read or write their own rows. The secret key
and the database password are never in this repo and the app never needs them.

**What's stored.** One row per record — `settings` (your preferences), `bikes`, `entries`,
`rides` — with the record as `jsonb`, plus a few columns pulled out for querying (type,
date, odometer, amount, ride start, km). Which bike is selected and when this device last
backed up are about the device, so they stay local. Receipt photos go to the private
`receipts` bucket under `<your user id>/<photo id>.jpg` (JPEG only, 2 MB each).

**How sync works.** Each device keeps a snapshot of every record as last agreed with the
server (`motolog.cloud`), and the time it last changed each one. A round pulls what changed
since its last look (with a two-minute overlap), folds it in, sends what's new here, and
reads back what the server kept. The database trigger keeps the **later edit** of any record
and stamps every accepted write with server time; a deletion is a row marked `deleted`, so
it reaches devices that were offline. Two devices editing different things never collide.
Edits made while a round is in flight are replayed on top of its result (`rebase`). Rounds
run on launch, a few seconds after each change, when the app comes back to the foreground or
online, and every two minutes while it's open. Up to 12 photos move per round.

**First sign-in.** A fresh install simply becomes your account's garage. A device that
already has records merges them into the account, so signing in on your existing phone is
also the migration.

**Leaving.** *Sign out* asks whether to keep a copy on the device. *Delete account* removes
the photos through the Storage API, then calls `delete_me()`, which deletes the login; every
row goes with it (`on delete cascade`). The device keeps its own copy either way.

#### Setting up the Supabase project (once)

1. **SQL Editor** → paste all of `supabase/schema.sql` → Run.
2. **Authentication → URL Configuration**: Site URL `https://jabezgoh.netlify.app/moto/`,
   and add the same address under Redirect URLs. Confirmation and reset emails link there.
3. **Authentication → Sign In / Providers → Email**: on. "Confirm email" can stay on.
4. Supabase's built-in email sender only delivers to members of the project's team and only
   a few an hour. Fine for you; before anyone else signs up, add your own SMTP under
   **Authentication → Emails → SMTP Settings** (Resend, Brevo, etc.).
5. The site's `public/_headers` must allow the project in `connect-src` (it does).

### What was left out, and why

- **Live pump prices** — no official source; see Fuel-card discounts above.
- **Partner rewards** ("chops" at workshops) — needs real partner businesses, not code.
  Level and badges cover the game part.

## Data

On startup the app calls `navigator.storage.persist()`, which asks the browser to exempt this
origin from eviction under storage pressure. Chrome grants it silently for installed apps and
declines for a casual tab; Safari does not implement it. The Bike tab reports which state you
are actually in rather than assuming, alongside how long ago you last exported — that reminder
turns amber past 90 days, or immediately if there are entries and no backup at all. A CSV
export (one bike at a time) deliberately does **not** count as a backup, since it cannot be restored from.

Stored under `motolog.v2` — `localStorage` on the web, native Preferences in the app shell —
with receipt photos in IndexedDB (`motolog-photos`).
**Per browser and per origin**: the installed PWA, the hosted claude.ai artifact and a local
`bundle.html` each keep their own separate garage, and a native build would keep a fourth. Pick
one as the real log, or sign in on each so they share one account. Back it up from the Bike tab; the JSON export is also
the migration path onto a native build.
