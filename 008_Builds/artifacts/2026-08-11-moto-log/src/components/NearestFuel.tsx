import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { nearest, prettyDistance, directionsUrl, type Near } from "@/lib/stations";

type Phase =
  | { k: "asking" }
  | { k: "ok"; list: Near[]; accuracy: number }
  | { k: "far"; km: number }
  | { k: "denied" }
  | { k: "failed"; why: string };

/**
 * Where the nearest petrol is. The list is baked into the app, so this works
 * with no signal — which is the situation you are usually in when it matters.
 * Directions hand off to the phone's maps app: it has live traffic and routing,
 * this has a list that works offline. Each does the part it is good at.
 */
export function NearestFuel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ k: "asking" });

  useEffect(() => {
    if (!navigator.geolocation) {
      setPhase({ k: "failed", why: "This browser cannot report a location." });
      return;
    }
    let live = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (!live) return;
        const { latitude, longitude, accuracy } = pos.coords;
        const list = nearest(latitude, longitude, 5);
        // The list is Singapore only; well outside it, say so rather than
        // pointing at a station 900 km away as though it were useful.
        if (!list.length || list[0].km > 60) {
          setPhase({ k: "far", km: list[0]?.km ?? 0 });
        } else {
          setPhase({ k: "ok", list, accuracy });
        }
      },
      err => {
        if (!live) return;
        if (err.code === err.PERMISSION_DENIED) setPhase({ k: "denied" });
        else setPhase({ k: "failed", why: err.code === err.TIMEOUT ? "Timed out getting a fix." : "Could not get a location fix." });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    return () => { live = false; };
  }, []);

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-[520px] gap-0 p-0 rounded-[6px] max-h-[92vh] overflow-y-auto"
        style={{ background: "var(--card-c)", borderColor: "var(--rule)" }}
      >
        <div className="p-[18px]">
          <div className="flex items-center justify-between gap-3 mb-4 pb-[11px] border-b-2"
               style={{ borderColor: "var(--ink)" }}>
            <DialogTitle className="sheet__title">Nearest fuel</DialogTitle>
          </div>

          {phase.k === "asking" && (
            <p className="field__h !mt-0">Getting a location fix…</p>
          )}

          {phase.k === "denied" && (
            <div className="empty">
              <b>Location is off</b>
              Allow location for this site in your browser settings, then try again. Nothing is
              sent anywhere — the station list is already on your phone and the lookup happens
              here.
            </div>
          )}

          {phase.k === "failed" && (
            <div className="empty">
              <b>No fix</b>
              {phase.why} Under cover or in a basement carpark it can take a moment — step
              outside and try again.
            </div>
          )}

          {phase.k === "far" && (
            <div className="empty">
              <b>Nothing nearby</b>
              {/* The distance is worth stating just over the border, where it tells
                  you something. At 10,000 km it is only noise. */}
              The station list covers Singapore only
              {phase.km > 0 && phase.km < 200
                ? `, and the closest is ${prettyDistance(phase.km)} away`
                : ""}
              . Use your maps app from here.
            </div>
          )}

          {phase.k === "ok" && (
            <>
              <ul className="stations">
                {phase.list.map((s, i) => (
                  <li key={`${s.name}-${i}`}>
                    <a className="station" href={directionsUrl(s)} target="_blank" rel="noopener noreferrer">
                      <span className="station__dir" aria-hidden="true">{s.dir}</span>
                      <span className="station__body">
                        <span className="station__name">{s.name}</span>
                        {/* Street where OSM has it, otherwise the brand — but never
                            the brand when it just repeats the name. */}
                        {(s.street || (s.brand && s.brand !== s.name)) && (
                          <span className="station__brand">{s.street || s.brand}</span>
                        )}
                      </span>
                      <span className="station__km">{prettyDistance(s.km)}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="field__h">
                Straight-line distance, so the nearest here is not always the shortest ride.
                Tap one for directions. Fix accurate to about {Math.round(phase.accuracy)} m.
              </p>
            </>
          )}

          <div className="flex gap-2 mt-[18px] pt-[14px] border-t" style={{ borderColor: "var(--rule-2)" }}>
            <button type="button" className="btn flex-1" onClick={onClose}>Close</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
