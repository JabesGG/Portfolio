import { useCallback, useEffect, useState } from "react";

export type FixPhase =
  | { k: "checking" }
  | { k: "prime" }
  | { k: "locating" }
  | { k: "ok"; lat: number; lon: number; accuracy: number }
  | { k: "blocked" }
  | { k: "failed"; why: string };

/**
 * One location fix, asked for politely. Location is never requested on mount
 * unless it is already granted: the browser shows its prompt once, and a prompt
 * that arrives unexplained gets dismissed, so the caller explains and the user
 * triggers it.
 */
export function useFix(): [FixPhase, () => void] {
  const [phase, setPhase] = useState<FixPhase>({ k: "checking" });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setPhase({ k: "failed", why: "This browser cannot report a location." });
      return;
    }
    setPhase({ k: "locating" });
    navigator.geolocation.getCurrentPosition(
      pos => setPhase({ k: "ok", lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => {
        if (err.code === err.PERMISSION_DENIED) setPhase({ k: "blocked" });
        else setPhase({ k: "failed", why: err.code === err.TIMEOUT ? "Timed out getting a fix." : "Could not get a location fix." });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const st = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        if (!live) return;
        if (st?.state === "granted") locate();
        else if (st?.state === "denied") setPhase({ k: "blocked" });
        else setPhase({ k: "prime" });
      } catch {
        if (live) setPhase({ k: "prime" });
      }
    })();
    return () => { live = false; };
  }, [locate]);

  return [phase, locate];
}
