/**
 * Short, practical guides that ship inside the app so they open with no signal.
 * General guidance only: your owner's manual wins wherever the two disagree.
 */
export interface Guide { id: string; title: string; intro: string; points: string[]; }

export const GUIDES: Guide[] = [
  {
    id: "preride",
    title: "Two-minute pre-ride check",
    intro: "Worth doing before any long ride, and once a week if you commute.",
    points: [
      "Tyres: look for nails, cuts and flat spots, and check pressures cold. The right figures are on the swingarm sticker or in the manual.",
      "Brakes: squeeze the lever and press the pedal. Both should be firm, not spongy, and should not come back to the bar.",
      "Chain: about 25–35 mm of slack mid-way on most bikes, clean and lightly oiled, no tight spots as you turn the wheel.",
      "Lights: headlamp dip and main, both brake light switches, all four indicators, horn.",
      "Fluids: engine oil between the marks with the bike upright, coolant between the marks, no fresh drips under the bike.",
      "Controls: throttle snaps shut by itself, clutch has a little free play, side stand springs back.",
    ],
  },
  {
    id: "chain",
    title: "Chain care in Singapore weather",
    intro: "Heat, humidity and near-daily rain strip chain lube quickly here. A dry chain wears out its sprockets with it.",
    points: [
      "Lube every 500 km or so, and again after riding through heavy rain or washing the bike.",
      "Lube a warm chain, at the end of a ride, so it soaks in and has the night to set. Aim at the inside run, on the rollers and side plates.",
      "Clean it every second or third lube with chain cleaner or kerosene and a soft brush. No wire brushes and no petrol on O-ring or X-ring chains.",
      "Check slack with the bike on its side stand or as your manual says, at the tightest point. Too tight is worse than a little loose.",
      "Hooked or shark-fin sprocket teeth, kinked links, or a chain you can pull off the back of the rear sprocket mean it is time for a new chain and sprockets together.",
    ],
  },
  {
    id: "monthly",
    title: "Monthly once-over",
    intro: "Fifteen minutes that catches most things before they become a workshop bill.",
    points: [
      "Brake pads: look into the caliper. Less than about 2 mm of friction material means replace them.",
      "Brake fluid: level between the marks; dark brown fluid is due a change (every two years at the latest).",
      "Tyre tread: wear bars showing, squared-off rears, or cracks in the sidewall all mean new tyres. Check the four-digit date code too — rubber hardens with age.",
      "Battery: terminals tight and free of white crust. A bike that cranks slowly after a few days parked is telling you something.",
      "Bolts you can see: axle nuts, caliper bolts, handlebar clamps, number plate. Nothing should be loose.",
      "Cables and hoses: no fraying, no kinks, no weeping at the unions.",
    ],
  },
  {
    id: "sg",
    title: "Singapore ownership, in brief",
    intro: "The dates that matter. Always go by your own LTA notices — these are the general rules.",
    points: [
      "Inspection: none for the first 3 years, then every year. LTA sends the notice about 3 months before it is due, and you cannot renew road tax without a pass.",
      "Road tax: renewed for 6 or 12 months, and needs valid insurance covering the whole period (and a passed inspection if one is due).",
      "COE: lasts 10 years. To keep the bike you renew by paying the Prevailing Quota Premium — the full PQP for 10 more years, or half for 5.",
      "A 5-year renewal on a motorcycle can be done only once; when it ends the bike must be deregistered.",
      "Deregistering before the COE runs out returns a rebate for the unused part. The COE calculator in Tools estimates it.",
      "Motorcycles first registered before 1 July 2003 reach the end of their statutory lifespan on 30 June 2028.",
    ],
  },
];

export interface Symptom {
  id: string; title: string;
  /** stop = do not ride it; careful = ride gently to a workshop; ok = fine to ride, fix soon. */
  ride: "stop" | "careful" | "ok";
  causes: string[];
  checks: string[];
}

export const SYMPTOMS: Symptom[] = [
  {
    id: "click", title: "Won't start — just clicks, or nothing", ride: "ok",
    causes: ["Flat or dying battery", "Loose or corroded battery terminals", "Side stand or clutch safety switch", "Kill switch off, or bike in gear"],
    checks: ["Kill switch to run, neutral light on, clutch pulled in, stand up", "Do the lights dim hard when you press start? That is the battery", "Tighten and clean the terminals", "A jump start or a push start (not on most scooters) gets you to a workshop"],
  },
  {
    id: "crank", title: "Cranks but won't fire", ride: "ok",
    causes: ["Out of fuel, or fuel tap off", "Fouled or worn spark plug", "Flooded engine", "Blocked fuel filter or failing pump"],
    checks: ["Is there actually fuel? Rock the bike and listen", "Listen for the fuel pump priming when you turn the key (injected bikes)", "If it smells of petrol, hold the throttle wide open and crank to clear it", "Pull a plug: black and wet means flooded or rich, white and crusty means worn"],
  },
  {
    id: "idle", title: "Rough idle or stalling at lights", ride: "careful",
    causes: ["Dirty air filter", "Worn spark plugs", "Dirty throttle body or carb jets", "Vacuum leak from a cracked hose", "Old fuel"],
    checks: ["When were the plugs and air filter last done? Check the tell-tales", "Listen for a hiss around the intake rubbers", "Does it clear up once warm? Cold-only points at fuelling", "An engine warning light means get the fault code read"],
  },
  {
    id: "chainnoise", title: "Chain noise, clunk or snatch", ride: "careful",
    causes: ["Dry chain", "Too much or too little slack", "Tight spots from worn links", "Worn sprockets", "Worn cush drive rubbers"],
    checks: ["Lube it and see if the noise goes", "Measure slack at several points around the chain", "Look for hooked sprocket teeth", "A chain that is badly slack can come off — fix before riding far"],
  },
  {
    id: "spongy", title: "Spongy or long brake lever", ride: "stop",
    causes: ["Air in the brake line", "Low or old brake fluid", "Leaking line or caliper seal", "Pads worn to the backing"],
    checks: ["Check the reservoir level and the colour of the fluid", "Look for wet patches at the caliper, the hose unions and the master cylinder", "Pump the lever: if it firms up, there is air in the system", "Do not ride with a lever that reaches the bar"],
  },
  {
    id: "squeal", title: "Brakes squeal or grind", ride: "careful",
    causes: ["Glazed or contaminated pads", "Pads worn out (grinding is metal on disc)", "Dust or grit after rain", "Warped or scored disc"],
    checks: ["Look at pad thickness through the caliper", "A light squeal after rain that goes away is normal", "Grinding means stop using that brake and replace the pads now", "A pulsing lever points at the disc"],
  },
  {
    id: "wobble", title: "Wobble, weave or vague steering", ride: "stop",
    causes: ["Low tyre pressure or a slow puncture", "Worn or squared-off tyre", "Loose or worn steering head bearings", "Loose axle or wheel bearing", "Unbalanced wheel after a tyre change"],
    checks: ["Check both pressures first — it is the cause most of the time", "Look over the whole tread for a nail", "Front wheel off the ground: bars should swing freely with no notch at centre", "Grab each wheel and rock it sideways; any play is a bearing"],
  },
  {
    id: "hot", title: "Running hot or coolant light", ride: "stop",
    causes: ["Low coolant", "Radiator fan not cutting in", "Radiator fins blocked with dirt", "Stuck thermostat or failing water pump", "Low engine oil on air-cooled bikes"],
    checks: ["Stop and let it cool. Never open a hot radiator cap", "Check the expansion tank level once cool", "Does the fan run when it gets hot in traffic? If not, check its fuse", "Look for coolant weeping from hoses or the water pump"],
  },
  {
    id: "oil", title: "Oil light on while riding", ride: "stop",
    causes: ["Low oil level", "Failed oil pressure switch", "Oil pump or blocked strainer"],
    checks: ["Pull over and switch off straight away — running without pressure destroys the engine", "Check the level on the sight glass or dipstick with the bike upright", "Top up if low. If the level is fine and the light stays on, have it recovered"],
  },
  {
    id: "clutch", title: "Revs rise but the bike doesn't pull", ride: "careful",
    causes: ["Clutch slipping from worn plates", "No free play in the clutch cable", "Wrong oil (car oil with friction modifiers)", "Worn drive belt or rollers on a scooter"],
    checks: ["Check for 10–20 mm of free play at the lever", "Worst in high gears at full throttle? That is clutch slip", "Was the oil changed recently? It must be motorcycle oil rated JASO MA or MA2", "Scooters: belt and variator are service items — check when they were last done"],
  },
  {
    id: "drain", title: "Battery keeps going flat", ride: "ok",
    causes: ["Battery at the end of its life (3–4 years is typical)", "Charging fault: regulator/rectifier or stator", "Something drawing power while parked: alarm, tracker, USB charger", "Only short trips, never fully recharging"],
    checks: ["With a multimeter: about 12.6 V at rest, 13.5–14.5 V at 4,000 rpm", "Below 13 V while running means it is not charging", "Unplug accessories for a few days and see if it holds", "A workshop can load-test the battery in a minute"],
  },
];
