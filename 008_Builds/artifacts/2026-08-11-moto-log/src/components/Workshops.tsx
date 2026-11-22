import { useState } from "react";
import { PlainSheet } from "./PlainSheet";
import { useApp } from "@/lib/ctx";
import { useFix } from "@/lib/locate";
import { prettyDistance } from "@/lib/stations";
import {
  WORKSHOPS, nearestWorkshops, telHref, waHref, mapsUrl, mapsSearchUrl, type Workshop,
} from "@/lib/workshops";
import { uid } from "@/lib/store";

type Filter = "all" | "repair" | "shop" | "mine";

/**
 * Workshops. Two lists: the ones OpenStreetMap knows about, which work offline
 * and can be sorted by distance, and the ones you save yourself — because the
 * mechanic you actually trust is rarely on a map.
 */
export function Workshops({ onClose }: { onClose: () => void }) {
  const { g, updateGarage, toast } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [phase, locate] = useFix();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", area: "", note: "" });

  const here = phase.k === "ok" ? phase : null;
  const base: (Workshop & { km?: number; dir?: string })[] = here
    ? nearestWorkshops(here.lat, here.lon)
    : WORKSHOPS;
  const list = base.filter(w => filter === "all" || w.kind === filter);
  const mine = g.prefs.myWorkshops;
  const far = here && nearestWorkshops(here.lat, here.lon)[0]?.km > 60;

  return (
    <PlainSheet title="Workshops" onClose={onClose}>
      <div className="flex gap-[6px] mb-3 flex-wrap">
        {([["all", "All"], ["repair", "Repair"], ["shop", "Dealers & parts"], ["mine", `Mine (${mine.length})`]] as const)
          .map(([k, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={filter === k}
                    onClick={() => setFilter(k)}>{label}</button>
          ))}
      </div>

      {filter !== "mine" && (
        <>
          {phase.k === "prime" && (
            <button type="button" className="btn btn--ghost btn--sm btn--full mb-2" onClick={locate}>
              Sort by distance from me
            </button>
          )}
          {phase.k === "locating" && <p className="field__h !mt-0 mb-2">Getting a location fix…</p>}
          {phase.k === "blocked" && (
            <p className="field__h !mt-0 mb-2">
              Location is blocked for this site, so the list is alphabetical. Allow Location in the
              site settings to sort by distance.
            </p>
          )}
          {phase.k === "failed" && (
            <p className="field__h !mt-0 mb-2">
              {phase.why}{" "}
              <button type="button" className="linkish" onClick={locate}>Try again</button>
            </p>
          )}
          {far && <p className="field__h !mt-0 mb-2">The list covers Singapore only.</p>}

          <ul className="stations">
            {list.map((w, i) => {
              const wa = w.phone ? waHref(w.phone) : null;
              return (
                <li key={`${w.name}-${i}`} className="shop">
                  <div className="shop__head">
                    <span className="station__dir" aria-hidden="true">{w.dir ?? (w.kind === "repair" ? "🔧" : "🏍")}</span>
                    <span className="station__body">
                      <span className="station__name">{w.name}</span>
                      <span className="station__brand">
                        {[w.kind === "repair" ? "Workshop" : "Dealer / parts", w.street, w.hours].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {w.km != null && <span className="station__km">{prettyDistance(w.km)}</span>}
                  </div>
                  <div className="shop__acts">
                    <a className="chip" href={mapsUrl(w.lat, w.lon)} target="_blank" rel="noopener noreferrer">Directions</a>
                    {w.phone && <a className="chip" href={telHref(w.phone)}>Call</a>}
                    {wa && <a className="chip" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                    {w.web && <a className="chip" href={w.web} target="_blank" rel="noopener noreferrer">Website</a>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="field__h">
            {list.length} places from OpenStreetMap, stored in the app so this works offline.
            Its coverage of Singapore bike shops is patchy and carries no ratings — save your own
            under <b>Mine</b>.{here ? " Distances are straight-line." : ""}
          </p>
        </>
      )}

      {filter === "mine" && (
        <>
          {mine.length === 0 && !adding && (
            <div className="empty !border-t-0 !pt-0">
              <b>None saved yet</b>
              Save the workshops you actually use, with a number to call. They also appear as
              suggestions when you log a service.
            </div>
          )}
          <ul className="stations">
            {mine.map(w => {
              const wa = w.phone ? waHref(w.phone) : null;
              return (
                <li key={w.id} className="shop">
                  <div className="shop__head">
                    <span className="station__dir" aria-hidden="true">★</span>
                    <span className="station__body">
                      <span className="station__name">{w.name}</span>
                      <span className="station__brand">{[w.area, w.phone, w.note].filter(Boolean).join(" · ")}</span>
                    </span>
                    <button type="button" className="iconbtn" aria-label={`Remove ${w.name}`}
                            onClick={() => {
                              if (!confirm(`Remove “${w.name}” from your workshops?`)) return;
                              updateGarage(d => { d.prefs.myWorkshops = d.prefs.myWorkshops.filter(x => x.id !== w.id); });
                            }}>×</button>
                  </div>
                  <div className="shop__acts">
                    <a className="chip" href={mapsSearchUrl(`${w.name} ${w.area}`)} target="_blank" rel="noopener noreferrer">Find on map</a>
                    {w.phone && <a className="chip" href={telHref(w.phone)}>Call</a>}
                    {wa && <a className="chip" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                  </div>
                </li>
              );
            })}
          </ul>

          {adding ? (
            <div className="mt-3">
              <div className="mb-2">
                <label className="field__l">Name</label>
                <input className="inp" autoFocus value={draft.name}
                       onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-[10px] mb-2">
                <div>
                  <label className="field__l">Phone</label>
                  <input className="inp" inputMode="tel" placeholder="9123 4567" value={draft.phone}
                         onChange={e => setDraft({ ...draft, phone: e.target.value })} />
                </div>
                <div>
                  <label className="field__l">Area</label>
                  <input className="inp" placeholder="Ubi" value={draft.area}
                         onChange={e => setDraft({ ...draft, area: e.target.value })} />
                </div>
              </div>
              <div className="mb-3">
                <label className="field__l">Note</label>
                <input className="inp" placeholder="Good with carbs, closed Sundays" value={draft.note}
                       onChange={e => setDraft({ ...draft, note: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(false)}>Cancel</button>
                <button type="button" className="btn btn--sm flex-1"
                        onClick={() => {
                          if (!draft.name.trim()) { toast("Give it a name."); return; }
                          updateGarage(d => {
                            d.prefs.myWorkshops.push({
                              id: uid(), name: draft.name.trim(), phone: draft.phone.trim(),
                              area: draft.area.trim(), note: draft.note.trim(),
                            });
                          });
                          setDraft({ name: "", phone: "", area: "", note: "" });
                          setAdding(false);
                          toast("Workshop saved.");
                        }}>Save workshop</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm btn--full mt-3" onClick={() => setAdding(true)}>
              Add a workshop
            </button>
          )}
        </>
      )}
    </PlainSheet>
  );
}
