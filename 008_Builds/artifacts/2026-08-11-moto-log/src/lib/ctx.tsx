import { createContext, useContext } from "react";
import type { State, Entry } from "./types";

export type Tab = "dash" | "log" | "costs" | "bike";
export type SheetKind = "odo" | "fuel" | "service" | "expense" | null;

export interface Api {
  s: State;
  /** Mutate a structural clone, then persist. Safe under StrictMode double-render. */
  update(fn: (draft: State) => void): void;
  replace(next: State): void;
  openSheet(kind: Exclude<SheetKind, null>, entry?: Entry): void;
  go(tab: Tab): void;
  toast(msg: string): void;
}

export const AppCtx = createContext<Api | null>(null);

export function useApp(): Api {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp must be used inside AppCtx.Provider");
  return v;
}
