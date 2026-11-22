import { Fuel, Paperclip, Receipt, Wrench } from "lucide-react";
import type { Entry, State } from "@/lib/types";
import { dmy, money, km, num } from "@/lib/format";

/** One line in the log. Fuel rows carry their full-to-full economy when known. */
export function EntryRow({
  e, s, kmpl, onEdit,
}: {
  e: Entry; s: State; kmpl?: number; onEdit: (e: Entry) => void;
}) {
  const meta: string[] = [];
  let title: string;

  if (e.type === "fuel") {
    title = e.station || "Fuel";
    if (num(e.litres)) meta.push(`${num(e.litres).toFixed(2)} L`);
    if (num(e.litres) && num(e.amount)) meta.push(`$${(num(e.amount) / num(e.litres)).toFixed(3)}/L`);
    if (!e.full) meta.push("part tank");
  } else if (e.type === "service") {
    const names = (e.items || [])
      .map(id => s.schedule.find(x => x.id === id)?.n)
      .filter((x): x is string => Boolean(x));
    title = e.label || names.slice(0, 2).join(", ") || "Service";
    if (names.length > 2) meta.push(`+${names.length - 2} more`);
    if (e.shop) meta.push(e.shop);
  } else {
    title = e.cat || "Expense";
    if (e.note) meta.push(e.note);
  }

  if (num(e.odo)) meta.unshift(`${km(e.odo)} km`);
  meta.unshift(e.date ? dmy(e.date) : "No date");
  if (e.type !== "expense" && e.note) meta.push(e.note);

  return (
    <li>
      <button className="entry" onClick={() => onEdit(e)}>
        {/* Whole class names, never assembled: Tailwind drops any it can't read in the source. */}
        {e.type === "fuel" ? <span className="entry__ic entry__ic--fuel"><Fuel size={20} /></span>
          : e.type === "service" ? <span className="entry__ic entry__ic--service"><Wrench size={20} /></span>
          : <span className="entry__ic"><Receipt size={20} /></span>}
        <span className="min-w-0">
          <span className="entry__title">
            {title}
            {e.photos?.length ? <span className="entry__clip" title="Has a receipt photo"><Paperclip size={13} /></span> : null}
          </span>
          {meta.length > 0 && <span className="entry__meta">{meta.join(" · ")}</span>}
        </span>
        <span className="entry__amt">
          {money(num(e.amount))}
          {kmpl !== undefined && <small>{kmpl.toFixed(1)} km/L</small>}
        </span>
      </button>
    </li>
  );
}
