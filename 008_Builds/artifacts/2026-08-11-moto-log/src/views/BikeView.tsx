import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import { SyncPanel } from "@/components/SyncPanel";
import { statusOf, dateStatus, csv } from "@/lib/calc";
import { addMonths, agoLabel, backupIsStale, dmy, num, todayISO } from "@/lib/format";
import { seedGarage, newBook, uid, GARAGE_KEY } from "@/lib/store";
import { durability, type Durability } from "@/lib/storage";
import { bikeLabel, parseBackup, photoIds, upgradeV1, type BackupFile } from "@/lib/garage";
import { getPhotos, putPhotos, clearPhotos } from "@/lib/photos";
import { garageIcs } from "@/lib/ics";
import { garageNotifications } from "@/lib/reminders";
import { download as saveFile } from "@/lib/download";
import { BUILD_STAMP } from "@/lib/build";
import type { State } from "@/lib/types";

/* Drafts hold raw strings so half-typed numbers don't get coerced mid-keystroke.
   One Save commits the whole tab, so editing one section can't clobber another. */
interface BikeDraft {
  name: string; make: string; model: string; year: string;
  plate: string; regDate: string; startOdo: string; tank: string;
  coePaid: string; coeStart: string; coeYears: string;
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
      coePaid: s.bike.coe?.paid ? String(s.bike.coe.paid) : "",
      coeStart: s.bike.coe?.start || "",
      coeYears: s.bike.coe?.years ? String(s.bike.coe.years) : "",
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
  const { s, g, update, updateGarage, replaceGarage, toast } = useApp();
  const [d, setD] = useState(() => toDrafts(s));
  const fileRef = useRef<HTMLInputElement>(null);
  const [durable, setDurable] = useState<Durability>("unknown");

  useEffect(() => { durability().then(setDurable); }, []);

  /** Records that a copy left the device, so the reminder can reset. */
  function markBackedUp() {
    updateGarage(d => { d.lastBackup = todayISO(); });
  }

  const totalEntries = g.bikes.reduce((t, b) => t + b.entries.length, 0);
  const upcoming = garageNotifications(g).length;

  /** The backup file: every bike, settings, and the receipt photos themselves. */
  async function backupFile(withPhotos: boolean): Promise<BackupFile> {
    const photos = withPhotos ? await getPhotos(photoIds(g)) : {};
    return {
      app: "moto-log", v: 2, exported: new Date().toISOString(), garage: g,
      ...(Object.keys(photos).length ? { photos } : {}),
    };
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
      if (d.bike.coeStart || num(d.bike.coePaid) > 0) {
        st.bike.coe = { paid: num(d.bike.coePaid), start: d.bike.coeStart, years: num(d.bike.coeYears) || 10 };
      } else {
        delete st.bike.coe;
      }
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

  function download(name: string, text: string, mime: string): boolean {
    const ok = saveFile(name, text, mime);
    toast(ok ? `Saved ${name}` : "Download blocked here — use Copy backup instead.");
    return ok;
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

      <Panel title="Bike details">
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
            <label className="field__l">Starting odometer</label>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-[10px] mt-4">
          <div>
            <label className="field__l">COE paid ($)</label>
            <input className="inp" inputMode="decimal" placeholder="9000" value={d.bike.coePaid}
                   onChange={e => setD({ ...d, bike: { ...d.bike, coePaid: e.target.value } })} />
          </div>
          <div>
            <label className="field__l">COE from</label>
            <input className="inp" type="date" value={d.bike.coeStart}
                   onChange={e => setD({ ...d, bike: { ...d.bike, coeStart: e.target.value } })} />
          </div>
          <div>
            <label className="field__l">Years</label>
            <select className="inp" style={{ fontFamily: "var(--body)" }} value={d.bike.coeYears || "10"}
                    onChange={e => setD({ ...d, bike: { ...d.bike, coeYears: e.target.value } })}>
              <option value="10">10</option>
              <option value="5">5</option>
            </select>
          </div>
        </div>
        <p className="field__h">
          Optional. The quota premium on your current COE and the day it started — your
          registration date, or the date of your last renewal. Feeds the COE calculator in Tools.
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
                  <span className="flex gap-2 items-center">
                    <span className={`lamp__val lamp--${st.level}`}>{st.headline}</span>
                    <button type="button" className="iconbtn" aria-label={`Remove ${x.n}`}
                            onClick={() => {
                              if (!confirm(`Remove “${x.n}” from your renewal dates?`)) return;
                              setD({ ...d, dates: d.dates.filter(y => y.id !== x.id) });
                            }}>×</button>
                  </span>
                </div>
                {/* The date gets a full row: three across clipped it on a phone. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="mini__l">Expires</span>
                    <input className="inp inp--sm" type="date" value={x.due}
                           onChange={e => set({ due: e.target.value })} />
                  </div>
                  <div>
                    <span className="mini__l">Renew every (months)</span>
                    <input className="inp inp--sm" inputMode="numeric" value={x.months}
                           onChange={e => set({ months: e.target.value })} />
                  </div>
                  <div>
                    <span className="mini__l">Warn me (days before)</span>
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
        <button type="button" className="btn btn--ghost btn--sm w-full mt-3"
                onClick={() => {
                  const name = prompt("Name the date — e.g. Licence renewal, Warranty ends");
                  if (!name?.trim()) return;
                  setD({ ...d, dates: [...d.dates, { id: uid(), n: name.trim(), due: "", months: "", remind: "30" }] });
                }}>
          Add a date
        </button>
        <p className="field__h mt-[10px]">
          Use whatever your renewal notice or LTA record actually says — these are your dates, not
          calculated ones. COE runs 10 years from registration; inspection is yearly once the bike
          is 3 years old.
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="mini__l">Every km</span>
                    <input className="inp inp--sm" inputMode="numeric" value={x.km}
                           onChange={e => set({ km: e.target.value })} />
                  </div>
                  <div>
                    <span className="mini__l">Every months</span>
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

      <Panel title="Reminders" note={upcoming ? `${upcoming} coming up` : "none set"}>
        <p className="field__h !mt-0 mb-3">
          Renewals warn you 30, 14, 7 and 1 days ahead, on the day, and again after if nothing was
          done; services with a month interval warn a week ahead. A browser can't ring you by
          itself, so put them in your phone's calendar — it will, with nothing leaving this device.
        </p>
        <button className="btn btn--ghost btn--sm w-full"
                onClick={() => {
                  const ics = garageIcs(g);
                  if (!ics.count) { toast("Set a renewal date or a service baseline first."); return; }
                  if (download(`moto-log-reminders-${todayISO()}.ics`, ics.text, "text/calendar")) {
                    toast(`${ics.count} reminders saved — open the file to add them.`);
                  }
                }}>
          Add reminders to my calendar
        </button>
        <p className="field__h">
          Covers {g.bikes.length > 1 ? "every bike" : "this bike"}. After you renew something, export
          again — the calendar matches entries up and moves them.
        </p>
      </Panel>

      <Panel title="Your data" note={`${totalEntries} ${totalEntries === 1 ? "entry" : "entries"}`}>
        <p className={`backup ${backupIsStale(g.lastBackup, totalEntries > 0) ? "backup--stale" : ""}`}>
          <span className="backup__bulb" />
          <span>
            {agoLabel(g.lastBackup)}
            {durable === "persistent" && " · storage marked persistent"}
            {durable === "best-effort" && " · storage is best-effort"}
          </span>
        </p>
        <p className="field__h !mt-0 mb-3">
          Everything lives on this device only. Back it up before you clear your browsing data or
          switch phones. A backup holds {g.bikes.length > 1 ? `all ${g.bikes.length} bikes` : "your bike"},
          your settings and your receipt photos.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button className="btn btn--ghost btn--sm"
                  onClick={() => {
                    void backupFile(true).then(f => {
                      if (download(`moto-log-${todayISO()}.json`, JSON.stringify(f), "application/json")) markBackedUp();
                    });
                  }}>
            Download backup
          </button>
          <button className="btn btn--ghost btn--sm"
                  onClick={() => download(`moto-log-${s.bike.plate || "bike"}-${todayISO()}.csv`, csv(s), "text/csv")}>
            Download CSV
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button className="btn btn--ghost btn--sm"
                  onClick={() => {
                    // Photos are left out: a clipboard is the wrong place for megabytes.
                    void backupFile(false).then(f =>
                      navigator.clipboard?.writeText(JSON.stringify(f)).then(
                        // Only counts as a backup once the copy actually succeeded.
                        () => { markBackedUp(); toast("Backup copied (without photos). Paste it somewhere safe."); },
                        () => toast("Clipboard blocked — use Download backup."),
                      ) ?? toast("Clipboard unavailable — use Download backup."));
                  }}>
            Copy backup
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            Restore backup
          </button>
        </div>
        {g.bikes.length > 1 && (
          <button className="btn btn--danger btn--sm w-full mb-2"
                  onClick={() => {
                    if (!confirm(`Remove “${bikeLabel(s)}” and all ${s.entries.length} of its entries? This can't be undone.`)) return;
                    updateGarage(dr => {
                      dr.bikes = dr.bikes.filter(b => b.id !== s.id);
                      dr.active = dr.bikes[0].id;
                    });
                    toast("Bike removed.");
                  }}>
            Remove this bike
          </button>
        )}
        <button className="btn btn--danger btn--sm w-full"
                onClick={() => {
                  if (!confirm(g.bikes.length > 1
                    ? `Erase all ${g.bikes.length} bikes, every entry, and your photos? This can't be undone.`
                    : "Erase every entry, interval, photo and bike detail? This can't be undone.")) return;
                  void clearPhotos();
                  replaceGarage(seedGarage());
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
                   const p = parseBackup(String(r.result));
                   if (!p) { toast("That file isn't a Moto Log backup."); return; }
                   if (p.kind === "book") {
                     // A backup from before the garage holds one bike. Adding it
                     // is safe; replacing everything with it would not be.
                     if (!confirm("This backup holds one bike. Add it to your garage as another bike? Nothing you have now is changed.")) return;
                     updateGarage(dr => {
                       const b = newBook(upgradeV1(p.book));
                       dr.bikes.push(b);
                       dr.active = b.id;
                     });
                     toast("Bike added from the backup.");
                     return;
                   }
                   if (!confirm(`Replace everything on this device with the backup (${p.garage.bikes.length} ${p.garage.bikes.length === 1 ? "bike" : "bikes"})?`)) return;
                   void putPhotos(p.photos).catch(() => toast("Records restored, but the photos would not fit here."));
                   replaceGarage(p.garage);
                   toast("Backup restored.");
                 };
                 r.readAsText(file);
               }} />
        <p className="field__h">
          Stored under <code>{GARAGE_KEY}</code> on this device.
          <br />
          Build <b>{BUILD_STAMP}</b> — if this date has not changed after an update,
          close the app fully and open it again.
        </p>
      </Panel>

      <SyncPanel />
    </div>
  );
}
