import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { nearest, prettyDistance, directionsUrl, type Near } from "@/lib/stations";

type Phase =
  | { k: "checking" }
  | { k: "prime" }
  | { k: "locating" }
  | { k: "ok"; list: Near[]; accuracy: number }
  | { k: "far"; km: number }
  | { k: "blocked" }
  | { k: "failed"; why: string };

/**
 * Where the nearest petrol is. The list is baked into the app, so this works
 * with no signal — which is the situation you are usually in when it matters.
 * Directions hand off to the phone's maps app: it has live traffic and routing,
 * this has a list that works offline.
 *
 * Location is never requested on open. The browser only ever shows its prompt
 * once, and a prompt that arrives unexplained gets dismissed — so we say what it
 * is for and let you trigger it. Once a browser has been told to block, nothing
 * in here can re-open that prompt; only settings can, and we say so plainly
 * rather than offering a button that would do nothing.
 */
export function NearestFuel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ k: "checking" });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setPhase({ k: "failed", why: "This browser cannot report a location." });
      return;
    }
    setPhase({ k: "locating" });
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        const list = nearest(latitude, longitude, 5);
        // The list is Singapore only; well outside it, say so rather than
        // pointing at a station on the other side of the world.
        if (!list.length || list[0].km > 60) setPhase({ k: "far", km: list[0]?.km ?? 0 });
        else setPhase({ k: "ok", list, accuracy });
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) setPhase({ k: "blocked" });
        else setPhase({
          k: "failed",
          why: err.code === err.TIMEOUT ? "Timed out getting a fix." : "Could not get a location fix.",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  // Skip the explanation when permission is already granted — asking someone to
  // confirm something they have already allowed is just a wasted tap.
  useEffect(() => {
    let live = true;
    const decide = async () => {
      try {
        const st = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        if (!live) return;
        if (st?.state === "granted") locate();
        else if (st?.state === "denied") setPhase({ k: "blocked" });
        else setPhase({ k: "prime" });
      } catch {
        // Permissions API unavailable (older Safari): offer the button and let
        // the geolocation call itself be the source of truth.
        if (live) setPhase({ k: "prime" });
      }
    };
    void decide();
    return () => { live = false; };
  }, [locate]);

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

          {phase.k === "checking" && <p className="field__h !mt-0">One moment…</p>}

          {phase.k === "prime" && (
            <>
              <div className="empty !border-t-0 !pt-0">
                <b>Where are you?</b>
                To list the closest stations the app needs your location. Your phone will ask you
                to allow it. Nothing is sent anywhere — every station is already stored in the app,
                and the distances are worked out on your phone.
              </div>
              <button className="btn btn--full" onClick={locate}>Use my location</button>
            </>
          )}

          {phase.k === "locating" && <p className="field__h !mt-0">Getting a location fix…</p>}

          {phase.k === "blocked" && (
            <>
              <div className="empty !border-t-0 !pt-0">
                <b>Location is blocked</b>
                Your browser is refusing location for this site, and only it can undo that — no
                button here can re-open the prompt. Find <b className="inline">Location</b> in the
                site settings for this page and set it to Allow, then try again.
              </div>
              <button className="btn btn--ghost btn--full" onClick={locate}>Try again</button>
            </>
          )}

          {phase.k === "failed" && (
            <>
              <div className="empty !border-t-0 !pt-0">
                <b>No fix</b>
                {phase.why} Under cover or in a basement carpark it can take a moment — step
                outside and try again.
              </div>
              <button className="btn btn--ghost btn--full" onClick={locate}>Try again</button>
            </>
          )}

          {phase.k === "far" && (
            <div className="empty !border-t-0 !pt-0">
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
            <button type="button" className="btn btn--ghost flex-1" onClick={onClose}>Close</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
