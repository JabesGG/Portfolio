// Relative, not "@/", so the test runner resolves it the same way the bundler does.
import raw from "../data/workshops.json";
import { bearingDeg, compass, distanceKm } from "./stations";

/**
 * Motorcycle workshops and shops in Singapore, baked in at build time by
 * tools/fetch-workshops.cjs from OpenStreetMap. Bundled for the same reasons as
 * the fuel stations: it works with no signal, and your position stays on the phone.
 *
 * OSM's coverage of Singapore bike shops is thin — a few dozen, where there are
 * hundreds. That is why the app also lets you save your own.
 */
export interface Workshop {
  name: string;
  /** "repair" where OSM tags a workshop; "shop" for a dealer or parts shop. */
  kind: "repair" | "shop";
  street?: string;
  phone?: string;
  web?: string;
  hours?: string;
  lat: number;
  lon: number;
}

export interface NearWorkshop extends Workshop { km: number; dir: string; }

export const WORKSHOPS = raw as Workshop[];

export function nearestWorkshops(lat: number, lon: number, list: Workshop[] = WORKSHOPS): NearWorkshop[] {
  return list
    .map(w => ({ ...w, km: distanceKm(lat, lon, w.lat, w.lon), dir: compass(bearingDeg(lat, lon, w.lat, w.lon)) }))
    .sort((a, b) => a.km - b.km);
}

/** Digits only, with Singapore's country code when it is missing. */
export function sgDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 8) return "65" + d;
  return d;
}

export function telHref(phone: string): string {
  return "tel:+" + sgDigits(phone);
}

/** WhatsApp only makes sense for mobile numbers, which start with 8 or 9 here. */
export function waHref(phone: string): string | null {
  const d = sgDigits(phone);
  return /^65[89]\d{7}$/.test(d) ? `https://wa.me/${d}` : null;
}

export function mapsUrl(lat: number, lon: number): string {
  const isIOS = typeof navigator !== "undefined" && /iP(hone|ad|od)/.test(navigator.userAgent);
  const q = `${lat},${lon}`;
  return isIOS
    ? `https://maps.apple.com/?daddr=${q}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

/** A search link for a workshop you saved by name, which has no coordinates. */
export function mapsSearchUrl(text: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text + " Singapore")}`;
}
