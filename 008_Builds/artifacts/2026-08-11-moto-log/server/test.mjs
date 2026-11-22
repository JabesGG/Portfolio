// Checks for the server function (the parked AI mechanic), run with plain
// Node:  node server/test.mjs
//
// It is exercised with a stand-in for the upstream API. Nothing here touches
// the network. Sync no longer has a server function of ours: it is Supabase,
// and its rules are tested by supabase/test-schema.mjs.
import aiHandler, { bikeLine, tidyMessages } from "./moto-ai.mjs";

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
