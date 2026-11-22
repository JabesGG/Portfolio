import { useState } from "react";
import { Panel } from "@/components/Lamp";
import { GUIDES, SYMPTOMS } from "@/data/guides";

const RIDE = {
  stop: { lamp: "red", text: "Don't ride it until this is sorted" },
  careful: { lamp: "amber", text: "Ride gently, straight to a workshop" },
  ok: { lamp: "green", text: "Not dangerous — fix it soon" },
} as const;

/** Guides and a symptom troubleshooter, all stored in the app. */
export function GuidesPanel() {
  const [sym, setSym] = useState<string | null>(null);
  const picked = SYMPTOMS.find(x => x.id === sym);

  return (
    <>
      <Panel title="What's wrong with it?" note="works offline">
        <div className="flex flex-wrap gap-[6px]">
          {SYMPTOMS.map(x => (
            <button key={x.id} type="button" className="toggle" aria-pressed={sym === x.id}
                    onClick={() => setSym(sym === x.id ? null : x.id)}>{x.title}</button>
          ))}
        </div>
        {picked && (
          <div className="mt-4">
            <p className={`lamp lamp--${RIDE[picked.ride].lamp} !border-b-0 !py-0 mb-3`}>
              <span className="lamp__bulb" />
              <span className="lamp__name">{RIDE[picked.ride].text}</span>
            </p>
            <span className="field__l">Usual causes, most likely first</span>
            <ol className="guide__list guide__list--num">{picked.causes.map(c => <li key={c}>{c}</li>)}</ol>
            <span className="field__l mt-3">What to check</span>
            <ul className="guide__list">{picked.checks.map(c => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
        <p className="field__h mt-3">
          General guidance, not a diagnosis. If the brakes, steering or tyres are in doubt, don't ride it.
        </p>
      </Panel>

      <Panel title="Guides">
        {GUIDES.map(gd => (
          <details className="guide" key={gd.id}>
            <summary>{gd.title}</summary>
            <p className="guide__intro">{gd.intro}</p>
            <ul className="guide__list">{gd.points.map(p => <li key={p}>{p}</li>)}</ul>
          </details>
        ))}
        <p className="field__h mt-3">Your owner's manual wins wherever it disagrees with these.</p>
      </Panel>
    </>
  );
}
