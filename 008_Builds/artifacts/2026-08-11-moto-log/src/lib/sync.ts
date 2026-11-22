import type { Garage } from "./types";
import { SYNC_KEY } from "./store";
import { normaliseGarage } from "./garage";

/**
 * Optional sync between your own devices. Off by default; while it is off the
 * app sends nothing anywhere.
 *
 * There are no accounts. Turning it on makes a long random code, and the server
 * files your garage under a hash of that code. Whoever has the code can read
 * and replace the copy, so it is a password: it is never put in a backup file,
 * in the synced copy, or in a URL. Receipt photos are not synced — they are too
 * big for this; they travel in backup files instead.
 */
export const SYNC_URL = "/api/moto-sync";

export interface SyncState {
  code: string;
  /** Server revision this device last saw. */
  rev: number;
  /** True when this device has changes the server has not got. */
  dirty: boolean;
  /** ISO time of the last successful exchange. */
  last?: string;
}

export function readSync(): SyncState | null {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SyncState;
    return s && typeof s.code === "string" && s.code.length >= 20 ? { ...s, rev: Number(s.rev) || 0, dirty: Boolean(s.dirty) } : null;
  } catch { return null; }
}

export function writeSync(s: SyncState | null): void {
  try {
    if (s) localStorage.setItem(SYNC_KEY, JSON.stringify(s));
    else localStorage.removeItem(SYNC_KEY);
  } catch { /* private mode */ }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to mistype

/** 28 characters from a 32-letter alphabet: 140 bits. */
export function newCode(): string {
  const bytes = new Uint8Array(28);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

export function tidyCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function prettyCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export function validCode(code: string): boolean {
  return /^[A-Z0-9]{24,64}$/.test(code);
}

export type Decision = "push" | "adopt" | "conflict" | "none";

/**
 * What to do, given what this device has and what the server has.
 *  - nothing on the server yet → push
 *  - server unchanged since we last looked → push if we have changes
 *  - server moved on → take it, unless we also changed, which is a conflict
 */
export function decide(localRev: number, dirty: boolean, remoteRev: number | null): Decision {
  if (remoteRev == null) return "push";
  if (remoteRev <= localRev) return dirty ? "push" : "none";
  return dirty ? "conflict" : "adopt";
}

export type PullResult =
  | { status: "ok"; rev: number; garage: Garage }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "error"; why: string };

export type PushResult =
  | { status: "ok"; rev: number }
  | { status: "conflict"; rev: number; garage: Garage | null }
  | { status: "unavailable" }
  | { status: "error"; why: string };

async function call(code: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(SYNC_URL, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Sync-Code": code, ...(init.headers || {}) },
      cache: "no-store",
    });
  } catch { return null; }
}

/** 404 with no JSON body means the function is not deployed on this host. */
async function body(res: Response): Promise<Record<string, unknown> | null> {
  try { return (await res.json()) as Record<string, unknown>; } catch { return null; }
}

export async function pull(code: string): Promise<PullResult> {
  const res = await call(code, { method: "GET" });
  if (!res) return { status: "unavailable" };
  const j = await body(res);
  if (!j) return { status: "unavailable" };
  if (res.status === 404 && j.error === "empty") return { status: "empty" };
  if (!res.ok) return { status: "error", why: String(j.error || res.status) };
  const garage = normaliseGarage(j.garage);
  if (!garage) return { status: "error", why: "bad copy" };
  return { status: "ok", rev: Number(j.rev) || 0, garage };
}

export async function push(code: string, baseRev: number, garage: Garage): Promise<PushResult> {
  const res = await call(code, { method: "PUT", body: JSON.stringify({ baseRev, garage }) });
  if (!res) return { status: "unavailable" };
  const j = await body(res);
  if (!j) return { status: "unavailable" };
  if (res.status === 409) return { status: "conflict", rev: Number(j.rev) || 0, garage: normaliseGarage(j.garage) };
  if (!res.ok) return { status: "error", why: String(j.error || res.status) };
  return { status: "ok", rev: Number(j.rev) || 0 };
}

export type SyncOutcome =
  | { kind: "off" | "none" | "unavailable" }
  | { kind: "pushed"; rev: number }
  | { kind: "adopted"; garage: Garage }
  | { kind: "conflict"; remote: Garage; rev: number }
  | { kind: "error"; why: string };

/**
 * One round of sync. `current` is read again after the upload, so a change made
 * while the request was in flight is not mistaken for one the server has.
 */
export async function syncOnce(current: () => Garage): Promise<SyncOutcome> {
  const st = readSync();
  if (!st) return { kind: "off" };
  const r = await pull(st.code);
  if (r.status === "unavailable") return { kind: "unavailable" };
  if (r.status === "error") return { kind: "error", why: r.why };
  const remoteRev = r.status === "ok" ? r.rev : null;
  const now = new Date().toISOString();

  switch (decide(st.rev, st.dirty, remoteRev)) {
    case "none":
      writeSync({ ...st, last: now });
      return { kind: "none" };
    case "adopt":
      if (r.status !== "ok") return { kind: "none" };
      writeSync({ ...st, rev: r.rev, dirty: false, last: now });
      return { kind: "adopted", garage: r.garage };
    case "conflict":
      if (r.status !== "ok") return { kind: "none" };
      return { kind: "conflict", remote: r.garage, rev: r.rev };
    case "push":
      return pushNow(current, remoteRev ?? 0);
  }
}

/** Uploads this device's copy on top of revision `baseRev`. */
export async function pushNow(current: () => Garage, baseRev: number): Promise<SyncOutcome> {
  const st = readSync();
  if (!st) return { kind: "off" };
  const sent = current();
  const p = await push(st.code, baseRev, sent);
  if (p.status === "unavailable") return { kind: "unavailable" };
  if (p.status === "error") return { kind: "error", why: p.why };
  if (p.status === "conflict") {
    return p.garage ? { kind: "conflict", remote: p.garage, rev: p.rev } : { kind: "error", why: "conflict" };
  }
  writeSync({ ...st, rev: p.rev, dirty: current().updated !== sent.updated, last: new Date().toISOString() });
  return { kind: "pushed", rev: p.rev };
}

/** Takes the server's copy over this device's. */
export function acceptRemote(rev: number): void {
  const st = readSync();
  if (st) writeSync({ ...st, rev, dirty: false, last: new Date().toISOString() });
}

/** Deletes the server's copy. Best effort: there is nothing useful to do if it fails. */
export async function wipe(code: string): Promise<boolean> {
  const res = await call(code, { method: "DELETE" });
  return Boolean(res?.ok);
}
