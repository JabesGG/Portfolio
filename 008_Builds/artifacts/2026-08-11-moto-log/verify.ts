import { statusOf, dateStatus, fuelRuns, totals, monthlySpend, entriesSorted } from "./src/lib/calc";
import { addMonths, dmy, money, km } from "./src/lib/format";
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

console.log("\n" + (fails ? `FAILED: ${fails}` : "All checks passed") + "\n");
process.exit(fails ? 1 : 0);
