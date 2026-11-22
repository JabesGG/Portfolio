import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import {
  readSync, writeSync, newCode, tidyCode, prettyCode, validCode,
  pull, wipe, syncOnce, pushNow, acceptRemote, type SyncState,
} from "@/lib/sync";
import type { Garage } from "@/lib/types";

function when(iso?: string): string {
  if (!iso) return "not yet";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "not yet" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Sync between your own devices. Off until you turn it on, and while it is off
 * this app talks to nobody.
 */
export function SyncPanel() {
  const { g, replaceGarage, toast } = useApp();
  const live = useRef(g);
  live.current = g;
  const [st, setSt] = useState<SyncState | null>(() => readSync());
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [join, setJoin] = useState("");
  const [clash, setClash] = useState<{ remote: Garage; rev: number } | null>(null);

  // Another tab, or the background sync in App, may have moved things on.
  useEffect(() => { setSt(readSync()); }, [g]);

  const refresh = () => setSt(readSync());

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); refresh(); }
  }

  const unavailable = () => toast("Sync isn't available on this copy of the app.");

  const turnOn = () => run(async () => {
    writeSync({ code: newCode(), rev: 0, dirty: true });
    const out = await pushNow(() => live.current, 0);
    if (out.kind === "pushed") { setShow(true); toast("Sync is on. Enter the code on your other device."); }
    else { writeSync(null); if (out.kind === "unavailable") unavailable(); else toast("Couldn't turn sync on. Try again."); }
  });

  const joinWith = () => run(async () => {
    const code = tidyCode(join);
    if (!validCode(code)) { toast("That doesn't look like a sync code."); return; }
    const r = await pull(code);
    if (r.status === "unavailable") { unavailable(); return; }
    if (r.status === "empty") { toast("Nothing is stored under that code."); return; }
    if (r.status === "error") { toast("Couldn't fetch that copy. Try again."); return; }
    if (!confirm("Replace everything on this device with the copy from your other device? Back up first if unsure.")) return;
    writeSync({ code, rev: r.rev, dirty: false, last: new Date().toISOString() });
    replaceGarage(r.garage, true);
    setJoin("");
    toast("This device now follows that code.");
  });

  const syncNow = () => run(async () => {
    const out = await syncOnce(() => live.current);
    if (out.kind === "adopted") { replaceGarage(out.garage, true); toast("Updated from your other device."); }
    else if (out.kind === "pushed") toast("Uploaded.");
    else if (out.kind === "none") toast("Already up to date.");
    else if (out.kind === "conflict") setClash({ remote: out.remote, rev: out.rev });
    else if (out.kind === "unavailable") toast("Couldn't reach the sync service. Are you online?");
    else if (out.kind === "error") toast("Sync failed. Try again in a moment.");
  });

  const keepMine = () => run(async () => {
    if (!clash) return;
    const out = await pushNow(() => live.current, clash.rev);
    if (out.kind === "pushed") { setClash(null); toast("Kept this device's copy."); }
    else toast("Couldn't upload. Try again.");
  });

  const keepTheirs = () => {
    if (!clash) return;
    acceptRemote(clash.rev);
    replaceGarage(clash.remote, true);
    setClash(null);
    refresh();
    toast("Took the other device's copy.");
  };

  const turnOff = () => run(async () => {
    if (!st) return;
    if (!confirm("Turn sync off on this device? Your records stay here.")) return;
    if (confirm("Also delete the copy stored on the server? Choose Cancel if another device still uses it.")) {
      await wipe(st.code);
    }
    writeSync(null);
    setShow(false);
    toast("Sync is off.");
  });

  if (!st) {
    return (
      <Panel title="Sync between devices" note="off">
        <p className="field__h !mt-0 mb-3">
          Optional. Keeps your phone and computer on the same garage. Turning it on stores a copy of
          your records (not receipt photos) on this site's server under a long random code — no
          account, no email. While it is off, nothing leaves this device.
        </p>
        <button className="btn btn--ghost btn--sm w-full mb-3" disabled={busy} onClick={turnOn}>
          {busy ? "Working…" : "Turn on sync"}
        </button>
        <label className="field__l">Or enter a code from your other device</label>
        <div className="flex gap-2">
          <input className="inp inp--sm flex-1" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                 placeholder="ABCD-EFGH-…" value={join} onChange={e => setJoin(e.target.value)} />
          <button className="btn btn--sm" disabled={busy || !join.trim()} onClick={joinWith}>Join</button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Sync between devices" note={st.dirty ? "changes waiting" : "up to date"}>
      {clash && (
        <div className="p-3 rounded mb-3" style={{ background: "var(--card-2)", border: "1px solid var(--rule)" }}>
          <p className="field__h !mt-0 mb-2">
            This device and another one both changed since they last matched. Pick the copy to keep —
            the other is overwritten.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn--ghost btn--sm" disabled={busy} onClick={keepMine}>
              This device ({live.current.bikes.reduce((t, b) => t + b.entries.length, 0)} entries)
            </button>
            <button className="btn btn--ghost btn--sm" disabled={busy} onClick={keepTheirs}>
              Other device ({clash.remote.bikes.reduce((t, b) => t + b.entries.length, 0)} entries)
            </button>
          </div>
        </div>
      )}
      <p className="field__h !mt-0 mb-3">Last synced {when(st.last)}. Changes upload a few seconds after you make them.</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={syncNow}>{busy ? "Working…" : "Sync now"}</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setShow(v => !v)}>{show ? "Hide code" : "Show code"}</button>
      </div>
      {show && (
        <>
          <p className="synccode">{prettyCode(st.code)}</p>
          <button className="btn btn--ghost btn--sm w-full mb-2"
                  onClick={() => {
                    navigator.clipboard?.writeText(prettyCode(st.code)).then(
                      () => toast("Code copied."), () => toast("Clipboard blocked — type it in instead."),
                    ) ?? toast("Clipboard unavailable — type it in instead.");
                  }}>Copy code</button>
          <p className="field__h !mt-0 mb-2">
            Treat this like a password: anyone with it can read and replace your records.
          </p>
        </>
      )}
      <button className="btn btn--danger btn--sm w-full" disabled={busy} onClick={turnOff}>Turn sync off</button>
    </Panel>
  );
}
