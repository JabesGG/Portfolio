// Relative, not "@/", so the test runner resolves it the same way the bundler does.
import raw from "../data/stations.json";

/**
 * Every petrol station in Singapore, baked in at build time by
 * tools/fetch-stations.cjs. Bundled rather than fetched so this works when you
 * are low on fuel somewhere with no reception — and so your position never
 * leaves the device.
 */
export interface Station {
  name: string;
  brand: string;
  /** Present only where OSM knows it; disambiguates forecourts named just "Shell". */
  street?: string;
  lat: number;
  lon: number;
}

export interface Near extends Station {
  /** Straight-line distance. Not road distance — see the note in the sheet. */
  km: number;
  /** Compass point, e.g. "NE". */
  dir: string;
}

export const STATIONS = raw as Station[];

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing from a to b, in degrees clockwise from north. */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLon = rad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(rad(bLat));
  const x =
    Math.cos(rad(aLat)) * Math.sin(rad(bLat)) -
    Math.sin(rad(aLat)) * Math.cos(rad(bLat)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function compass(deg: number): string {
  const i = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return POINTS[i];
}

/** The `count` closest stations to a position, nearest first. */
export function nearest(
  lat: number,
  lon: number,
  count = 5,
  list: Station[] = STATIONS,
): Near[] {
  return list
    .map(s => ({
      ...s,
      km: distanceKm(lat, lon, s.lat, s.lon),
      dir: compass(bearingDeg(lat, lon, s.lat, s.lon)),
    }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}

/** Metres under a kilometre, so "400 m" rather than "0.4 km". */
export function prettyDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(1)} km`;
}

/**
 * A directions link. iOS gets Apple Maps so it opens natively even without
 * Google Maps installed; everything else gets the Google universal URL, which
 * hands off to the installed app when there is one.
 */
export function directionsUrl(s: Station): string {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const q = `${s.lat},${s.lon}`;
  return isIOS
    ? `https://maps.apple.com/?daddr=${q}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}
