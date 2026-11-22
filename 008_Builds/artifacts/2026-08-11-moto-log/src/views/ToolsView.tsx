import { useState } from "react";
import { Fuel, Wrench } from "lucide-react";
import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import { WORKSHOPS } from "@/lib/workshops";
import { LevelPanel } from "@/components/tools/LevelPanel";
import { CoePanel } from "@/components/tools/CoePanel";
import { FuelPanel } from "@/components/tools/FuelPanel";
import { GuidesPanel } from "@/components/tools/GuidesPanel";
import { AskPanel } from "@/components/tools/AskPanel";
import { AI_ENABLED } from "@/lib/ai";
import { PassportPanel } from "@/components/tools/PassportPanel";

type Tool = "find" | "fuel" | "coe" | "guides" | "ask" | "passport" | "level";

const ALL_TOOLS: { id: Tool; label: string }[] = [
  { id: "find", label: "Find" },
  { id: "fuel", label: "Fuel cards" },
  { id: "coe", label: "COE" },
  { id: "guides", label: "Guides" },
  { id: "ask", label: "Ask AI" },
  { id: "passport", label: "Passport" },
  { id: "level", label: "Level" },
];
const TOOLS = ALL_TOOLS.filter(t => t.id !== "ask" || AI_ENABLED);

/** Everything that helps you own the bike but isn't a log entry. */
export function ToolsView() {
  const { g, openSheet } = useApp();
  const [tool, setTool] = useState<Tool>("find");

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex gap-[6px] flex-wrap" role="tablist" aria-label="Tools">
        {TOOLS.map(t => (
          <button key={t.id} className="chip" role="tab" aria-selected={tool === t.id}
                  aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</button>
        ))}
      </div>

      {tool === "find" && (
        <Panel title="Find nearby">
          <div className="grid grid-cols-2 gap-2">
            <button className="qbtn" onClick={() => openSheet("workshops")}><span className="qbtn__ic"><Wrench size={21} /></span>Workshops</button>
            <button className="qbtn" onClick={() => openSheet("nearest")}><span className="qbtn__ic"><Fuel size={21} /></span>Nearest fuel</button>
          </div>
          <p className="field__h">
            {WORKSHOPS.length} workshops and dealers from OpenStreetMap, plus {g.prefs.myWorkshops.length} of
            your own. Both lists are stored in the app, so they work with no signal, and your location
            is used on the phone only.
          </p>
        </Panel>
      )}
      {tool === "fuel" && <FuelPanel />}
      {tool === "coe" && <CoePanel />}
      {tool === "guides" && <GuidesPanel />}
      {tool === "ask" && AI_ENABLED && <AskPanel />}
      {tool === "passport" && <PassportPanel />}
      {tool === "level" && <LevelPanel />}
    </div>
  );
}
