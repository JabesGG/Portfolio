import { useApp } from "@/lib/ctx";
import { Odometer } from "@/components/Odometer";
import { Lamp, Stat, Empty, Panel, QuickAdd, FindFuel } from "@/components/Lamp";
import { EntryRow } from "@/components/EntryRow";
import { statusOf, dateStatus, entriesSorted, totals, monthlySpend, fuelRuns } from "@/lib/calc";
import { money0 } from "@/lib/format";
import type { Status } from "@/lib/types";

export function Dash() {
  const { s, openSheet, go } = useApp();

  const lamps: { name: string; st: Status }[] = [
    ...s.schedule.map(it => ({ name: it.n, st: statusOf(s, it) })),
    ...s.dates.map(d => ({ name: d.n, st: dateStatus(d) })),
  ];
  const lit = lamps.filter(l => l.st.level === "red" || l.st.level === "amber")
                   .sort((a, b) => a.st.rank - b.st.rank);
  const clear = lamps.filter(l => l.st.level === "green");
  const unset = lamps.filter(l => l.st.level === "unset");

  const t = totals(s);
  const thisMonth = monthlySpend(s, 1)[0].total;
  const recent = entriesSorted(s).slice(0, 5);
  const runs = fuelRuns(s);
  const kmplById = new Map(runs.map(r => [r.to.id, r.kmpl]));

  return (
    <div className="grid gap-[14px] lg:grid-cols-[390px_1fr] items-start">
      <div className="flex flex-col gap-[14px]">
        <section className="cluster">
          <div className="flex justify-between items-baseline mb-[10px]">
            <span className="eyebrow">Odometer</span>
            <span className="panel__note">{s.bike.odo ? "tap to update" : "not set"}</span>
          </div>
          <Odometer value={s.bike.odo} onEdit={() => openSheet("odo")} />
          <p className="text-xs mt-[11px]" style={{ color: "var(--ink-3)" }}>
            Every interval below counts from this number.
          </p>
        </section>

        <Panel title="Log something">
          <QuickAdd onPick={k => openSheet(k)} />
          <div className="mt-2">
            <FindFuel onPick={() => openSheet("nearest")} />
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-[14px]">
        <Panel title="Tell-tales" note={lit.length ? `${lit.length} lit` : "all dark"}>
          {lit.length > 0 ? (
            <ul>{lit.map((l, i) => <Lamp key={i} name={l.name} st={l.st} />)}</ul>
          ) : clear.length > 0 ? (
            <Empty title="Nothing due">
              Every interval you&rsquo;ve set a baseline for is inside its window.
            </Empty>
          ) : (
            <Empty title="No baselines yet">
              Open <b className="inline">Bike</b> and set when each item was last done — that&rsquo;s
              what the lamps read from.
            </Empty>
          )}

          {(lit.length > 0 && (clear.length > 0 || unset.length > 0)) && (
            <div className="flex items-center gap-[9px] mt-3 pt-[11px] border-t text-[12.5px]"
                 style={{ borderColor: "var(--rule-2)", color: "var(--ink-2)" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--lamp-green)" }} />
              {clear.length > 0 && <span>{clear.length} in range</span>}
              {clear.length > 0 && unset.length > 0 && <span>·</span>}
              {unset.length > 0 && (
                <button className="linkish" onClick={() => go("bike")}>
                  {unset.length} without a baseline
                </button>
              )}
            </div>
          )}
        </Panel>

        <div className="stats sm:grid-cols-4">
          <Stat v={money0(t.total)} k="Total spent" />
          <Stat v={t.perKm ? `$${t.perKm.toFixed(3)}` : "—"} k="Per km" />
          <Stat v={t.kmpl ? t.kmpl.toFixed(1) : "—"} k="km / litre" />
          <Stat v={money0(thisMonth)} k="This month" />
        </div>

        {recent.length > 0 && (
          <Panel
            title="Latest"
            action={<button className="linkish" onClick={() => go("log")}>See all</button>}
          >
            <ul>
              {recent.map(e => (
                <EntryRow key={e.id} e={e} s={s} kmpl={kmplById.get(e.id)}
                          onEdit={en => openSheet(en.type, en)} />
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
