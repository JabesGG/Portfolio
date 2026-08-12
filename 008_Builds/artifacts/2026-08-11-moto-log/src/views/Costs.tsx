import { useApp } from "@/lib/ctx";
import { Panel, Stat, Empty } from "@/components/Lamp";
import { totals, monthlySpend, fuelRuns } from "@/lib/calc";
import { money, money0, km } from "@/lib/format";

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

  const cats = Object.entries(t.byCat)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxC = cats.length ? cats[0][1] : 1;

  const runs = fuelRuns(s);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="stats sm:grid-cols-4">
        <Stat v={money0(t.total)} k="Total spent" />
        <Stat v={`${km(t.dist)} km`} k="Distance tracked" />
        <Stat v={t.perKm ? `$${t.perKm.toFixed(3)}` : "—"} k="Cost per km" />
        <Stat v={t.kmpl ? t.kmpl.toFixed(1) : "—"} k="km / litre" />
      </div>

      <Panel title="Last 12 months" note={`peak ${money0(maxM)}`}>
        <div className="bars">
          {months.map(m => (
            <div className="bars__col" key={m.key} title={`${m.key} ${money(m.total)}`}>
              <div className="bars__fill" style={{ height: `${Math.max(2, (m.total / maxM) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {months.map(m => <div className="bars__col" key={m.key}><div className="bars__lab">{m.lab}</div></div>)}
        </div>
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

function FuelPanel({ runs, avg, perL }: { runs: { kmpl: number }[]; avg: number; perL: number }) {
  const vals = runs.map(r => r.kmpl);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const span = (mx - mn) || 1;
  const x = (i: number) => (vals.length > 1 ? (i / (vals.length - 1)) * 100 : 50);
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
              style={{ background: "var(--ink)", left: `${x(lastI)}%`,
                       top: `${(y(vals[lastI]) / 60) * 64 - 64 - 3.5}px` }} />
      </div>
      <div className="stats sm:grid-cols-4 mt-3">
        <Stat v={avg.toFixed(1)} k="Average km/L" />
        <Stat v={mx.toFixed(1)} k="Best run" />
        <Stat v={mn.toFixed(1)} k="Worst run" />
        <Stat v={`$${perL.toFixed(3)}`} k="Avg per litre" />
      </div>
    </Panel>
  );
}
