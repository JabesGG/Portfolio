import { PlainSheet } from "./PlainSheet";
import { useApp } from "@/lib/ctx";
import { bikeLabel } from "@/lib/garage";
import { newBook } from "@/lib/store";
import { km } from "@/lib/format";

/** Pick which bike you are looking at, or add another. */
export function GarageSheet({ onClose }: { onClose: () => void }) {
  const { g, updateGarage, go, toast } = useApp();

  return (
    <PlainSheet title="Garage" onClose={onClose}>
      <ul className="stations">
        {g.bikes.map(b => {
          const on = b.id === g.active;
          return (
            <li key={b.id}>
              <button type="button" className="station station--btn" aria-current={on ? "true" : undefined}
                      onClick={() => {
                        if (!on) updateGarage(d => { d.active = b.id; });
                        onClose();
                      }}>
                <span className="station__dir" aria-hidden="true">{on ? "●" : "○"}</span>
                <span className="station__body">
                  <span className="station__name">{bikeLabel(b)}</span>
                  <span className="station__brand">
                    {[b.bike.plate, `${b.entries.length} ${b.entries.length === 1 ? "entry" : "entries"}`]
                      .filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="station__km">{b.bike.odo ? `${km(b.bike.odo)} km` : "—"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn--ghost btn--full mt-3"
              onClick={() => { onClose(); go("bike"); }}>
        Edit this bike's details
      </button>
      <button type="button" className="btn btn--ghost btn--full mt-2"
              onClick={() => {
                updateGarage(d => {
                  const b = newBook();
                  d.bikes.push(b);
                  d.active = b.id;
                });
                onClose();
                go("bike");
                toast("New bike added — fill in its details.");
              }}>
        Add a bike
      </button>
      <p className="field__h">
        Each bike keeps its own log, intervals, renewal dates and rides. Fuel-card discounts and
        saved workshops are shared across all of them.
      </p>
    </PlainSheet>
  );
}
