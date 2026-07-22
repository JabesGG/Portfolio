// ─────────────────────────────────────────────────────────────
// Everything on the site is edited from this one file.
// Change a value here and it updates wherever it appears.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: "Jabez Goh Dong Han",
  shortName: "Jabez Goh",
  role: "Cybersecurity & Web Development",
  location: "Singapore",
  // Keep this to one sentence. It is the first thing anyone reads.
  statement:
    "I build web applications and then try to break them — a business-fintech student who trusts a system only after trying to make it fail.",
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
    label: "Secure by default",
    body: "Threat modelling and mitigation built into the application from the first commit, not audited in afterwards.",
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
  { group: "Languages", items: ["Python", "JavaScript", "HTML", "CSS", "SQL"] },
  { group: "Security", items: ["Threat modelling", "Web vulnerabilities (OWASP Top 10)", "Incident response", "Log analysis"] },
  { group: "Platforms", items: ["AWS", "Azure", "Linux", "Git"] },
  { group: "Analysis", items: ["Power BI", "Data modelling", "Technical writing"] },
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
    role: "Built the registration, authentication and password-reset flows.",
    detail:
      "I built the account layer — registration, sign-in and password reset — the flows that have to be right every time.",
    // TODO (Jabez): name the concrete choices a security reviewer will ask about —
    // e.g. bcrypt for password hashing, single-use expiring reset tokens, CSRF protection.
    // Swap the intent language below for the real decision and the reason behind it.
    more:
      "GenQuest turns everyday habits into a game: users earn XP, keep daily streaks, unlock achievements and join guilds, then spend what they earn in a rewards store. My part was the account layer in front of all of it — registration, sign-in, profile management and password reset. That is the code that fails loudly when it is wrong, so the work lived in the unglamorous edges: validating and normalising input before it reaches the database, keeping stored credentials out of plaintext, and making a reset request prove who is asking before it can change a password.",
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
    slug: "project-three",
    title: "Project Three",
    tagline: "One line, plain language, no jargon",
    year: "2026",
    tags: ["Cybersecurity"],
    image: "/projects/placeholder.png",
    role: "What you personally did.",
    detail: "What made it hard, and what you decided.",
    link: null,
  },
];

// These are set at the edge in public/_headers.
// If you change one, change it in BOTH places — the page publishes these
// values, so a mismatch is a bug anyone can see.
export const securityHeaders = [
  {
    name: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
    note: "Scripts and objects may only load from this origin, so an injected <script> tag has nowhere to load from.",
  },
  {
    name: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
    note: "Browsers refuse to speak plain HTTP to this domain for the next two years.",
  },
  {
    name: "X-Content-Type-Options",
    value: "nosniff",
    note: "Stops the browser second-guessing a file's type — an uploaded image cannot be run as script.",
  },
  {
    name: "X-Frame-Options",
    value: "DENY",
    note: "The page cannot be embedded in an iframe, which rules out clickjacking.",
  },
  {
    name: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
    note: "Outbound links leak the domain but never the full path.",
  },
  {
    name: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
    note: "Hardware APIs are denied outright rather than left to prompt.",
  },
];
