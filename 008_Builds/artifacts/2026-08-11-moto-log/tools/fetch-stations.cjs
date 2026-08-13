/* Fetches every petrol station in Singapore from OpenStreetMap and bakes the
   result into src/data/stations.json.
 *
 * Run at build time, never at runtime: the app must work at a pump with no
 * signal, and a live query would also need `connect-src` opened up in the
 * site's CSP. Re-run this occasionally — stations open and close.
 *
 *   node tools/fetch-stations.cjs
 */
const fs = require("fs");
const path = require("path");

// Overpass rejects requests without a User-Agent, and the main instance is
// often busy — so identify ourselves and fall through to the mirrors.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];
const UA = "moto-log-station-list/1.0 (personal project; build-time, one-off)";

// Nodes and ways both occur: a forecourt is often mapped as a polygon, so ask
// for centres too and treat them alike.
const QUERY = `
[out:json][timeout:90];
area["ISO3166-1"="SG"][admin_level=2]->.sg;
(
  node["amenity"="fuel"](area.sg);
  way["amenity"="fuel"](area.sg);
);
out center tags;
`;

/** Tidies OSM's inconsistent brand spellings into what is on the sign.
 *  Deliberately does NOT fall back to tags.name — that put things like
 *  "Refuelling Station" in the brand column, and the name is shown anyway. */
function normaliseBrand(tags) {
  const raw = (tags.brand || tags.operator || "").trim();
  const b = raw.toLowerCase();
  if (b.includes("shell")) return "Shell";
  if (b.includes("caltex")) return "Caltex";
  if (b.includes("esso") || b.includes("exxon")) return "Esso";
  if (b.includes("sinopec")) return "Sinopec";
  if (b.includes("spc") || b.includes("singapore petroleum")) return "SPC";
  if (b.includes("smart energy")) return "SMART Energy";
  if (b.includes("cnergy")) return "Cnergy";
  return raw;
}

(async () => {
  let json = null;
  for (const endpoint of ENDPOINTS) {
    process.stdout.write(`querying ${new URL(endpoint).host}… `);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
          "Accept": "application/json",
        },
        body: "data=" + encodeURIComponent(QUERY),
      });
      if (!res.ok) { console.log(`${res.status} ${res.statusText}`); continue; }
      json = await res.json();
      break;
    } catch (e) {
      console.log("failed: " + (e.cause?.code || e.message));
    }
  }
  if (!json) throw new Error("every Overpass endpoint refused; try again later");
  console.log(`${json.elements.length} raw elements`);

  const seen = new Set();
  const stations = [];
  for (const el of json.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = el.tags || {};
    const brand = normaliseBrand(tags);
    const name = (tags.name || brand || "Petrol station").trim();

    // A forecourt mapped as both a node and a way would otherwise appear twice.
    const key = `${name}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Many forecourts are named only "Shell" or "SPC", which makes two nearby
    // ones indistinguishable in a list. The street disambiguates them.
    const street = (tags["addr:street"] || "").trim();

    stations.push({
      name,
      brand,
      ...(street && street !== name ? { street } : {}),
      lat: +lat.toFixed(5),   // ~1m precision; more is noise from a phone GPS
      lon: +lon.toFixed(5),
    });
  }

  stations.sort((a, b) => a.name.localeCompare(b.name));

  const out = path.join(__dirname, "..", "src", "data", "stations.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(stations));

  const byBrand = {};
  for (const s of stations) byBrand[s.brand || "(unbranded)"] = (byBrand[s.brand || "(unbranded)"] || 0) + 1;
  console.log(`${stations.length} stations → src/data/stations.json (${(fs.statSync(out).size / 1024).toFixed(1)} kB)`);
  for (const [b, n] of Object.entries(byBrand).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${b}`);
})();
