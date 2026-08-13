import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { AppCtx, type Api, type Tab, type SheetKind } from "@/lib/ctx";
import { THEME_KEY } from "@/lib/store";
import { load, loadSync, save, requestPersistence } from "@/lib/storage";
import { watchForUpdate } from "@/lib/updates";
import { syncReminders } from "@/lib/reminders";
import type { State, Entry, FuelEntry, ServiceEntry, ExpenseEntry } from "@/lib/types";
import { Dash } from "@/views/Dash";
import { LogView } from "@/views/LogView";
import { Costs } from "@/views/Costs";
import { BikeView } from "@/views/BikeView";
import { OdoSheet, FuelSheet, ServiceSheet, ExpenseSheet } from "@/components/Sheets";
import { NearestFuel } from "@/components/NearestFuel";

const TABS: { id: Tab; label: string }[] = [
  { id: "dash", label: "Dash" },
  { id: "log", label: "Log" },
  { id: "costs", label: "Costs" },
  { id: "bike", label: "Bike" },
];

/**
 * The web reads its book synchronously, so `initial` is already populated on the
 * very first render and nothing flashes. Native storage is async, so there the
 * first render has nothing and we wait — which is why Book is a separate
 * component: it can take the loaded state as a prop and keep its hooks simple.
 */
export default function App() {
  const [initial, setInitial] = useState<State | null>(() => loadSync());

  useEffect(() => {
    if (initial) return;
    let live = true;
    load().then(v => { if (live) setInitial(v); });
    return () => { live = false; };
  }, [initial]);

  if (!initial) {
    return (
      <div className="app">
        <div className="wrap" style={{ paddingTop: 40 }}>
          <span className="eyebrow">Moto Log</span>
        </div>
      </div>
    );
  }
  return <Book initial={initial} />;
}

function Book({ initial }: { initial: State }) {
  const ref = useRef<State>(initial);
  const [s, setS] = useState<State>(initial);
  const [tab, setTab] = useState<Tab>("dash");
  const [sheet, setSheet] = useState<{ kind: SheetKind; entry?: Entry }>({ kind: null });
  const [msg, setMsg] = useState<{ n: number; text: string } | null>(null);
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem(THEME_KEY) || ""; } catch { return ""; }
  });

  useEffect(() => {
    const el = document.documentElement;
    if (theme) el.setAttribute("data-theme", theme);
    else el.removeAttribute("data-theme");
    const isDark = theme === "dark" ||
      (!theme && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    el.classList.toggle("dark", Boolean(isDark));
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  }, [theme]);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(id);
  }, [msg]);

  // Rescheduled from scratch whenever the book changes. No-op on the web.
  useEffect(() => { void syncReminders(s); }, [s]);

  // Ask once per launch to have this data exempted from eviction. Silent either
  // way — it can only improve on the default, and nothing depends on it.
  useEffect(() => { void requestPersistence(); }, []);

  // setState with a function argument would call it; wrap so we store it.
  useEffect(() => { watchForUpdate(apply => setApplyUpdate(() => apply)); }, []);

  // Home-screen shortcuts land on ?add=fuel etc. Open that sheet, then drop the
  // query so a refresh doesn't reopen it.
  useEffect(() => {
    const add = new URLSearchParams(window.location.search).get("add");
    if (add === "fuel" || add === "service" || add === "expense") {
      setSheet({ kind: add });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const toast = (text: string) => setMsg(m => ({ n: (m?.n ?? 0) + 1, text }));

  const persist = (next: State) => {
    save(next).then(ok => {
      if (!ok) toast("Couldn't save — storage is full or blocked.");
    });
  };

  const api: Api = {
    s,
    // clone-then-commit, so a StrictMode double-render can never double-apply
    update(fn) {
      const next = structuredClone(ref.current);
      fn(next);
      ref.current = next;
      persist(next);
      setS(next);
    },
    replace(next) {
      ref.current = next;
      persist(next);
      setS(next);
    },
    openSheet(kind, entry) { setSheet({ kind, entry }); },
    go(t) { setTab(t); window.scrollTo(0, 0); },
    toast,
  };

  const close = () => setSheet({ kind: null });
  const title = s.bike.name || [s.bike.year, s.bike.make, s.bike.model].filter(Boolean).join(" ");

  return (
    <AppCtx.Provider value={api}>
      <div className="app">
        <header className="wrap masthead">
          <div>
            <span className="eyebrow">Service &amp; running log</span>
            <h1 className="masthead__bike">{title || "Set up your bike"}</h1>
          </div>
          <div className="flex items-center gap-[10px] shrink-0">
            {s.bike.plate && <span className="plate">{s.bike.plate}</span>}
            <button
              className="themer"
              title={`Theme: ${theme || "system"}`}
              aria-label={`Switch theme, currently ${theme || "system"}`}
              onClick={() => setTheme(t => (t === "dark" ? "light" : t === "light" ? "" : "dark"))}
            >◐</button>
          </div>
        </header>

        <Tabs.Root value={tab} onValueChange={v => { setTab(v as Tab); window.scrollTo(0, 0); }}>
          <Tabs.List className="wrap tabs" aria-label="Sections">
            {TABS.map(t => (
              <Tabs.Trigger key={t.id} value={t.id} className="tab">{t.label}</Tabs.Trigger>
            ))}
          </Tabs.List>

          <main className="wrap pt-5">
            <Tabs.Content value="dash"><Dash /></Tabs.Content>
            <Tabs.Content value="log"><LogView /></Tabs.Content>
            <Tabs.Content value="costs"><Costs /></Tabs.Content>
            <Tabs.Content value="bike"><BikeView /></Tabs.Content>
          </main>
        </Tabs.Root>

        <footer className="wrap colophon mt-7">
          <span>Saved on this device · SGD · km</span>
          <span>{s.entries.length} {s.entries.length === 1 ? "entry" : "entries"}</span>
        </footer>
      </div>

      {sheet.kind === "odo" && <OdoSheet onClose={close} />}
      {sheet.kind === "fuel" && <FuelSheet entry={sheet.entry as FuelEntry | undefined} onClose={close} />}
      {sheet.kind === "service" && <ServiceSheet entry={sheet.entry as ServiceEntry | undefined} onClose={close} />}
      {sheet.kind === "expense" && <ExpenseSheet entry={sheet.entry as ExpenseEntry | undefined} onClose={close} />}
      {sheet.kind === "nearest" && <NearestFuel onClose={close} />}

      {applyUpdate && (
        <div className="update" role="status">
          <span className="update__bulb" />
          <span className="update__text">A newer version is ready.</span>
          <button className="btn btn--sm" onClick={applyUpdate}>Reload</button>
        </div>
      )}

      {msg && (
        <div role="status"
             className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[90] rounded px-4 py-[11px]
                        text-[13px] max-w-[calc(100vw-32px)] shadow-lg"
             style={{ background: "var(--metal)", color: "var(--face)", fontFamily: "var(--mono)" }}>
          {msg.text}
        </div>
      )}
    </AppCtx.Provider>
  );
}
