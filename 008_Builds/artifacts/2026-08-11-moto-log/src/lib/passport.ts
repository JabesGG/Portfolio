import type { State } from "./types";
import { entriesSorted, fuelRuns, lastDone, totals } from "./calc";
import { dmy, km, money, num, todayISO } from "./format";
import { coeExpiry } from "./coe";

/**
 * The bike passport: a service and ownership history you can hand to a buyer
 * or a workshop. Built as plain data first, so the on-screen version, the
 * printed version and the downloaded file all say exactly the same thing.
 *
 * What you paid is yours to share or not, so costs are a switch.
 */
export interface PassportOpts { costs: boolean; fuel: boolean; }

export interface PassportService {
  date: string; odo: string; what: string; shop: string; cost: string; note: string;
}

export interface Passport {
  title: string;
  plate: string;
  made: string;
  facts: [string, string][];
  dates: [string, string][];
  services: PassportService[];
  upkeep: { item: string; last: string }[];
  running: [string, string][];
  fuel: { date: string; odo: string; litres: string; where: string; cost: string }[];
  showCosts: boolean;
}

export function buildPassport(s: State, opts: PassportOpts, today = todayISO()): Passport {
  const b = s.bike;
  const title = b.name || [b.year, b.make, b.model].filter(Boolean).join(" ") || "Motorcycle";
  const t = totals(s);
  const runs = fuelRuns(s);
  const sorted = entriesSorted(s);

  const facts: [string, string][] = [];
  const model = [b.year, b.make, b.model].filter(Boolean).join(" ");
  if (model) facts.push(["Model", model]);
  if (b.plate) facts.push(["Plate", b.plate]);
  if (b.regDate) facts.push(["First registered", dmy(b.regDate)]);
  if (b.odo) facts.push(["Odometer", `${km(b.odo)} km`]);
  if (b.coe?.start && num(b.coe.years) > 0) facts.push(["COE expires", dmy(coeExpiry(b.coe))]);
  if (t.dist > 0) facts.push(["Distance on record", `${km(t.dist)} km`]);

  const dates: [string, string][] = s.dates.filter(d => d.due).map(d => [d.n, dmy(d.due)]);

  const services: PassportService[] = sorted
    .filter(e => e.type === "service")
    .map(e => {
      const names = (e.type === "service" ? e.items : [])
        .map(id => s.schedule.find(x => x.id === id)?.n)
        .filter((x): x is string => Boolean(x));
      const label = e.type === "service" ? e.label : "";
      return {
        date: dmy(e.date),
        odo: num(e.odo) ? `${km(e.odo)} km` : "",
        what: [label, names.join(", ")].filter(Boolean).join(" — ") || "Service",
        shop: e.type === "service" ? e.shop : "",
        cost: opts.costs && num(e.amount) ? money(num(e.amount)) : "",
        note: e.note || "",
      };
    });

  const upkeep = s.schedule
    .map(it => ({ it, last: lastDone(s, it) }))
    .filter(x => x.last && (x.last.date || x.last.odo != null))
    .map(x => ({
      item: x.it.n,
      last: [x.last!.date ? dmy(x.last!.date) : "", x.last!.odo != null ? `${km(x.last!.odo)} km` : ""].filter(Boolean).join(" · "),
    }));

  const running: [string, string][] = [];
  if (runs.length) running.push(["Fuel economy", `${t.kmpl.toFixed(1)} km/L over ${runs.length} full-tank runs`]);
  running.push(["Entries on record", String(s.entries.length)]);
  if (opts.costs && t.total > 0) {
    running.push(["Total spent", money(t.total)]);
    if (t.perKm > 0) running.push(["Cost per km", `$${t.perKm.toFixed(3)}`]);
  }

  const fuel = opts.fuel
    ? sorted.filter(e => e.type === "fuel").map(e => ({
        date: dmy(e.date),
        odo: num(e.odo) ? `${km(e.odo)} km` : "",
        litres: e.type === "fuel" && num(e.litres) ? `${num(e.litres).toFixed(2)} L` : "",
        where: e.type === "fuel" ? e.station : "",
        cost: opts.costs && num(e.amount) ? money(num(e.amount)) : "",
      }))
    : [];

  return { title, plate: b.plate, made: dmy(today), facts, dates, services, upkeep, running, fuel, showCosts: opts.costs };
}

export function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const kv = (rows: [string, string][]) =>
  `<table class="kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`;

/** A self-contained page: no scripts, no outside requests, prints cleanly. */
export function passportHtml(p: Passport): string {
  const cost = p.showCosts;
  const svc = p.services.length
    ? `<table class="log"><thead><tr><th>Date</th><th>Odometer</th><th>Work done</th><th>Workshop</th>${cost ? "<th>Cost</th>" : ""}</tr></thead><tbody>${
        p.services.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.odo)}</td><td>${esc(r.what)}${r.note ? `<small>${esc(r.note)}</small>` : ""}</td><td>${esc(r.shop)}</td>${cost ? `<td>${esc(r.cost)}</td>` : ""}</tr>`).join("")
      }</tbody></table>`
    : `<p class="none">No services logged yet.</p>`;
  const fuel = p.fuel.length
    ? `<h2>Fuel log</h2><table class="log"><thead><tr><th>Date</th><th>Odometer</th><th>Litres</th><th>Station</th>${cost ? "<th>Cost</th>" : ""}</tr></thead><tbody>${
        p.fuel.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.odo)}</td><td>${esc(r.litres)}</td><td>${esc(r.where)}</td>${cost ? `<td>${esc(r.cost)}</td>` : ""}</tr>`).join("")
      }</tbody></table>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} — bike passport</title>
<style>
body{font:15px/1.5 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#15191c;margin:0;padding:28px;max-width:820px;margin-inline:auto}
h1{font-size:26px;margin:0 0 2px;letter-spacing:.02em;text-transform:uppercase}
h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid #15191c;padding-bottom:5px;margin:26px 0 8px}
.sub{color:#5a6268;font-size:13px;margin:0}
table{border-collapse:collapse;width:100%}
.kv th{text-align:left;font-weight:400;color:#5a6268;width:38%;padding:5px 0;border-bottom:1px solid #dcdfd8}
.kv td{padding:5px 0;border-bottom:1px solid #dcdfd8;font-variant-numeric:tabular-nums}
.log th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5a6268;padding:6px 8px 6px 0;border-bottom:1px solid #15191c}
.log td{padding:7px 8px 7px 0;border-bottom:1px solid #dcdfd8;vertical-align:top;font-variant-numeric:tabular-nums}
.log small{display:block;color:#5a6268;font-size:12px}
.none{color:#5a6268}
footer{margin-top:30px;color:#5a6268;font-size:12px;border-top:1px solid #dcdfd8;padding-top:10px}
@media print{body{padding:0}tr{break-inside:avoid}}
</style></head><body>
<h1>${esc(p.title)}</h1>
<p class="sub">Bike passport${p.plate ? ` · ${esc(p.plate)}` : ""} · prepared ${esc(p.made)}</p>
<h2>The bike</h2>${kv(p.facts)}
${p.dates.length ? `<h2>Renewal dates</h2>${kv(p.dates)}` : ""}
<h2>Service history</h2>${svc}
${p.upkeep.length ? `<h2>Last done</h2>${kv(p.upkeep.map(u => [u.item, u.last] as [string, string]))}` : ""}
<h2>Running record</h2>${kv(p.running)}
${fuel}
<footer>Owner-kept record from Moto Log. Entries are as logged by the owner and are not verified by a workshop or by LTA.</footer>
</body></html>`;
}
