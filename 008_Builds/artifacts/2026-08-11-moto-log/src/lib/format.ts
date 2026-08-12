export const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function num(v: unknown): number {
  const x = parseFloat(String(v));
  return isFinite(x) ? x : 0;
}

export function todayISO(): string {
  const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${day < 10 ? "0" : ""}${day}`;
}

function group(s: string): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function money(v: number): string {
  const neg = v < 0;
  return (neg ? "−$" : "$") + group(Math.abs(v).toFixed(2));
}

export function money0(v: number): string {
  return "$" + group(String(Math.round(v)));
}

export function km(v: number): string {
  return group(String(Math.round(v)));
}

export interface DParts { y: number; m: number; d: number; }

export function dparts(iso: string): DParts | null {
  if (!iso) return null;
  const b = iso.split("-");
  if (b.length !== 3) return null;
  return { y: +b[0], m: +b[1], d: +b[2] };
}

export function dmy(iso: string): string {
  const p = dparts(iso);
  return p ? `${p.d} ${MON[p.m - 1]} ${p.y}` : "—";
}

function toUTC(iso: string): number | null {
  const p = dparts(iso);
  return p ? Date.UTC(p.y, p.m - 1, p.d) : null;
}

export function daysUntil(iso: string): number | null {
  const t = toUTC(iso);
  if (t == null) return null;
  const now = toUTC(todayISO())!;
  return Math.round((t - now) / 86400000);
}

/** Adds months, clamping to the end of the target month (31 Jan + 1 → 28 Feb). */
export function addMonths(iso: string, m: number): string {
  const p = dparts(iso);
  if (!p) return "";
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + m);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  const mm = d.getUTCMonth() + 1, dd = d.getUTCDate();
  return `${d.getUTCFullYear()}-${mm < 10 ? "0" : ""}${mm}-${dd < 10 ? "0" : ""}${dd}`;
}

export function plural(v: number, word: string): string {
  return `${v} ${word}${Math.abs(v) === 1 ? "" : "s"}`;
}

/** How long ago a date was, in the roundest useful unit. */
export function agoLabel(iso?: string): string {
  if (!iso) return "Never backed up";
  const left = daysUntil(iso);
  if (left == null) return "Never backed up";
  const days = -left;
  if (days <= 0) return "Backed up today";
  if (days === 1) return "Backed up yesterday";
  if (days < 31) return `Backed up ${days} days ago`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `Backed up ${plural(months, "month")} ago`;
  const years = Math.floor(months / 12);
  return `Backed up over ${plural(years, "year")} ago`;
}

/** True once a backup is old enough to be worth mentioning. */
export function backupIsStale(iso: string | undefined, hasEntries: boolean): boolean {
  if (!hasEntries) return false;
  if (!iso) return true;
  const left = daysUntil(iso);
  return left == null || -left > 90;
}
