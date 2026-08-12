import type {
  State, Entry, FuelEntry, SchedItem, KeyDate, Status, FuelRun, Totals,
} from "./types";
import { num, addMonths, daysUntil, dmy, km, plural, todayISO, MON } from "./format";

export function entriesSorted(s: State): Entry[] {
  return s.entries.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return num(b.odo) - num(a.odo);
  });
}

/** The most recent time an item was done: the manual baseline, or any logged
 *  service that ticked it — whichever is later by date. */
export function lastDone(s: State, item: SchedItem): { date: string; odo: number | null } | null {
  const recs: { date: string; odo: number | null }[] = [];
  if (item.baseDate || item.baseOdo != null) {
    recs.push({ date: item.baseDate || "", odo: item.baseOdo == null ? null : num(item.baseOdo) });
  }
  for (const e of s.entries) {
    if (e.type === "service" && e.items && e.items.indexOf(item.id) !== -1) {
      recs.push({ date: e.date || "", odo: e.odo ? num(e.odo) : null });
    }
  }
  if (!recs.length) return null;
  recs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return recs[recs.length - 1];
}

/** Status for one interval. When an item has both a km and a month interval,
 *  whichever is closer to expiry wins. */
export function statusOf(s: State, item: SchedItem): Status {
  const last = lastDone(s, item);
  if (!last) return { level: "unset", headline: "—", sub: "No last-service date set", rank: 2.5 };

  const cands: { frac: number; left: number; unit: "km" | "day" }[] = [];
  if (num(item.km) > 0 && last.odo != null && s.bike.odo > 0) {
    const kmLeft = num(item.km) - (num(s.bike.odo) - last.odo);
    cands.push({ frac: kmLeft / num(item.km), left: kmLeft, unit: "km" });
  }
  if (num(item.months) > 0 && last.date) {
    const due = addMonths(last.date, num(item.months));
    const dLeft = daysUntil(due);
    if (dLeft != null) cands.push({ frac: dLeft / (num(item.months) * 30.44), left: dLeft, unit: "day" });
  }
  if (!cands.length) return { level: "unset", headline: "—", sub: "Set a km or month interval", rank: 2.5 };

  cands.sort((a, b) => a.frac - b.frac);
  const w = cands[0];
  const level = w.frac <= 0 ? "red" : w.frac <= 0.15 ? "amber" : "green";
  const headline = w.unit === "km"
    ? (w.left <= 0 ? `${km(-w.left)} km over` : `in ${km(w.left)} km`)
    : (w.left <= 0 ? `${plural(-w.left, "day")} over` : `in ${plural(w.left, "day")}`);
  const sub = `Last ${last.date ? dmy(last.date) : "—"}` +
    (last.odo != null ? ` · ${km(last.odo)} km` : "");
  return { level, headline, sub, rank: w.frac };
}

export function dateStatus(d: KeyDate): Status {
  if (!d.due) return { level: "unset", headline: "—", sub: "No date set", rank: 2.5 };
  const left = daysUntil(d.due)!;
  const level = left <= 0 ? "red" : left <= num(d.remind || 30) ? "amber" : "green";
  const headline = left <= 0 ? `${plural(-left, "day")} over` : `in ${plural(left, "day")}`;
  return { level, headline, sub: `Expires ${dmy(d.due)}`, rank: left / 365 };
}

/** Fuel economy measured full tank to full tank. Part-fills in between are
 *  accumulated into the next full tank rather than each producing a figure. */
export function fuelRuns(s: State): FuelRun[] {
  const fills = s.entries
    .filter((e): e is FuelEntry => e.type === "fuel" && num(e.odo) > 0)
    .sort((a, b) => num(a.odo) - num(b.odo));
  const runs: FuelRun[] = [];
  let anchor: FuelEntry | null = null;
  let litres = 0;
  for (const f of fills) {
    if (!anchor) { if (f.full) anchor = f; continue; }
    litres += num(f.litres);
    if (f.full) {
      const dist = num(f.odo) - num(anchor.odo);
      if (dist > 0 && litres > 0) runs.push({ to: f, dist, litres, kmpl: dist / litres });
      anchor = f; litres = 0;
    }
  }
  return runs;
}

export function totals(s: State): Totals {
  let total = 0, fuelAmt = 0, fuelL = 0;
  const byCat: Record<string, number> = {};
  for (const e of s.entries) {
    const a = num(e.amount);
    total += a;
    const cat = e.type === "fuel" ? "Fuel"
      : e.type === "service" ? "Service & parts"
      : (e.cat || "Other");
    byCat[cat] = (byCat[cat] || 0) + a;
    if (e.type === "fuel") { fuelAmt += a; fuelL += num(e.litres); }
  }
  const dist = Math.max(0, num(s.bike.odo) - num(s.bike.startOdo));
  const runs = fuelRuns(s);
  const kmpl = runs.length
    ? runs.reduce((t, r) => t + r.dist, 0) / runs.reduce((t, r) => t + r.litres, 0)
    : 0;
  return {
    total, byCat, dist,
    perKm: dist > 0 ? total / dist : 0,
    kmpl,
    perL: fuelL > 0 ? fuelAmt / fuelL : 0,
    fuelL, fuelAmt,
  };
}

export function monthlySpend(s: State, months: number) {
  const out: { key: string; lab: string; total: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = d.getMonth() + 1;
    out.push({ key: `${d.getFullYear()}-${mm < 10 ? "0" : ""}${mm}`, lab: MON[d.getMonth()], total: 0 });
  }
  const idx: Record<string, { total: number }> = {};
  out.forEach(o => { idx[o.key] = o; });
  for (const e of s.entries) {
    const k = (e.date || "").slice(0, 7);
    if (idx[k]) idx[k].total += num(e.amount);
  }
  return out;
}

export function csv(s: State): string {
  const rows: (string | number)[][] = [
    ["Date", "Type", "Category", "Odometer km", "Litres", "Amount SGD", "Where", "Note"],
  ];
  for (const e of entriesSorted(s)) {
    rows.push([
      e.date,
      e.type,
      e.type === "fuel" ? "Fuel" : e.type === "service" ? "Service & parts" : (e.cat || ""),
      e.odo || "",
      e.type === "fuel" ? e.litres || "" : "",
      num(e.amount).toFixed(2),
      e.type === "fuel" ? e.station || "" : e.type === "service" ? e.shop || "" : "",
      [e.type === "service" ? e.label : "", e.note].filter(Boolean).join(" — "),
    ]);
  }
  return rows.map(r => r.map(c => {
    const v = String(c);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",")).join("\n");
}

export { todayISO };
