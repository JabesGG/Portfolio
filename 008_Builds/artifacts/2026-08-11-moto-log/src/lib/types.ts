export type EntryType = "fuel" | "service" | "expense";

interface EntryBase {
  id: string; date: string; odo: number; amount: number; note?: string;
  /** Receipt photo ids. The images live in IndexedDB (./photos), not in the book. */
  photos?: string[];
}

export interface FuelEntry extends EntryBase {
  type: "fuel";
  litres: number; station: string; full: boolean;
  /** Petrol company, for fuel-card discounts. Guessed from the station name. */
  brand?: string;
  /** What the pump showed before any card discount. `amount` is what you paid. */
  pump?: number;
}
export interface ServiceEntry extends EntryBase {
  type: "service";
  items: string[]; shop: string; label: string;
}
export interface ExpenseEntry extends EntryBase {
  type: "expense";
  cat: string;
}
export type Entry = FuelEntry | ServiceEntry | ExpenseEntry;

export interface Bike {
  name: string; make: string; model: string; year: string;
  plate: string; regDate: string; odo: number; startOdo: number; tank: number;
  /** COE details for the calculator and the passport. All optional. */
  coe?: CoeInfo;
}

export interface CoeInfo {
  /** Quota premium (or PQP for a renewal) actually paid for the current COE. */
  paid: number;
  /** When the current COE period started (registration, or the last renewal). */
  start: string;
  /** Length of the current COE period in years: 10, or 5 for a 5-year renewal. */
  years: number;
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

/** A recorded ride. The path is thinned on the phone before it is stored. */
export interface Ride {
  id: string;
  /** ISO timestamps. */
  start: string; end: string;
  km: number; secs: number; maxKph: number;
  /** [lat, lon] pairs, thinned to roughly one point per 25 m. */
  path: [number, number][];
  /** True once its distance has been added to the odometer. */
  addedToOdo?: boolean;
  note?: string;
}

/** One bike's book. Everything the calculations need lives here, so the pure
 *  functions in ./calc keep taking a single State, exactly as before. */
export interface State {
  v: number; bike: Bike; schedule: SchedItem[]; dates: KeyDate[]; entries: Entry[];
  rides?: Ride[];
  /** ISO date of the last export. Drives the backup reminder on the Bike tab. */
  lastBackup?: string;
}

/** A book with the id it is filed under in the garage. */
export interface Book extends State { id: string; }

/** A workshop you have saved yourself — OSM is thin on Singapore bike shops. */
export interface MyWorkshop {
  id: string; name: string; phone: string; area: string; note?: string;
}

/** Settings that belong to the rider rather than to any one bike. */
export interface Prefs {
  /** Fuel-card discount by brand, in percent. */
  fuelDiscounts: Record<string, number>;
  /** Pump prices you entered yourself, by brand, for RON95 — SGD per litre. */
  pumpPrices?: { updated: string; ron95: Record<string, number> };
  myWorkshops: MyWorkshop[];
}

export interface Garage {
  v: 2;
  active: string;
  bikes: Book[];
  prefs: Prefs;
  /** ISO date of the last whole-garage export. */
  lastBackup?: string;
  /** Bumped on every change; cloud sync uses it to tell which copy is newer. */
  updated?: string;
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
