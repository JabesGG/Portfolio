export type EntryType = "fuel" | "service" | "expense";

export interface FuelEntry {
  id: string; type: "fuel"; date: string; odo: number; amount: number; note?: string;
  litres: number; station: string; full: boolean;
}
export interface ServiceEntry {
  id: string; type: "service"; date: string; odo: number; amount: number; note?: string;
  items: string[]; shop: string; label: string;
}
export interface ExpenseEntry {
  id: string; type: "expense"; date: string; odo: number; amount: number; note?: string;
  cat: string;
}
export type Entry = FuelEntry | ServiceEntry | ExpenseEntry;

export interface Bike {
  name: string; make: string; model: string; year: string;
  plate: string; regDate: string; odo: number; startOdo: number; tank: number;
}

/** A maintenance item: its interval, plus the manual baseline for when it was
 *  last done before you started logging. Logged services override the baseline. */
export interface SchedItem {
  id: string; n: string; km: number; months: number;
  baseOdo: number | null; baseDate: string;
}

/** A renewal that expires on a date rather than at a distance. */
export interface KeyDate {
  id: string; n: string; due: string; months: number; remind: number;
}

export interface State {
  v: number; bike: Bike; schedule: SchedItem[]; dates: KeyDate[]; entries: Entry[];
  /** ISO date of the last export. Drives the backup reminder on the Bike tab. */
  lastBackup?: string;
}

export type Level = "red" | "amber" | "green" | "unset";

export interface Status {
  level: Level;
  /** e.g. "in 724 km", "76 km over" */
  headline: string;
  sub: string;
  /** fraction of the interval remaining; lower is more urgent */
  rank: number;
}

export interface FuelRun {
  to: FuelEntry; dist: number; litres: number; kmpl: number;
}

export interface Totals {
  total: number; byCat: Record<string, number>; dist: number;
  perKm: number; kmpl: number; perL: number; fuelL: number; fuelAmt: number;
}
