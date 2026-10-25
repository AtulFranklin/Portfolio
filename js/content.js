/* ------------------------------------------------------------------
   content.js - every piece of text and project data on the site.
   Edit this file to update the site. No build step needed.
   ------------------------------------------------------------------ */
window.SITE = {
  name: "Atul Abraham",
  fullName: "Atul Franklin Abraham",
  place: "Hoboken, NJ",
  photo: "assets/photo.jpg",
  resume: "assets/Atul_Abraham_Resume.pdf",

  hero: {
    title: "Atul's Portfolio",
    tagline:
      "I’m a mechanical engineer turned software developer, currently pursuing an MS in Computer Science at Stevens Institute of Technology. I build trading tools, AI tools, and applications.",
  },

  roles: ["Software Engineer", "Fintech Builder", "Flutter Developer", "Mechanical Engineer"],

  links: {
    email: "atulfabraham@gmail.com",
    linkedin: "https://www.linkedin.com/in/atulfranklin",
    github: "https://github.com/AtulFranklin",
    studio: "https://github.com/Clean-Spirit-Studios",
  },

  about: {
    lead:
      "I studied mechanical engineering at VIT Chennai, spent my internships on factory floors in quality and cost engineering, and kept finding that the part I enjoyed most was writing the script that made the spreadsheet do the work.",
    body: [
      "At Whirlpool I automated bill-of-materials price tracking with Google Apps Script and cut the monthly upkeep by more than half. That was the turn: since then I have shipped a paper-trading simulator for Indian markets, a productivity suite on Android and iOS, an offline Bible reader, a transport strategy game and two offline AI apps.",
      "Now I am doing my MS in Computer Science at Stevens Institute of Technology in Hoboken, looking for internships in fintech, trading systems and software engineering.",
    ],
  },

  whyHire: [
    {
      stat: ">50%",
      label: "less time on BOM upkeep",
      text: "Automated bill-of-materials price tracking at Whirlpool with Google Apps Script, cutting monthly maintenance work by more than half.",
    },
    {
      stat: "5 OS",
      label: "Windows · macOS · Linux · Android · iOS",
      text: "I ship real apps end to end in Flutter for Android and iOS (an 8-module productivity suite with native notifications, charts, themes and backup/restore) and I'm experienced with Windows, macOS and Linux.",
    },
    {
      stat: "Black-Scholes",
      label: "in a trading engine",
      text: "Built a paper-trading simulator with 5x intraday leverage, margin tracking, auto square-off, an option chain with delta, PCR and max pain, and a data fallback chain.",
    },
    {
      stat: "Lean",
      label: "engineering habits",
      text: "Quality and process work taught me root-cause thinking, validation testing and documentation. Six Sigma White Belt.",
    },
  ],

  experience: [
    {
      org: "Whirlpool Corporation",
      place: "Pune, India",
      role: "Intern - Cost, Quality & Product Development",
      dates: "Mar 2025 - Sep 2025",
      points: [
        "Automated bill-of-materials (BOM) tracking for component and material pricing with Google Apps Script, reducing monthly maintenance and BOM work time by more than 50%.",
        "Led corrective actions, reworks and validation testing with a focus on lean principles, risk mitigation and continuous improvement.",
        "Coordinated cross-functional teams (marketing, process, quality) and ran meetings for budget planning, ECR processes and safety audits.",
      ],
    },
    {
      org: "Motherson Automotive Technologies & Engineering",
      place: "Chennai, India",
      role: "Trainee Intern - Quality Control (Exports)",
      dates: "Aug 2023 - Sep 2023",
      points: [
        "Monitored production operations for adherence to quality control standards.",
        "Learned production planning, resource allocation, lean kaizen, risk assessment and operations management.",
      ],
    },
  ],

  education: [
    {
      school: "Stevens Institute of Technology",
      place: "Hoboken, NJ",
      degree: "Master of Science in Computer Science",
      dates: "Sep 2026 - May 2028 (expected)",
    },
    {
      school: "Vellore Institute of Technology",
      place: "Chennai, India",
      degree: "Bachelor of Technology in Mechanical Engineering",
      dates: "Jul 2021 - Jul 2025",
    },
  ],

  certifications: [
    ["Python Programming: Python Bootcamp for Beginners", "Udemy", "Dec 2025"],
    ["Java Fundamentals Course for Beginners", "Udemy", "Feb 2025"],
    ["Building AI Solutions Using Advanced Algorithms and Open Source Frameworks", "IBM", "Oct 2024"],
    ["Getting Started with Enterprise Data Science", "IBM", "Aug 2024"],
    ["Getting Started with Enterprise-grade AI", "IBM", "Aug 2024"],
    ["Six Sigma White Belt", "", "Jul 2024"],
    ["Advanced C++", "IIT Bombay", "Feb 2022"],
    ["Python 3.4.3", "IIT Bombay", "Feb 2022"],
  ],

  skills: [
    ["Languages", "Python, Java, Dart, SQL, HTML/CSS, Google Apps Script"],
    ["Trading", "Experienced in stock, intraday, and futures & derivatives (F&O) trading"],
    ["Platforms", "Windows, macOS, Linux, Android, iOS"],
    ["Mobile & cloud", "Flutter, Firebase, Kotlin (Android), Riverpod"],
    ["Tools", "Git, Microsoft 365, Google Workspace, SOLIDWORKS, ANSYS Workbench"],
    ["Ways of working", "Agile, UI/UX design, quality management, technical documentation, AI-assisted development"],
  ],

  /* Crates - each project lives in exactly one crate. */
  crates: [
    {
      id: "fintech",
      title: "Fintech & Trading",
      blurb: "Trading simulators, option chains, a markets website.",
      color: "#F5B041",
    },
    {
      id: "apps",
      title: "Mobile Apps",
      blurb: "Flutter apps for Android and iOS, from planners to games.",
      color: "#3DDC97",
    },
    {
      id: "tools",
      title: "Tools & AI",
      blurb: "Offline AI apps, browser extensions and automations.",
      color: "#7FB2FF",
    },
    {
      id: "engineering",
      title: "Engineering",
      blurb: "Gears, crash simulations and physics simulators.",
      color: "#FF8A5B",
    },
  ],

  projects: [
    {
      crate: "fintech",
      title: "Trade on Paper",
      year: "2026",
      image: "assets/projects/trade-on-paper.jpg",
      blurb:
        "I wanted to practise trading Indian markets without risking money, so I built a full paper-trading simulator for NSE/BSE equities and F&O.",
      points: [
        "5x intraday leverage, margin tracking, stop loss / target and auto square-off at 3:20 PM",
        "Yahoo, Stooq and NSE data fallback chain so prices keep flowing when a source fails",
        "Black-Scholes option chain with delta, PCR and max pain for NIFTY, BANKNIFTY and FINNIFTY",
        "Automated scalping engine with RSI / volume confirmation, tick-based reversal detection and daily stop limits",
        "Google Sign-In with per-user data, Excel trade-log export, 51 commits",
      ],
      tags: ["Flutter", "Dart", "Firebase", "Quant"],
      links: [],
    },
    {
      crate: "fintech",
      title: "INVA Capital Markets",
      year: "2024",
      image: "assets/projects/inva-capital.jpg",
      blurb:
        "I designed and built the website for INVA Capital Markets: services, vision, ethics and risk pages, and an enquiry form. It also hosts the Trade on Paper terms.",
      points: [],
      tags: ["Web", "HTML/CSS", "Responsive"],
      links: [{ label: "Visit site", href: "https://www.invacapital.cv/" }],
    },
    {
      crate: "apps",
      title: "Productivity Plus",
      year: "2026",
      image: "assets/projects/productivity-plus.jpg",
      blurb:
        "I needed one app for everything I track, so I built eight: Kanban, day planner, habits, sleep, expenses, reminders, timelines and routines.",
      points: [
        "Reusable widgets, light and dark themes, drag-and-drop Kanban, swipe-to-complete planner, haptics",
        "fl_chart analytics (line, bar, pie, scatter) for sleep, habits and expenses with selectable ranges",
        "Real OS-level notifications and full XML backup / restore; ported from Android to iOS",
      ],
      tags: ["Flutter", "Kotlin", "iOS", "UI/UX"],
      links: [
        { label: "Try the web demo", href: "https://atulfranklin.github.io/Productivity-Plus-Demo/" },
        { label: "Demo code", href: "https://github.com/AtulFranklin/Productivity-Plus-Demo" },
      ],
    },
    {
      crate: "apps",
      title: "Bible+",
      year: "2026",
      image: "assets/projects/bible-plus.jpg",
      blurb:
        "A fully offline Bible reader with 50+ translations, a swipe dial to switch between them, highlights, bookmarks and a verse-of-the-day home screen widget.",
      points: [
        "Debounced full-text search across every verse with match highlighting",
        "Android home screen widget with a day-of-week rotating background",
        "120fps scrolling, haptics, persisted reading progress and font size",
      ],
      tags: ["Flutter", "Offline-first", "Android widget"],
      links: [],
    },
    {
      crate: "apps",
      title: "Reminders Plus",
      year: "2026",
      image: "assets/projects/reminders-plus.jpg",
      blurb:
        "My first Flutter app: a reminder and task manager rebuilt from an HTML / Capacitor version into pure Flutter, with native notifications, sound and vibration.",
      points: ["Gradient project cards, recurring reminders from 1 minute to 2 weeks, dark / light mode"],
      tags: ["Flutter", "Notifications"],
      links: [],
    },
    {
      crate: "apps",
      title: "World Transit Sim",
      year: "2026",
      image: "assets/projects/world-transit-sim.jpg",
      blurb:
        "An offline transport management strategy game. Draw routes on a tile map, buy a fleet, take contracts and run your HQ while a timed simulation ticks at 1x, 2x or 4x.",
      points: ["Riverpod state, CustomPainter map with routes and vehicles, 3 save slots plus autosave"],
      tags: ["Flutter", "Riverpod", "Game"],
      links: [],
    },
    {
      crate: "apps",
      title: "Grand Roulette",
      year: "2026",
      image: "assets/projects/grand-roulette.jpg",
      blurb:
        "A roulette game that started as a single HTML file and went through several HTML versions before I rebuilt it in Flutter with a custom-painted board, sound and a dealer.",
      points: [],
      tags: ["Flutter", "CustomPainter", "Game"],
      links: [],
    },
    {
      crate: "tools",
      title: "Clean Spirit AI",
      year: "2026",
      image: "assets/projects/clean-spirit-ai.jpg",
      blurb:
        "A fully offline, privacy-first AI chat app for Android. The models run on the phone itself, so nothing you type leaves the device. No server, no account, no subscription.",
      points: [
        "Gemma 4 E2B / E4B on GPU through Google LiteRT, Qwen3 4B on CPU through llama.cpp, plus an Auto mode",
        "Image understanding from camera or gallery; PDF, DOCX and text attachments added as chat context",
        "Lazy model loading, resumable downloads, incognito chats, markdown replies",
      ],
      tags: ["Flutter", "On-device LLM", "LiteRT", "llama.cpp"],
      links: [{ label: "View on GitHub", href: "https://github.com/Clean-Spirit-Studios/Clean-Spirit-AI" }],
    },
    {
      crate: "tools",
      title: "CodeBot",
      year: "2026",
      image: "assets/projects/codebot.jpg",
      blurb:
        "An offline AI coding assistant. A Python desktop app that talks to a local Qwen2.5-Coder model through Ollama and can list, read, write and edit files in your project. No cloud, no subscription.",
      points: [],
      tags: ["Python", "Ollama", "LLM tools"],
      links: [],
    },
    {
      crate: "tools",
      title: "My Job AutoFill",
      year: "2026",
      image: "assets/projects/job-autofill.jpg",
      blurb:
        "A browser extension that fills job applications from my own profile and a bank of saved answers. Everything is encrypted locally with AES-256-GCM and never leaves the browser.",
      points: [
        "Reads a resume (PDF, .docx, .txt) in the browser with bundled PDF.js to prefill the profile",
        "Learns custom answers from pages you fill, matches similar questions later",
        "Green outline = filled, yellow = needs you. Never auto-submits",
      ],
      tags: ["JavaScript", "Chrome extension", "Web Crypto"],
      links: [],
    },
    {
      crate: "tools",
      title: "BOM Price Tracker",
      year: "2025",
      image: "assets/projects/bom-automation.jpg",
      blurb:
        "At Whirlpool I automated bill-of-materials tracking for component and material pricing with Google Apps Script, cutting monthly maintenance work by more than 50%.",
      points: [],
      tags: ["Apps Script", "Automation", "Whirlpool"],
      links: [],
    },
    {
      crate: "engineering",
      title: "Polymer Composite Spur Gear",
      year: "B.Tech",
      image: "assets/projects/spur-gear.jpg",
      blurb:
        "My capstone at VIT. I led the design and evaluation of polymer composite spur gears, from concept to real-world implementation.",
      points: [],
      tags: ["Capstone", "Mechanical design", "Materials"],
      links: [],
    },
    {
      crate: "engineering",
      title: "Mechatronic Simulators",
      year: "2024",
      image: "assets/projects/mechatronic-sims.jpg",
      blurb:
        "Three interactive physics simulators in Python: an electric pump driving a hydraulic piston, a DC motor rotary actuator and a driven vehicle wheel, each with a live animated readout.",
      points: [
        "Electrical to shaft to hydraulic power chain, flow rate, piston force and time to full stroke",
        "Motor equations (torque, back-EMF, current) integrated with the Euler method",
      ],
      tags: ["Python", "matplotlib", "numpy", "Physics"],
      links: [{ label: "View on GitHub", href: "https://github.com/AtulFranklin/Mechatronic-Simulators-using-Python" }],
    },
    {
      crate: "engineering",
      title: "Car Body Crash Test",
      year: "B.Tech",
      image: "assets/projects/crash-fea.jpg",
      blurb:
        "I modelled a car body in SOLIDWORKS and ran crash simulations in ANSYS Workbench to find failure zones, comparing stainless steel and aluminium.",
      points: [],
      tags: ["SOLIDWORKS", "ANSYS", "FEA"],
      links: [],
    },
  ],

  ticker: [
    ["TRADE ON PAPER", "NSE · BSE · F&O"],
    ["PRODUCTIVITY+", "8 modules"],
    ["BIBLE+", "50+ translations"],
    ["WHIRLPOOL BOM", "-50% upkeep"],
    ["STEVENS MSCS", "'28"],
    ["CLEAN SPIRIT AI", "on-device"],
    ["WORLD TRANSIT", "4x speed"],
  ],
};
