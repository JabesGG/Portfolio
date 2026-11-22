import type { Garage, State } from "./types";
import { fuelRuns } from "./calc";
import { num } from "./format";

/**
 * XP and badges, worked out from the log itself. Nothing extra is stored, so
 * the numbers can never drift from the records, deleting an entry takes its XP
 * back, and a restored backup arrives with its history already counted.
 */

export const XP = { fuel: 10, service: 30, expense: 5, perRideKm: 1, rideMax: 50, receipt: 5, renewal: 15, baseline: 5 };

export function bookXp(s: State): number {
  let xp = 0;
  for (const e of s.entries) {
    xp += e.type === "fuel" ? XP.fuel : e.type === "service" ? XP.service : XP.expense;
    if (e.photos?.length) xp += XP.receipt;
  }
  for (const r of s.rides ?? []) xp += Math.min(XP.rideMax, Math.round(r.km) * XP.perRideKm);
  xp += s.dates.filter(d => d.due).length * XP.renewal;
  xp += s.schedule.filter(i => i.baseDate || i.baseOdo != null).length * XP.baseline;
  return xp;
}

export function garageXp(g: Garage): number {
  return g.bikes.reduce((t, b) => t + bookXp(b), 0);
}

export interface LevelInfo {
  level: number; title: string;
  /** XP into the current level, and the size of that level. */
  into: number; span: number;
  /** 0–1 progress to the next level. */
  frac: number;
}

const TITLES = ["Learner", "Commuter", "Regular", "Wrench", "Road captain", "Iron butt", "Legend"];

/** Level n needs 100·n(n−1)/2 XP in total: 0, 100, 300, 600, 1000… */
export function levelOf(xp: number): LevelInfo {
  let level = 1;
  while (xp >= (100 * (level + 1) * level) / 2) level++;
  const floor = (100 * level * (level - 1)) / 2;
  const span = 100 * level;
  const into = xp - floor;
  return { level, title: TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))], into, span, frac: into / span };
}

export interface Badge { id: string; name: string; how: string; got: boolean; }

export function badges(g: Garage): Badge[] {
  const all = g.bikes.flatMap(b => b.entries);
  const rides = g.bikes.flatMap(b => b.rides ?? []);
  const fuel = all.filter(e => e.type === "fuel").length;
  const svc = all.filter(e => e.type === "service").length;
  const rideKm = rides.reduce((t, r) => t + r.km, 0);
  const runs = g.bikes.reduce((t, b) => t + fuelRuns(b).length, 0);
  const tracked = g.bikes.reduce((t, b) => t + Math.max(0, num(b.bike.odo) - num(b.bike.startOdo)), 0);
  const months = new Set(all.map(e => (e.date || "").slice(0, 7)).filter(Boolean)).size;
  const allDates = g.bikes.some(b => b.dates.length > 0 && b.dates.every(d => d.due));
  const allBase = g.bikes.some(b => b.schedule.length > 0 && b.schedule.every(i => i.baseDate || i.baseOdo != null));

  return [
    { id: "first", name: "First entry", how: "Log anything", got: all.length >= 1 },
    { id: "fuel10", name: "Ten tanks", how: "Log 10 fuel fills", got: fuel >= 10 },
    { id: "econ", name: "Knows the number", how: "5 full-to-full economy runs", got: runs >= 5 },
    { id: "svc1", name: "Spanner out", how: "Log a service", got: svc >= 1 },
    { id: "svc5", name: "Full service history", how: "Log 5 services", got: svc >= 5 },
    { id: "papers", name: "Paperwork sorted", how: "Set every renewal date on a bike", got: allDates },
    { id: "base", name: "Nothing unknown", how: "Give every service item a baseline", got: allBase },
    { id: "receipt", name: "Kept the receipt", how: "Attach a receipt photo", got: all.some(e => e.photos?.length) },
    { id: "ride1", name: "Wheels turning", how: "Record a ride", got: rides.length >= 1 },
    { id: "ride100", name: "Century", how: "Record 100 km of rides", got: rideKm >= 100 },
    { id: "km5k", name: "5,000 km tracked", how: "Track 5,000 km on the odometer", got: tracked >= 5000 },
    { id: "habit", name: "Six-month habit", how: "Log in 6 different months", got: months >= 6 },
    { id: "backup", name: "Belt and braces", how: "Take a backup", got: Boolean(g.lastBackup) },
    { id: "garage", name: "Two in the garage", how: "Add a second bike", got: g.bikes.length >= 2 },
  ];
}
