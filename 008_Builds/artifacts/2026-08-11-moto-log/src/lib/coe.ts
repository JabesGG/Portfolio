import type { CoeInfo } from "./types";
import { addMonths, dparts, num, todayISO } from "./format";

/**
 * COE sums for a motorcycle (Category D).
 *
 *  - Renewing for 10 years costs the full Prevailing Quota Premium (PQP).
 *  - Renewing for 5 years costs half the PQP, and for Category D that can be
 *    done only once: the bike must be deregistered when it runs out.
 *  - Deregistering early earns a rebate pro-rated on the unused period:
 *      rebate = premium paid × unused months ÷ months in the COE period
 *    with leftover days counted as a fraction of a 30-day month, as LTA does.
 *
 * These are estimates for planning. LTA's figure on the day is the real one.
 */

export interface RenewalCost {
  years: number; total: number; perYear: number; perMonth: number;
  /** True for the 5-year option, which cannot be renewed again. */
  final: boolean;
}

export function renewalCost(pqp: number, years: 5 | 10): RenewalCost {
  const total = years === 5 ? num(pqp) * 0.5 : num(pqp);
  return {
    years,
    total,
    perYear: total / years,
    perMonth: total / (years * 12),
    final: years === 5,
  };
}

export function coeExpiry(c: CoeInfo): string {
  return c.start && num(c.years) > 0 ? addMonths(c.start, Math.round(num(c.years) * 12)) : "";
}

/** Whole months plus a fraction (days ÷ 30) from `from` to `to`; never negative. */
export function monthsBetween(from: string, to: string): number {
  const a = dparts(from), b = dparts(to);
  if (!a || !b) return 0;
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  let days = b.d - a.d;
  if (days < 0) {
    months -= 1;
    // days in the month before `to`
    const dim = new Date(Date.UTC(b.y, b.m - 1, 0)).getUTCDate();
    days += dim;
  }
  const v = months + days / 30;
  return v > 0 ? v : 0;
}

export interface CoeNow {
  expiry: string;
  /** Unused months left on the COE, fractional. */
  monthsLeft: number;
  /** What deregistering today would roughly return. */
  rebate: number;
  /** How much of the premium is used up each month you keep the bike. */
  perMonth: number;
  /** Share of the COE period already used, 0–1. */
  used: number;
}

export function coeNow(c: CoeInfo, today = todayISO()): CoeNow | null {
  const paid = num(c.paid), years = num(c.years);
  if (!c.start || years <= 0) return null;
  const expiry = coeExpiry(c);
  const total = years * 12;
  const left = Math.min(total, monthsBetween(today, expiry));
  return {
    expiry,
    monthsLeft: left,
    rebate: paid > 0 ? (paid * left) / total : 0,
    perMonth: paid > 0 ? paid / total : 0,
    used: total > 0 ? 1 - left / total : 0,
  };
}
