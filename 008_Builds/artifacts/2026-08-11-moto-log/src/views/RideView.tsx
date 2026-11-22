import { useEffect, useState } from "react";
import { useApp } from "@/lib/ctx";
import { Panel, Stat, Empty } from "@/components/Lamp";
import { useRecorder, startRecording, stopRecording, resetRecorder, MIN_RIDE_KM } from "@/lib/recorder";
import { avgKph, duration, pathToSvg, rideTotals, trackSecs } from "@/lib/rides";
import { uid } from "@/lib/store";
import { Route } from "lucide-react";
import { dmy, km } from "@/lib/format";
import type { Ride } from "@/lib/types";

/** Local date (yyyy-mm-dd) of an ISO timestamp, for display. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1, day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${day < 10 ? "0" : ""}${day}`;
}

function RouteMap({ path }: { path: [number, number][] }) {
  const pts = pathToSvg(path);
  if (!pts) return null;
  return (
    <svg className="route" viewBox="0 0 100 60" role="img" aria-label="Route sketch">
      <polyline className="route__line" points={pts} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RideView() {
  const { s, update, toast } = useApp();
  const rec = useRecorder();
  const [, tick] = useState(0);
  const [addOdo, setAddOdo] = useState(true);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const live = rec.status === "recording" || rec.status === "starting";
  // A stopped ride waits in the recorder until it is saved or discarded.
  const done = rec.status === "stopped" ? rec : null;

  // The clock runs between fixes too, so the timer never appears stuck.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  // The odometer is whole kilometres; a ride that rounds to none has nothing to add.
  const canAddOdo = Boolean(done) && s.bike.odo > 0 && Math.round(done!.track.km) >= 1;

  const rides = (s.rides ?? []).slice().sort((a, b) => (a.start < b.start ? 1 : -1));
  const tot = rideTotals(rides);

  function stop() {
    if (stopRecording().km < MIN_RIDE_KM) {
      toast("Nothing recorded — no distance covered.");
      return;
    }
    setAddOdo(true);
    setNote("");
  }

  function saveRide() {
    if (!done) return;
    const t = done.track;
    const start = new Date(t.firstT ?? done.startedAt ?? Date.now());
    const end = new Date(t.lastT ?? Date.now());
    const kmRounded = Math.round(t.km * 100) / 100;
    const add = addOdo && canAddOdo;
    const ride: Ride = {
      id: uid(), start: start.toISOString(), end: end.toISOString(),
      km: kmRounded, secs: trackSecs(t), maxKph: Math.round(t.maxKph),
      path: t.path, ...(add ? { addedToOdo: true } : {}), ...(note.trim() ? { note: note.trim() } : {}),
    };
    update(d => {
      (d.rides ??= []).push(ride);
      if (add) d.bike.odo = Math.round(d.bike.odo + t.km);
    });
    resetRecorder();
    toast(add ? `Ride saved — odometer +${Math.round(t.km)} km.` : "Ride saved.");
  }

  const elapsed = live && rec.startedAt ? Math.max(0, Math.round((Date.now() - rec.startedAt) / 1000)) : 0;

  return (
    <div className="flex flex-col gap-[14px]">
      <Panel title="Record a ride" note={live ? "recording" : undefined}>
        {done ? (
          <>
            <div className="stats sm:grid-cols-4 mb-3">
              <Stat v={`${done.track.km.toFixed(1)} km`} k="Distance" />
              <Stat v={duration(trackSecs(done.track))} k="Time" />
              <Stat v={`${avgKph(done.track.km, trackSecs(done.track)).toFixed(0)} km/h`} k="Average" />
              <Stat v={`${Math.round(done.track.maxKph)} km/h`} k="Top speed" />
            </div>
            <RouteMap path={done.track.path} />
            {canAddOdo && (
              <label className="flex items-center gap-3 my-3 cursor-pointer">
                <input type="checkbox" className="check" checked={addOdo} onChange={e => setAddOdo(e.target.checked)} />
                <span className="field__l !mb-0">
                  Add {Math.round(done.track.km)} km to the odometer ({km(s.bike.odo)} → {km(s.bike.odo + done.track.km)})
                </span>
              </label>
            )}
            <div className="mb-3">
              <label className="field__l">Note</label>
              <input className="inp" placeholder="Sunday loop, Mandai" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn--danger" onClick={() => { if (confirm("Discard this ride?")) resetRecorder(); }}>Discard</button>
              <button className="btn flex-1" onClick={saveRide}>Save ride</button>
            </div>
          </>
        ) : live ? (
          <>
            <div className="rec">
              <span className="rec__km">{rec.track.km.toFixed(2)}</span>
              <span className="rec__unit">km</span>
            </div>
            <div className="stats sm:grid-cols-4 mb-3">
              <Stat v={duration(elapsed)} k="Time" />
              <Stat v={rec.kph != null ? `${Math.round(rec.kph)}` : "—"} k="km/h now" />
              <Stat v={`${Math.round(rec.track.maxKph)}`} k="Top km/h" />
              <Stat v={rec.acc != null ? `±${Math.round(rec.acc)} m` : "…"} k="GPS" />
            </div>
            {rec.status === "starting" && (
              <p className="field__h !mt-0 mb-3">{rec.why || "Waiting for the first GPS fix…"}</p>
            )}
            <button className="btn btn--full" onClick={stop}>Stop</button>
            <p className="field__h">
              Keep the app open with the screen on{rec.wake ? " — it is being held awake for you" : ""}.
              A browser stops receiving GPS once the app is in the background or the phone is locked,
              so distance covered then is not counted.
            </p>
          </>
        ) : (
          <>
            {rec.status === "blocked" && (
              <div className="empty !border-t-0 !pt-0">
                <b>Location is blocked</b>
                Your browser is refusing location for this site. Find <b className="inline">Location</b> in
                the site settings for this page, set it to Allow, then try again.
              </div>
            )}
            {rec.status === "failed" && (
              <div className="empty !border-t-0 !pt-0"><b>Can't record here</b>{rec.why}</div>
            )}
            {rec.status === "idle" && (
              <p className="field__h !mt-0 mb-3">
                Records distance, time and a sketch of your route using your phone's GPS, and can add
                the distance to your odometer. The route is stored on this phone only.
              </p>
            )}
            <button className="btn btn--full"
                    onClick={() => { if (rec.status !== "idle") resetRecorder(); startRecording(); }}>
              Start ride
            </button>
          </>
        )}
      </Panel>

      {rides.length > 0 ? (
        <>
          <div className="stats sm:grid-cols-4">
            <Stat v={String(tot.count)} k={tot.count === 1 ? "Ride" : "Rides"} />
            <Stat v={`${km(tot.km)} km`} k="Recorded" />
            <Stat v={duration(tot.secs)} k="In the saddle" />
            <Stat v={`${tot.longest.toFixed(1)} km`} k="Longest" />
          </div>
          <Panel title="Rides" note={`${rides.length} saved · since ${dmy(dayOf(rides[rides.length - 1].start))}`}>
            <ul>
              {rides.map(r => {
                const isOpen = open === r.id;
                return (
                  <li key={r.id} className="border-b last:border-b-0" style={{ borderColor: "var(--rule-2)" }}>
                    <button className="entry !border-b-0" aria-expanded={isOpen}
                            onClick={() => setOpen(isOpen ? null : r.id)}>
                      <span className="entry__ic entry__ic--ride"><Route size={20} /></span>
                      <span className="min-w-0">
                        <span className="entry__title">{r.note || "Ride"}</span>
                        <span className="entry__meta">
                          {dmy(dayOf(r.start))} · {duration(r.secs)} · {avgKph(r.km, r.secs).toFixed(0)} km/h avg
                          {r.addedToOdo ? " · on odometer" : ""}
                        </span>
                      </span>
                      <span className="entry__amt">{r.km.toFixed(1)} km</span>
                    </button>
                    {isOpen && (
                      <div className="pb-3">
                        <RouteMap path={r.path} />
                        <div className="flex items-center justify-between gap-3 mt-2">
                          <span className="field__h !mt-0">Top speed {r.maxKph} km/h · {r.path.length} route points</span>
                          <button className="btn btn--danger btn--sm"
                                  onClick={() => {
                                    if (!confirm("Delete this ride? The odometer is left as it is.")) return;
                                    update(d => { d.rides = (d.rides ?? []).filter(x => x.id !== r.id); });
                                    setOpen(null);
                                    toast("Ride deleted.");
                                  }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </>
      ) : !live && !done && (
        <Panel title="Rides">
          <Empty title="No rides yet">Recorded rides collect here, each with its distance, time and route.</Empty>
        </Panel>
      )}
    </div>
  );
}
