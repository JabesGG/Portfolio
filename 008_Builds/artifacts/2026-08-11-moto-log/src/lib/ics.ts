import type { Garage } from "./types";
import { addMonths, num } from "./format";
import { lastDone } from "./calc";
import { bikeLabel } from "./garage";

/**
 * A calendar file of every renewal and month-based service, with alarms.
 *
 * The web app cannot schedule notifications by itself — that needs a push server
 * or the native shell. A calendar can: import this once and the phone's own
 * calendar does the reminding, 30/14/7/1 days ahead and at 9am on the day,
 * with no server and nothing leaving the phone except the file you chose to open.
 */

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const ymd = (iso: string) => iso.replace(/-/g, "");

/** RFC 5545 lines are at most 75 octets; longer ones continue after CRLF+space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

/** An all-day event starts at 00:00, so "9am, d days before" is 15h short of d days. */
function alarm(daysBefore: number, text: string): string[] {
  const trigger = daysBefore === 0 ? "PT9H" : `-P${daysBefore - 1}DT15H`;
  return ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, "END:VALARM"];
}

function event(uid: string, date: string, summary: string, desc: string, alarms: number[], stamp: string): string[] {
  const next = addMonths(date, 0); // normalised copy
  const end = new Date(Date.UTC(+next.slice(0, 4), +next.slice(5, 7) - 1, +next.slice(8, 10) + 1));
  const endIso = end.toISOString().slice(0, 10);
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@moto-log`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(date)}`,
    `DTEND;VALUE=DATE:${ymd(endIso)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(desc)}`,
    "TRANSP:TRANSPARENT",
    ...alarms.flatMap(d => alarm(d, summary)),
    "END:VEVENT",
  ];
}

export function garageIcs(g: Garage, now = new Date()): { text: string; count: number } {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Moto Log//Renewals//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Moto Log",
  ];
  let count = 0;
  const many = g.bikes.length > 1;
  for (const b of g.bikes) {
    const who = many ? `${bikeLabel(b)}: ` : "";
    const plate = b.bike.plate ? ` (${b.bike.plate})` : "";
    for (const d of b.dates) {
      if (!d.due) continue;
      lines.push(...event(`${b.id}-${d.id}-${d.due}`, d.due, `${who}${d.n} expires`,
        `Renew ${d.n}${plate}. From Moto Log.`, [30, 14, 7, 1, 0], stamp));
      count++;
    }
    for (const it of b.schedule) {
      if (num(it.months) <= 0) continue;
      const last = lastDone(b, it);
      if (!last?.date) continue;
      const due = addMonths(last.date, num(it.months));
      lines.push(...event(`${b.id}-${it.id}-${due}`, due, `${who}${it.n} due`,
        `Last done ${last.date}. Every ${it.months} months. From Moto Log.`, [7, 0], stamp));
      count++;
    }
  }
  lines.push("END:VCALENDAR");
  return { text: lines.map(fold).join("\r\n") + "\r\n", count };
}
