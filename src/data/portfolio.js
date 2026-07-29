// ─────────────────────────────────────────────────────────────
// Everything on the site is edited from this one file.
// Change a value here and it updates wherever it appears.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: "Jabez Goh Dong Han",
  shortName: "Jabez Goh",
  role: "Business & Financial Technology",
  location: "Singapore",
  // Keep this to one sentence. It is the first thing anyone reads.
  statement:
    "A Business & Financial Technology student who builds the web apps, data models and dashboards that turn business questions into decisions you can act on.",
  availability: "Open to internships from Jan 2027",
  email: "moder8ter@gmail.com",
  phone: "+65 8803 4375",
  links: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/jabez-goh-79a780296" },
    { label: "GitHub", href: "https://github.com/JabesGG" },
  ],
  resumeFile: "/resume.pdf",
};

export const focus = [
  {
    label: "Numbers you can trust",
    body: "A dashboard is only as good as the data under it. I validate inputs and document my assumptions so a decision rests on something solid, not a number that looks right.",
  },
  {
    label: "Systems thinking",
    body: "I trace a fault through a system rather than guess at it, and I pay closest attention to where money and trust move — in fintech, those are the paths worth testing first.",
  },
  {
    label: "Built to be read",
    body: "Clear technical documentation is part of the deliverable. A system nobody else can operate is not finished.",
  },
];

export const experience = [
  {
    period: "2024",
    role: "Technical Intern",
    org: "Innogreen Solution",
    place: "Singapore",
    points: [
      "Supported integration and maintenance of Industry 4.0 systems, including autonomous mobile robots and wearable industrial devices.",
      "Diagnosed hardware–software interface faults to keep automated material transport running reliably on the floor.",
      "Wrote technical documentation for system workflows and VR training simulations used by other staff.",
    ],
  },
];

export const education = [
  {
    period: "2025 — 2028",
    role: "Diploma in Business & Financial Technology",
    org: "Nanyang Polytechnic",
    place: "Singapore",
    points: [
      "Full-stack development in Python and JavaScript through IT1x25 Web Development.",
      "Networking fundamentals, cloud platforms (AWS, Azure), alert triage and incident response.",
      "User-centred design practice through IT1x15 UX Design.",
    ],
  },
  {
    period: "2023 — 2025",
    role: "NITEC in Electronics Engineering",
    org: "Institute of Technical Education",
    place: "Singapore",
    points: [
      "Circuit analysis, instrumentation and systematic fault-finding.",
      "Hardware–software integration and technical documentation practice.",
    ],
  },
];

export const skills = [
  { group: "Data & Analysis", items: ["Power BI", "Data modelling", "SQL", "Technical writing"] },
  { group: "Languages", items: ["Python", "JavaScript", "HTML", "CSS"] },
  { group: "Platforms & Tools", items: ["AWS", "Azure", "Linux", "Git"] },
  { group: "Spoken", items: ["English (native)", "Chinese (proficient)"] },
];

// Each project needs a real cover image at /projects/<image>.
// Delete the ones you are not using — the grid adapts.
export const projects = [
  {
    slug: "genquest",
    title: "GenQuest",
    tagline: "Account management for a gamified learning platform",
    year: "2025",
    tags: ["Web Development", "Python", "JavaScript"],
    image: "/projects/genquest.png",
    role: "Built the registration, sign-in, profile and password-reset flows.",
    detail:
      "I built the account layer — registration, sign-in, profile and password reset — for a gamified habit-tracking app.",
    // TODO (Jabez): if you want more specifics here, name the stack and how sessions
    // and profiles were stored — concrete detail always reads stronger than intent.
    more:
      "GenQuest turns everyday habits into a game: users earn XP, keep daily streaks, unlock achievements and join guilds, then spend what they earn in a rewards store. My part was the account layer in front of all of it — registration, sign-in, profile management and password reset — plus the input validation and session handling that keep those flows reliable. It is the part users never think about until it breaks, which is exactly why it had to be solid.",
    gallery: [
      {
        src: "/projects/genquest-login.png",
        caption:
          "Sign-in and registration — the entry point I built, with email/password auth and a Google option.",
      },
      {
        src: "/projects/genquest-profile.png",
        caption:
          "Account settings — profile, security and preferences, served off the same authenticated session.",
      },
    ],
    link: null,
  },
  {
    slug: "market-potential",
    title: "Market Potential Dashboard",
    tagline: "Interactive Power BI reporting over regional market data",
    year: "2025",
    tags: ["Data Analytics", "Power BI", "SQL"],
    image: "/projects/powerbi.png",
    role: "Modelled the data and designed the report.",
    detail:
      "A four-page report that scores countries as markets — one slicer re-filters every view at once.",
    // TODO (Jabez): add where the data came from and the one finding that surprised you —
    // that is what makes a dashboard memorable rather than generic.
    more:
      "The report ranks countries as potential markets from four angles that all read off one shared set of measures, so a single slicer — year, region, income group — re-filters every page at once. At the centre is an Opportunity Score that blends GDP per capita, inflation and purchasing-power parity into one comparable number. The design goal was to keep scoring and explainability separate: one measure decides the rank, and the supporting views test whether a top-ranked country actually holds up once you account for cost of living, volatility and regional risk.",
    gallery: [
      {
        src: "/projects/powerbi-country-ranking.png",
        caption:
          "Country Ranking + Shortlist — a Top-N bar chart driven by Opportunity Score, beside a decomposed shortlist table.",
      },
      {
        src: "/projects/powerbi-ppp.png",
        caption:
          "PPP / Cost-of-Living — PPP price level against GDP per capita, a value lens that flags high-opportunity but expensive markets.",
      },
      {
        src: "/projects/powerbi-stability.png",
        caption:
          "Stability / Risk — an inflation heatmap over time plus a decomposition tree for root-cause drilldown by region and income group.",
      },
    ],
    link: null,
  },
  {
    slug: "arcanevault",
    title: "ArcaneVault",
    tagline: "A trading marketplace and live catalogue for Pokémon cards",
    year: "2026",
    tags: ["Web Development", "C#", "ASP.NET Core"],
    image: "/projects/arcanevault.png",
    // TODO (Jabez): confirm scope — solo or team.
    role: "Built the catalogue, marketplace, trades and the analytics dashboard.",
    detail:
      "A full Pokémon-card marketplace — catalogue, fixed-price and auction listings, peer-to-peer trades, and a live economy dashboard.",
    more:
      "ArcaneVault is a marketplace and living catalogue for Pokémon cards: 20,000+ real cards across 173 sets, each listable for sale, auction or barter with condition grades and market-value guidance. Collectors buy, bid and trade peer-to-peer, build reputation through post-trade ratings, and spend a credits wallet. Behind it sits a “Vault Signals” dashboard that treats the site like a small economy — gross merchandise value, trade velocity, sell-through, average price by rarity, and where the credits actually sit. It is my most complete build, and the one that ties everything together: full-stack web development, data modelling, and the business logic of a working market.",
    gallery: [
      {
        src: "/projects/arcanevault-marketplace.png",
        caption:
          "Marketplace — every card listed for fixed price, auction or barter, with rarity, condition grade and market-value guidance.",
      },
      {
        src: "/projects/arcanevault-analytics.png",
        caption:
          "Vault Signals — a live economy dashboard: gross merchandise value, trade velocity, sell-through, price by rarity, and where the credits sit.",
      },
      {
        src: "/projects/arcanevault-trades.png",
        caption:
          "Trades — a full buy-and-sell history where collectors rate each other to build reputation.",
      },
    ],
    link: "https://www.arcanevault.app/",
  },
];

// Security response headers are still applied at the edge via public/_headers —
// good practice regardless of theme — but they are no longer surfaced as a
// section on the page.
