import { distanceKm } from "./stations";
import type { Ride } from "./types";

/**
 * Turns a stream of GPS fixes into a ride. Pure: no geolocation, no clock, so
 * the filtering can be tested with made-up tracks.
 *
 * Phone GPS wanders. Standing still at a light it can drift several metres a
 * second, and in a tunnel or under an HDB block it can jump hundreds of metres
 * at once. Summing raw fixes would add kilometres you never rode, so:
 *   - fixes with poor accuracy are dropped,
 *   - movement smaller than the noise floor is not counted,
 *   - a jump implying more than 250 km/h is treated as a glitch, not a ride.
 */
export interface Fix {
  lat: number; lon: number;
  /** Horizontal accuracy in metres, as the browser reports it. */
  acc: number;
  /** Milliseconds since epoch. */
  t: number;
  /** Metres per second, when the device reports it. */
  speed?: number | null;
}

export interface Track {
  km: number;
  maxKph: number;
  path: [number, number][];
  /** Last fix that was accepted as a position. */
  last: Fix | null;
  /** Last point stored in the path. */
  lastPathPt: [number, number] | null;
  /** Where the current speed window started, for devices that report no speed. */
  spAnchor: { lat: number; lon: number; t: number } | null;
  firstT: number | null;
  lastT: number | null;
  /** Fixes received and fixes thrown away, for the "GPS quality" readout. */
  fixes: number;
  dropped: number;
}

export const MAX_ACC_M = 35;
export const MIN_STEP_M = 8;
export const MAX_KPH = 250;
export const PATH_STEP_M = 25;
/** Speed from positions is averaged over at least this long; one-second steps
 *  are mostly GPS noise and would report silly top speeds. */
export const SPEED_WINDOW_MS = 3000;
/** Enough for several hours of riding at one point per 25 m. */
export const MAX_PATH = 4000;

export function newTrack(): Track {
  return { km: 0, maxKph: 0, path: [], last: null, lastPathPt: null, spAnchor: null, firstT: null, lastT: null, fixes: 0, dropped: 0 };
}

export function addFix(tr: Track, f: Fix): Track {
  const t: Track = { ...tr, fixes: tr.fixes + 1 };
  if (!isFinite(f.lat) || !isFinite(f.lon) || f.acc > MAX_ACC_M) {
    return { ...t, dropped: t.dropped + 1 };
  }
  if (t.firstT == null) t.firstT = f.t;
  t.lastT = f.t;

  if (!t.last) {
    t.last = f;
    t.spAnchor = { lat: f.lat, lon: f.lon, t: f.t };
    t.path = [[round5(f.lat), round5(f.lon)]];
    t.lastPathPt = t.path[0];
    return t;
  }

  const stepKm = distanceKm(t.last.lat, t.last.lon, f.lat, f.lon);
  const stepM = stepKm * 1000;
  const dtH = Math.max(0.0001, (f.t - t.last.t) / 3600000);
  const kph = stepKm / dtH;

  if (kph > MAX_KPH) return { ...t, dropped: t.dropped + 1 };
  // Inside the noise floor: hold the anchor, so slow real movement still
  // accumulates once it clears the floor rather than being lost step by step.
  const floor = Math.max(MIN_STEP_M, Math.min(f.acc, t.last.acc) * 0.5);
  if (stepM < floor) return t;

  t.km += stepKm;
  // Device speed (Doppler) is better than position deltas when it exists.
  // Without it, average over a few seconds rather than trusting single steps.
  const reported = f.speed != null && f.speed >= 0 ? f.speed * 3.6 : null;
  let sp = reported ?? 0;
  const a = t.spAnchor ?? { lat: t.last.lat, lon: t.last.lon, t: t.last.t };
  if (f.t - a.t >= SPEED_WINDOW_MS) {
    if (reported == null) sp = distanceKm(a.lat, a.lon, f.lat, f.lon) / ((f.t - a.t) / 3600000);
    t.spAnchor = { lat: f.lat, lon: f.lon, t: f.t };
  } else {
    t.spAnchor = a;
  }
  if (sp <= MAX_KPH) t.maxKph = Math.max(t.maxKph, sp);
  t.last = f;

  const lp = t.lastPathPt!;
  if (distanceKm(lp[0], lp[1], f.lat, f.lon) * 1000 >= PATH_STEP_M && t.path.length < MAX_PATH) {
    const pt: [number, number] = [round5(f.lat), round5(f.lon)];
    t.path = [...t.path, pt];
    t.lastPathPt = pt;
  }
  return t;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

export function trackSecs(t: Track): number {
  return t.firstT != null && t.lastT != null ? Math.max(0, Math.round((t.lastT - t.firstT) / 1000)) : 0;
}

export function avgKph(km: number, secs: number): number {
  return secs > 0 ? km / (secs / 3600) : 0;
}

export function duration(secs: number): string {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(s).padStart(2, "0")}`;
}

export interface RideTotals { count: number; km: number; secs: number; longest: number; }

export function rideTotals(rides: Ride[]): RideTotals {
  let km = 0, secs = 0, longest = 0;
  for (const r of rides) { km += r.km; secs += r.secs; longest = Math.max(longest, r.km); }
  return { count: rides.length, km, secs, longest };
}

/**
 * Projects a path into an SVG box, keeping its shape (equirectangular with the
 * longitude squeezed by cos(latitude) — plenty at Singapore's scale).
 */
export function pathToSvg(path: [number, number][], w = 100, h = 60, pad = 4): string {
  if (path.length < 2) return "";
  const k = Math.cos((path[0][0] * Math.PI) / 180);
  const xs = path.map(p => p[1] * k), ys = path.map(p => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9, spanY = maxY - minY || 1e-9;
  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  const offX = (w - spanX * scale) / 2, offY = (h - spanY * scale) / 2;
  return xs.map((x, i) => `${(offX + (x - minX) * scale).toFixed(1)},${(offY + (ys[i] - minY) * scale).toFixed(1)}`).join(" ");
}
