# Builds

Standalone tools and artifacts built alongside the portfolio.

| Date | Name | Type | What it is |
|------|------|------|------------|
| 2026-08-11 | [Moto Log](artifacts/2026-08-11-moto-log/) | Installable PWA | Motorcycle service intervals, renewal dates and running costs. Odometer-driven tell-tales, full-to-full fuel economy, SGD/km. React + TS + Tailwind + shadcn, bundled by Parcel. Deployed with the site at `/moto/`; installs to a phone home screen and runs offline. |

## Note on `public/moto/`

The built Moto Log app is committed to `portfolio/public/moto/`, which Astro copies verbatim
into the deploy. It is build output, kept in the repo on purpose so Netlify does not need a
second build step. Regenerate it from
[`008_Builds/artifacts/2026-08-11-moto-log/`](artifacts/2026-08-11-moto-log/) — see that
README for the build commands and the Windows gotchas.
