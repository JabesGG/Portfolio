import { statusOf, dateStatus, fuelRuns, totals, monthlySpend, entriesSorted } from "./src/lib/calc";
import { dueNotifications } from "./src/lib/reminders";
import { distanceKm, bearingDeg, compass, nearest, prettyDistance, STATIONS } from "./src/lib/stations";
import { addMonths, agoLabel, backupIsStale, dmy, money, km } from "./src/lib/format";
import type { State } from "./src/lib/types";

const S: State = {
  v: 1,
  bike: { name: "", make: "Honda", model: "CB400 Super Four", year: "2019",
          plate: "FBA1234X", regDate: "2019-03-14", odo: 28476, startOdo: 21000, tank: 18 },
  schedule: [
    { id: "s1", n: "Engine oil",         km: 3000,  months: 6,  baseOdo: null,  baseDate: "" },
    { id: "s2", n: "Oil filter",         km: 6000,  months: 12, baseOdo: null,  baseDate: "" },
    { id: "s3", n: "Chain clean & lube", km: 500,   months: 1,  baseOdo: 27900, baseDate: "2026-07-20" },
    { id: "s4", n: "Rear tyre",          km: 10000, months: 0,  baseOdo: 19000, baseDate: "2024-02-01" },
    { id: "s5", n: "Valve clearance",    km: 24000, months: 0,  baseOdo: null,  baseDate: "" },
  ],
  dates: [
    { id: "d1", n: "Road tax",           due: "2026-09-05", months: 12, remind: 30 },
    { id: "d2", n: "Insurance",          due: "2027-03-01", months: 12, remind: 30 },
    { id: "d3", n: "Vehicle inspection", due: "",           months: 24, remind: 30 },
    { id: "d4", n: "COE expiry",         due: "2029-03-14", months: 0,  remind: 60 },
  ],
  entries: [
    { id:"f1", type:"fuel", date:"2026-06-01", odo:26000, litres:12.0, amount:28.80, station:"Shell Bishan", full:true },
    { id:"f2", type:"fuel", date:"2026-06-20", odo:26380, litres:12.4, amount:29.76, station:"Caltex AMK",   full:true },
    { id:"f3", type:"fuel", date:"2026-07-10", odo:26760, litres:12.1, amount:29.04, station:"Shell Bishan", full:true },
    { id:"f4", type:"fuel", date:"2026-07-28", odo:27150, litres:12.9, amount:30.96, station:"SPC Yishun",   full:true },
    { id:"f5", type:"fuel", date:"2026-08-08", odo:27560, litres:13.2, amount:31.68, station:"Shell Bishan", full:true },
    { id:"v1", type:"service", date:"2026-06-15", odo:26200, items:["s1","s2"], amount:85, shop:"Ah Seng Motor", label:"", note:"Semi-syn" },
    { id:"x1", type:"expense", date:"2026-03-01", odo:0, cat:"Road tax",      amount:70 },
    { id:"x2", type:"expense", date:"2026-03-01", odo:0, cat:"Insurance",     amount:420 },
    { id:"x3", type:"expense", date:"2026-08-01", odo:0, cat:"Parking & ERP", amount:18 },
  ],
};

let fails = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = String(got) === String(want);
  if (!ok) fails++;
  console.log((ok ? "  ok   " : "  FAIL ") + label + " = " + got + (ok ? "" : `   (expected ${want})`));
}

console.log("\n-- date maths --");
check("addMonths +6", addMonths("2026-06-15", 6), "2026-12-15");
check("addMonths clamps to month end", addMonths("2026-01-31", 1), "2026-02-28");
check("COE = reg + 120 months", addMonths("2019-03-14", 120), "2029-03-14");
check("dmy", dmy("2026-09-05"), "5 Sep 2026");

console.log("\n-- fuel economy (full-to-full) --");
const runs = fuelRuns(S);
check("5 full fills -> 4 runs", runs.length, 4);
check("run 1 dist", runs[0].dist, 380);
check("run 1 litres", runs[0].litres, 12.4);
check("run 1 km/L", runs[0].kmpl.toFixed(2), (380 / 12.4).toFixed(2));
check("run 4 km/L", runs[3].kmpl.toFixed(2), (410 / 13.2).toFixed(2));

console.log("\n-- totals --");
const t = totals(S);
check("total spent", t.total.toFixed(2), (28.80+29.76+29.04+30.96+31.68+85+70+420+18).toFixed(2));
check("distance tracked", t.dist, 28476 - 21000);
check("cost per km", t.perKm.toFixed(4), (t.total / 7476).toFixed(4));
check("avg km/L", t.kmpl.toFixed(3), ((380+380+390+410) / (12.4+12.1+12.9+13.2)).toFixed(3));
check("avg $/litre", t.perL.toFixed(3), ((28.80+29.76+29.04+30.96+31.68) / (12.0+12.4+12.1+12.9+13.2)).toFixed(3));
check("fuel category", t.byCat["Fuel"].toFixed(2), "150.24");
check("service category", t.byCat["Service & parts"].toFixed(2), "85.00");
check("road tax category", t.byCat["Road tax"].toFixed(2), "70.00");

console.log("\n-- schedule status (odo 28476) --");
const st: Record<string, ReturnType<typeof statusOf>> = {};
S.schedule.forEach(i => { st[i.id] = statusOf(S, i); });
check("engine oil level", st.s1.level, "green");
check("engine oil headline", st.s1.headline, "in 724 km");
check("logged service overrides baseline", st.s1.sub, "Last 15 Jun 2026 · 26,200 km");
check("chain lube level", st.s3.level, "red");
check("chain lube headline", st.s3.headline, "76 km over");
check("rear tyre level", st.s4.level, "amber");
check("rear tyre headline", st.s4.headline, "in 524 km");
check("valve clearance level", st.s5.level, "unset");

console.log("\n-- renewal dates (today " + new Date().toISOString().slice(0, 10) + ") --");
const d: Record<string, ReturnType<typeof dateStatus>> = {};
S.dates.forEach(x => { d[x.id] = dateStatus(x); });
check("road tax (25 days out, warn 30)", d.d1.level, "amber");
check("insurance", d.d2.level, "green");
check("inspection, no date", d.d3.level, "unset");
check("COE", d.d4.level, "green");

console.log("\n-- ordering & formatting --");
check("newest first", entriesSorted(S)[0].id, "f5");
check("money", money(1234.5), "$1,234.50");
check("km", km(28476), "28,476");
const ms = monthlySpend(S, 12);
check("12 buckets", ms.length, 12);
check("Aug 2026 bucket", ms[ms.length - 1].total.toFixed(2), (31.68 + 18).toFixed(2));

console.log("\n-- reminders (pure scheduling logic) --");
// Fixed clock: these assertions must not drift with the real date.
const NOW = new Date(2026, 7, 11, 12, 0, 0); // 11 Aug 2026, local
const due = dueNotifications(S, NOW);
const ids = due.map(d => d.id).sort();

check("road tax warn window already passed, so not scheduled", ids.includes("date:d1"), false);
check("road tax expiry-day reminder scheduled", ids.includes("date:d1:day"), true);
check("engine oil (6mth from 15 Jun) scheduled", ids.includes("svc:s1"), true);
check("oil filter (12mth) scheduled", ids.includes("svc:s2"), true);
check("chain lube (1mth from 20 Jul) scheduled", ids.includes("svc:s3"), true);
check("rear tyre is km-only, never scheduled", ids.includes("svc:s4"), false);
check("valve clearance is km-only, never scheduled", ids.includes("svc:s5"), false);
check("inspection has no date, so nothing scheduled", ids.some(i => i.startsWith("date:d3")), false);
// Every dated renewal still ahead of its warning window yields two: the warning
// and the expiry day itself. Insurance and COE are both far out, so both give 2.
check("insurance gives warning + expiry day", ids.filter(i => i.startsWith("date:d2")).length, 2);
check("COE gives warning + expiry day", ids.filter(i => i.startsWith("date:d4")).length, 2);
check("total scheduled", due.length, 1 + 2 + 2 + 3);

const oil = due.find(d => d.id === "svc:s1")!;
check("engine oil fires 7 days before due", oil.at.toISOString().slice(0, 10), "2026-12-08");
check("reminders fire at 9am local", oil.at.getHours(), 9);

// Wind the clock back: now the road-tax warning is still ahead of us.
const early = dueNotifications(S, new Date(2026, 6, 1, 12, 0, 0));
check("30-day road tax warning scheduled when still ahead", early.some(d => d.id === "date:d1"), true);
const rt = early.find(d => d.id === "date:d1")!;
check("road tax warning is 30 days before 5 Sep", rt.at.toISOString().slice(0, 10), "2026-08-06");

// Nothing in the past should ever be scheduled.
const late = dueNotifications(S, new Date(2030, 0, 1));
check("no reminders scheduled once everything is in the past", late.length, 0);

console.log("\n-- backup reminder --");
// agoLabel reads the real clock, so build the fixtures relative to today.
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = d.getMonth() + 1, day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${day < 10 ? "0" : ""}${day}`;
};

check("never backed up", agoLabel(undefined), "Never backed up");
check("today", agoLabel(daysAgo(0)), "Backed up today");
check("yesterday", agoLabel(daysAgo(1)), "Backed up yesterday");
check("10 days", agoLabel(daysAgo(10)), "Backed up 10 days ago");
check("30 days stays in days", agoLabel(daysAgo(30)), "Backed up 30 days ago");
check("31 days rolls to months", agoLabel(daysAgo(31)), "Backed up 1 month ago");
check("200 days", agoLabel(daysAgo(200)), "Backed up 7 months ago");
check("400 days", agoLabel(daysAgo(400)), "Backed up over 1 year ago");

check("empty book is never stale", backupIsStale(undefined, false), false);
check("entries but no backup is stale", backupIsStale(undefined, true), true);
check("backed up today is not stale", backupIsStale(daysAgo(0), true), false);
check("90 days is not yet stale", backupIsStale(daysAgo(90), true), false);
check("91 days is stale", backupIsStale(daysAgo(91), true), true);

console.log("\n-- nearest fuel --");
// Known Singapore landmarks, checked against real-world distances.
const MARINA_BAY = { lat: 1.2834, lon: 103.8607 };
const CHANGI     = { lat: 1.3644, lon: 103.9915 };
const JURONG     = { lat: 1.3329, lon: 103.7436 };

const d1 = distanceKm(MARINA_BAY.lat, MARINA_BAY.lon, CHANGI.lat, CHANGI.lon);
check("Marina Bay → Changi ≈ 17 km", Math.round(d1), 17);
const d2 = distanceKm(MARINA_BAY.lat, MARINA_BAY.lon, JURONG.lat, JURONG.lon);
check("Marina Bay → Jurong ≈ 14 km", Math.round(d2), 14);
check("distance to self is 0", distanceKm(1.3, 103.8, 1.3, 103.8), 0);
check("distance is symmetric",
  distanceKm(MARINA_BAY.lat, MARINA_BAY.lon, CHANGI.lat, CHANGI.lon).toFixed(6),
  distanceKm(CHANGI.lat, CHANGI.lon, MARINA_BAY.lat, MARINA_BAY.lon).toFixed(6));

check("due north is N", compass(bearingDeg(1.30, 103.80, 1.40, 103.80)), "N");
check("due east is E",  compass(bearingDeg(1.30, 103.80, 1.30, 103.90)), "E");
check("due south is S", compass(bearingDeg(1.30, 103.80, 1.20, 103.80)), "S");
check("due west is W",  compass(bearingDeg(1.30, 103.80, 1.30, 103.70)), "W");
check("north-east is NE", compass(bearingDeg(1.30, 103.80, 1.40, 103.90)), "NE");

const FAKE = [
  { name: "Far",    brand: "X", lat: 1.44, lon: 103.90 },
  { name: "Close",  brand: "X", lat: 1.285, lon: 103.861 },
  { name: "Middle", brand: "X", lat: 1.32, lon: 103.87 },
];
const near3 = nearest(MARINA_BAY.lat, MARINA_BAY.lon, 3, FAKE);
check("sorted nearest first", near3.map(s => s.name).join(","), "Close,Middle,Far");
check("count is respected", nearest(MARINA_BAY.lat, MARINA_BAY.lon, 2, FAKE).length, 2);
check("empty list is handled", nearest(1.3, 103.8, 5, []).length, 0);

check("sub-km shows metres", prettyDistance(0.42), "420 m");
check("over a km shows km", prettyDistance(3.14), "3.1 km");

check("station list is bundled", STATIONS.length > 150, true);
check("every station has coordinates",
  STATIONS.every(s => typeof s.lat === "number" && typeof s.lon === "number"), true);
check("every station sits inside Singapore",
  STATIONS.every(s => s.lat > 1.15 && s.lat < 1.50 && s.lon > 103.5 && s.lon < 104.1), true);
check("every station is named", STATIONS.every(s => s.name.length > 0), true);

console.log("\n" + (fails ? `FAILED: ${fails}` : "All checks passed") + "\n");
process.exit(fails ? 1 : 0);
