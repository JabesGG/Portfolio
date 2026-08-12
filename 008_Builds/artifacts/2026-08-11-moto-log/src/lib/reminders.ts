import type { State } from "./types";
import { addMonths, dparts, num } from "./format";
import { lastDone } from "./calc";

/**
 * Which reminders a book implies, and a hook for something that can deliver
 * them. Like ./storage, this file imports no Capacitor: the scheduling logic is
 * pure and testable, and the native entry supplies the scheduler.
 */
export interface Due {
  /** Stable across rebuilds, so a reminder can be matched and replaced. */
  id: string;
  title: string;
  body: string;
  at: Date;
}

export interface ReminderScheduler {
  sync(due: Due[]): Promise<void>;
}

let scheduler: ReminderScheduler | null = null;

export function setReminderScheduler(s: ReminderScheduler): void {
  scheduler = s;
}

/** 9am local on the given date — a reminder at 03:00 helps nobody. */
function at9am(iso: string): Date | null {
  const p = dparts(iso);
  return p ? new Date(p.y, p.m - 1, p.d, 9, 0, 0, 0) : null;
}

/**
 * Only date-driven items can be scheduled ahead of time. Distance-driven ones
 * (chain lube every 500 km) depend on how much you ride, so they stay as
 * tell-tales in the app rather than becoming notifications that would be
 * guesses at best.
 */
export function dueNotifications(s: State, now: Date = new Date()): Due[] {
  const out: Due[] = [];

  for (const d of s.dates) {
    if (!d.due) continue;
    const expiry = at9am(d.due);
    if (!expiry) continue;
    const warn = num(d.remind) || 30;
    const fire = new Date(expiry.getTime() - warn * 86400000);
    if (fire > now) {
      out.push({
        id: `date:${d.id}`,
        title: `${d.n} is due soon`,
        body: `Expires ${d.due} — ${warn} days left.`,
        at: fire,
      });
    }
    if (expiry > now) {
      out.push({
        id: `date:${d.id}:day`,
        title: `${d.n} expires today`,
        body: "Renew it today.",
        at: expiry,
      });
    }
  }

  for (const item of s.schedule) {
    if (num(item.months) <= 0) continue;
    const last = lastDone(s, item);
    if (!last?.date) continue;
    const due = at9am(addMonths(last.date, num(item.months)));
    if (!due) continue;
    const fire = new Date(due.getTime() - 7 * 86400000);
    if (fire > now) {
      out.push({
        id: `svc:${item.id}`,
        title: `${item.n} is due in a week`,
        body: `Last done ${last.date}.`,
        at: fire,
      });
    }
  }

  return out;
}

/** No-op on the web, where no scheduler is installed. */
export async function syncReminders(s: State): Promise<void> {
  if (!scheduler) return;
  try {
    await scheduler.sync(dueNotifications(s));
  } catch {
    // A missed reminder must never take the app down with it.
  }
}
