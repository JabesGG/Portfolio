import { useApp } from "@/lib/ctx";
import { Panel, Stat, Empty } from "@/components/Lamp";
import { totals, monthlySpend, fuelRuns, yearlySpend, fuelSavings, entrySpan, runPositions } from "@/lib/calc";
import { money, money0, km, dmy, dmyShort } from "@/lib/format";
import type { FuelRun } from "@/lib/types";

export function Costs() {
  const { s } = useApp();
  const t = totals(s);

  if (!s.entries.length) {
    return (
      <Panel title="Costs">
        <Empty title="No numbers yet">
          Log a fuel fill or an expense and the running costs build themselves.
        </Empty>
      </Panel>
    );
  }

  const months = monthlySpend(s, 12);
  const maxM = Math.max(...months.map(m => m.total), 1);
  const peak = months.reduce((a, m) => (m.total > a.total ? m : a), months[0]);
  const first = months[0], last = months[months.length - 1];
  const sum12 = months.reduce((a, m) => a + m.total, 0);
  const span = entrySpan(s);
  const thisYear = String(new Date().getFullYear());

  const cats = Object.entries(t.byCat)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxC = cats.length ? cats[0][1] : 1;

  const runs = fuelRuns(s);
  const years = yearlySpend(s);
  const saved = fuelSavings(s);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="stats sm:grid-cols-4">
        <Stat v={money0(t.total)} k="Total spent" />
        <Stat v={`${km(t.dist)} km`} k="Distance tracked" />
        <Stat v={t.perKm ? `$${t.perKm.toFixed(3)}` : "—"} k="Cost per km" />
        <Stat v={t.kmpl ? t.kmpl.toFixed(1) : "—"} k="km / litre" />
      </div>
      {span && (
        <p className="dated">
          All figures cover your entries from <b>{dmy(span.from)}</b> to <b>{dmy(span.to)}</b>.
        </p>
      )}

      <Panel title="Last 12 months" note={`${first.lab} ${first.year} – ${last.lab} ${last.year}`}>
        <div className="bars">
          {months.map(m => (
            <div className="bars__col" key={m.key} title={`${m.lab} ${m.year} · ${money(m.total)}`}>
              <div className={m === last ? "bars__fill bars__fill--now" : "bars__fill"}
                   style={{ height: `${Math.max(2, (m.total / maxM) * 100)}%` }} />
            </div>
          ))}
        </div>
        {/* The year sits under the first bar and under each January, so a bar
            can always be placed in its year without crowding twelve labels. */}
        <div className="flex gap-1">
          {months.map((m, i) => (
            <div className="bars__col" key={m.key}>
              <div className="bars__lab">{m.lab}</div>
              <div className="bars__yr">{i === 0 || m.lab === "Jan" ? `’${String(m.year).slice(2)}` : "\u00a0"}</div>
            </div>
          ))}
        </div>
        <p className="field__h">
          {sum12 > 0
            ? `Highest month: ${peak.lab} ${peak.year} at ${money0(peak.total)}. Average ${money0(sum12 / 12)} a month over the twelve.`
            : "Nothing logged in these twelve months."}
        </p>
      </Panel>

      <Panel title="Where it goes" note={`${cats.length} categories`}>
        <ul>
          {cats.map(([k, v]) => (
            <li key={k} className="py-[9px] border-b last:border-b-0" style={{ borderColor: "var(--rule-2)" }}>
              <div className="flex justify-between items-baseline gap-[10px] mb-[5px]">
                <span className="split__k">{k}</span>
                <span className="split__v">
                  {money(v)}<small>{t.total > 0 ? ((v / t.total) * 100).toFixed(0) : 0}%</small>
                </span>
              </div>
              <div className="split__track">
                <div className="split__bar" style={{ width: `${(v / maxC) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {years.length > 0 && (
        <Panel title="Year by year" note={`${years.length} ${years.length === 1 ? "year" : "years"}`}>
          <div className="overflow-x-auto">
            <table className="years">
              <thead>
                <tr><th>Year</th><th>Total</th><th>Fuel</th><th>Service</th><th>Other</th><th>km</th></tr>
              </thead>
              <tbody>
                {years.map(y => (
                  <tr key={y.year}>
                    <th>{y.year}{y.year === thisYear && <small>so far</small>}</th>
                    <td><b>{money0(y.total)}</b></td>
                    <td>{money0(y.fuel)}</td>
                    <td>{money0(y.service)}</td>
                    <td>{money0(y.other)}</td>
                    <td>{y.km ? km(y.km) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field__h">
            Distance is the spread of odometer readings on that year's entries, so a year with few
            readings shows less than you rode.
            {saved > 0 && ` Fuel cards have saved you ${money(saved)} on this bike so far.`}
          </p>
        </Panel>
      )}

      {runs.length >= 2 ? <FuelPanel runs={runs} avg={t.kmpl} perL={t.perL} /> : (
        <Panel title="Fuel economy">
          <Empty title="Needs two full tanks">
            Economy is measured full-to-full. Tick <b className="inline">Filled to full</b> on your
            fills and the first figure appears after the second one.
          </Empty>
        </Panel>
      )}
    </div>
  );
}

function FuelPanel({ runs, avg, perL }: { runs: FuelRun[]; avg: number; perL: number }) {
  const vals = runs.map(r => r.kmpl);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const span = (mx - mn) || 1;
  // Spaced by the date of each fill, not evenly: a long gap between fills shows as one.
  const pos = runPositions(runs);
  const x = (i: number) => pos[i] * 100;
  const best = runs[vals.indexOf(mx)], worst = runs[vals.indexOf(mn)];
  const firstRun = runs[0], lastRun = runs[runs.length - 1];
  const y = (v: number) => 56 - ((v - mn) / span) * 48;
  const pts = vals.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const area = `0,60 ${pts.join(" ")} 100,60`;
  const lastI = vals.length - 1;

  return (
    <Panel title="Fuel economy" note={`${runs.length} full-to-full runs`}>
      <svg className="w-full h-16 block overflow-visible" viewBox="0 0 100 60"
           preserveAspectRatio="none" aria-hidden="true">
        <polygon className="spark__area" points={area} />
        <polyline className="spark__line" points={pts.join(" ")} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* endpoint marker, drawn outside the stretched viewBox so it stays round */}
      <div className="relative h-0">
        <span className="absolute w-[7px] h-[7px] rounded-full -translate-x-1/2"
              style={{ background: "var(--brand)", left: `${x(lastI)}%`,
                       top: `${(y(vals[lastI]) / 60) * 64 - 64 - 3.5}px` }} />
      </div>
      <div className="axis">
        <span>{dmy(firstRun.to.date)}</span>
        <span>{dmy(lastRun.to.date)}</span>
      </div>
      <div className="stats sm:grid-cols-4 mt-3">
        <Stat v={avg.toFixed(1)} k="Average km/L" />
        <Stat v={mx.toFixed(1)} k={`Best · ${dmyShort(best.to.date)}`} />
        <Stat v={mn.toFixed(1)} k={`Worst · ${dmyShort(worst.to.date)}`} />
        <Stat v={`$${perL.toFixed(3)}`} k="Avg per litre" />
      </div>
      <p className="field__h">Each point is a full tank, placed at the date it was filled.</p>
    </Panel>
  );
}
