/**
 * Receipt photos. They live in IndexedDB rather than in the book, because the
 * book is one JSON string in a key-value store with a small quota — a handful
 * of photos would fill it and start failing saves of the records themselves.
 *
 * Photos are held as data: URLs, which is what the site's `img-src 'self' data:`
 * allows; a blob: URL would be refused. For the same reason the picked file is
 * decoded with createImageBitmap, never by pointing an <img> at a blob.
 */
const DB = "motolog-photos";
const STORE = "p";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no indexedDB")); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(db => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error("indexedDB write failed")); };
  }));
}

function pid(): string {
  return "p" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function putPhoto(dataUrl: string): Promise<string> {
  const id = pid();
  await run("readwrite", s => { s.put(dataUrl, id); });
  return id;
}

export async function getPhoto(id: string): Promise<string | null> {
  try { return (await run<string>("readonly", s => s.get(id) as IDBRequest<string>)) ?? null; }
  catch { return null; }
}

export async function getPhotos(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of ids) {
    const v = await getPhoto(id);
    if (v) out[id] = v;
  }
  return out;
}

export async function putPhotos(rec: Record<string, string>): Promise<void> {
  const ids = Object.keys(rec);
  if (!ids.length) return;
  await run("readwrite", s => { for (const id of ids) s.put(rec[id], id); });
}

export async function clearPhotos(): Promise<void> {
  try { await run("readwrite", s => { s.clear(); }); } catch { /* nothing stored */ }
}

/** Drops photos no entry points at any more — a deleted entry, or a sheet that
 *  was closed without saving. Returns how many went. */
export async function gcPhotos(keep: string[]): Promise<number> {
  try {
    const keys = (await run<IDBValidKey[]>("readonly", s => s.getAllKeys())) ?? [];
    const want = new Set(keep);
    const dead = keys.filter(k => !want.has(String(k)));
    if (dead.length) await run("readwrite", s => { for (const k of dead) s.delete(k); });
    return dead.length;
  } catch { return 0; }
}

/** Scales a picked image down and re-encodes it. A phone photo is 3–8 MB; a
 *  legible receipt needs about 150 kB. */
export async function shrink(file: Blob, max = 1280, quality = 0.72): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}
