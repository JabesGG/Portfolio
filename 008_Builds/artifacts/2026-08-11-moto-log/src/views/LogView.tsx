import { useState } from "react";
import { useApp } from "@/lib/ctx";
import { Panel, Empty, QuickAdd } from "@/components/Lamp";
import { EntryRow } from "@/components/EntryRow";
import { entriesSorted, fuelRuns } from "@/lib/calc";
import type { EntryType } from "@/lib/types";

type Filter = "all" | EntryType;
const FILTERS: Filter[] = ["all", "fuel", "service", "expense"];

export function LogView() {
  const { s, openSheet } = useApp();
  const [filter, setFilter] = useState<Filter>("all");

  const all = entriesSorted(s);
  const list = filter === "all" ? all : all.filter(e => e.type === filter);
  const kmplById = new Map(fuelRuns(s).map(r => [r.to.id, r.kmpl]));

  return (
    <Panel title="Every entry" note={`${list.length} shown`}>
      <div className="mb-[14px]">
        <QuickAdd onPick={k => openSheet(k)} />
      </div>

      <div className="flex gap-[6px] mb-3 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {list.length > 0 ? (
        <ul>
          {list.map(e => (
            <EntryRow key={e.id} e={e} s={s} kmpl={kmplById.get(e.id)}
                      onEdit={en => openSheet(en.type, en)} />
          ))}
        </ul>
      ) : (
        <Empty title="Nothing here yet">
          Use the buttons above to add your first entry. Tap any entry later to edit or delete it.
        </Empty>
      )}
    </Panel>
  );
}
