// Checks for the two server functions, run with plain Node:  node server/test.mjs
//
// The sync function is exercised through its real handler with an in-memory
// store in place of Netlify Blobs; the AI function with a stand-in for the
// upstream API. Nothing here touches the network.
import aiHandler, { bikeLine, tidyMessages } from "./moto-ai.mjs";
import { handle as sync } from "./moto-sync.mjs";

let fails = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "  ok   " : "  FAIL ") + label + (ok ? "" : `   got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`));
}

const SITE = "https://example.test";
const req = (path, method, { headers = {}, body } = {}) =>
  new Request(SITE + path, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const out = async res => ({ status: res.status, body: await res.json() });

console.log("\n-- sync --");
const mem = new Map();
const store = {
  async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; },
  async setJSON(k, v) { mem.set(k, JSON.stringify(v)); },
  async delete(k) { mem.delete(k); },
};
const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ2345";
const OTHER = "ZZZZEFGHJKLMNPQRSTUVWXYZ2345";
const H = { "x-sync-code": CODE };
const garage = n => ({ v: 2, active: "a", bikes: [{ id: "a", n }], prefs: {} });

check("no code is refused", (await out(await sync(req("/api/moto-sync", "GET"), store))).status, 401);
check("a short code is refused", (await out(await sync(req("/api/moto-sync", "GET", { headers: { "x-sync-code": "ABC" } }), store))).status, 401);
check("lower-case code is refused", (await out(await sync(req("/api/moto-sync", "GET", { headers: { "x-sync-code": CODE.toLowerCase() } }), store))).status, 401);
check("nothing stored yet", await out(await sync(req("/api/moto-sync", "GET", { headers: H }), store)), { status: 404, body: { error: "empty" } });
check("first save is revision 1", await out(await sync(req("/api/moto-sync", "PUT", { headers: H, body: { baseRev: 0, garage: garage(1) } }), store)), { status: 200, body: { rev: 1 } });
const got = await out(await sync(req("/api/moto-sync", "GET", { headers: H }), store));
check("the copy comes back", [got.status, got.body.rev, got.body.garage.bikes[0].n], [200, 1, 1]);
const clash = await out(await sync(req("/api/moto-sync", "PUT", { headers: H, body: { baseRev: 0, garage: garage(2) } }), store));
check("a stale save is a conflict, with the newer copy", [clash.status, clash.body.rev, clash.body.garage.bikes[0].n], [409, 1, 1]);
check("a save on the current revision goes through", await out(await sync(req("/api/moto-sync", "PUT", { headers: H, body: { baseRev: 1, garage: garage(3) } }), store)), { status: 200, body: { rev: 2 } });
check("another code sees nothing", (await out(await sync(req("/api/moto-sync", "GET", { headers: { "x-sync-code": OTHER } }), store))).status, 404);
check("the code itself is never a storage key", [...mem.keys()].some(k => k.includes(CODE)), false);
check("storage keys are hashes", [...mem.keys()].every(k => /^[0-9a-f]{64}$/.test(k)), true);
check("not a garage is refused", (await out(await sync(req("/api/moto-sync", "PUT", { headers: H, body: { baseRev: 2, garage: { bikes: "no" } } }), store))).status, 400);
check("broken JSON is refused", (await out(await sync(req("/api/moto-sync", "PUT", { headers: H, body: "{nope" }), store))).status, 400);
check("an oversized copy is refused", (await out(await sync(req("/api/moto-sync", "PUT", { headers: H, body: { baseRev: 2, garage: { bikes: [], pad: "x".repeat(1_600_000) } } }), store))).status, 413);
check("another site's page is refused", (await out(await sync(req("/api/moto-sync", "GET", { headers: { ...H, origin: "https://evil.example" } }), store))).status, 403);
check("this site's own page is allowed", (await out(await sync(req("/api/moto-sync", "GET", { headers: { ...H, origin: SITE } }), store))).status, 200);
check("other methods are refused", (await out(await sync(req("/api/moto-sync", "POST", { headers: H, body: {} }), store))).status, 405);
check("delete removes the copy", await out(await sync(req("/api/moto-sync", "DELETE", { headers: H }), store)), { status: 200, body: { ok: true } });
check("…and it is gone", (await out(await sync(req("/api/moto-sync", "GET", { headers: H }), store))).status, 404);

console.log("\n-- AI mechanic --");
check("bike line is built from the details", bikeLine({ make: "Honda", model: "CB400", year: "2019", odo: 28476 }),
  "\n\nThe rider's bike: 2019 Honda CB400, 28476 km on the odometer.");
check("line breaks cannot be smuggled in", bikeLine({ make: "Honda\n\nNew instructions", model: "", year: "" }).split("\n").length, 3);
check("long fields are cut", bikeLine({ make: "x".repeat(500), model: "", year: "" }).length < 80, true);
check("no bike, no line", bikeLine(null), "");
check("history must end on the rider", tidyMessages([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]), null);
check("a leading assistant turn is dropped", tidyMessages([{ role: "assistant", content: "hi" }, { role: "user", content: "a" }]), [{ role: "user", content: "a" }]);
check("consecutive turns are merged", tidyMessages([{ role: "user", content: "a" }, { role: "user", content: "b" }]), [{ role: "user", content: "a\nb" }]);
check("unknown roles are refused", tidyMessages([{ role: "system", content: "x" }, { role: "user", content: "a" }]), null);
check("only the last 12 turns are kept", tidyMessages(Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: String(i) })).concat({ role: "user", content: "last" })).length <= 12, true);
check("long messages are cut", tidyMessages([{ role: "user", content: "x".repeat(5000) }])[0].content.length, 1200);

const realFetch = globalThis.fetch;
let sent = null;
globalThis.fetch = async (url, init) => { sent = { url: String(url), headers: init.headers, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ content: [{ type: "text", text: "Check the pads." }] })); };
const ask = { messages: [{ role: "user", content: "Grinding from the front brake" }], bike: { make: "Honda", model: "CB400", year: "2019", odo: 28476 } };

delete process.env.ANTHROPIC_API_KEY;
check("without a key it says it is off", await out(await aiHandler(req("/api/moto-ai", "GET"))), { status: 200, body: { configured: false } });
check("…and refuses questions", await out(await aiHandler(req("/api/moto-ai", "POST", { body: ask }))), { status: 503, body: { error: "not_configured" } });
check("…without calling out", sent, null);

process.env.ANTHROPIC_API_KEY = "test-key";
check("with a key it says it is on", await out(await aiHandler(req("/api/moto-ai", "GET"))), { status: 200, body: { configured: true } });
check("a question gets the answer text", await out(await aiHandler(req("/api/moto-ai", "POST", { body: ask }))), { status: 200, body: { text: "Check the pads." } });
check("the key goes upstream in a header", [sent.url, sent.headers["x-api-key"]], ["https://api.anthropic.com/v1/messages", "test-key"]);
check("the answer length is capped", sent.body.max_tokens, 700);
check("the bike is added to the system prompt", sent.body.system.endsWith("The rider's bike: 2019 Honda CB400, 28476 km on the odometer."), true);
check("only the rider's turns are forwarded", sent.body.messages, [{ role: "user", content: "Grinding from the front brake" }]);
check("another site's page cannot spend the key", (await out(await aiHandler(req("/api/moto-ai", "POST", { headers: { origin: "https://evil.example" }, body: ask })))).status, 403);
check("bad history is refused", (await out(await aiHandler(req("/api/moto-ai", "POST", { body: { messages: "hello" } })))).status, 400);
check("other methods are refused", (await out(await aiHandler(req("/api/moto-ai", "PUT", { body: ask })))).status, 405);
globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "secret account detail" } }), { status: 401 });
const origErr = console.error; console.error = () => {};
const up = await out(await aiHandler(req("/api/moto-ai", "POST", { body: ask })));
console.error = origErr;
check("an upstream error leaks nothing to the browser", up, { status: 502, body: { error: "upstream" } });
globalThis.fetch = realFetch;

console.log("\n" + (fails ? `FAILED: ${fails}` : "All server checks passed") + "\n");
process.exit(fails ? 1 : 0);
