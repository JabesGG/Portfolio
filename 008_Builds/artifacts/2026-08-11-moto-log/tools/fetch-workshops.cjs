/* Fetches motorcycle workshops, dealers and parts shops in Singapore from
   OpenStreetMap and bakes the result into src/data/workshops.json.
 *
 * Build time only, for the same reasons as fetch-stations.cjs: the list has to
 * work with no signal, and a live query would mean opening connect-src in the
 * site's CSP for a third party.
 *
 * OSM's coverage here is thin (a few dozen of several hundred shops), which is
 * why the app also lets riders save their own. Re-run occasionally:
 *
 *   node tools/fetch-workshops.cjs
 */
const fs = require("fs");
const path = require("path");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];
const UA = "moto-log-workshop-list/1.0 (personal project; build-time, one-off)";

const QUERY = `
[out:json][timeout:90];
area["ISO3166-1"="SG"][admin_level=2]->.sg;
(
  nwr["shop"="motorcycle"](area.sg);
  nwr["shop"="motorcycle_repair"](area.sg);
  nwr["craft"="motorcycle_repair"](area.sg);
  nwr["service:vehicle:motorcycle"="yes"](area.sg);
  nwr["motorcycle:repair"="yes"](area.sg);
  nwr["motorcycle"="repair"](area.sg);
);
out center tags;
`;

/** OSM separates "sells bikes" from "fixes bikes"; riders mostly want the second. */
function kindOf(t) {
  const repair = t.shop === "motorcycle_repair" || t.craft === "motorcycle_repair" ||
    t["service:motorcycle:repair"] === "yes" || t["motorcycle:repair"] === "yes" || t.shop === "car_repair";
  return repair ? "repair" : "shop";
}

(async () => {
  let json = null;
  for (const endpoint of ENDPOINTS) {
    process.stdout.write(`querying ${new URL(endpoint).host}… `);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, "Accept": "application/json" },
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
  const out = [];
  for (const el of json.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const t = el.tags || {};
    // An unnamed pin is no use to someone choosing where to take their bike.
    const name = (t.name || t.brand || "").trim();
    if (!name) continue;

    const key = `${name}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ").trim();
    const phone = (t.phone || t["contact:phone"] || "").trim();
    const web = (t.website || t["contact:website"] || "").trim();
    const hours = (t.opening_hours || "").trim();

    out.push({
      name,
      kind: kindOf(t),
      ...(street ? { street } : {}),
      ...(phone ? { phone } : {}),
      // Only real web links: this ends up in an href.
      ...(/^https?:\/\//i.test(web) ? { web } : {}),
      ...(hours ? { hours } : {}),
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
    });
  }

  out.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.lat - b.lat);

  const file = path.join(__dirname, "..", "src", "data", "workshops.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));

  const repair = out.filter(w => w.kind === "repair").length;
  console.log(`${out.length} places → src/data/workshops.json (${(fs.statSync(file).size / 1024).toFixed(1)} kB)`);
  console.log(`   ${String(repair).padStart(4)}  workshops`);
  console.log(`   ${String(out.length - repair).padStart(4)}  dealers / parts`);
  console.log(`   ${String(out.filter(w => w.phone).length).padStart(4)}  with a phone number`);
})();
