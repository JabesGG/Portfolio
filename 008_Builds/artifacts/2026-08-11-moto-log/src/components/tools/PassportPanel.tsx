import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import { buildPassport, passportHtml, type Passport } from "@/lib/passport";
import { download } from "@/lib/download";
import { todayISO } from "@/lib/format";

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <table className="pp__kv"><tbody>
      {rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
    </tbody></table>
  );
}

/** The passport as a page. Shown only when printing — see `.pp` in index.css. */
function PassportDoc({ p }: { p: Passport }) {
  return (
    <div className="pp">
      <h1>{p.title}</h1>
      <p className="pp__sub">Bike passport{p.plate ? ` · ${p.plate}` : ""} · prepared {p.made}</p>
      <h2>The bike</h2>
      <Rows rows={p.facts} />
      {p.dates.length > 0 && <><h2>Renewal dates</h2><Rows rows={p.dates} /></>}
      <h2>Service history</h2>
      {p.services.length ? (
        <table className="pp__log">
          <thead><tr><th>Date</th><th>Odometer</th><th>Work done</th><th>Workshop</th>{p.showCosts && <th>Cost</th>}</tr></thead>
          <tbody>
            {p.services.map((r, i) => (
              <tr key={i}>
                <td>{r.date}</td><td>{r.odo}</td>
                <td>{r.what}{r.note && <small>{r.note}</small>}</td>
                <td>{r.shop}</td>{p.showCosts && <td>{r.cost}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="pp__sub">No services logged yet.</p>}
      {p.upkeep.length > 0 && <><h2>Last done</h2><Rows rows={p.upkeep.map(u => [u.item, u.last])} /></>}
      <h2>Running record</h2>
      <Rows rows={p.running} />
      {p.fuel.length > 0 && (
        <>
          <h2>Fuel log</h2>
          <table className="pp__log">
            <thead><tr><th>Date</th><th>Odometer</th><th>Litres</th><th>Station</th>{p.showCosts && <th>Cost</th>}</tr></thead>
            <tbody>
              {p.fuel.map((r, i) => (
                <tr key={i}><td>{r.date}</td><td>{r.odo}</td><td>{r.litres}</td><td>{r.where}</td>{p.showCosts && <td>{r.cost}</td>}</tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="pp__foot">
        Owner-kept record from Moto Log. Entries are as logged by the owner and are not verified by a
        workshop or by LTA.
      </p>
    </div>
  );
}

/** A shareable service and ownership history for a buyer or a workshop. */
export function PassportPanel() {
  const { s, toast } = useApp();
  const [costs, setCosts] = useState(false);
  const [fuel, setFuel] = useState(false);
  const [printing, setPrinting] = useState(false);
  const p = buildPassport(s, { costs, fuel });

  // Print once the page copy is in the document, then take it out again.
  useEffect(() => {
    if (!printing) return;
    const off = () => setPrinting(false);
    window.addEventListener("afterprint", off);
    const id = setTimeout(() => window.print(), 60);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", off); };
  }, [printing]);

  const name = `${(s.bike.plate || p.title).replace(/[^\w-]+/g, "-")}-passport-${todayISO()}.html`;

  return (
    <Panel title="Bike passport" note={`${p.services.length} ${p.services.length === 1 ? "service" : "services"} on record`}>
      <p className="field__h !mt-0 mb-3">
        A clean copy of this bike's history — details, renewal dates, every service, when each item
        was last done — to hand to a buyer or a workshop. You choose what goes in.
      </p>
      <label className="flex items-center gap-3 mb-2 cursor-pointer">
        <input type="checkbox" className="check" checked={costs} onChange={e => setCosts(e.target.checked)} />
        <span className="field__l !mb-0">Include what I paid</span>
      </label>
      <label className="flex items-center gap-3 mb-3 cursor-pointer">
        <input type="checkbox" className="check" checked={fuel} onChange={e => setFuel(e.target.checked)} />
        <span className="field__l !mb-0">Include the fuel log</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn--ghost btn--sm" onClick={() => setPrinting(true)}>Print / save as PDF</button>
        <button className="btn btn--ghost btn--sm"
                onClick={() => {
                  toast(download(name, passportHtml(p), "text/html") ? `Saved ${name}` : "Download blocked here — use Print instead.");
                }}>Download file</button>
      </div>
      <p className="field__h">
        The file is a single page with no scripts that opens in any browser. Nothing is uploaded —
        you send it yourself.
      </p>
      {printing && createPortal(<PassportDoc p={p} />, document.body)}
    </Panel>
  );
}
