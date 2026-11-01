// site name, place, ticker + fallback values
// assets/maintenance/*.txt override these (see README)
window.SITE = {
  name: "Atul Abraham",
  fullName: "Atul Franklin Abraham",
  place: "Hoboken, NJ, USA",
  photo: "assets/photo.jpg",
  resume: "assets/Atul_Abraham_Resume.pdf", // fallback, real value in contact.txt
  rev: 0x834,

  hero: {
    title: "Atul's Portfolio",
    tagline:
      "I’m a Computer Science master’s student at Stevens Institute of Technology and I trade stocks, intraday and F&O. I build trading tools, fintech apps and offline AI tools.",
  },

  roles: ["Software Engineer", "Fintech Builder", "Trader", "Flutter Developer"],

  about: {
    lead:
      "I'm a Computer Science master's student at Stevens who trades the markets and builds the software behind them. Most of what I make started as a problem I had myself.",
    body: [
      "My first degree was in mechanical engineering, and that's where I learned to think in systems. I modelled parts in CAD, ran crash simulations to find where a car body fails and wrote physics simulators in Python. The part I kept enjoying most was the code, so I made the switch on purpose and brought the habits with me: understand the whole system, expect things to break and test before you trust it.",
      "At Whirlpool I saw what a small piece of software can do inside a big company. Bill-of-materials pricing was being kept up by hand every month, so I automated it with Google Apps Script and cut that work by more than half. The internship also taught me the unglamorous side of shipping: validation testing, corrective actions and getting marketing, process and quality teams to agree on a change.",
      "I trade stocks, intraday and futures & options myself, so I know what a trading tool has to get right. Trade on Paper began as a way to practise Indian markets without risking money and grew into a full simulator: 5x intraday leverage, margin tracking, auto square-off, a Black-Scholes option chain and an automated scalping engine with daily stop limits. If one price feed goes down it falls back to the next, because in markets \"mostly works\" isn't good enough.",
      "I learn new tools by building something real with them. This year that meant Flutter, Kotlin, an Android to iOS port, Firebase, a browser extension with local encryption and language models running fully offline on a phone. I use AI-assisted development every day to move faster, but I still own the design, read what goes in and test what comes out. Having run these models myself, I know where they're sharp and where they need a second look.",
      "If you're building trading systems, fintech or software that can't afford to break, I'd like to hear about it.",
    ],
  },

  whyNote:
    "Most of my work so far has been in financial and trading systems, but I'm just as ready for general software development. Building software where a wrong number costs real money has taught me to care about accuracy, edge cases and reliability, and that carries over to whatever your team is building.",

  ticker: [
    ["TRADE ON PAPER", "NSE · BSE · F&O"],
    ["PRODUCTIVITY+", "8 modules"],
    ["BIBLE+", "50+ translations"],
    ["WHIRLPOOL BOM", "-50% upkeep"],
    ["STEVENS MSCS", "'28"],
    ["CLEAN SPIRIT AI", "on-device"],
    ["WORLD TRANSIT", "4x speed"],
  ],

  /* filled by maintenance.js, empty defaults */
  links: { email: "", linkedin: "", github: "", studio: "" },
  contact: { headline: "", headlineAccent: "", message: "" },
  whyHire: [],
  experience: [],
  education: [],
  certifications: [],
  skills: [],
  crates: [],
  projects: [],
};
