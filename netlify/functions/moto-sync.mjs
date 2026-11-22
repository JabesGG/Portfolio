// Netlify Function — optional device sync for Moto Log (/moto/).
//
// No accounts. The app makes a long random code and sends it in a header; the
// garage is stored in Netlify Blobs under the SHA-256 of that code, so the code
// itself is never written anywhere on the server. Whoever holds the code can
// read, replace or delete that one copy and nothing else.
//
// Needs no configuration: Netlify Blobs is part of every Netlify site.
//
//   GET     → { rev, updated, garage }      404 { error: "empty" } if none
//   PUT     ← { baseRev, garage }           409 { rev, garage } if someone else
//           → { rev }                           saved since baseRev
//   DELETE  → { ok: true }

import { getStore } from "@netlify/blobs";

const MAX_BYTES = 1_500_000;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

async function keyFor(code) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("moto-log:" + code));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** The handler proper, with the store passed in so it can be tested without Netlify. */
export async function handle(req, store) {
  if (!sameOrigin(req)) return json(403, { error: "origin" });

  // 140 bits of code is the whole of the security here, so insist on its shape.
  const code = (req.headers.get("x-sync-code") || "").trim();
  if (!/^[A-Z0-9]{24,64}$/.test(code)) return json(401, { error: "code" });
  const key = await keyFor(code);

  if (req.method === "GET") {
    const cur = await store.get(key, { type: "json" });
    return cur ? json(200, cur) : json(404, { error: "empty" });
  }

  if (req.method === "DELETE") {
    await store.delete(key);
    return json(200, { ok: true });
  }

  if (req.method !== "PUT") return json(405, { error: "method" });

  let body;
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) return json(413, { error: "too_large" });
    body = JSON.parse(text);
  } catch { return json(400, { error: "bad_json" }); }

  const garage = body?.garage;
  if (!garage || typeof garage !== "object" || !Array.isArray(garage.bikes)) return json(400, { error: "bad_garage" });

  const cur = await store.get(key, { type: "json" });
  const curRev = Number(cur?.rev) || 0;
  // Someone else saved since this device last looked: hand their copy back
  // rather than silently overwriting it.
  if (cur && curRev !== (Number(body.baseRev) || 0)) return json(409, { rev: curRev, garage: cur.garage });

  const rev = curRev + 1;
  await store.setJSON(key, { rev, updated: new Date().toISOString(), garage });
  return json(200, { rev });
}

export default async function handler(req) {
  return handle(req, getStore("moto-sync"));
}

export const config = {
  path: "/api/moto-sync",
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
