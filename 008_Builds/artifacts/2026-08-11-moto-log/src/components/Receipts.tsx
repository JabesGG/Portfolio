import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/ctx";
import { getPhoto, putPhoto, shrink } from "@/lib/photos";

const MAX = 4;

/**
 * Receipt photos on an entry. Each is shrunk on the phone and kept in the
 * browser's own database; the entry only holds its id.
 */
export function Receipts({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const { toast } = useApp();
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    for (const id of ids) {
      if (id in urls) continue;
      void getPhoto(id).then(u => { if (live) setUrls(m => ({ ...m, [id]: u })); });
    }
    return () => { live = false; };
    // urls is read, not a trigger: a fetched photo must not refetch the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  async function add(files: FileList) {
    setBusy(true);
    const next = ids.slice();
    for (const f of Array.from(files).slice(0, MAX - ids.length)) {
      try {
        const url = await shrink(f);
        const id = await putPhoto(url);
        setUrls(m => ({ ...m, [id]: url }));
        next.push(id);
      } catch {
        toast("Couldn't store that photo on this device.");
      }
    }
    onChange(next);
    setBusy(false);
  }

  return (
    <div className="mb-3">
      <span className="field__l">Receipt photos</span>
      <div className="thumbs">
        {ids.map(id => {
          const u = urls[id];
          return (
            <span className="thumb" key={id}>
              {u ? (
                <button type="button" className="thumb__img" onClick={() => setOpen(open === id ? null : id)}
                        aria-label="View receipt">
                  <img src={u} alt="Receipt" />
                </button>
              ) : (
                <span className="thumb__img thumb__img--gone" title="This photo is not on this device">
                  {u === null ? "not here" : "…"}
                </span>
              )}
              <button type="button" className="thumb__x" aria-label="Remove photo"
                      onClick={() => { onChange(ids.filter(x => x !== id)); if (open === id) setOpen(null); }}>×</button>
            </span>
          );
        })}
        {ids.length < MAX && (
          <button type="button" className="thumb__add" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "…" : "+ Photo"}
          </button>
        )}
      </div>
      {open && urls[open] && <img className="thumb__big" src={urls[open]!} alt="Receipt, full size" />}
      <input ref={fileRef} type="file" accept="image/*" multiple hidden
             onChange={e => {
               const files = e.target.files;
               if (files?.length) void add(files);
               e.target.value = "";
             }} />
      <p className="field__h">
        Kept on this phone and included in backup files. Not sent anywhere.
      </p>
    </div>
  );
}
