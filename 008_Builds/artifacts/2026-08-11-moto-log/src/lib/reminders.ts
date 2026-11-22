import type { State, Garage } from "./types";
import { addMonths, dparts, num } from "./format";
import { lastDone } from "./calc";
import { bikeLabel } from "./garage";

/**
 * Which reminders a garage implies, and a hook for something that can deliver
 * them. Like ./storage, this file imports no Capacitor: the scheduling logic is
 * pure and testable, and the native entry supplies the scheduler.
 *
 * Renewals escalate: 30, 14, 7 and 1 days before, on the day, then the day
 * after and a week after if nothing was done. Everything fires at 9am, and
 * whatever falls on the same morning arrives as one notification rather than
 * a stack of them.
 */
export interface Due {
  /** Stable across rebuilds, so a reminder can be matched and replaced. */
  id: string;
  title: string;
  body: string;
  at: Date;
}

/** One thing to say on one morning, before grouping. */
export interface Alert {
  key: string;
  /** Short line, e.g. "Road tax expires in 7 days". */
  line: string;
  at: Date;
}

export interface ReminderScheduler {
  sync(due: Due[]): Promise<void>;
}

let scheduler: ReminderScheduler | null = null;

export function setReminderScheduler(s: ReminderScheduler): void {
  scheduler = s;
}

/** Days relative to expiry: positive is before, negative is after. */
export const RENEWAL_STAGES = [30, 14, 7, 1, 0, -1, -7];

/** 9am local on the given date — a reminder at 03:00 helps nobody. */
function at9am(iso: string): Date | null {
  const p = dparts(iso);
  return p ? new Date(p.y, p.m - 1, p.d, 9, 0, 0, 0) : null;
}

const DAY = 86400000;

function stageLine(n: string, d: number): string {
  if (d > 1) return `${n} expires in ${d} days`;
  if (d === 1) return `${n} expires tomorrow`;
  if (d === 0) return `${n} expires today`;
  if (d === -1) return `${n} expired yesterday`;
  return `${n} expired ${-d} days ago`;
}

/**
 * Every individual alert one bike implies from `now` onward. Only date-driven
 * items can be scheduled ahead of time. Distance-driven ones (chain lube every
 * 500 km) depend on how much you ride, so they stay as tell-tales in the app
 * rather than becoming notifications that would be guesses at best.
 */
export function alertsFor(s: State, now: Date = new Date(), prefix = ""): Alert[] {
  const out: Alert[] = [];
  const pre = prefix ? `${prefix}: ` : "";

  for (const d of s.dates) {
    if (!d.due) continue;
    const expiry = at9am(d.due);
    if (!expiry) continue;
    // A custom warning window longer than the first stage is honoured too.
    const warn = num(d.remind) || 30;
    const stages = warn > RENEWAL_STAGES[0] ? [warn, ...RENEWAL_STAGES] : RENEWAL_STAGES;
    for (const st of stages) {
      const at = new Date(expiry.getTime() - st * DAY);
      if (at > now) out.push({ key: `date:${d.id}:${st}`, line: pre + stageLine(d.n, st), at });
    }
  }

  for (const item of s.schedule) {
    if (num(item.months) <= 0) continue;
    const last = lastDone(s, item);
    if (!last?.date) continue;
    const due = at9am(addMonths(last.date, num(item.months)));
    if (!due) continue;
    const week = new Date(due.getTime() - 7 * DAY);
    if (week > now) out.push({ key: `svc:${item.id}:7`, line: `${pre}${item.n} is due in a week`, at: week });
    if (due > now) out.push({ key: `svc:${item.id}:0`, line: `${pre}${item.n} is due today`, at: due });
  }

  return out;
}

function dayKey(d: Date): string {
  const m = d.getMonth() + 1, day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${day < 10 ? "0" : ""}${day}`;
}

/** One notification per morning, soonest first. */
export function groupAlerts(alerts: Alert[]): Due[] {
  const byDay = new Map<string, Alert[]>();
  for (const a of alerts) {
    const k = dayKey(a.at);
    const list = byDay.get(k);
    if (list) list.push(a); else byDay.set(k, [a]);
  }
  const out: Due[] = [];
  for (const [k, list] of byDay) {
    list.sort((a, b) => a.line.localeCompare(b.line));
    out.push(list.length === 1
      ? { id: `day:${k}`, title: list[0].line, body: "Open Moto Log for details.", at: list[0].at }
      : { id: `day:${k}`, title: `${list.length} things need attention`, body: list.map(a => a.line).join("\n"), at: list[0].at });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Grouped reminders for one bike. */
export function dueNotifications(s: State, now: Date = new Date()): Due[] {
  return groupAlerts(alertsFor(s, now));
}

/** Grouped reminders for every bike. Lines are prefixed with the bike's name
 *  only when there is more than one, where it is the only way to tell. */
export function garageNotifications(g: Garage, now: Date = new Date()): Due[] {
  const many = g.bikes.length > 1;
  const all: Alert[] = [];
  for (const b of g.bikes) all.push(...alertsFor(b, now, many ? bikeLabel(b) : ""));
  return groupAlerts(all);
}

/** No-op on the web, where no scheduler is installed. */
export async function syncReminders(g: Garage): Promise<void> {
  if (!scheduler) return;
  try {
    await scheduler.sync(garageNotifications(g));
  } catch {
    // A missed reminder must never take the app down with it.
  }
}
