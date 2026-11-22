import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { ChartColumn, ChevronDown, House, LayoutGrid, List, Moon, Route, Settings, Sun, SunMoon, type LucideIcon } from "lucide-react";
import { AppCtx, type Api, type Tab, type SheetKind } from "@/lib/ctx";
import { THEME_KEY } from "@/lib/store";
import { load, loadSync, save, requestPersistence, storageReadOk } from "@/lib/storage";
import { watchForUpdate } from "@/lib/updates";
import { syncReminders } from "@/lib/reminders";
import { activeBook, bikeLabel, photoIds } from "@/lib/garage";
import { gcPhotos } from "@/lib/photos";
import { startCloud, noteLocalChange, useCloud } from "@/lib/cloud";
import { RecoverySheet } from "@/components/AccountPanel";
import { useRecorder } from "@/lib/recorder";
import type { Garage, Entry, FuelEntry, ServiceEntry, ExpenseEntry } from "@/lib/types";
import { Dash } from "@/views/Dash";
import { LogView } from "@/views/LogView";
import { Costs } from "@/views/Costs";
import { BikeView } from "@/views/BikeView";
import { RideView } from "@/views/RideView";
import { ToolsView } from "@/views/ToolsView";
import { OdoSheet, FuelSheet, ServiceSheet, ExpenseSheet } from "@/components/Sheets";
import { NearestFuel } from "@/components/NearestFuel";
import { Workshops } from "@/components/Workshops";
import { GarageSheet } from "@/components/GarageSheet";

/** The five places you go every day. Bike details and settings are a sixth,
 *  opened from the gear in the header — set up once, visited rarely, and five
 *  is what fits a thumb-reach bar without shrinking the targets. */
const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "dash", label: "Home", Icon: House },
  { id: "log", label: "Log", Icon: List },
  { id: "costs", label: "Costs", Icon: ChartColumn },
  { id: "ride", label: "Ride", Icon: Route },
  { id: "tools", label: "Tools", Icon: LayoutGrid },
];

/**
 * The web reads its garage synchronously, so `initial` is already populated on
 * the very first render and nothing flashes. Native storage is async, so there
 * the first render has nothing and we wait — which is why Book is a separate
 * component: it can take the loaded state as a prop and keep its hooks simple.
 */
export default function App() {
  const [initial, setInitial] = useState<Garage | null>(() => loadSync());

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

function Book({ initial }: { initial: Garage }) {
  const ref = useRef<Garage>(initial);
  const [g, setG] = useState<Garage>(initial);
  const [tab, setTab] = useState<Tab>("dash");
  const [sheet, setSheet] = useState<{ kind: SheetKind; entry?: Entry }>({ kind: null });
  const [msg, setMsg] = useState<{ n: number; text: string } | null>(null);
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem(THEME_KEY) || ""; } catch { return ""; }
  });
  // Bumped whenever the whole garage is swapped, so views drop drafts made
  // against records that are no longer there.
  const [epoch, setEpoch] = useState(0);
  const rec = useRecorder();
  const cloud = useCloud();

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

  // Rescheduled from scratch whenever the garage changes. No-op on the web.
  useEffect(() => { void syncReminders(g); }, [g]);

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

  const persist = (next: Garage) => {
    save(next).then(ok => {
      if (!ok) toast("Couldn't save — storage is full or blocked.");
    });
  };

  // Every change lands here. `synced` marks a copy that came from the account,
  // which must not be flagged as a local change and sent straight back.
  const commit = (next: Garage, synced = false) => {
    if (!synced) {
      next.updated = new Date().toISOString();
      noteLocalChange(ref.current, next);
    }
    ref.current = next;
    persist(next);
    setG(next);
  };

  // The account, if there is one: sync on launch and while the app is open.
  // Then tidy orphaned photos, a beat later so it never competes with first paint.
  useEffect(() => {
    const stop = startCloud({
      get: () => ref.current,
      set: (next, adopted) => { commit(next, true); if (adopted) setEpoch(e => e + 1); },
      toast,
    });
    const b = setTimeout(() => {
      if (storageReadOk()) void gcPhotos(photoIds(ref.current));
    }, 8000);
    return () => { stop(); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = activeBook(g);

  const api: Api = {
    s, g,
    // clone-then-commit, so a StrictMode double-render can never double-apply
    update(fn) {
      const next = structuredClone(ref.current);
      fn(activeBook(next));
      commit(next);
    },
    updateGarage(fn) {
      const next = structuredClone(ref.current);
      fn(next);
      commit(next);
    },
    replaceGarage(next, synced) { commit(next, synced); setEpoch(e => e + 1); },
    openSheet(kind, entry) { setSheet({ kind, entry }); },
    go(t) { setTab(t); window.scrollTo(0, 0); },
    toast,
  };

  const close = () => setSheet({ kind: null });
  const title = bikeLabel(s);
  const named = title !== "Unnamed bike";
  const recording = rec.status === "recording" || rec.status === "starting";

  return (
    <AppCtx.Provider value={api}>
      <div className="app">
        <header className="masthead">
          <div className="wrap masthead__in">
            <div className="min-w-0">
              {s.bike.plate
                ? <span className="plate">{s.bike.plate}</span>
                : <span className="eyebrow">Moto Log</span>}
              <button className="masthead__pick" onClick={() => setSheet({ kind: "garage" })}
                      aria-label={`${named ? title : "Set up your bike"} — switch bike`}>
                <h1 className="masthead__bike">{named ? title : "Set up your bike"}</h1>
                <span className="masthead__caret" aria-hidden="true"><ChevronDown size={20} strokeWidth={2.5} /></span>
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="themer"
                title={`Theme: ${theme || "system"}`}
                aria-label={`Switch theme, currently ${theme || "system"}`}
                onClick={() => setTheme(t => (t === "dark" ? "light" : t === "light" ? "" : "dark"))}
              >
                {theme === "dark" ? <Moon size={18} /> : theme === "light" ? <Sun size={18} /> : <SunMoon size={18} />}
              </button>
              <button
                className="themer"
                title="Bike details and settings"
                aria-label="Bike details and settings"
                aria-pressed={tab === "bike"}
                onClick={() => { setTab("bike"); window.scrollTo(0, 0); }}
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </header>

        <Tabs.Root value={tab} onValueChange={v => { setTab(v as Tab); window.scrollTo(0, 0); }}>
          <Tabs.List className="tabs" aria-label="Sections">
            {TABS.map(({ id, label, Icon }) => (
              <Tabs.Trigger key={id} value={id} className="tab">
                <span className="tab__ic">
                  <Icon size={21} strokeWidth={2.1} />
                  {id === "ride" && recording && <span className="tab__rec" aria-label="recording" />}
                </span>
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Keyed by bike, so drafts and filters never carry across a switch. */}
          <main className="wrap pt-5" key={`${s.id}:${epoch}`}>
            <Tabs.Content value="dash"><Dash /></Tabs.Content>
            <Tabs.Content value="log"><LogView /></Tabs.Content>
            <Tabs.Content value="costs"><Costs /></Tabs.Content>
            <Tabs.Content value="ride"><RideView /></Tabs.Content>
            <Tabs.Content value="tools"><ToolsView /></Tabs.Content>
            <Tabs.Content value="bike"><BikeView /></Tabs.Content>
          </main>
        </Tabs.Root>

        <footer className="wrap colophon mt-8">
          <span>{cloud.status === "signed-in" ? "Synced to your account" : "Saved on this device"} · SGD · km</span>
          <span>
            {g.bikes.length > 1 && `${g.bikes.length} bikes · `}
            {s.entries.length} {s.entries.length === 1 ? "entry" : "entries"}
          </span>
        </footer>
      </div>

      {sheet.kind === "odo" && <OdoSheet onClose={close} />}
      {sheet.kind === "fuel" && <FuelSheet entry={sheet.entry as FuelEntry | undefined} onClose={close} />}
      {sheet.kind === "service" && <ServiceSheet entry={sheet.entry as ServiceEntry | undefined} onClose={close} />}
      {sheet.kind === "expense" && <ExpenseSheet entry={sheet.entry as ExpenseEntry | undefined} onClose={close} />}
      {sheet.kind === "nearest" && <NearestFuel onClose={close} />}
      {sheet.kind === "workshops" && <Workshops onClose={close} />}
      {sheet.kind === "garage" && <GarageSheet onClose={close} />}
      {cloud.recovery && <RecoverySheet />}

      {applyUpdate && (
        <div className="update" role="status">
          <span className="update__bulb" />
          <span className="update__text">A newer version is ready.</span>
          <button className="btn btn--sm" onClick={applyUpdate}>Reload</button>
        </div>
      )}

      {msg && (
        <div role="status" className="toast">{msg.text}</div>
      )}
    </AppCtx.Provider>
  );
}
