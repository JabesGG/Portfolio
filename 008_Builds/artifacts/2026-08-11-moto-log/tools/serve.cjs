/* Serves the built app from portfolio/public/moto at http://localhost:4173/moto/,
   applying the *real* Content-Security-Policy read straight out of public/_headers.
   Testing under a hand-copied CSP would drift from production; reading the actual
   file means a policy change breaks the local run too, which is the point.

   localhost is a secure context, so the service worker registers here exactly as
   it does on Netlify — including offline behaviour if you stop this server.

   Run via `.claude/launch.json` → "moto-pwa", or: node tools/serve.cjs
*/
const http = require("http");
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "../../../.."); // .../portfolio
const ROOT = path.join(REPO, "public", "moto");
const HEADERS_FILE = path.join(REPO, "public", "_headers");
const PORT = 4173;

function cspFromHeaders() {
  try {
    const txt = fs.readFileSync(HEADERS_FILE, "utf8");
    const line = txt.split(/\r?\n/).find(l => /^\s*Content-Security-Policy:/i.test(l));
    if (line) return line.replace(/^\s*Content-Security-Policy:\s*/i, "").trim();
  } catch { /* fall through */ }
  return null;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

if (!fs.existsSync(ROOT)) {
  console.error(`No build at ${ROOT}. See the README for the build commands.`);
  process.exit(1);
}

const CSP = cspFromHeaders();

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  if (!p.startsWith("/moto")) {
    res.writeHead(302, { Location: "/moto/" });
    return res.end();
  }
  p = p.slice("/moto".length) || "/";
  if (p === "/" || p === "") p = "/index.html";

  const file = path.join(ROOT, p);
  if (!path.resolve(file).startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }

  fs.readFile(file, (err, buf) => {
    const headers = { "Cache-Control": "no-cache" };
    if (CSP) headers["Content-Security-Policy"] = CSP;
    if (err) {
      res.writeHead(404, { ...headers, "Content-Type": "text/plain" });
      return res.end("404 " + p);
    }
    headers["Content-Type"] = TYPES[path.extname(file)] || "application/octet-stream";
    res.writeHead(200, headers);
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`Moto Log: http://localhost:${PORT}/moto/`);
  console.log(CSP ? `CSP from public/_headers: ${CSP.slice(0, 72)}...` : "WARNING: no CSP found in public/_headers");
});
