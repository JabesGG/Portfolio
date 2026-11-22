import type { State } from "./types";

/**
 * The AI mechanic. Unlike everything else in the app this needs the network and
 * a server: the question goes to a small function on this site, which adds the
 * API key and forwards it. The key never reaches the phone.
 *
 * Only what is listed in `bikeContext` is sent with a question — no records,
 * no costs, no location.
 */
export const AI_URL = "/api/moto-ai";

/**
 * Parked. The AI mechanic is written (this file, AskPanel, server/moto-ai.mjs)
 * but not switched on: while this is false the Tools tab does not offer it and
 * the app never calls AI_URL. To bring it back, set this to true, deploy
 * server/moto-ai.mjs to netlify/functions/, and give the site an API key.
 */
export const AI_ENABLED: boolean = false;

export interface ChatMsg { role: "user" | "assistant"; content: string; }

export interface BikeContext { make: string; model: string; year: string; odo: number; }

export function bikeContext(s: State): BikeContext {
  return { make: s.bike.make, model: s.bike.model, year: s.bike.year, odo: Math.round(s.bike.odo || 0) };
}

export type AiStatus = "ready" | "not-configured" | "unavailable";

export async function aiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch(AI_URL, { method: "GET", cache: "no-store" });
    const j = (await res.json()) as { configured?: boolean };
    if (!res.ok) return "unavailable";
    return j.configured ? "ready" : "not-configured";
  } catch { return "unavailable"; }
}

export type AskResult = { ok: true; text: string } | { ok: false; why: string };

export async function ask(messages: ChatMsg[], bike: BikeContext): Promise<AskResult> {
  let res: Response;
  try {
    res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-12), bike }),
    });
  } catch {
    return { ok: false, why: "No connection. The AI mechanic needs the internet." };
  }
  let j: { text?: string; error?: string } | null = null;
  try { j = (await res.json()) as { text?: string; error?: string }; } catch { /* not ours */ }
  if (res.status === 429) return { ok: false, why: "Too many questions in a short time. Give it a minute." };
  if (!res.ok || !j?.text) {
    const why = j?.error === "not_configured" ? "The AI mechanic is not switched on for this site yet."
      : "The AI mechanic could not answer just now. Try again in a moment.";
    return { ok: false, why };
  }
  return { ok: true, text: j.text };
}
