import { createContext, useContext } from "react";
import type { State, Book, Garage, Entry } from "./types";

export type Tab = "dash" | "log" | "costs" | "ride" | "tools" | "bike";
export type SheetKind = "odo" | "fuel" | "service" | "expense" | "nearest" | "workshops" | "garage" | null;

export interface Api {
  /** The bike you are looking at. Every view reads and writes this one. */
  s: Book;
  /** The whole garage: every bike, plus rider-level settings. */
  g: Garage;
  /** Mutate a structural clone of the active bike, then persist. Safe under StrictMode. */
  update(fn: (draft: State) => void): void;
  /** Mutate a clone of the whole garage — switching bikes, settings, adding a bike. */
  updateGarage(fn: (draft: Garage) => void): void;
  /** Swap in a whole garage: restore or erase.
   *  Pass `synced` for a copy that came from the account, so it is not sent back. */
  replaceGarage(next: Garage, synced?: boolean): void;
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
