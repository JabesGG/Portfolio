import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/ctx";
import { EXPENSE_CATS, uid } from "@/lib/store";
import { num, todayISO } from "@/lib/format";
import type { Entry, FuelEntry, ServiceEntry, ExpenseEntry } from "@/lib/types";

/* ---------- shared shell ---------- */

function Shell({
  title, onClose, onSubmit, submitLabel, onDelete, children,
}: {
  title: string; onClose: () => void; onSubmit: () => void;
  submitLabel: string; onDelete?: () => void; children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-[520px] gap-0 p-0 rounded-[6px] max-h-[92vh] overflow-y-auto"
        style={{ background: "var(--card-c)", borderColor: "var(--rule)" }}
      >
        <form
          className="p-[18px]"
          onSubmit={e => { e.preventDefault(); onSubmit(); }}
        >
          <div className="flex items-center justify-between gap-3 mb-4 pb-[11px] border-b-2"
               style={{ borderColor: "var(--ink)" }}>
            <DialogTitle className="sheet__title">{title}</DialogTitle>
          </div>

          {children}

          <div className="flex gap-2 mt-[18px] pt-[14px] border-t" style={{ borderColor: "var(--rule-2)" }}>
            {onDelete && (
              <button type="button" className="btn btn--danger" onClick={onDelete}>Delete</button>
            )}
            <button type="submit" className="btn flex-1">{submitLabel}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="field__l">{label}</label>
      {children}
      {hint && <p className="field__h">{hint}</p>}
    </div>
  );
}

/* ---------- odometer ---------- */

export function OdoSheet({ onClose }: { onClose: () => void }) {
  const { s, update, toast } = useApp();
  const [v, setV] = useState(String(s.bike.odo || ""));

  return (
    <Shell
      title="Odometer"
      onClose={onClose}
      submitLabel="Update"
      onSubmit={() => {
        update(d => {
          d.bike.odo = Math.max(0, Math.round(num(v)));
          if (!d.bike.startOdo) d.bike.startOdo = d.bike.odo;
        });
        onClose();
        toast("Odometer updated.");
      }}
    >
      <Field label="Reading now (km)"
             hint="Round to the whole kilometre — it only needs to be close enough to keep the intervals honest.">
        <input className="inp text-2xl tracking-wider" inputMode="numeric" autoFocus
               value={v} onChange={e => setV(e.target.value)} />
      </Field>
    </Shell>
  );
}

/* ---------- fuel ---------- */

export function FuelSheet({ entry, onClose }: { entry?: FuelEntry; onClose: () => void }) {
  const { s, update, toast } = useApp();
  const [date, setDate] = useState(entry?.date || todayISO());
  const [odo, setOdo] = useState(String(entry?.odo || s.bike.odo || ""));
  const [litres, setLitres] = useState(String(entry?.litres || ""));
  const [amount, setAmount] = useState(String(entry?.amount || ""));
  const [station, setStation] = useState(entry?.station || "");
  const [full, setFull] = useState(entry ? entry.full : true);
  const [note, setNote] = useState(entry?.note || "");

  const L = num(litres), a = num(amount);
  const rate = L > 0 && a > 0 ? `$${(a / L).toFixed(3)} per litre` : "Enter both to see the pump price";

  return (
    <Shell
      title={entry ? "Edit fuel" : "Log fuel"}
      onClose={onClose}
      submitLabel={entry ? "Save" : "Log fuel"}
      onDelete={entry ? () => deleteEntry(entry.id) : undefined}
      onSubmit={() => {
        if (!L && !a) { toast("Add litres or an amount first."); return; }
        const next: FuelEntry = {
          id: entry?.id || uid(), type: "fuel", date: date || todayISO(),
          odo: num(odo), litres: L, amount: a, station, full, note,
        };
        commit(next);
      }}
    >
      <div className="grid grid-cols-2 gap-[10px]">
        <Field label="Date">
          <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Odometer">
          <input className="inp" inputMode="numeric" value={odo} onChange={e => setOdo(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-[10px]">
        <Field label="Litres">
          <input className="inp" inputMode="decimal" placeholder="8.42"
                 value={litres} onChange={e => setLitres(e.target.value)} />
        </Field>
        <Field label="Paid">
          <input className="inp" inputMode="decimal" placeholder="22.30"
                 value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
      </div>
      <p className="field__h -mt-1 mb-3">{rate}</p>

      <Field label="Station">
        <input className="inp" placeholder="Shell Bukit Timah"
               value={station} onChange={e => setStation(e.target.value)} />
      </Field>

      <div className="mb-3 flex items-center gap-3">
        <Switch id="full" checked={full} onCheckedChange={setFull} />
        <label htmlFor="full" className="field__l !mb-0 cursor-pointer">Filled to full</label>
      </div>
      <p className="field__h -mt-2 mb-3">
        km/L is measured full tank to full tank, so leave this on unless you stopped early.
      </p>

      <Field label="Note">
        <input className="inp" value={note} onChange={e => setNote(e.target.value)} />
      </Field>
    </Shell>
  );

  function commit(next: Entry) { save(next); }
  function save(next: Entry) {
    update(d => {
      const i = d.entries.findIndex(x => x.id === next.id);
      if (i >= 0) d.entries[i] = next; else d.entries.push(next);
      if (num(next.odo) > num(d.bike.odo)) d.bike.odo = Math.round(num(next.odo));
      if (!d.bike.startOdo) d.bike.startOdo = Math.round(num(next.odo));
    });
    onClose();
    toast(entry ? "Fuel saved." : "Fuel logged.");
  }
  function deleteEntry(id: string) {
    if (!confirm("Delete this entry? It can't be undone.")) return;
    update(d => { d.entries = d.entries.filter(x => x.id !== id); });
    onClose();
    toast("Entry deleted.");
  }
}

/* ---------- service ---------- */

export function ServiceSheet({ entry, onClose }: { entry?: ServiceEntry; onClose: () => void }) {
  const { s, update, toast } = useApp();
  const [date, setDate] = useState(entry?.date || todayISO());
  const [odo, setOdo] = useState(String(entry?.odo || s.bike.odo || ""));
  const [items, setItems] = useState<string[]>(entry?.items || []);
  const [amount, setAmount] = useState(String(entry?.amount || ""));
  const [shop, setShop] = useState(entry?.shop || "");
  const [label, setLabel] = useState(entry?.label || "");
  const [note, setNote] = useState(entry?.note || "");

  const toggle = (id: string) =>
    setItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Shell
      title={entry ? "Edit service" : "Log service"}
      onClose={onClose}
      submitLabel={entry ? "Save" : "Log service"}
      onDelete={entry ? () => {
        if (!confirm("Delete this entry? It can't be undone.")) return;
        update(d => { d.entries = d.entries.filter(x => x.id !== entry.id); });
        onClose(); toast("Entry deleted.");
      } : undefined}
      onSubmit={() => {
        if (!items.length && !label.trim()) { toast("Pick what was done, or name the job."); return; }
        const next: ServiceEntry = {
          id: entry?.id || uid(), type: "service", date: date || todayISO(),
          odo: num(odo), items, amount: num(amount), shop, label, note,
        };
        update(d => {
          const i = d.entries.findIndex(x => x.id === next.id);
          if (i >= 0) d.entries[i] = next; else d.entries.push(next);
          if (num(next.odo) > num(d.bike.odo)) d.bike.odo = Math.round(num(next.odo));
          if (!d.bike.startOdo) d.bike.startOdo = Math.round(num(next.odo));
        });
        onClose();
        toast(entry ? "Service saved." : "Service logged.");
      }}
    >
      <div className="grid grid-cols-2 gap-[10px]">
        <Field label="Date">
          <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Odometer">
          <input className="inp" inputMode="numeric" value={odo} onChange={e => setOdo(e.target.value)} />
        </Field>
      </div>

      <div className="mb-3">
        <span className="field__l">What was done</span>
        <div className="flex flex-wrap gap-[6px]">
          {s.schedule.map(it => (
            <button key={it.id} type="button" className="toggle"
                    aria-pressed={items.includes(it.id)} onClick={() => toggle(it.id)}>
              {it.n}
            </button>
          ))}
        </div>
        <p className="field__h">Ticking an item restarts its interval from this date and reading.</p>
      </div>

      <div className="grid grid-cols-2 gap-[10px]">
        <Field label="Paid">
          <input className="inp" inputMode="decimal" placeholder="185.00"
                 value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
        <Field label="Workshop">
          <input className="inp" value={shop} onChange={e => setShop(e.target.value)} />
        </Field>
      </div>

      <Field label="Call it something (optional)">
        <input className="inp" placeholder="Major service"
               value={label} onChange={e => setLabel(e.target.value)} />
      </Field>
      <Field label="Note">
        <textarea className="inp min-h-[60px] resize-y" style={{ fontFamily: "var(--body)" }}
                  value={note} onChange={e => setNote(e.target.value)} />
      </Field>
    </Shell>
  );
}

/* ---------- expense ---------- */

export function ExpenseSheet({ entry, onClose }: { entry?: ExpenseEntry; onClose: () => void }) {
  const { update, toast } = useApp();
  const [date, setDate] = useState(entry?.date || todayISO());
  const [amount, setAmount] = useState(String(entry?.amount || ""));
  const [cat, setCat] = useState(entry?.cat || EXPENSE_CATS[0]);
  const [odo, setOdo] = useState(String(entry?.odo || ""));
  const [note, setNote] = useState(entry?.note || "");

  return (
    <Shell
      title={entry ? "Edit expense" : "Log expense"}
      onClose={onClose}
      submitLabel={entry ? "Save" : "Log expense"}
      onDelete={entry ? () => {
        if (!confirm("Delete this entry? It can't be undone.")) return;
        update(d => { d.entries = d.entries.filter(x => x.id !== entry.id); });
        onClose(); toast("Entry deleted.");
      } : undefined}
      onSubmit={() => {
        if (!num(amount)) { toast("Enter an amount."); return; }
        const next: ExpenseEntry = {
          id: entry?.id || uid(), type: "expense", date: date || todayISO(),
          odo: num(odo), cat, amount: num(amount), note,
        };
        update(d => {
          const i = d.entries.findIndex(x => x.id === next.id);
          if (i >= 0) d.entries[i] = next; else d.entries.push(next);
        });
        onClose();
        toast(entry ? "Expense saved." : "Expense logged.");
      }}
    >
      <div className="grid grid-cols-2 gap-[10px]">
        <Field label="Date">
          <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Paid">
          <input className="inp" inputMode="decimal" placeholder="0.00"
                 value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
      </div>

      {/* native select: on a phone this opens the OS picker, which beats a custom listbox */}
      <Field label="Category">
        <select className="inp" style={{ fontFamily: "var(--body)" }}
                value={cat} onChange={e => setCat(e.target.value)}>
          {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Odometer (optional)">
        <input className="inp" inputMode="numeric" value={odo} onChange={e => setOdo(e.target.value)} />
      </Field>
      <Field label="Note">
        <input className="inp" value={note} onChange={e => setNote(e.target.value)} />
      </Field>
    </Shell>
  );
}
