import { useEffect, useRef, useState } from "react";
import { MON, dparts, todayISO } from "@/lib/format";

/**
 * A date control in the app's own idiom: the value reads "12 Aug 2026" rather
 * than 2026-08-12, and the two dates you actually pick most — today and
 * yesterday — are one tap rather than a calendar hunt.
 *
 * The calendar expands inline rather than floating. The sheets it lives in are
 * scroll containers, and an absolutely positioned popover gets clipped by them;
 * pushing the form down instead always works, on every screen size.
 */

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function iso(y: number, m: number, d: number): string {
  return `${y}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`;
}
function shiftDays(from: string, delta: number): string {
  const p = dparts(from) ?? dparts(todayISO())!;
  const d = new Date(p.y, p.m - 1, p.d + delta);
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
/** Monday-first index, because that is how a week reads here. */
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export function DateField({
  value, onChange, label, hint,
}: {
  value: string;
  onChange: (iso: string) => void;
  label: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const shown = dparts(value) ?? dparts(today)!;
  const [view, setView] = useState({ y: shown.y, m: shown.m });
  const gridRef = useRef<HTMLDivElement>(null);

  // Re-centre on the selected month each time it opens, not on every keystroke.
  useEffect(() => {
    if (!open) return;
    const p = dparts(value) ?? dparts(today)!;
    setView({ y: p.y, m: p.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const first = new Date(view.y, view.m - 1, 1);
  const lead = mondayIndex(first.getDay());
  const days = new Date(view.y, view.m, 0).getDate();

  const pick = (d: number) => {
    onChange(iso(view.y, view.m, d));
    setOpen(false);
  };

  const step = (months: number) => {
    const d = new Date(view.y, view.m - 1 + months, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };

  /** Arrow keys walk the grid; the month follows when you step off the edge. */
  function onGridKey(e: React.KeyboardEvent) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1
      : e.key === "ArrowDown" ? 7 : e.key === "ArrowUp" ? -7 : 0;
    if (!delta) return;
    e.preventDefault();
    const base = dparts(value) ?? dparts(today)!;
    const next = shiftDays(iso(base.y, base.m, base.d), delta);
    onChange(next);
    const p = dparts(next)!;
    setView({ y: p.y, m: p.m });
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>('[data-selected="true"]')?.focus();
    });
  }

  const pretty = value ? `${shown.d} ${MON[shown.m - 1]} ${shown.y}` : "Set a date";
  const isToday = value === today;
  const isYesterday = value === shiftDays(today, -1);

  // The field usually sits in a two-column row. Confined there the day cells come
  // out around 29px, which is too small to tap reliably, so an open calendar
  // takes the whole row back.
  return (
    <div className={`field-date mb-3${open ? " is-open" : ""}`}>
      <label className="field__l">{label}</label>

      <button
        type="button"
        className="datefield"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className={value ? "" : "datefield--empty"}>{pretty}</span>
        <span className="datefield__mark" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="cal" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } }}>
          <div className="cal__quick">
            <button type="button" className="toggle" aria-pressed={isToday}
                    onClick={() => { onChange(today); setOpen(false); }}>Today</button>
            <button type="button" className="toggle" aria-pressed={isYesterday}
                    onClick={() => { onChange(shiftDays(today, -1)); setOpen(false); }}>Yesterday</button>
          </div>

          <div className="cal__head">
            <button type="button" className="iconbtn" aria-label="Previous month" onClick={() => step(-1)}>‹</button>
            <span className="cal__month" aria-live="polite">{MON[view.m - 1]} {view.y}</span>
            <button type="button" className="iconbtn" aria-label="Next month" onClick={() => step(1)}>›</button>
          </div>

          <div className="cal__dow" aria-hidden="true">
            {DOW.map(d => <span key={d}>{d}</span>)}
          </div>

          <div className="cal__grid" ref={gridRef} onKeyDown={onGridKey} role="grid">
            {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const d = i + 1;
              const cell = iso(view.y, view.m, d);
              const selected = cell === value;
              return (
                <button
                  key={d}
                  type="button"
                  className="cal__day"
                  data-selected={selected}
                  data-today={cell === today}
                  aria-current={cell === today ? "date" : undefined}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => pick(d)}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hint && <p className="field__h">{hint}</p>}
    </div>
  );
}
