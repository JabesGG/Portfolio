import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { seedGarage } from "@/lib/store";
import { clearPhotos } from "@/lib/photos";
import {
  useCloud, clearNotice, signIn, signUp, sendReset, setNewPassword, dismissRecovery,
  signOut, deleteAccount, syncNow,
} from "@/lib/cloud";

function ago(iso?: string): string {
  if (!iso) return "not yet";
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (!isFinite(s)) return "not yet";
  if (s < 45) return "just now";
  if (s < 90) return "a minute ago";
  if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Mode = "in" | "up" | "reset";

/**
 * Optional account. Signed out, nothing changes: everything stays on this
 * device and the app talks to nobody. Signed in, records sync between your
 * devices and survive a lost phone.
 */
export function AccountPanel() {
  const cloud = useCloud();
  const { replaceGarage, toast } = useApp();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  // Re-render "2 minutes ago" now and then.
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(id); }, []);

  useEffect(() => { if (cloud.notice) setErr(cloud.notice); }, [cloud.notice]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null); clearNotice();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr("Enter your email address."); return; }
    if (mode !== "reset" && pw.length < 8) { setErr("Passwords need at least 8 characters."); return; }
    setBusy(true);
    try {
      if (mode === "in") {
        const r = await signIn(email, pw);
        if (r) setErr(r); else setPw("");
      } else if (mode === "up") {
        const r = await signUp(email, pw);
        if (r.error) setErr(r.error);
        else if (r.confirm) { setSent(`We've sent a link to ${email.trim()}. Open it on this device to finish creating your account.`); setPw(""); }
        else setPw("");
      } else {
        const r = await sendReset(email);
        if (r) setErr(r);
        else setSent(`If ${email.trim()} has an account, a link to set a new password is on its way.`);
      }
    } finally { setBusy(false); }
  }

  if (cloud.status === "loading") {
    return (
      <Panel title="Account">
        <p className="field__h !mt-0">Checking your sign-in…</p>
      </Panel>
    );
  }

  if (cloud.status === "signed-in") {
    const doSync = async () => {
      setBusy(true);
      const e = await syncNow();
      setBusy(false);
      toast(e ?? "Up to date.");
    };
    const doSignOut = async () => {
      if (!confirm("Sign out on this device? Your records stay in your account.")) return;
      const wipe = confirm("Also remove your records from this device?\n\nOK removes them (they stay in your account). Cancel keeps a copy here.");
      await signOut();
      if (wipe) { await clearPhotos(); replaceGarage(seedGarage()); }
      toast("Signed out.");
    };
    const doDelete = async () => {
      if (!confirm("Delete your account? Every record and receipt photo stored in it is deleted for good, on every device that syncs with it. This device keeps its own copy.")) return;
      if (prompt('Type DELETE to confirm.')?.trim().toUpperCase() !== "DELETE") return;
      setBusy(true);
      const e = await deleteAccount();
      setBusy(false);
      toast(e ?? "Account deleted. Your records are still on this device.");
    };
    return (
      <Panel title="Account" note={cloud.syncing ? "syncing…" : cloud.error ? "not synced" : "synced"}>
        <p className="field__h !mt-0 mb-1">Signed in as <b>{cloud.email}</b>.</p>
        <p className="field__h !mt-0 mb-3">
          {cloud.error
            ? cloud.error
            : <>Last synced {ago(cloud.last)}. Changes sync a few seconds after you make them, receipt photos included.</>}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button className="btn btn--ghost btn--sm" disabled={busy || cloud.syncing} onClick={doSync}>
            {cloud.syncing ? "Syncing…" : "Sync now"}
          </button>
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={doSignOut}>Sign out</button>
        </div>
        <button className="btn btn--danger btn--sm w-full" disabled={busy} onClick={doDelete}>Delete account</button>
      </Panel>
    );
  }

  const switchTo = (m: Mode) => { setMode(m); setErr(null); setSent(null); clearNotice(); };

  return (
    <Panel title="Account" note="optional">
      <p className="field__h !mt-0 mb-3">
        Sign in to keep your phone and computer in sync, and to get your records back if you lose
        this phone. Without an account, everything stays on this device.
      </p>
      {sent ? (
        <>
          <p className="field__h !mt-0 mb-3" role="status">{sent}</p>
          <button className="btn btn--ghost btn--sm w-full" onClick={() => switchTo("in")}>Back to sign in</button>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <label className="field__l" htmlFor="acct-email">Email</label>
          <input id="acct-email" className="inp mb-2" type="email" inputMode="email" autoComplete="email"
                 autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} />
          {mode !== "reset" && (
            <>
              <label className="field__l" htmlFor="acct-pw">Password</label>
              <input id="acct-pw" className="inp mb-2" type="password"
                     autoComplete={mode === "up" ? "new-password" : "current-password"}
                     value={pw} onChange={e => setPw(e.target.value)} />
              {mode === "up" && <p className="field__h !mt-0 mb-2">At least 8 characters.</p>}
            </>
          )}
          {err && <p className="field__h !mt-0 mb-2 acct__err" role="alert">{err}</p>}
          <button className="btn btn--sm w-full mb-2" type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
          </button>
          <div className="flex justify-between gap-2">
            {mode === "in" ? (
              <>
                <button type="button" className="linkish" onClick={() => switchTo("up")}>Create an account</button>
                <button type="button" className="linkish" onClick={() => switchTo("reset")}>Forgot password?</button>
              </>
            ) : (
              <button type="button" className="linkish" onClick={() => switchTo("in")}>I have an account: sign in</button>
            )}
          </div>
        </form>
      )}
    </Panel>
  );
}

/** Shown when a password-reset link brings the rider back to the app. */
export function RecoverySheet() {
  const { toast } = useApp();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("sheet-open");
    return () => document.body.classList.remove("sheet-open");
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setErr("Passwords need at least 8 characters."); return; }
    setBusy(true);
    const r = await setNewPassword(pw);
    setBusy(false);
    if (r) setErr(r); else toast("Password changed. You're signed in.");
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) dismissRecovery(); }}>
      <DialogContent aria-describedby={undefined}>
        <form className="sheet__body" onSubmit={submit} noValidate>
          <div className="sheet__head">
            <DialogTitle className="sheet__title">Set a new password</DialogTitle>
          </div>
          <label className="field__l" htmlFor="new-pw">New password</label>
          <input id="new-pw" className="inp mb-2" type="password" autoComplete="new-password" autoFocus
                 value={pw} onChange={e => setPw(e.target.value)} />
          <p className="field__h !mt-0 mb-2">At least 8 characters.</p>
          {err && <p className="field__h !mt-0 mb-2 acct__err" role="alert">{err}</p>}
          <div className="sheet__foot">
            <button type="button" className="btn btn--ghost flex-1" onClick={dismissRecovery}>Later</button>
            <button type="submit" className="btn flex-1" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
