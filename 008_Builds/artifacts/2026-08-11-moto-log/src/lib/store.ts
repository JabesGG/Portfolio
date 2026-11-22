import type { State, SchedItem, KeyDate, Book, Garage, Prefs } from "./types";

/** The single-bike book from before the garage. Read once to migrate, never
 *  written again, and left in place so a downgrade still finds its data. */
export const KEY = "motolog.v1";
/** The garage: every bike plus rider-level settings. */
export const GARAGE_KEY = "motolog.v2";
export const THEME_KEY = "motolog.theme";
/** Sync code and revision. Kept out of the garage so neither a backup file nor
 *  the synced copy itself ever carries the secret. */
export const SYNC_KEY = "motolog.sync";

/** The forecourt brands in Singapore, as they appear in the station list. */
export const BRANDS = ["Shell", "Esso", "Caltex", "SPC", "Sinopec", "Cnergy", "SMART Energy"];

/** Best guess at the brand from whatever was typed as the station. */
export function guessBrand(station: string): string {
  const s = station.toLowerCase();
  if (s.includes("shell")) return "Shell";
  if (s.includes("esso") || s.includes("exxon")) return "Esso";
  if (s.includes("caltex")) return "Caltex";
  if (s.includes("spc")) return "SPC";
  if (s.includes("sinopec")) return "Sinopec";
  if (s.includes("cnergy")) return "Cnergy";
  if (s.includes("smart")) return "SMART Energy";
  return "";
}

export const DEFAULT_SCHEDULE: Omit<SchedItem, "id" | "baseOdo" | "baseDate">[] = [
  { n: "Engine oil",         km: 3000,  months: 6 },
  { n: "Oil filter",         km: 6000,  months: 12 },
  { n: "Chain clean & lube", km: 500,   months: 1 },
  { n: "Chain & sprockets",  km: 20000, months: 36 },
  { n: "Air filter",         km: 12000, months: 24 },
  { n: "Spark plugs",        km: 8000,  months: 12 },
  { n: "Brake pads — front", km: 15000, months: 0 },
  { n: "Brake pads — rear",  km: 18000, months: 0 },
  { n: "Brake fluid",        km: 0,     months: 24 },
  { n: "Coolant",            km: 24000, months: 24 },
  { n: "Valve clearance",    km: 24000, months: 0 },
  { n: "Front tyre",         km: 15000, months: 0 },
  { n: "Rear tyre",          km: 10000, months: 0 },
  { n: "Battery",            km: 0,     months: 36 },
];

export const DEFAULT_DATES: Omit<KeyDate, "id" | "due" | "remind">[] = [
  { n: "Road tax",           months: 12 },
  { n: "Insurance",          months: 12 },
  // LTA: motorcycles are inspected yearly once they are 3 years old.
  { n: "Vehicle inspection", months: 12 },
  { n: "COE expiry",         months: 0 },
];

/** "Upgrades & mods" is what you bolt to the bike; "Gear & accessories" is what
 *  you wear. Keeping them apart is the difference between knowing what the bike
 *  costs to run and what the hobby costs. Never rename an existing entry here —
 *  logged expenses store the string, so a rename orphans them. */
export const CATS = [
  "Fuel", "Service & parts", "Road tax", "Insurance", "COE", "Inspection",
  "Parking & ERP", "Upgrades & mods", "Gear & accessories", "Fines",
  "Loan / instalment", "Other",
];

/** Categories a manual expense can use — fuel and service get their own forms. */
export const EXPENSE_CATS = CATS.filter(c => c !== "Fuel" && c !== "Service & parts");

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

export function seed(): State {
  return {
    v: 1,
    bike: { name: "", make: "", model: "", year: "", plate: "", regDate: "", odo: 0, startOdo: 0, tank: 0 },
    schedule: DEFAULT_SCHEDULE.map(d => ({ id: uid(), ...d, baseOdo: null, baseDate: "" })),
    dates: DEFAULT_DATES.map(d => ({ id: uid(), ...d, due: "", remind: 30 })),
    entries: [],
    rides: [],
  };
}

export function newBook(from?: State): Book {
  return { ...(from ?? seed()), id: uid() };
}

export function defaultPrefs(): Prefs {
  return { fuelDiscounts: {}, myWorkshops: [] };
}

export function seedGarage(): Garage {
  const b = newBook();
  return { v: 2, active: b.id, bikes: [b], prefs: defaultPrefs() };
}

// Persistence lives in ./storage, which picks localStorage on the web and
// native Preferences inside the app shell.
