import { useSyncExternalStore } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import type { Garage } from "./types";
import {
  markDirty, syncRound, newCloudState, rebase, keepNewDirt,
  type CloudState, type Row, type Server, type Table,
} from "./records";
import { photoIds } from "./garage";
import { getPhoto, putPhotos } from "./photos";

/**
 * Accounts and sync, through Supabase.
 *
 * Signed out, the app works exactly as before and talks to nobody: the Supabase
 * library isn't even downloaded until you sign in, or a stored sign-in is found.
 * Signed in, each record (a bike, an entry, a ride, your settings) is its own
 * row, so two devices editing different things never overwrite each other.
 * Where both changed the same record, the later edit wins. Receipt photos go
 * to private storage under your account.
 *
 * The key below is the project's *publishable* key. It is meant to be in the
 * page: on its own it can do nothing but sign in, and every row is guarded by
 * row-level security (supabase/schema.sql) so a rider only ever sees their own.
 */
export const SUPABASE_URL = "https://uderotopoaxwvjtyigqy.supabase.co";
const SUPABASE_KEY = "sb_publishable_gQtNrebUr_douQ0Its3qwQ_HFYoMdeg";
const AUTH_KEY = "sb-uderotopoaxwvjtyigqy-auth-token";
const STATE_KEY = "motolog.cloud";
const BUCKET = "receipts";

/* ---------------------------------------------------------------- view --- */

export interface CloudView {
  /** "loading" while a stored sign-in is being checked. */
  status: "signed-out" | "loading" | "signed-in";
  email?: string;
  syncing: boolean;
  /** ISO time of the last finished round. */
  last?: string;
  /** Why the last round failed, in words for the rider. Cleared by the next success. */
  error?: string;
  /** Arrived from a password-reset link: ask for a new password. */
  recovery: boolean;
  /** Something to say once, then forget (a confirmation link that expired, say). */
  notice?: string;
}

let view: CloudView = { status: hasStoredSession() ? "loading" : "signed-out", syncing: false, recovery: false, last: readState()?.last };
const listeners = new Set<() => void>();
function setView(patch: Partial<CloudView>) {
  view = { ...view, ...patch };
  listeners.forEach(f => f());
}
export function useCloud(): CloudView {
  return useSyncExternalStore(
    f => { listeners.add(f); return () => { listeners.delete(f); }; },
    () => view,
  );
}
export function clearNotice() { if (view.notice) setView({ notice: undefined }); }

/* --------------------------------------------------------------- state --- */

interface Stored {
  st: CloudState;
  last?: string;
  /** Photo ids known to be in storage. */
  photosUp: string[];
  /** Last time orphaned photos were swept from storage. */
  gcAt?: string;
}

function readState(): Stored | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    return s && s.st && typeof s.st.user === "string" ? { ...s, photosUp: Array.isArray(s.photosUp) ? s.photosUp : [] } : null;
  } catch { return null; }
}
function writeState(s: Stored | null) {
  try {
    if (s) localStorage.setItem(STATE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STATE_KEY);
  } catch { /* storage full or blocked: the next round starts over, which is safe */ }
}

/** True when there may be a signed-in rider: a stored session, or a link from
 *  an email (confirm, reset) that has just landed us here. */
export function hasStoredSession(): boolean {
  try {
    if (localStorage.getItem(AUTH_KEY)) return true;
  } catch { /* fall through */ }
  const h = typeof location !== "undefined" ? location.hash : "";
  return /access_token=|error_description=/.test(h);
}

/* -------------------------------------------------------------- client --- */

let clientP: Promise<SupabaseClient> | null = null;
let session: Session | null = null;

function client(): Promise<SupabaseClient> {
  if (clientP) return clientP;
  // A link from an email that failed (expired, already used) comes back with
  // the reason in the hash. Read it before the library tidies the hash away.
  const h = new URLSearchParams(location.hash.slice(1));
  const linkError = h.get("error_description");
  clientP = import("@supabase/supabase-js").then(({ createClient }) => {
    const c = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Links in emails carry the session themselves, so they work even when
        // opened in a different browser from the one that asked for them.
        flowType: "implicit",
        storageKey: AUTH_KEY,
      },
    });
    c.auth.onAuthStateChange((event, s) => {
      session = s;
      // Supabase asks that nothing else is awaited inside this callback.
      setTimeout(() => onAuth(event, s), 0);
    });
    if (linkError) {
      setView({ notice: /expired|invalid/i.test(linkError) ? "That link has expired or was already used. Sign in, or ask for a new one." : linkError });
      history.replaceState(null, "", location.pathname + location.search);
    }
    return c;
  });
  clientP.catch(() => { clientP = null; });
  return clientP;
}

function onAuth(event: string, s: Session | null) {
  if (event === "PASSWORD_RECOVERY") setView({ recovery: true });
  if (!s) {
    writeState(null);
    setView({ status: "signed-out", email: undefined, syncing: false, error: undefined, last: undefined });
    return;
  }
  const prev = readState();
  if (!prev || prev.st.user !== s.user.id) {
    // A different rider from last time (or the first time): start a fresh link.
    // The first round merges whatever this device has into their account.
    writeState({ st: newCloudState(s.user.id), photosUp: [] });
  }
  setView({ status: "signed-in", email: s.user.email ?? undefined, last: readState()?.last });
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") requestSync(300);
}

/* -------------------------------------------------------------- server --- */

const COLS = "id,data,updated_at,deleted,synced_at";
const colsOf = (t: Table) => (t === "entries" || t === "rides" ? COLS + ",bike_id" : COLS);
const PAGE = 1000;

function server(c: SupabaseClient): Server {
  return {
    async pull(t, since) {
      const out: Row[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = c.from(t).select(colsOf(t));
        if (since) q = q.gt("synced_at", since);
        const { data, error } = await q.order("synced_at").order("id").range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data as unknown as Row[]));
        if (!data || data.length < PAGE) return out;
      }
    },
    async push(t, rows) {
      const out: Row[] = [];
      for (let i = 0; i < rows.length; i += 500) {
        const { data, error } = await c.from(t)
          .upsert(rows.slice(i, i + 500), { onConflict: "user_id,id" })
          .select(colsOf(t));
        if (error) throw error;
        out.push(...(data as unknown as Row[]));
      }
      return out;
    },
  };
}

/** Turns whatever went wrong into something a rider can act on. */
function say(e: unknown): string {
  const any = e as { message?: string; code?: string; status?: number } | null;
  const m = String(any?.message ?? e ?? "");
  if (/fetch|network|load failed|offline/i.test(m) || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return "Offline. Your changes are saved here and will sync when you're back online.";
  }
  if (any?.code === "PGRST205" || /relation .* does not exist|schema cache/i.test(m)) {
    return "The account database isn't set up yet (run supabase/schema.sql).";
  }
  if (/JWT|token|401/i.test(m) || any?.status === 401) return "Your sign-in has expired. Sign in again.";
  return m || "Sync failed.";
}

/* ---------------------------------------------------------------- sync --- */

export interface Host {
  /** The garage as it is right now. */
  get(): Garage;
  /** Put a garage that came from the account. Not a local edit: don't mark it. */
  set(next: Garage, adopted: boolean): void;
  toast(msg: string): void;
}

let host: Host | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;

/** Called once by the app. Picks up a stored sign-in and keeps syncing while
 *  the app is open: on launch, on return to the tab, on reconnect, every two
 *  minutes while visible, and a few seconds after each change. */
export function startCloud(h: Host): () => void {
  host = h;
  // The code-based sync this replaced kept its secret here. It is dead now.
  try { localStorage.removeItem("motolog.sync"); } catch { /* blocked */ }
  if (hasStoredSession()) void client().catch(() => setView({ status: "signed-out", error: "Couldn't load sign-in. Check your connection." }));
  const wake = () => { if (document.visibilityState === "visible") requestSync(500); };
  const tick = setInterval(() => { if (document.visibilityState === "visible") requestSync(0); }, 120_000);
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);
  return () => {
    host = null;
    clearInterval(tick);
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("online", wake);
  };
}

/** Every local edit passes through here, so the next round knows what to send
 *  and how recent each change is. */
export function noteLocalChange(prev: Garage, next: Garage) {
  const s = readState();
  if (!s) return;
  const now = new Date().toISOString();
  writeState({ ...s, st: { ...s.st, dirtyAt: markDirty(prev, next, s.st.dirtyAt, now) } });
  requestSync(3000);
}

export function requestSync(delay = 2500) {
  if (!readState() || !host) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void runSync(); }, delay);
}

/** Sync right now and say how it went. */
export async function syncNow(): Promise<string | null> {
  await runSync();
  return view.error ?? null;
}

async function runSync(): Promise<void> {
  if (running) { again = true; return; }
  running = true;
  try {
    // One round at a time across tabs, too.
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks) await locks.request("motolog-sync", () => round());
    else await round();
  } finally {
    running = false;
    if (again) { again = false; requestSync(500); }
  }
}

async function round(): Promise<void> {
  const stored = readState();
  if (!stored || !host) return;
  const c = await client();
  if (!session) { const { data } = await c.auth.getSession(); session = data.session; }
  if (!session || session.user.id !== stored.st.user) return;

  setView({ syncing: true });
  const startG = host.get();
  const startDirt = stored.st.dirtyAt;
  const wasLinked = stored.st.linked;
  try {
    const r = await syncRound(startG, stored.st, server(c), () => new Date().toISOString());

    // Signed out, or someone else signed in, while this ran: drop the result.
    const cur = readState();
    if (!cur || cur.st.user !== stored.st.user || !host) return;

    const nowG = host.get();
    const touched = nowG !== startG;
    const garage = touched ? rebase(startG, nowG, r.garage) : r.garage;
    const dirtyAt = touched ? keepNewDirt(startDirt, cur.st.dirtyAt, r.state.dirtyAt) : r.state.dirtyAt;
    const last = new Date().toISOString();
    writeState({ ...cur, st: { ...r.state, dirtyAt }, last });
    if (r.changed || r.adopted) host.set(garage, r.adopted);
    setView({ last, error: undefined });

    if (!wasLinked) {
      host.toast(r.adopted ? "Signed in. Your records are on this device now."
        : r.pushed ? "Signed in. This device's records are now in your account." : "Signed in.");
    } else if (r.changed) {
      host.toast("Updated from your other device.");
    }
    if (touched) requestSync(1500);

    try { await syncPhotos(c, stored.st.user, garage); } catch { /* photos catch up next round */ }
  } catch (e) {
    setView({ error: say(e) });
    if (navigator.onLine) requestSync(60_000);
  } finally {
    setView({ syncing: false });
  }
}

/* -------------------------------------------------------------- photos --- */

function dataUrlToBlob(u: string): Blob {
  const [head, b64] = u.split(",", 2);
  const type = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Uploads photos this device has that the account doesn't, and fetches ones
 *  it is missing. A dozen per round, so a big backlog never stalls a sync. */
async function syncPhotos(c: SupabaseClient, uid: string, g: Garage) {
  const ids = photoIds(g);
  const s = readState();
  if (!s || s.st.user !== uid) return;
  const up = new Set(s.photosUp);
  const store = c.storage.from(BUCKET);
  let budget = 12;
  for (const id of ids) {
    if (budget <= 0) break;
    const local = await getPhoto(id);
    if (local && up.has(id)) continue;
    budget--;
    const path = `${uid}/${id}.jpg`;
    if (local) {
      const { error } = await store.upload(path, dataUrlToBlob(local), { contentType: "image/jpeg", upsert: true });
      const status = Number((error as { statusCode?: string | number } | null)?.statusCode);
      // A photo the bucket refuses (too big, wrong type) is not retried forever.
      if (!error || (status >= 400 && status < 500 && status !== 401 && status !== 403)) up.add(id);
    } else {
      const { data } = await store.download(path);
      if (data) { await putPhotos({ [id]: await blobToDataUrl(data) }); up.add(id); }
    }
  }

  // Once a day, sweep photos no record points at any more. Only ones over a day
  // old, so a photo another device uploaded just before its entry arrives here
  // is never taken for an orphan.
  let gcAt = s.gcAt;
  if (!gcAt || Date.now() - Date.parse(gcAt) > 86_400_000) {
    const keep = new Set(ids);
    const { data } = await store.list(uid, { limit: 1000 });
    const dead = (data ?? [])
      .filter(o => !keep.has(o.name.replace(/\.jpg$/, "")) && o.created_at && Date.now() - Date.parse(o.created_at) > 86_400_000)
      .map(o => `${uid}/${o.name}`);
    if (dead.length) await store.remove(dead);
    gcAt = new Date().toISOString();
  }
  const cur = readState();
  if (cur && cur.st.user === uid) writeState({ ...cur, photosUp: [...up].filter(id => ids.includes(id)), gcAt });
}

/* ------------------------------------------------------------- account --- */

const here = () => location.origin + location.pathname;

function authSay(e: { message?: string } | null | undefined): string {
  const m = String(e?.message ?? "");
  if (/invalid login/i.test(m)) return "Wrong email or password.";
  if (/not confirmed/i.test(m)) return "Confirm your email first: open the link we sent you.";
  if (/already registered|already exists/i.test(m)) return "There's already an account with that email. Sign in instead.";
  if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a while, then try again.";
  if (/fetch|network|load failed/i.test(m)) return "Couldn't reach the server. Check your connection.";
  return m || "Something went wrong. Try again.";
}

async function withClient<T>(fn: (c: SupabaseClient) => Promise<T>): Promise<T | string> {
  let c: SupabaseClient;
  try { c = await client(); }
  catch { return "Couldn't load sign-in. Check your connection."; }
  return fn(c);
}

/** Null on success, otherwise what to tell the rider. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const r = await withClient(async c => {
    const { error } = await c.auth.signInWithPassword({ email: email.trim(), password });
    return error ? authSay(error) : null;
  });
  return r;
}

/** "confirm" when an email has gone out to confirm the address. */
export async function signUp(email: string, password: string): Promise<{ error?: string; confirm?: boolean }> {
  const r = await withClient(async c => {
    const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: here() } });
    if (error) return { error: authSay(error) };
    // With confirmation on, an address that already has an account comes back
    // looking like a success but with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: "There's already an account with that email. Sign in instead." };
    }
    return data.session ? {} : { confirm: true };
  });
  return typeof r === "string" ? { error: r } : r;
}

export async function sendReset(email: string): Promise<string | null> {
  return withClient(async c => {
    const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: here() });
    return error ? authSay(error) : null;
  });
}

export async function setNewPassword(password: string): Promise<string | null> {
  return withClient(async c => {
    const { error } = await c.auth.updateUser({ password });
    if (error) return authSay(error);
    setView({ recovery: false });
    return null;
  });
}

export function dismissRecovery() { setView({ recovery: false }); }

/** Signs out on this device only. Records stay here unless the caller clears them. */
export async function signOut(): Promise<void> {
  writeState(null);
  setView({ status: "signed-out", email: undefined, error: undefined, last: undefined, syncing: false });
  try { const c = await client(); await c.auth.signOut({ scope: "local" }); } catch { /* already gone */ }
  session = null;
}

/** Deletes the account and everything in it, then signs out. Null on success. */
export async function deleteAccount(): Promise<string | null> {
  return withClient(async c => {
    const uid = session?.user.id ?? (await c.auth.getSession()).data.session?.user.id;
    if (!uid) return "You're not signed in.";
    const store = c.storage.from(BUCKET);
    for (let i = 0; i < 50; i++) {
      const { data, error } = await store.list(uid, { limit: 1000 });
      if (error) return say(error);
      if (!data?.length) break;
      const { error: rmErr } = await store.remove(data.map(o => `${uid}/${o.name}`));
      if (rmErr) return say(rmErr);
    }
    const { error } = await c.rpc("delete_me");
    if (error) return say(error);
    await signOut();
    return null;
  });
}


