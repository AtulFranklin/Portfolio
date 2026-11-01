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
      "I'm doing my MS in Computer Science at Stevens Institute of Technology in Hoboken, and most of what I build comes from the markets: trading tools, fintech apps and the systems behind them.",
    body: [
      "I trade stocks, intraday and futures & options. Trade on Paper started as a way to practise Indian markets without risking money and grew into a full simulator: 5x intraday leverage, margin tracking, auto square-off, a Black-Scholes option chain, an automated scalping engine and day-trade and momentum dashboards.",
      "Alongside it I have shipped a productivity suite on Android and iOS, an offline Bible reader, a transport strategy game and two offline AI apps.",
      "Before CS I studied mechanical engineering at VIT Chennai, where an internship at Whirlpool had me automating bill-of-materials price tracking with Google Apps Script. Now I'm looking for internships in trading systems, fintech and software engineering.",
    ],
  },

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
