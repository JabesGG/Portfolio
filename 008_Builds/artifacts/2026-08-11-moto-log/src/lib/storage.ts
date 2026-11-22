import type { Garage } from "./types";
import { KEY, GARAGE_KEY, seedGarage } from "./store";
import { fromV1, normaliseBook, normaliseGarage } from "./garage";

/**
 * Persistence with a pluggable backend.
 *
 * Nothing here imports Capacitor. That is deliberate: pulling the native bridge
 * into the web bundle made Parcel emit an inline <script type="importmap"> to
 * resolve its lazy chunks, which the site's `script-src 'self'` blocks outright.
 * The native entry injects its backend at startup instead, so the web build
 * stays free of both the bridge and the import map.
 */
export interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

let backend: StorageBackend | null = null;

/** Called once by the native entry, before the app renders. */
export function setStorageBackend(b: StorageBackend): void {
  backend = b;
}

export const isNative = (): boolean => backend !== null;

/**
 * Turns whatever is on disk into a garage. The garage key wins; failing that, a
 * v1 single-bike book is wrapped as the first bike. The v1 key is left exactly
 * as it was — never written again, but there for a downgrade to find.
 */
function fromDisk(v2: string | null, v1: string | null): Garage {
  try {
    if (v2) { const g = normaliseGarage(JSON.parse(v2)); if (g) { readOk = true; return g; } }
  } catch { /* fall through */ }
  try {
    if (v1) { const b = normaliseBook(JSON.parse(v1)); if (b) { readOk = true; return fromV1(b); } }
  } catch { /* fall through */ }
  // Nothing stored at all is a genuine first run; something stored that would
  // not parse is not, and must not be treated as "the garage is empty".
  if (!v2 && !v1) readOk = true;
  return seedGarage();
}

let readOk = false;

/** True when the garage in memory really is what storage holds (or a genuine
 *  first run). Destructive tidying — dropping unreferenced photos — checks this,
 *  so a failed read can never be mistaken for "nothing references them". */
export const storageReadOk = (): boolean => readOk;

/**
 * Synchronous read for the web, so the first paint already has the garage and
 * there is no empty flash. Returns null when a native backend is installed,
 * where the caller must await load() instead.
 */
export function loadSync(): Garage | null {
  if (backend) return null;
  try {
    return fromDisk(localStorage.getItem(GARAGE_KEY), localStorage.getItem(KEY));
  } catch { /* private mode, blocked storage */ }
  return seedGarage();
}

export async function load(): Promise<Garage> {
  if (!backend) return loadSync()!;
  try {
    return fromDisk(await backend.get(GARAGE_KEY), await backend.get(KEY));
  } catch { /* fall through to a fresh garage */ }
  return seedGarage();
}

export type Durability = "native" | "persistent" | "best-effort" | "unknown";

/**
 * Asks the browser to mark this origin's storage as persistent, which takes it
 * out of the pool the browser is free to evict when space runs short. Chrome
 * grants it silently for installed apps; Safari does not implement it at all,
 * hence the guards. Safe to call on every start — it is a no-op once granted.
 */
export async function requestPersistence(): Promise<Durability> {
  if (backend) return "native"; // the native key store is already durable
  try {
    if (!navigator.storage?.persist) return "unknown";
    if (await navigator.storage.persisted()) return "persistent";
    return (await navigator.storage.persist()) ? "persistent" : "best-effort";
  } catch {
    return "unknown";
  }
}

export async function durability(): Promise<Durability> {
  if (backend) return "native";
  try {
    if (!navigator.storage?.persisted) return "unknown";
    return (await navigator.storage.persisted()) ? "persistent" : "best-effort";
  } catch {
    return "unknown";
  }
}

/**
 * Resolves false if the write failed, so the caller can say so rather than
 * silently losing an entry.
 */
export async function save(g: Garage): Promise<boolean> {
  const json = JSON.stringify(g);
  try {
    if (backend) await backend.set(GARAGE_KEY, json);
    else localStorage.setItem(GARAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}
