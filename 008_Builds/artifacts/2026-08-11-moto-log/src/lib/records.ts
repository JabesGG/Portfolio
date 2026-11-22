import type { Book, Entry, Garage, Ride } from "./types";
import { normaliseBook, normalisePrefs } from "./garage";
import { newBook, defaultPrefs } from "./store";
import { num } from "./format";

/**
 * Record-level sync, as pure functions. No network, no storage, no clock
 * (callers pass the time in), so every rule here is covered by verify.ts.
 *
 * The garage is split into records — one per bike, entry and ride, plus
 * the rider's settings — which map one-to-one onto rows in Supabase. Each
 * device remembers, per record, what it last agreed with the server (the
 * "snapshot"). Comparing the garage with the snapshot says what changed here;
 * comparing an incoming row with the snapshot says whether we also changed
 * that record, which is the only time two copies can disagree.
 *
 * When both sides changed the same record, the later edit wins. Different
 * records never conflict, so two devices adding entries both keep them.
 */

export type Table = "bikes" | "entries" | "rides" | "settings";
export const TABLES: Table[] = ["settings", "bikes", "entries", "rides"];

export interface Rec {
  t: Table;
  id: string;
  /** Which bike an entry or ride belongs to. */
  bike?: string;
  data: Record<string, unknown>;
}

/** A row as it comes back from the server. */
export interface Row {
  id: string;
  bike_id?: string | null;
  data: Record<string, unknown>;
  updated_at: string;
  deleted: boolean;
  synced_at: string;
}

/** Canonical JSON of each record as last agreed with the server. */
export type Snap = Record<string, string>;
/** When this device last changed each record, ISO. */
export type DirtyAt = Record<string, string>;

export const keyOf = (t: Table, id: string) => `${t}:${id}`;

/**
 * JSON with object keys sorted. Postgres stores jsonb with its own key order,
 * so a record that comes back from the server would otherwise look "changed"
 * to a plain JSON.stringify comparison, and bounce back and forth forever.
 */
export function stable(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).filter(k => o[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}";
}

/**
 * Which bike is selected and when this device last took a backup are about
 * this device, not the rider, so they are left out: switching bikes on the
 * phone should not switch them on the laptop.
 */
export function flatten(g: Garage): Map<string, Rec> {
  const m = new Map<string, Rec>();
  m.set(keyOf("settings", "me"), { t: "settings", id: "me", data: { prefs: g.prefs } });
  for (const b of g.bikes) {
    const { id, entries, rides, lastBackup: _lb, ...rest } = b;
    void _lb;
    m.set(keyOf("bikes", id), { t: "bikes", id, data: rest as Record<string, unknown> });
    for (const e of entries) {
      m.set(keyOf("entries", e.id), { t: "entries", id: e.id, bike: id, data: e as unknown as Record<string, unknown> });
    }
    for (const r of rides ?? []) {
      m.set(keyOf("rides", r.id), { t: "rides", id: r.id, bike: id, data: r as unknown as Record<string, unknown> });
    }
  }
  return m;
}

export function recJson(r: Rec): string {
  return stable({ t: r.t, id: r.id, bike: r.bike ?? null, data: r.data });
}

export interface Outgoing { rec: Rec; deleted: boolean; updated_at: string; }

/** What this device has that the server has not: changed or new records, and
 *  records that were here when we last agreed and are gone now. */
export function outgoing(g: Garage, snap: Snap, dirtyAt: DirtyAt, now: string): Outgoing[] {
  const cur = flatten(g);
  const out: Outgoing[] = [];
  for (const [k, rec] of cur) {
    if (recJson(rec) !== snap[k]) out.push({ rec, deleted: false, updated_at: dirtyAt[k] ?? now });
  }
  for (const k of Object.keys(snap)) {
    if (cur.has(k)) continue;
    let rec: Rec;
    try { rec = JSON.parse(snap[k]) as Rec; } catch { continue; }
    out.push({ rec: { ...rec, data: {} }, deleted: true, updated_at: dirtyAt[k] ?? now });
  }
  return out;
}

/** Notes which records changed between two versions of the garage, and when. */
export function markDirty(prev: Garage, next: Garage, dirtyAt: DirtyAt, now: string): DirtyAt {
  const a = flatten(prev), b = flatten(next);
  const out = { ...dirtyAt };
  for (const [k, rec] of b) {
    const before = a.get(k);
    if (!before || recJson(before) !== recJson(rec)) out[k] = now;
  }
  for (const k of a.keys()) if (!b.has(k)) out[k] = now;
  return out;
}

/** A garage nobody has typed anything into yet — what a fresh install has. */
export function isPristine(g: Garage): boolean {
  if (g.bikes.length !== 1) return false;
  const b = g.bikes[0];
  const p = g.prefs;
  return b.entries.length === 0 && (b.rides ?? []).length === 0
    && !b.bike.name && !b.bike.make && !b.bike.model && !b.bike.plate && !b.bike.year && !b.bike.regDate
    && !num(b.bike.odo) && !num(b.bike.startOdo) && !num(b.bike.tank) && !b.bike.coe
    && b.schedule.every(i => i.baseOdo == null && !i.baseDate)
    && b.dates.every(d => !d.due)
    && Object.keys(p.fuelDiscounts).length === 0 && p.myWorkshops.length === 0 && !p.pumpPrices;
}

/** An empty garage to build a downloaded copy into. */
export function emptyGarage(): Garage {
  return { v: 2, active: "", bikes: [], prefs: defaultPrefs() };
}

function tableOf(k: string): Table { return k.slice(0, k.indexOf(":")) as Table; }

/** Puts one record into the garage, or takes it out. False if it had nowhere to go. */
function put(g: Garage, t: Table, id: string, bike: string | undefined, data: Record<string, unknown> | null): boolean {
  if (t === "settings") {
    if (data) g.prefs = normalisePrefs((data as { prefs?: unknown }).prefs);
    return true;
  }
  if (t === "bikes") {
    const i = g.bikes.findIndex(b => b.id === id);
    if (!data) { if (i >= 0) g.bikes.splice(i, 1); return true; }
    const old = i >= 0 ? g.bikes[i] : null;
    const book = normaliseBook({ ...data, entries: old?.entries ?? [], rides: old?.rides ?? [] });
    if (!book) return false;
    const next: Book = { ...book, id, ...(old?.lastBackup ? { lastBackup: old.lastBackup } : {}) };
    if (i >= 0) g.bikes[i] = next; else g.bikes.push(next);
    return true;
  }
  // entries and rides
  const field = t === "entries" ? "entries" : "rides";
  for (const b of g.bikes) {
    const list = (b[field] ?? []) as { id: string }[];
    const j = list.findIndex(x => x.id === id);
    if (j >= 0 && (!data || b.id !== bike)) list.splice(j, 1);
  }
  if (!data) return true;
  const home = g.bikes.find(b => b.id === bike);
  if (!home) return false;
  const list = (field === "entries" ? home.entries : (home.rides ??= [])) as { id: string }[];
  const j = list.findIndex(x => x.id === id);
  if (j >= 0) list[j] = data as unknown as Entry & Ride; else list.push(data as unknown as Entry & Ride);
  return true;
}

export interface Applied { garage: Garage; snap: Snap; changed: boolean; }

/**
 * Brings rows from the server into the garage.
 *
 *  - A record we have not touched since we last agreed: take the server's.
 *  - A record we have also changed: the later edit wins. `fallback` is the
 *    time to assume for a local change whose time is not known (a garage
 *    that existed before this device first signed in).
 *  - The snapshot moves on for every record that now matches the server, so
 *    nothing we just received is sent straight back.
 */
export function applyRemote(
  g: Garage, rows: { t: Table; row: Row }[], snap: Snap, dirtyAt: DirtyAt, fallback?: string,
): Applied {
  const next = structuredClone(g);
  const s = { ...snap };
  let changed = false;
  const order = (t: Table) => TABLES.indexOf(t);
  const sorted = [...rows].sort((a, b) => order(a.t) - order(b.t) || (a.row.synced_at < b.row.synced_at ? -1 : 1));

  for (const { t, row } of sorted) {
    const k = keyOf(t, row.id);
    const cur = flatten(next).get(k);
    const localJ = cur ? recJson(cur) : undefined;
    const remote: Rec | undefined = row.deleted ? undefined
      : { t, id: row.id, bike: row.bike_id ?? undefined, data: row.data ?? {} };
    const remoteJ = remote ? recJson(remote) : undefined;

    if (localJ === remoteJ) {                  // already the same
      if (remoteJ) s[k] = remoteJ; else delete s[k];
      continue;
    }
    const localDirty = localJ !== s[k];
    if (localDirty) {
      const mine = dirtyAt[k] ?? fallback;
      if (mine && Date.parse(mine) > Date.parse(row.updated_at)) continue;   // ours is later: keep, and send
    }
    if (put(next, t, row.id, remote?.bike, remote ? remote.data : null)) {
      changed = true;
      if (remoteJ) s[k] = remoteJ; else delete s[k];
    }
  }

  // The app needs at least one bike, and a selected one that exists.
  if (!next.bikes.length) next.bikes.push(newBook());
  if (!next.bikes.some(b => b.id === next.active)) next.active = next.bikes[0].id;
  return { garage: next, snap: s, changed };
}

/** Shapes an outgoing record as a row for its table. */
export function toRow(o: Outgoing, userId: string): Record<string, unknown> {
  const { rec, deleted, updated_at } = o;
  const base: Record<string, unknown> = { user_id: userId, id: rec.id, data: deleted ? {} : rec.data, updated_at, deleted };
  if (rec.t === "entries") {
    const e = rec.data as Partial<Entry>;
    const date = typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
    return {
      ...base, bike_id: rec.bike,
      type: deleted ? null : (e.type === "fuel" || e.type === "service" || e.type === "expense" ? e.type : null),
      date: deleted ? null : date,
      odo: deleted || !Number.isFinite(Number(e.odo)) ? null : Number(e.odo),
      amount: deleted || !Number.isFinite(Number(e.amount)) ? null : Number(e.amount),
    };
  }
  if (rec.t === "rides") {
    const r = rec.data as Partial<Ride>;
    return {
      ...base, bike_id: rec.bike,
      started_at: deleted || !r.start || isNaN(Date.parse(r.start)) ? null : r.start,
      km: deleted || !Number.isFinite(Number(r.km)) ? null : Number(r.km),
    };
  }
  return base;
}

export { tableOf };

/* --------------------------------------------------------------------------
 * One round of sync, against anything that behaves like the server. The real
 * one is Supabase (./cloud); verify.ts runs two simulated devices against an
 * in-memory stand-in with the same rules as the database trigger.
 * ------------------------------------------------------------------------ */

export interface CloudState {
  /** The signed-in rider this state belongs to. */
  user: string;
  /** Highest server time seen in a pull; the next pull asks for newer. */
  cursor?: string;
  snap: Snap;
  dirtyAt: DirtyAt;
  /** False until this device's first successful round with this rider. */
  linked: boolean;
}

export function newCloudState(user: string): CloudState {
  return { user, snap: {}, dirtyAt: {}, linked: false };
}

export interface Server {
  /** Rows changed after `since` (all rows when undefined), oldest first. */
  pull(t: Table, since: string | undefined): Promise<Row[]>;
  /** Insert-or-update; returns each row as the server now holds it. */
  push(t: Table, rows: Record<string, unknown>[]): Promise<Row[]>;
}

/** Pulls look back this far past the cursor. Server times are stamped when a
 *  write starts, so a write that started earlier but finished later than one
 *  we already saw would otherwise be skipped. Re-reading a row is harmless. */
export const OVERLAP_MS = 120_000;

export interface Round {
  garage: Garage; state: CloudState; changed: boolean; pulled: number; pushed: number;
  /** True when this round replaced a fresh install with the rider's records. */
  adopted: boolean;
}

export async function syncRound(g: Garage, st: CloudState, io: Server, now: () => string): Promise<Round> {
  const since = st.linked && st.cursor ? new Date(Date.parse(st.cursor) - OVERLAP_MS).toISOString() : undefined;

  // 1. What changed elsewhere.
  const rows: { t: Table; row: Row }[] = [];
  let cursor = st.cursor;
  for (const t of TABLES) {
    for (const row of await io.pull(t, since)) {
      rows.push({ t, row });
      if (!cursor || row.synced_at > cursor) cursor = row.synced_at;
    }
  }

  // 2. Fold it in. On a device's first round with this rider, a fresh install
  //    simply becomes the rider's garage; one with records of its own is
  //    merged, with the garage's last-change time standing in for each record.
  let applied: Applied;
  let adopted = false;
  if (!st.linked && rows.length && isPristine(g)) {
    applied = applyRemote(emptyGarage(), rows, {}, {});
    adopted = true;
  } else if (!st.linked) {
    applied = applyRemote(g, rows, {}, {}, g.updated);
  } else {
    applied = applyRemote(g, rows, st.snap, st.dirtyAt);
  }
  let garage = applied.garage;
  let changed = applied.changed;
  const snap = applied.snap;
  const dirtyAt = { ...st.dirtyAt };

  // 3. Send what is ours, one table at a time.
  const out = outgoing(garage, snap, dirtyAt, now());
  const lost: { t: Table; row: Row }[] = [];
  for (const t of TABLES) {
    const mine = out.filter(o => o.rec.t === t);
    if (!mine.length) continue;
    const byId = new Map(mine.map(o => [o.rec.id, o]));
    const back = await io.push(t, mine.map(o => toRow(o, st.user)));
    for (const row of back) {
      const o = byId.get(row.id);
      if (!o) continue;
      const k = keyOf(t, row.id);
      // The server keeps whichever edit is later. Same time → ours went in.
      if (Date.parse(row.updated_at) === Date.parse(o.updated_at) && row.deleted === o.deleted) {
        if (o.deleted) delete snap[k]; else snap[k] = recJson(o.rec);
        delete dirtyAt[k];
      } else {
        lost.push({ t, row });
      }
    }
  }

  // 4. Where another device's later edit beat ours, take theirs.
  if (lost.length) {
    const again = applyRemote(garage, lost, snap, dirtyAt);
    garage = again.garage;
    Object.assign(snap, again.snap);
    for (const { t, row } of lost) {
      const k = keyOf(t, row.id);
      if (!(k in again.snap)) delete snap[k];
      delete dirtyAt[k];
    }
    changed = changed || again.changed;
  }

  return {
    garage, changed, adopted, pulled: rows.length, pushed: out.length,
    state: { user: st.user, cursor, snap, dirtyAt, linked: true },
  };
}

/**
 * A sync round works on the garage as it was when the round started. If the
 * rider changed something while it ran, those changes are replayed on top of
 * the round's result, record by record, so nothing typed mid-sync is lost.
 * Their dirty marks are newer than anything the round cleared, so they go out
 * next round.
 */
export function rebase(base: Garage, mine: Garage, onto: Garage): Garage {
  const a = flatten(base), b = flatten(mine);
  const next = structuredClone(onto);
  for (const t of TABLES) {
    for (const [k, rec] of b) {
      if (rec.t !== t) continue;
      const was = a.get(k);
      if (!was || recJson(was) !== recJson(rec)) put(next, t, rec.id, rec.bike, rec.data);
    }
  }
  // Deletions last and children first, so removing a bike can't strand records.
  for (const t of [...TABLES].reverse()) {
    for (const [k, rec] of a) if (rec.t === t && !b.has(k)) put(next, t, rec.id, rec.bike, null);
  }
  next.updated = mine.updated;
  if (next.bikes.some(x => x.id === mine.active)) next.active = mine.active;
  if (!next.bikes.length) next.bikes.push(newBook());
  if (!next.bikes.some(x => x.id === next.active)) next.active = next.bikes[0].id;
  return next;
}

/** Dirty marks made while a round ran are kept over what the round settled. */
export function keepNewDirt(start: DirtyAt, now: DirtyAt, settled: DirtyAt): DirtyAt {
  const out = { ...settled };
  for (const k of Object.keys(now)) if (now[k] !== start[k]) out[k] = now[k];
  return out;
}
