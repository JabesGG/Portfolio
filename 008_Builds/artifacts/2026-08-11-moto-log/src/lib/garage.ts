import type { State, Book, Garage, Prefs } from "./types";
import { seed, newBook, defaultPrefs, uid } from "./store";
import { num } from "./format";

/**
 * The garage holds every bike. Each bike keeps the exact single-bike book shape
 * the app had before, so every calculation still takes one State and none of
 * them had to change. Nothing here touches storage or the DOM.
 */

/** A book from disk may predate a field, so fill the gaps rather than trust it. */
export function normaliseBook(raw: unknown): State | null {
  const p = raw as State;
  if (!p || typeof p !== "object" || !p.bike || !Array.isArray(p.entries)) return null;
  if (!Array.isArray(p.schedule)) p.schedule = seed().schedule;
  if (!Array.isArray(p.dates)) p.dates = seed().dates;
  if (!Array.isArray(p.rides)) p.rides = [];
  if (typeof p.v !== "number") p.v = 1;
  return p;
}

function normalisePrefs(raw: unknown): Prefs {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Prefs>;
  return {
    ...defaultPrefs(),
    ...p,
    fuelDiscounts: p.fuelDiscounts && typeof p.fuelDiscounts === "object" ? p.fuelDiscounts : {},
    myWorkshops: Array.isArray(p.myWorkshops) ? p.myWorkshops : [],
  };
}

export function normaliseGarage(raw: unknown): Garage | null {
  const g = raw as Garage;
  if (!g || typeof g !== "object" || !Array.isArray(g.bikes)) return null;
  const bikes: Book[] = [];
  for (const b of g.bikes) {
    const ok = normaliseBook(b);
    if (ok) bikes.push({ ...ok, id: (b as Book).id || uid() });
  }
  if (!bikes.length) bikes.push(newBook());
  const active = bikes.some(b => b.id === g.active) ? g.active : bikes[0].id;
  return { ...g, v: 2, active, bikes, prefs: normalisePrefs(g.prefs) };
}

/** Wraps a single-bike book from v1 as the first bike in a new garage. The
 *  book's own backup date becomes the garage's, so the reminder carries over. */
/**
 * Puts right one thing every v1 book got wrong. The inspection reminder shipped
 * with a 24-month default, which is the rule for cars; motorcycles are inspected
 * every year from their third. Only the untouched default is changed — a rider
 * who typed a different interval keeps it — and only once, on the way in from v1.
 */
export function upgradeV1(s: State): State {
  for (const d of s.dates) {
    if (d.n === "Vehicle inspection" && num(d.months) === 24) d.months = 12;
  }
  return s;
}

export function fromV1(s: State): Garage {
  const book = newBook(upgradeV1(normaliseBook(s) ?? seed()));
  return {
    v: 2, active: book.id, bikes: [book], prefs: defaultPrefs(),
    ...(s.lastBackup ? { lastBackup: s.lastBackup } : {}),
  };
}

export function activeBook(g: Garage): Book {
  return g.bikes.find(b => b.id === g.active) ?? g.bikes[0];
}

export function bikeLabel(s: State): string {
  return s.bike.name || [s.bike.year, s.bike.make, s.bike.model].filter(Boolean).join(" ") || "Unnamed bike";
}

/** What a backup file holds. Photos ride along so a restore is complete. */
export interface BackupFile {
  app: "moto-log";
  v: 2;
  exported: string;
  garage: Garage;
  photos?: Record<string, string>;
}

export type Parsed =
  | { kind: "garage"; garage: Garage; photos: Record<string, string> }
  | { kind: "book"; book: State }
  | null;

/**
 * Reads any backup this app has ever written: the v2 file (garage + photos),
 * a bare garage, or a v1 single-bike book. A v1 book is returned as a book so
 * the caller can add it as another bike instead of wiping the garage.
 */
export function parseBackup(text: string): Parsed {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const r = raw as Partial<BackupFile> & Partial<Garage> & Partial<State>;
  if (r && r.app === "moto-log" && r.garage) {
    const garage = normaliseGarage(r.garage);
    if (!garage) return null;
    const photos = r.photos && typeof r.photos === "object" ? r.photos : {};
    return { kind: "garage", garage, photos };
  }
  if (r && Array.isArray(r.bikes)) {
    const garage = normaliseGarage(r);
    return garage ? { kind: "garage", garage, photos: {} } : null;
  }
  const book = normaliseBook(r);
  return book ? { kind: "book", book } : null;
}

/** Every photo id referenced anywhere in the garage. */
export function photoIds(g: Garage): string[] {
  const out: string[] = [];
  for (const b of g.bikes) for (const e of b.entries) if (e.photos) out.push(...e.photos);
  return out;
}
