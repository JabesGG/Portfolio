import type { Status } from "@/lib/types";

/** An instrument-cluster tell-tale. Colour is the only saturated ink on the page. */
export function Lamp({ name, st }: { name: string; st: Status }) {
  return (
    <li className={`lamp lamp--${st.level}`}>
      <span className="lamp__bulb" />
      <span className="flex-1 min-w-0">
        <span className="lamp__name">{name}</span>
        <span className="lamp__sub">{st.sub}</span>
      </span>
      <span className="lamp__val">{st.headline}</span>
    </li>
  );
}

export function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="stat">
      <span className="stat__v">{v}</span>
      <span className="stat__k">{k}</span>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}

export function Panel({
  title, note, children, action,
}: {
  title: string; note?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {action ?? (note ? <span className="panel__note">{note}</span> : null)}
      </div>
      {children}
    </section>
  );
}

export function QuickAdd({ onPick }: { onPick: (k: "fuel" | "service" | "expense") => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button className="qbtn" onClick={() => onPick("fuel")}><span>⛽</span>Fuel</button>
      <button className="qbtn" onClick={() => onPick("service")}><span>🔧</span>Service</button>
      <button className="qbtn" onClick={() => onPick("expense")}><span>🧾</span>Expense</button>
    </div>
  );
}

/** Separate from QuickAdd: this finds something rather than recording something. */
export function FindFuel({ onPick }: { onPick: () => void }) {
  return (
    <button className="qbtn qbtn--wide" onClick={onPick}>
      <span>📍</span>Nearest fuel
    </button>
  );
}
