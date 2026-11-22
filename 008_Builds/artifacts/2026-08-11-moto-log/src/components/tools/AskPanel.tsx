import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import { aiStatus, ask, bikeContext, type AiStatus, type ChatMsg } from "@/lib/ai";

/**
 * The AI mechanic. The one feature that needs a connection and a server; the
 * panel says exactly what is sent, and stays out of the way when it is not
 * switched on.
 */
export function AskPanel() {
  const { s } = useApp();
  const [status, setStatus] = useState<AiStatus | "checking">("checking");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void aiStatus().then(v => { if (live) setStatus(v); });
    return () => { live = false; };
  }, []);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);

  const bike = bikeContext(s);
  const bikeLine = [bike.year, bike.make, bike.model].filter(Boolean).join(" ") || "your bike (no model set yet)";

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setText(""); setErr(""); setBusy(true);
    const r = await ask(next, bike);
    setBusy(false);
    if (r.ok) setMsgs([...next, { role: "assistant", content: r.text }]);
    else setErr(r.why);
  }

  return (
    <Panel title="Ask the AI mechanic" note={status === "ready" ? "online" : undefined}>
      {status === "checking" && <p className="field__h !mt-0">One moment…</p>}

      {status === "unavailable" && (
        <div className="empty !border-t-0 !pt-0">
          <b>Not available here</b>
          The AI mechanic needs an internet connection and only runs on the hosted app. The symptom
          guide under <b className="inline">Guides</b> works anywhere.
        </div>
      )}

      {status === "not-configured" && (
        <div className="empty !border-t-0 !pt-0">
          <b>Not switched on yet</b>
          This site hasn't been given an AI key, so there is nothing to answer questions. The symptom
          guide under <b className="inline">Guides</b> works without it.
        </div>
      )}

      {status === "ready" && (
        <>
          <p className="field__h !mt-0 mb-3">
            Sent with each question: what you type, plus “{bikeLine}{bike.odo ? `, ${bike.odo} km` : ""}”.
            Nothing else — not your records, costs, plate or location. Answers come from an AI and
            can be wrong; for brakes, steering and tyres, have a mechanic look.
          </p>
          {msgs.length > 0 && (
            <div className="chat" aria-live="polite">
              {msgs.map((m, i) => (
                // Whole class names, never assembled: Tailwind drops any it can't read in the source.
                <div key={i} className={m.role === "user" ? "chat__m chat__m--user" : "chat__m chat__m--assistant"}>
                  {m.content}
                </div>
              ))}
              {busy && <div className="chat__m chat__m--assistant chat__m--wait">Thinking…</div>}
              <div ref={end} />
            </div>
          )}
          {err && <p className="field__h mb-2" role="alert">{err}</p>}
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void send(); }}>
            <input className="inp flex-1" style={{ fontFamily: "var(--body)" }} maxLength={600}
                   placeholder="e.g. Clunk from the front when braking" value={text}
                   onChange={e => setText(e.target.value)} />
            <button className="btn" type="submit" disabled={busy || !text.trim()}>Ask</button>
          </form>
          {msgs.length > 0 && (
            <button className="linkish mt-2" type="button" onClick={() => { setMsgs([]); setErr(""); }}>
              Start over
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
