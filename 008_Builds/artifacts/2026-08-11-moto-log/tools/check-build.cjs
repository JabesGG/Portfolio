/* Checks the built app for the two failures that have shipped before and that
   nothing else would catch, because the code looks right in both cases:

   1. Tailwind dropping a class that is assembled at runtime (the tell-tale
      colours once went missing this way — every lamp rendered colourless).
   2. Anything inline in index.html. The site's CSP is `script-src 'self'` and
      `style-src 'self'`, so an inline script, style or import map is blocked
      outright and the page fails in production while working locally.

   Run after the build:  node tools/check-build.cjs
*/
const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const MUST_HAVE = [".lamp--red", ".lamp--amber", ".lamp--green", ".lamp--unset", ".chat__m--user", ".chat__m--assistant", ".badge--got", ".backup--stale"];

let bad = 0;
const fail = msg => { bad++; console.error("  FAIL " + msg); };

const files = fs.readdirSync(dist);
const css = files.filter(f => f.endsWith(".css")).map(f => fs.readFileSync(path.join(dist, f), "utf8")).join("\n");
if (!css) fail("no stylesheet in dist/");
for (const cls of MUST_HAVE) if (!css.includes(cls)) fail(`stylesheet is missing ${cls} — add it to safelist in tailwind.config.js`);

const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail("index.html has an inline <script> — the CSP will block it");
if (/type=["']?importmap/i.test(html)) fail("index.html has an import map — the CSP will block it");
if (/<style[\s>]/i.test(html)) fail("index.html has an inline <style> — the CSP will block it");
if (/\sstyle=/i.test(html)) fail("index.html has an inline style attribute — the CSP will block it");

if (!files.includes("sw.js")) fail("dist/sw.js is missing — run tools/make-sw.cjs first");

console.log(bad ? `build check FAILED (${bad})` : "build check passed");
process.exit(bad ? 1 : 0);
