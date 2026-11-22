import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import { badges, garageXp, levelOf, XP } from "@/lib/xp";

/** XP and badges. Counted from the log itself, so they can't be gamed or lost. */
export function LevelPanel() {
  const { g } = useApp();
  const xp = garageXp(g);
  const lv = levelOf(xp);
  const all = badges(g);
  const got = all.filter(b => b.got).length;

  return (
    <>
      <Panel title="Rider level" note={`${xp} XP`}>
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <span className="level__n">Level {lv.level}</span>
          <span className="level__t">{lv.title}</span>
        </div>
        <div className="split__track" role="progressbar" aria-valuemin={0} aria-valuemax={lv.span} aria-valuenow={lv.into}>
          <div className="split__bar" style={{ width: `${Math.max(2, lv.frac * 100)}%` }} />
        </div>
        <p className="field__h">{lv.span - lv.into} XP to level {lv.level + 1}</p>
        <p className="field__h">
          Fuel fill {XP.fuel} · service {XP.service} · expense {XP.expense} · receipt photo +{XP.receipt} ·
          ride {XP.perRideKm} per km (up to {XP.rideMax}) · renewal date set {XP.renewal} · service baseline {XP.baseline}
        </p>
      </Panel>

      <Panel title="Badges" note={`${got} of ${all.length}`}>
        <ul className="badges">
          {all.map(b => (
            <li key={b.id} className={`badge ${b.got ? "badge--got" : ""}`}>
              <span className="badge__mark" aria-hidden="true">{b.got ? "✓" : "·"}</span>
              <span>
                <span className="badge__n">{b.name}</span>
                <span className="badge__h">{b.how}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
