import type { State, SchedItem, KeyDate } from "./types";

export const KEY = "motolog.v1";
export const THEME_KEY = "motolog.theme";

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
  { n: "Vehicle inspection", months: 24 },
  { n: "COE expiry",         months: 0 },
];

export const CATS = [
  "Fuel", "Service & parts", "Road tax", "Insurance", "COE", "Inspection",
  "Parking & ERP", "Gear & accessories", "Fines", "Loan / instalment", "Other",
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
  };
}

// Persistence lives in ./storage, which picks localStorage on the web and
// native Preferences inside the app shell.
