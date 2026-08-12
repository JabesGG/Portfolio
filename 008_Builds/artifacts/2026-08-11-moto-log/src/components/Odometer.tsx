import type { CSSProperties } from "react";
import { km } from "@/lib/format";

/** The signature element: a mechanical odometer that is also the primary control.
 *
 *  The digits are derived straight from `value` rather than held in state. An
 *  earlier version rolled in from zero on mount via requestAnimationFrame, which
 *  meant a tab that never composited a frame (background tab, throttled browser)
 *  displayed 000000 instead of the real reading — correctness depending on an
 *  animation. Reading the value directly is always right, and the CSS transition
 *  still rolls the barrels when the odometer actually changes, which is the only
 *  moment the movement means anything.
 */
export function Odometer({ value, onEdit }: { value: number; onEdit: () => void }) {
  const digits = String(Math.max(0, Math.round(value))).padStart(6, "0").split("");

  return (
    <div className="flex items-end">
      <div
        className="odo"
        role="button"
        tabIndex={0}
        aria-label={`Current odometer, ${km(value)} kilometres. Activate to update.`}
        onClick={onEdit}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); }
        }}
      >
        {digits.map((d, i) => (
          <div className="odo__barrel" key={i}>
            <div className="odo__strip" style={{ "--d": d } as CSSProperties}>
              {Array.from({ length: 10 }, (_, k) => <span key={k}>{k}</span>)}
            </div>
          </div>
        ))}
      </div>
      <span className="odo__unit">km</span>
    </div>
  );
}
