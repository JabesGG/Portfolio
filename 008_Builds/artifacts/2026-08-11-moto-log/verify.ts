import { statusOf, dateStatus, fuelRuns, totals, monthlySpend, entriesSorted } from "./src/lib/calc";
import { alertsFor, dueNotifications, garageNotifications, groupAlerts } from "./src/lib/reminders";
import { fromV1, upgradeV1, normaliseGarage, parseBackup, photoIds, activeBook, bikeLabel } from "./src/lib/garage";
import { yearlySpend, afterDiscount, fuelSavings, entrySpan, runPositions } from "./src/lib/calc";
import { AI_ENABLED } from "./src/lib/ai";
import { renewalCost, coeExpiry, monthsBetween, coeNow } from "./src/lib/coe";
import { addFix, newTrack, trackSecs, duration, pathToSvg, avgKph, type Fix } from "./src/lib/rides";
import { bookXp, levelOf, badges } from "./src/lib/xp";
import { decide, tidyCode, prettyCode, validCode, newCode } from "./src/lib/sync";
import { buildPassport, passportHtml } from "./src/lib/passport";
import { garageIcs } from "./src/lib/ics";
import { WORKSHOPS, nearestWorkshops, telHref, waHref } from "./src/lib/workshops";
import { guessBrand, seedGarage } from "./src/lib/store";
import { GUIDES, SYMPTOMS } from "./src/data/guides";
import { distanceKm, bearingDeg, compass, nearest, prettyDistance, STATIONS } from "./src/lib/stations";
import { addMonths, agoLabel, backupIsStale, dmy, money, km } from "./src/lib/format";
import type { State, Garage, Book } from "./src/lib/types";

// The fixtures below are dated around August 2026 and several checks ("in 724 km",
// "25 days out") are relative to today. Pin the clock so the suite means the same
// thing whenever it runs, instead of quietly rotting as the calendar moves on.
// Only a bare `new Date()` / `Date.now()` is pinned; explicit dates pass through.
const PINNED = new Date(2026, 7, 11, 12, 0, 0).getTime(); // 11 Aug 2026, local
const RealDate = Date;
class PinnedDate extends RealDate {
  constructor(...a: any[]) {
    if (a.length) super(...(a as [any])); else super(PINNED);
  }
  static now() { return PINNED; }
}
globalThis.Date = PinnedDate as DateConstructor;

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
const alerts = alertsFor(S, NOW);
const keys = alerts.map(a => a.key);
const dayOfAlert = (k: string, list = alerts) => list.find(a => a.key === k)?.at.toISOString().slice(0, 10);

// Road tax is due 5 Sep. The 30-day stage (6 Aug) has passed; the rest are ahead.
check("road tax 30-day stage already passed, so not scheduled", keys.includes("date:d1:30"), false);
check("road tax 14-day stage", dayOfAlert("date:d1:14"), "2026-08-22");
check("road tax 7-day stage", dayOfAlert("date:d1:7"), "2026-08-29");
check("road tax day-before stage", dayOfAlert("date:d1:1"), "2026-09-04");
check("road tax expiry-day stage", dayOfAlert("date:d1:0"), "2026-09-05");
check("road tax chased the day after", dayOfAlert("date:d1:-1"), "2026-09-06");
check("road tax chased a week after", dayOfAlert("date:d1:-7"), "2026-09-12");
check("road tax stages still ahead", keys.filter(k => k.startsWith("date:d1:")).length, 6);
check("insurance gets all seven stages", keys.filter(k => k.startsWith("date:d2:")).length, 7);
// COE has a 60-day warning set, longer than the first stage, so it gains one.
check("a longer custom warning adds a stage", keys.filter(k => k.startsWith("date:d4:")).length, 8);
check("COE 60-day stage", dayOfAlert("date:d4:60"), "2029-01-13");
check("inspection has no date, so nothing scheduled", keys.some(k => k.startsWith("date:d3")), false);

check("engine oil (6mth from 15 Jun) week-ahead", dayOfAlert("svc:s1:7"), "2026-12-08");
check("engine oil due-day", dayOfAlert("svc:s1:0"), "2026-12-15");
check("oil filter (12mth) scheduled", keys.includes("svc:s2:7"), true);
check("chain lube (1mth from 20 Jul) scheduled", dayOfAlert("svc:s3:7"), "2026-08-13");
check("rear tyre is km-only, never scheduled", keys.some(k => k.startsWith("svc:s4")), false);
check("valve clearance is km-only, never scheduled", keys.some(k => k.startsWith("svc:s5")), false);
check("total alerts", alerts.length, 6 + 7 + 8 + 2 + 2 + 2);
check("alerts fire at 9am local", alerts.every(a => a.at.getHours() === 9), true);

const due = dueNotifications(S, NOW);
check("soonest notification first", due[0].title, "Chain clean & lube is due in a week");
check("notifications are in time order", due.every((d, i) => i === 0 || d.at >= due[i - 1].at), true);

// Wind the clock back: now the 30-day road-tax stage is still ahead of us.
const early = alertsFor(S, new Date(2026, 6, 1, 12, 0, 0));
check("30-day road tax stage is 30 days before 5 Sep", dayOfAlert("date:d1:30", early), "2026-08-06");

// Nothing in the past should ever be scheduled.
check("no reminders scheduled once everything is in the past", dueNotifications(S, new Date(2030, 0, 1)).length, 0);

// Two things on the same morning arrive as one notification.
const twin = groupAlerts([
  { key: "a", line: "Road tax expires today", at: new Date(2026, 8, 5, 9) },
  { key: "b", line: "Insurance expires in 7 days", at: new Date(2026, 8, 5, 9) },
  { key: "c", line: "Engine oil is due today", at: new Date(2026, 8, 6, 9) },
]);
check("same-morning alerts are grouped", twin.length, 2);
check("a grouped notification says how many", twin[0].title, "2 things need attention");
check("a grouped notification lists them", twin[0].body, "Insurance expires in 7 days\nRoad tax expires today");
check("a lone alert is its own title", twin[1].title, "Engine oil is due today");

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

console.log("\n-- garage: migration and backups --");
const G1 = fromV1(structuredClone({ ...S, lastBackup: "2026-08-01" }));
check("a v1 book becomes a one-bike garage", G1.bikes.length, 1);
check("the migrated bike is the active one", G1.active, G1.bikes[0].id);
check("every entry survives migration", G1.bikes[0].entries.length, S.entries.length);
check("intervals survive migration", G1.bikes[0].schedule.length, S.schedule.length);
check("the backup date carries over", G1.lastBackup, "2026-08-01");
check("migration adds an empty ride list", Array.isArray(G1.bikes[0].rides), true);
// v1 shipped a 24-month inspection default, which is the rule for cars.
check("migration corrects the 24-month inspection default", G1.bikes[0].dates.find(d => d.n === "Vehicle inspection")!.months, 12);
const custom = structuredClone(S);
custom.dates.find(d => d.n === "Vehicle inspection")!.months = 6;
check("…but leaves an interval the rider chose", upgradeV1(custom).dates.find(d => d.n === "Vehicle inspection")!.months, 6);
check("…and leaves other 24-month dates alone", upgradeV1({ ...structuredClone(S), dates: [{ id: "w", n: "Warranty", due: "", months: 24, remind: 30 }] }).dates[0].months, 24);
check("garbage is not a garage", normaliseGarage({ nope: 1 }), null);
const badActive = normaliseGarage({ ...structuredClone(G1), active: "missing" })!;
check("a dangling active id falls back to the first bike", badActive.active, badActive.bikes[0].id);
check("a garage with no usable bikes gets a fresh one", normaliseGarage({ v: 2, active: "x", bikes: [{}] })!.bikes.length, 1);
check("activeBook finds the active bike", activeBook(G1).id, G1.active);
check("unnamed bike is labelled from year/make/model", bikeLabel(S), "2019 Honda CB400 Super Four");

const v1file = parseBackup(JSON.stringify(S));
check("a v1 backup is read as a single bike", v1file?.kind, "book");
const v2file = parseBackup(JSON.stringify({ app: "moto-log", v: 2, exported: "x", garage: G1, photos: { p1: "data:image/jpeg;base64,AA" } }));
check("a v2 backup is read as a garage", v2file?.kind, "garage");
check("a v2 backup keeps its photos", v2file?.kind === "garage" ? Object.keys(v2file.photos).length : -1, 1);
check("a bare garage is accepted too", parseBackup(JSON.stringify(G1))?.kind, "garage");
check("non-JSON is rejected", parseBackup("not json"), null);
check("unrelated JSON is rejected", parseBackup('{"a":1}'), null);
const withPhoto = structuredClone(G1);
withPhoto.bikes[0].entries[0].photos = ["p1", "p2"];
check("photo ids are collected across the garage", photoIds(withPhoto).join(","), "p1,p2");
check("a fresh garage has one empty bike", seedGarage().bikes[0].entries.length, 0);

console.log("\n-- yearly costs and fuel-card discounts --");
const yr = yearlySpend(S);
check("one row per year with entries", yr.length, 1);
check("year total", yr[0].total.toFixed(2), "743.24");
check("year fuel", yr[0].fuel.toFixed(2), "150.24");
check("year service", yr[0].service.toFixed(2), "85.00");
check("year other", yr[0].other.toFixed(2), "508.00");
check("year distance is the odometer spread", yr[0].km, 1560);
const twoYears = structuredClone(S);
twoYears.entries.push({ id: "old", type: "expense", date: "2025-12-31", odo: 0, cat: "Other", amount: 10 });
check("years are listed newest first", yearlySpend(twoYears).map(y => y.year).join(","), "2026,2025");
check("5% off $24.00", afterDiscount(24, 5).toFixed(2), "22.80");
check("14% off $24.01 rounds to the cent", afterDiscount(24.01, 14).toFixed(2), "20.65");
check("no discount leaves the price alone", afterDiscount(10, 0).toFixed(2), "10.00");
check("a silly discount is clamped", afterDiscount(10, 250).toFixed(2), "0.00");
check("no pump prices kept, no savings", fuelSavings(S), 0);
const disc = structuredClone(S);
disc.entries.push({ id: "f9", type: "fuel", date: "2026-08-09", odo: 27900, litres: 9, amount: 22.8, pump: 24, station: "Shell", brand: "Shell", full: true });
check("savings are pump minus paid", fuelSavings(disc).toFixed(2), "1.20");
check("brand guessed from the station", guessBrand("Shell Bishan"), "Shell");
check("brand guess is case-blind", guessBrand("spc yishun"), "SPC");
check("unknown station has no brand", guessBrand("Ah Seng Kiosk"), "");

console.log("\n-- what period the figures cover --");
check("entries span first to last date", JSON.stringify(entrySpan(S)), '{"from":"2026-03-01","to":"2026-08-08"}');
check("no entries, no span", entrySpan({ ...S, entries: [] }), null);
check("12-month chart carries the year of each bar", `${ms[0].lab} ${ms[0].year} – ${ms[11].lab} ${ms[11].year}`, "Sep 2025 – Aug 2026");
// Runs close on 20 Jun, 10 Jul, 28 Jul and 8 Aug: 0, 20, 38 and 49 days in.
check("economy runs are placed by date, not evenly", runPositions(fuelRuns(S)).map(p => p.toFixed(3)).join(","), "0.000,0.408,0.776,1.000");
const sameDay = fuelRuns(S).map(r => ({ ...r, to: { ...r.to, date: "2026-07-01" } }));
check("runs on one day fall back to even spacing", runPositions(sameDay).map(p => p.toFixed(2)).join(","), "0.00,0.33,0.67,1.00");
const undated = fuelRuns(S).map(r => ({ ...r, to: { ...r.to, date: "" } }));
check("undated runs fall back to even spacing", runPositions(undated).map(p => p.toFixed(2)).join(","), "0.00,0.33,0.67,1.00");
check("a single run sits in the middle", runPositions(fuelRuns(S).slice(0, 1))[0], 0.5);

console.log("\n-- parked features --");
check("the AI mechanic is switched off", AI_ENABLED, false);

console.log("\n-- COE --");
const r10 = renewalCost(9000, 10), r5 = renewalCost(9000, 5);
check("10-year renewal is the full PQP", r10.total, 9000);
check("5-year renewal is half the PQP", r5.total, 4500);
check("both cost the same per year", r10.perYear === r5.perYear, true);
check("per month", r10.perMonth, 75);
check("only the 5-year renewal is final", `${r10.final},${r5.final}`, "false,true");
check("COE expiry is start + years", coeExpiry({ paid: 9000, start: "2019-03-14", years: 10 }), "2029-03-14");
check("months between, with spare days", monthsBetween("2026-08-11", "2029-03-14").toFixed(1), "31.1");
check("months between across a month end", monthsBetween("2026-08-20", "2026-09-05").toFixed(3), "0.533");
check("months between is never negative", monthsBetween("2029-03-14", "2026-08-11"), 0);
const cn = coeNow({ paid: 9000, start: "2019-03-14", years: 10 }, "2026-08-11")!;
check("rebate = paid × unused ÷ 120", cn.rebate.toFixed(2), "2332.50");
check("share of COE used", (cn.used * 100).toFixed(1), "74.1");
check("an expired COE returns nothing", coeNow({ paid: 9000, start: "2010-01-01", years: 10 }, "2026-08-11")!.rebate, 0);
check("no start date, no figures", coeNow({ paid: 9000, start: "", years: 10 }), null);

console.log("\n-- ride recording (GPS filtering) --");
// Due north at 50 km/h: 69.4 m every 5 s is 0.000624° of latitude.
const STEP = 50 / 3600 * 5 / 111.195;
const fix = (i: number, over: Partial<Fix> = {}): Fix => ({ lat: 1.3 + i * STEP, lon: 103.8, acc: 6, t: 1_000_000 + i * 5000, ...over });
let tr = newTrack();
for (let i = 0; i <= 10; i++) tr = addFix(tr, fix(i));
check("ten steps at 50 km/h cover 0.69 km", tr.km.toFixed(2), "0.69");
check("speed from position, when the device gives none", tr.maxKph.toFixed(0), "50");
check("elapsed time is first fix to last", trackSecs(tr), 50);
check("the route keeps a point per step over 25 m", tr.path.length, 11);
const before = tr.km;
tr = addFix(tr, fix(11, { acc: 120 }));
check("a poor-accuracy fix is dropped", tr.km === before && tr.dropped === 1, true);
tr = addFix(tr, { lat: 1.36, lon: 103.8, acc: 6, t: 1_000_000 + 12 * 5000 });
check("a teleport is treated as a glitch", tr.km === before && tr.dropped === 2, true);
let still = newTrack();
for (let i = 0; i < 40; i++) still = addFix(still, { lat: 1.3 + (i % 2) * 0.00003, lon: 103.8, acc: 10, t: 2_000_000 + i * 1000 });
check("standing still adds no distance", still.km, 0);
let slow = newTrack();
for (let i = 0; i <= 60; i++) slow = addFix(slow, { lat: 1.3 + i * 0.00002, lon: 103.8, acc: 6, t: 3_000_000 + i * 1000 });
check("slow real movement still accumulates", (slow.km * 1000).toFixed(0) === "133", true);
let fast = newTrack();
fast = addFix(fast, fix(0, { speed: 0 }));
fast = addFix(fast, fix(1, { speed: 20 }));
check("device-reported speed is preferred", fast.maxKph, 72);
check("duration over an hour", duration(3725), "1h 02m");
check("duration under an hour", duration(65), "1:05");
check("average speed", avgKph(30, 1800), 60);
check("one point is not a route", pathToSvg([[1.3, 103.8]]), "");
check("a route is projected into the box", pathToSvg([[1.3, 103.8], [1.31, 103.81]]).split(" ").length, 2);

console.log("\n-- XP and badges --");
check("level 1 at zero", levelOf(0).level, 1);
check("still level 1 at 99", levelOf(99).level, 1);
check("level 2 at 100", levelOf(100).level, 2);
check("level 3 at 300", levelOf(300).level, 3);
check("progress inside a level", `${levelOf(150).into}/${levelOf(150).span}`, "50/200");
// 5 fills ×10, 1 service ×30, 3 expenses ×5, 3 renewal dates ×15, 2 baselines ×5.
check("XP is counted from the log", bookXp(S), 50 + 30 + 15 + 45 + 10);
const bd = badges({ ...G1, lastBackup: undefined });
const has = (id: string) => bd.find(b => b.id === id)!.got;
check("first entry badge", has("first"), true);
check("service badge", has("svc1"), true);
check("ten tanks not yet", has("fuel10"), false);
check("no backup, no backup badge", has("backup"), false);

console.log("\n-- sync decisions --");
check("nothing on the server → push", decide(0, true, null), "push");
check("in step and unchanged → nothing", decide(3, false, 3), "none");
check("in step with local changes → push", decide(3, true, 3), "push");
check("server moved on, no local changes → adopt", decide(3, false, 5), "adopt");
check("both changed → conflict", decide(3, true, 5), "conflict");
check("codes are tidied", tidyCode("abcd-efgh 2345"), "ABCDEFGH2345");
check("codes are shown in fours", prettyCode("ABCDEFGH2345"), "ABCD-EFGH-2345");
check("a new code is valid", validCode(newCode()), true);
check("a new code is 28 characters", newCode().length, 28);
check("two new codes differ", newCode() !== newCode(), true);
check("a short code is refused", validCode("ABCD"), false);

console.log("\n-- bike passport --");
const pp = buildPassport(S, { costs: false, fuel: false }, "2026-08-11");
check("passport lists every service", pp.services.length, 1);
check("service names its items", pp.services[0].what, "Engine oil, Oil filter");
check("costs are left out unless asked", pp.services[0].cost, "");
check("fuel log is left out unless asked", pp.fuel.length, 0);
check("no totals without costs", pp.running.some(r => r[0] === "Total spent"), false);
const ppFull = buildPassport(S, { costs: true, fuel: true }, "2026-08-11");
check("costs included when asked", ppFull.services[0].cost, "$85.00");
check("fuel log included when asked", ppFull.fuel.length, 5);
check("last-done table covers baselines and services", pp.upkeep.map(u => u.item).join("|"),
  "Engine oil|Oil filter|Chain clean & lube|Rear tyre");
const evil = structuredClone(S);
evil.bike.name = '<script>alert(1)</script>';
evil.entries.push({ id: "v9", type: "service", date: "2026-08-10", odo: 28000, items: [], amount: 0, shop: '"><img src=x>', label: "<b>x</b>", note: "" });
const html = passportHtml(buildPassport(evil, { costs: true, fuel: true }, "2026-08-11"));
check("passport file escapes markup in names", html.includes("<script>alert") || html.includes("<img src=x>"), false);
check("passport file carries no scripts", /<script/i.test(html), false);

console.log("\n-- calendar export --");
const ics = garageIcs({ v: 2, active: "b1", bikes: [{ ...S, id: "b1" } as Book], prefs: { fuelDiscounts: {}, myWorkshops: [] } }, NOW);
// 3 renewals with dates + 3 month-based services with a last-done date.
check("one event per dated renewal and month service", ics.count, 6);
check("calendar starts and ends properly", ics.text.startsWith("BEGIN:VCALENDAR\r\n") && ics.text.endsWith("END:VCALENDAR\r\n"), true);
check("no line longer than 75 octets", ics.text.split("\r\n").every(l => new TextEncoder().encode(l).length <= 75), true);
check("road tax is an all-day event on its date", ics.text.includes("DTSTART;VALUE=DATE:20260905"), true);
check("all-day events end the next day", ics.text.includes("DTEND;VALUE=DATE:20260906"), true);
check("30-day alarm lands at 9am, 30 days before", ics.text.includes("TRIGGER:-P29DT15H"), true);
check("on-the-day alarm at 9am", ics.text.includes("TRIGGER:PT9H"), true);

const S2: Book = { ...structuredClone(S), id: "b2", bike: { ...S.bike, name: "Scooter" } };
const both: Garage = { v: 2, active: "b1", bikes: [{ ...S, id: "b1" } as Book, S2], prefs: { fuelDiscounts: {}, myWorkshops: [] } };
const gn = garageNotifications(both, NOW);
check("two bikes due the same day share a notification", gn.length, due.length);
check("with two bikes, lines say which bike", gn[0].body.includes("Scooter: ") && gn[0].body.includes("2019 Honda CB400 Super Four: "), true);
check("with one bike, lines carry no prefix", due[0].title.includes(":"), false);

console.log("\n-- workshops and guides --");
check("workshop list is bundled", WORKSHOPS.length >= 20, true);
check("every workshop sits inside Singapore",
  WORKSHOPS.every(w => w.lat > 1.15 && w.lat < 1.50 && w.lon > 103.5 && w.lon < 104.1), true);
check("every workshop is named and typed", WORKSHOPS.every(w => w.name.length > 0 && (w.kind === "repair" || w.kind === "shop")), true);
const nw = nearestWorkshops(MARINA_BAY.lat, MARINA_BAY.lon);
check("workshops sort nearest first", nw.every((w, i) => i === 0 || w.km >= nw[i - 1].km), true);
check("landline becomes a tel link", telHref("+65 6275 6656"), "tel:+6562756656");
check("8-digit number gains the country code", telHref("9123 4567"), "tel:+6591234567");
check("mobile numbers get WhatsApp", waHref("9123 4567"), "https://wa.me/6591234567");
check("landlines do not", waHref("6275 6656"), null);
check("every symptom has causes and checks", SYMPTOMS.every(x => x.causes.length >= 2 && x.checks.length >= 2), true);
check("symptom ids are unique", new Set(SYMPTOMS.map(x => x.id)).size, SYMPTOMS.length);
check("every guide has points", GUIDES.every(x => x.points.length >= 4), true);

console.log("\n" + (fails ? `FAILED: ${fails}` : "All checks passed") + "\n");
process.exit(fails ? 1 : 0);
