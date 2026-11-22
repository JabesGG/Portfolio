import { useState } from "react";
import { useApp } from "@/lib/ctx";
import { Panel, Stat } from "@/components/Lamp";
import { coeNow, renewalCost } from "@/lib/coe";
import { dmy, money0, num } from "@/lib/format";

const LTA_COE = "https://onemotoring.lta.gov.sg/content/onemotoring/home/owning/coe-renewal.html";

/** COE renewal cost, and what the current COE is still worth. */
export function CoePanel() {
  const { s, go } = useApp();
  const [pqp, setPqp] = useState("");
  const now = s.bike.coe ? coeNow(s.bike.coe) : null;
  const ten = renewalCost(num(pqp), 10), five = renewalCost(num(pqp), 5);
  const has = num(pqp) > 0;

  return (
    <>
      <Panel title="COE renewal cost">
        <label className="field__l">Prevailing Quota Premium for motorcycles (Cat D), $</label>
        <input className="inp" inputMode="decimal" placeholder="e.g. 9000" value={pqp}
               onChange={e => setPqp(e.target.value)} />
        <p className="field__h">
          The PQP changes every month.{" "}
          <a className="linkish" href={LTA_COE} target="_blank" rel="noopener noreferrer">Look up this month's on OneMotoring</a>.
        </p>

        <div className="grid grid-cols-2 gap-[10px] mt-3">
          {[ten, five].map(r => (
            <div className="coe" key={r.years}>
              <span className="coe__y">{r.years} years</span>
              <span className="coe__v">{has ? money0(r.total) : "—"}</span>
              <span className="coe__k">{r.years === 10 ? "full PQP" : "half the PQP"}</span>
              <span className="coe__row"><span>per year</span><b>{has ? money0(r.perYear) : "—"}</b></span>
              <span className="coe__row"><span>per month</span><b>{has ? money0(r.perMonth) : "—"}</b></span>
            </div>
          ))}
        </div>
        <p className="field__h">
          Both work out the same per year. The difference is what happens after: a 10-year COE can
          be renewed again; a 5-year COE on a motorcycle cannot — the bike must be deregistered when
          it ends.
        </p>
      </Panel>

      <Panel title="Your current COE" note={now ? `expires ${dmy(now.expiry)}` : "not set"}>
        {now ? (
          <>
            <div className="split__track" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                 aria-valuenow={Math.round(now.used * 100)}>
              <div className="split__bar" style={{ width: `${Math.min(100, Math.max(2, now.used * 100))}%` }} />
            </div>
            <div className="axis mb-3">
              <span>{dmy(s.bike.coe!.start)}</span>
              <span>{dmy(now.expiry)}</span>
            </div>
            <div className="stats sm:grid-cols-4">
              <Stat v={`${Math.floor(now.monthsLeft / 12)}y ${Math.floor(now.monthsLeft % 12)}m`} k="Left to run" />
              <Stat v={`${Math.round(now.used * 100)}%`} k="Used" />
              <Stat v={now.perMonth ? money0(now.perMonth) : "—"} k="COE per month" />
              <Stat v={now.rebate ? money0(now.rebate) : "—"} k="Rebate if deregistered today" />
            </div>
            <p className="field__h">
              The rebate is LTA's formula — premium paid × unused months ÷ months in the COE — worked
              out to today. It is an estimate: LTA's figure on the day you deregister is the one that counts.
            </p>
          </>
        ) : (
          <p className="field__h !mt-0">
            Add the COE premium you paid and the day it started under{" "}
            <button className="linkish" onClick={() => go("bike")}>Bike</button> to see how much of it
            is left and what deregistering would return.
          </p>
        )}
      </Panel>
    </>
  );
}
