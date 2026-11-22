import { useSyncExternalStore } from "react";
import { addFix, newTrack, type Track } from "./rides";

/**
 * The ride recorder. It lives outside React, as one module-level store, so a
 * recording carries on when you switch tabs inside the app — the Ride tab
 * unmounts, the recording does not.
 *
 * On the web this only works while the app is open and the screen is on: a
 * browser stops delivering GPS fixes to a page in the background. The screen
 * wake lock is requested to keep the phone from sleeping mid-ride. Recording
 * with the screen off needs the native app.
 */
export type RecStatus = "idle" | "starting" | "recording" | "stopped" | "blocked" | "failed";

export interface RecState {
  status: RecStatus;
  track: Track;
  startedAt: number | null;
  /** Latest reported accuracy in metres and speed in km/h, for the readout. */
  acc: number | null;
  kph: number | null;
  why: string;
  wake: boolean;
}

let state: RecState = fresh();
let watchId: number | null = null;
let wakeLock: { release(): Promise<void> } | null = null;
const subs = new Set<() => void>();

function fresh(): RecState {
  return { status: "idle", track: newTrack(), startedAt: null, acc: null, kph: null, why: "", wake: false };
}

function set(patch: Partial<RecState>) {
  state = { ...state, ...patch };
  subs.forEach(f => f());
}

async function holdScreen() {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (!wl) return;
    wakeLock = await wl.request("screen");
    set({ wake: true });
  } catch { /* not supported or refused: recording still works while the screen is on */ }
}

// The wake lock is dropped whenever the page is hidden; take it again on return.
function onVisible() {
  if (document.visibilityState === "visible" && state.status === "recording") void holdScreen();
}

export function startRecording(): void {
  if (state.status === "recording" || state.status === "starting") return;
  if (!navigator.geolocation) {
    set({ ...fresh(), status: "failed", why: "This browser cannot report a location." });
    return;
  }
  set({ ...fresh(), status: "starting", startedAt: Date.now() });
  void holdScreen();
  document.addEventListener("visibilitychange", onVisible);
  watchId = navigator.geolocation.watchPosition(
    pos => {
      const c = pos.coords;
      set({
        status: "recording",
        track: addFix(state.track, { lat: c.latitude, lon: c.longitude, acc: c.accuracy, t: pos.timestamp, speed: c.speed }),
        acc: c.accuracy,
        kph: c.speed != null && c.speed >= 0 ? c.speed * 3.6 : null,
      });
    },
    err => {
      // A timeout between fixes is normal under cover; only a refusal ends it.
      if (err.code === err.PERMISSION_DENIED) { release(); set({ status: "blocked" }); }
      else if (state.status === "starting") set({ why: "Waiting for a GPS fix — step into the open." });
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 },
  );
}

function release() {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  document.removeEventListener("visibilitychange", onVisible);
  void wakeLock?.release().catch(() => {});
  wakeLock = null;
}

/**
 * Stops receiving fixes but keeps the track, so the summary survives a tab
 * switch until the ride is saved or discarded. Too short to be a ride → idle.
 */
export function stopRecording(): Track {
  release();
  const track = state.track;
  if (track.km < MIN_RIDE_KM) set(fresh());
  else set({ status: "stopped", kph: null });
  return track;
}

/** Below this a "ride" is GPS drift in a carpark, not a ride. */
export const MIN_RIDE_KM = 0.05;

export function resetRecorder(): void {
  release();
  set(fresh());
}

export function recorderState(): RecState { return state; }

export function useRecorder(): RecState {
  return useSyncExternalStore(
    cb => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => state,
    () => state,
  );
}
