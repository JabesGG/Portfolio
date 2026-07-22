# Portfolio — Jabez Goh Dong Han

A static portfolio built with [Astro](https://astro.build). No JavaScript ships
to the browser; the whole site is HTML and one stylesheet.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # writes to dist/
npm run preview  # serve the built site locally
```

Node 18 or newer.

## Edit the content

Everything you will want to change lives in **`src/data/portfolio.js`**. It is
plain JavaScript objects with comments — you do not need to touch any `.astro`
files to update your details, add a project, or reword a bullet.

| What | Where |
| --- | --- |
| Name, statement, email, links | `profile` |
| The three "how I work" points | `focus` |
| Jobs and internships | `experience` |
| Schools | `education` |
| Skill chips | `skills` |
| Project cards | `projects` |
| Header values shown in the audit panel | `securityHeaders` |

### Before you publish

1. **Real contact details.** The email, phone and social links are placeholders.
2. **Your resume PDF.** Drop it at `public/resume.pdf`.
3. **Project screenshots.** Replace the three files in `public/projects/`.
   Anything around 1200×750 works. Keep the same filenames or update the
   `image` field.
4. **Fill in the project write-ups.** The `detail` fields currently contain
   prompts telling you what to write. Do not ship those.
5. **Check your dates.** Your Wix site describes you as a final-year student
   while listing a 2025–2028 diploma. Pick whichever is true.

## Deploy

**Cloudflare Pages** (recommended — it applies the security headers):

1. Push this folder to a GitHub repo.
2. Cloudflare Pages → Create project → connect the repo.
3. Build command `npm run build`, output directory `dist`.
4. Add your custom domain under the project's Custom domains tab.

Netlify works identically and reads the same `public/_headers` file.

GitHub Pages will host the site fine but **cannot set custom response headers**,
which means the audit section on the page would be claiming something untrue.
If you use GitHub Pages, either put Cloudflare in front of it or remove that
section.

## The security headers

`public/_headers` sets six response headers. The page displays those same values
in its Audit section, so **the two files must agree** — if you edit one, edit the
other. Claiming a header you do not send is exactly the kind of thing an
interviewer will check.

After deploying, run the site through <https://securityheaders.com>. You should
get an A or A+.

### Getting to a stricter CSP

The current policy allows stylesheets from `fonts.googleapis.com` and fonts from
`fonts.gstatic.com`, because the typefaces load from Google. That is a real
dependency on a third-party origin, and it is worth removing:

1. Download the Archivo, IBM Plex Sans and IBM Plex Mono `.woff2` files.
2. Put them in `public/fonts/` and declare them with `@font-face` in
   `src/styles/global.css`.
3. Delete the two `<link>` tags from `src/layouts/Base.astro`.
4. Simplify the CSP in `public/_headers` to `default-src 'self'`.

That also makes the site faster and stops Google seeing your visitors. Good
thing to be able to explain in an interview.

## Structure

```
src/
  data/portfolio.js     all content
  layouts/Base.astro    <head>, fonts, page shell, footer
  pages/index.astro     section markup
  styles/global.css     design tokens and all styling
public/
  _headers              security headers (Cloudflare / Netlify)
  projects/             screenshots
  favicon.svg
```

## Design notes

Drafting-paper palette rather than the black-and-neon-green that most security
portfolios use — the visual language comes from technical drawing and
instrumentation, which connects to the electronics engineering background rather
than to hacker iconography. Type is Archivo (display, set wide), IBM Plex Sans
(body) and IBM Plex Mono (labels and data).

Sections are marked by year rather than by decorative numbering, because the
chronology carries real information. The one deliberately bold element is the
Audit panel — a portfolio that demonstrates the claim instead of asserting it.
