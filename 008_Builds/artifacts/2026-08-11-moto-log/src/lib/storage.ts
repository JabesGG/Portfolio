import type { State } from "./types";
import { KEY, seed } from "./store";

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

/** A book from disk may predate a field, so fill the gaps rather than trust it. */
function normalise(raw: unknown): State | null {
  const p = raw as State;
  if (!p || !p.bike || !Array.isArray(p.entries)) return null;
  if (!Array.isArray(p.schedule)) p.schedule = seed().schedule;
  if (!Array.isArray(p.dates)) p.dates = seed().dates;
  return p;
}

/**
 * Synchronous read for the web, so the first paint already has the book and
 * there is no empty flash. Returns null when a native backend is installed,
 * where the caller must await load() instead.
 */
export function loadSync(): State | null {
  if (backend) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalise(JSON.parse(raw)) ?? seed();
  } catch { /* private mode, blocked storage */ }
  return seed();
}

export async function load(): Promise<State> {
  if (!backend) return loadSync()!;
  try {
    const value = await backend.get(KEY);
    if (value) return normalise(JSON.parse(value)) ?? seed();
  } catch { /* fall through to a fresh book */ }
  return seed();
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
export async function save(s: State): Promise<boolean> {
  const json = JSON.stringify(s);
  try {
    if (backend) await backend.set(KEY, json);
    else localStorage.setItem(KEY, json);
    return true;
  } catch {
    return false;
  }
}
