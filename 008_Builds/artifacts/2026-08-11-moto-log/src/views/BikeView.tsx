import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import { statusOf, dateStatus, csv } from "@/lib/calc";
import { addMonths, agoLabel, backupIsStale, dmy, num, todayISO } from "@/lib/format";
import { seed, uid, KEY } from "@/lib/store";
import { durability, type Durability } from "@/lib/storage";
import { BUILD_STAMP } from "@/lib/build";
import type { State } from "@/lib/types";

/* Drafts hold raw strings so half-typed numbers don't get coerced mid-keystroke.
   One Save commits the whole tab, so editing one section can't clobber another. */
interface BikeDraft {
  name: string; make: string; model: string; year: string;
  plate: string; regDate: string; startOdo: string; tank: string;
}
interface DateDraft { id: string; n: string; due: string; months: string; remind: string; }
interface SchedDraft { id: string; n: string; km: string; months: string; baseOdo: string; baseDate: string; }

function toDrafts(s: State) {
  return {
    bike: {
      name: s.bike.name, make: s.bike.make, model: s.bike.model, year: s.bike.year,
      plate: s.bike.plate, regDate: s.bike.regDate,
      startOdo: s.bike.startOdo ? String(s.bike.startOdo) : "",
      tank: s.bike.tank ? String(s.bike.tank) : "",
    } as BikeDraft,
    dates: s.dates.map(d => ({
      id: d.id, n: d.n, due: d.due,
      months: d.months ? String(d.months) : "",
      remind: d.remind ? String(d.remind) : "",
    })) as DateDraft[],
    sched: s.schedule.map(i => ({
      id: i.id, n: i.n,
      km: i.km ? String(i.km) : "",
      months: i.months ? String(i.months) : "",
      baseOdo: i.baseOdo == null ? "" : String(i.baseOdo),
      baseDate: i.baseDate,
    })) as SchedDraft[],
  };
}

export function BikeView() {
  const { s, update, replace, toast } = useApp();
  const [d, setD] = useState(() => toDrafts(s));
  const fileRef = useRef<HTMLInputElement>(null);
  const [durable, setDurable] = useState<Durability>("unknown");

  useEffect(() => { durability().then(setDurable); }, []);

  /** Records that a copy left the device, so the reminder can reset. */
  function markBackedUp() {
    update(st => { st.lastBackup = todayISO(); });
  }

  // Import and erase reset the drafts themselves, so no resync effect is needed
  // here — one would only clobber in-progress typing.
  const dirty = JSON.stringify(d) !== JSON.stringify(toDrafts(s));

  function saveAll() {
    update(st => {
      st.bike.name = d.bike.name.trim();
      st.bike.make = d.bike.make.trim();
      st.bike.model = d.bike.model.trim();
      st.bike.year = d.bike.year.trim();
      st.bike.plate = d.bike.plate.trim().toUpperCase();
      st.bike.regDate = d.bike.regDate;
      st.bike.startOdo = Math.round(num(d.bike.startOdo));
      st.bike.tank = num(d.bike.tank);
      st.dates = d.dates.map(x => ({
        id: x.id, n: x.n, due: x.due, months: num(x.months), remind: num(x.remind) || 30,
      }));
      st.schedule = d.sched.map(x => ({
        id: x.id, n: x.n, km: num(x.km), months: num(x.months),
        baseOdo: x.baseOdo === "" ? null : Math.round(num(x.baseOdo)),
        baseDate: x.baseDate,
      }));
    });
    toast("Saved.");
  }

  function download(name: string, text: string, mime: string) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast(`Saved ${name}`);
    } catch {
      toast("Download blocked here — use Copy backup instead.");
    }
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {dirty && (
        <div className="flex items-center justify-between gap-3 p-3 rounded"
             style={{ background: "var(--card-2)", border: "1px solid var(--rule)" }}>
          <span className="field__h !mt-0">You have unsaved changes on this tab.</span>
          <button className="btn btn--sm" onClick={saveAll}>Save changes</button>
        </div>
      )}

      <Panel title="The bike">
        <div className="mb-3">
          <label className="field__l">Name it</label>
          <input className="inp" placeholder="e.g. The CB" value={d.bike.name}
                 onChange={e => setD({ ...d, bike: { ...d.bike, name: e.target.value } })} />
        </div>
        <div className="grid grid-cols-3 gap-[10px]">
          {([["year", "Year", "2019"], ["make", "Make", "Honda"], ["model", "Model", "CB400"]] as const)
            .map(([k, label, ph]) => (
              <div className="mb-3" key={k}>
                <label className="field__l">{label}</label>
                <input className="inp" placeholder={ph} value={d.bike[k]}
                       onChange={e => setD({ ...d, bike: { ...d.bike, [k]: e.target.value } })} />
              </div>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          <div className="mb-3">
            <label className="field__l">Plate</label>
            <input className="inp" placeholder="FBA1234X" value={d.bike.plate}
                   onChange={e => setD({ ...d, bike: { ...d.bike, plate: e.target.value } })} />
          </div>
          <div className="mb-3">
            <label className="field__l">Registered on</label>
            <input className="inp" type="date" value={d.bike.regDate}
                   onChange={e => setD({ ...d, bike: { ...d.bike, regDate: e.target.value } })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          <div className="mb-3">
            <label className="field__l">Odometer when you started logging</label>
            <input className="inp" inputMode="numeric" value={d.bike.startOdo}
                   onChange={e => setD({ ...d, bike: { ...d.bike, startOdo: e.target.value } })} />
          </div>
          <div className="mb-3">
            <label className="field__l">Tank capacity (L)</label>
            <input className="inp" inputMode="decimal" placeholder="18" value={d.bike.tank}
                   onChange={e => setD({ ...d, bike: { ...d.bike, tank: e.target.value } })} />
          </div>
        </div>
        <p className="field__h">
          Cost per km is measured from the starting odometer, so set it once and leave it.
        </p>
      </Panel>

      <Panel title="Renewal dates">
        <ul>
          {d.dates.map((x, i) => {
            const st = dateStatus({ id: x.id, n: x.n, due: x.due, months: num(x.months), remind: num(x.remind) || 30 });
            const set = (patch: Partial<DateDraft>) => {
              const next = d.dates.slice(); next[i] = { ...x, ...patch };
              setD({ ...d, dates: next });
            };
            return (
              <li key={x.id} className="py-3 border-b last:border-b-0" style={{ borderColor: "var(--rule-2)" }}>
                <div className="flex justify-between items-center gap-[10px] mb-[7px]">
                  <span className="sched__n">{x.n}</span>
                  <span className={`lamp__val lamp--${st.level}`}>{st.headline}</span>
                </div>
                <div className="grid grid-cols-3 gap-[7px]">
                  <div>
                    <span className="mini__l">Expires</span>
                    <input className="inp inp--sm" type="date" value={x.due}
                           onChange={e => set({ due: e.target.value })} />
                  </div>
                  <div>
                    <span className="mini__l">Renew every (mth)</span>
                    <input className="inp inp--sm" inputMode="numeric" value={x.months}
                           onChange={e => set({ months: e.target.value })} />
                  </div>
                  <div>
                    <span className="mini__l">Warn (days)</span>
                    <input className="inp inp--sm" inputMode="numeric" value={x.remind}
                           onChange={e => set({ remind: e.target.value })} />
                  </div>
                </div>
                {num(x.months) > 0 && x.due && (
                  <p className="field__h">
                    Renewed → next due {dmy(addMonths(x.due, num(x.months)))}{" "}
                    <button className="linkish" type="button"
                            onClick={() => set({ due: addMonths(x.due, num(x.months)) })}>
                      Mark renewed
                    </button>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="field__h mt-3">
          Use whatever your renewal notice or LTA record actually says — these are your dates, not
          calculated ones. COE runs 10 years from registration.
        </p>
      </Panel>

      <Panel title="Service intervals">
        <ul>
          {d.sched.map((x, i) => {
            const st = statusOf(s, {
              id: x.id, n: x.n, km: num(x.km), months: num(x.months),
              baseOdo: x.baseOdo === "" ? null : num(x.baseOdo), baseDate: x.baseDate,
            });
            const set = (patch: Partial<SchedDraft>) => {
              const next = d.sched.slice(); next[i] = { ...x, ...patch };
              setD({ ...d, sched: next });
            };
            return (
              <li key={x.id} className="py-3 border-b last:border-b-0" style={{ borderColor: "var(--rule-2)" }}>
                <div className="flex justify-between items-center gap-[10px] mb-[7px]">
                  <span className="sched__n">{x.n}</span>
                  <span className="flex gap-2 items-center">
                    <span className={`lamp__val lamp--${st.level}`}>{st.headline}</span>
                    <button type="button" className="iconbtn" aria-label={`Remove ${x.n}`}
                            onClick={() => {
                              if (!confirm(`Remove “${x.n}” from the schedule?`)) return;
                              setD({ ...d, sched: d.sched.filter(y => y.id !== x.id) });
                            }}>×</button>
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-[7px]">
                  <div>
                    <span className="mini__l">Every km</span>
                    <input className="inp inp--sm" inputMode="numeric" value={x.km}
                           onChange={e => set({ km: e.target.value })} />
                  </div>
                  <div>
                    <span className="mini__l">Every mth</span>
                    <input className="inp inp--sm" inputMode="numeric" value={x.months}
                           onChange={e => set({ months: e.target.value })} />
                  </div>
                  <div>
                    <span className="mini__l">Last km</span>
                    <input className="inp inp--sm" inputMode="numeric" value={x.baseOdo}
                           onChange={e => set({ baseOdo: e.target.value })} />
                  </div>
                  <div>
                    <span className="mini__l">Last date</span>
                    <input className="inp inp--sm" type="date" value={x.baseDate}
                           onChange={e => set({ baseDate: e.target.value })} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn--ghost btn--sm w-full mt-3"
                onClick={() => {
                  const name = prompt("Name the item — e.g. Fork oil");
                  if (!name?.trim()) return;
                  setD({ ...d, sched: [...d.sched, { id: uid(), n: name.trim(), km: "", months: "", baseOdo: "", baseDate: "" }] });
                }}>
          Add an item
        </button>
        <p className="field__h mt-[10px]">
          Leave a field empty to ignore it. <b>Last km</b> and <b>last date</b> are your starting
          point — after that, logging a service resets them.
        </p>
      </Panel>

      <Panel title="Your data" note={`${s.entries.length} entries`}>
        <p className={`backup ${backupIsStale(s.lastBackup, s.entries.length > 0) ? "backup--stale" : ""}`}>
          <span className="backup__bulb" />
          <span>
            {agoLabel(s.lastBackup)}
            {durable === "persistent" && " · storage marked persistent"}
            {durable === "best-effort" && " · storage is best-effort"}
          </span>
        </p>
        <p className="field__h !mt-0 mb-3">
          Everything lives on this device only. Back it up before you clear your browsing data or
          switch phones.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button className="btn btn--ghost btn--sm"
                  onClick={() => {
                    download(`moto-log-${todayISO()}.json`, JSON.stringify(s, null, 2), "application/json");
                    markBackedUp();
                  }}>
            Download backup
          </button>
          <button className="btn btn--ghost btn--sm"
                  onClick={() => download(`moto-log-${todayISO()}.csv`, csv(s), "text/csv")}>
            Download CSV
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button className="btn btn--ghost btn--sm"
                  onClick={() => {
                    // Only counts as a backup once the copy actually succeeded.
                    navigator.clipboard?.writeText(JSON.stringify(s)).then(
                      () => { markBackedUp(); toast("Backup copied. Paste it somewhere safe."); },
                      () => toast("Clipboard blocked — use Download backup."),
                    ) ?? toast("Clipboard unavailable — use Download backup.");
                  }}>
            Copy backup
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            Restore backup
          </button>
        </div>
        <button className="btn btn--danger btn--sm w-full"
                onClick={() => {
                  if (!confirm("Erase every entry, interval and bike detail? This can't be undone.")) return;
                  const fresh = seed();
                  replace(fresh);
                  setD(toDrafts(fresh));
                  toast("Erased.");
                }}>
          Erase everything
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden
               onChange={e => {
                 const file = e.target.files?.[0];
                 e.target.value = "";
                 if (!file) return;
                 const r = new FileReader();
                 r.onload = () => {
                   try {
                     const p = JSON.parse(String(r.result)) as State;
                     if (!p?.bike || !Array.isArray(p.entries)) throw new Error("shape");
                     if (!confirm("Replace everything currently in this browser with the backup?")) return;
                     if (!Array.isArray(p.schedule)) p.schedule = seed().schedule;
                     if (!Array.isArray(p.dates)) p.dates = seed().dates;
                     replace(p);
                     setD(toDrafts(p));
                     toast("Backup restored.");
                   } catch {
                     toast("That file isn't a Moto Log backup.");
                   }
                 };
                 r.readAsText(file);
               }} />
        <p className="field__h">
          Stored under <code>{KEY}</code> on this device.
          <br />
          Build <b>{BUILD_STAMP}</b> — if this date has not changed after an update,
          close the app fully and open it again.
        </p>
      </Panel>
    </div>
  );
}
