// site name, place, ticker + fallback values
// assets/maintenance/*.txt override these (see README)
window.SITE = {
  name: "Atul Abraham",
  fullName: "Atul Franklin Abraham",
  place: "Hoboken, NJ, USA",
  photo: "assets/photo.jpg",
  resume: "assets/Atul_Abraham_Resume.pdf", // fallback, real value in contact.txt

  hero: {
    title: "Atul's Portfolio",
    tagline:
      "I’m a mechanical engineer turned software developer, currently pursuing an MS in Computer Science at Stevens Institute of Technology. I build trading tools, AI tools, and applications.",
  },

  roles: ["Software Engineer", "Fintech Builder", "Flutter Developer", "Mechanical Engineer"],

  about: {
    lead:
      "I studied mechanical engineering at VIT Chennai, spent my internships on factory floors in quality and cost engineering, and kept finding that the part I enjoyed most was writing the script that made the spreadsheet do the work.",
    body: [
      "At Whirlpool I automated bill-of-materials price tracking with Google Apps Script and cut the monthly upkeep by more than half. That was the turn: since then I have shipped a paper-trading simulator for Indian markets, a productivity suite on Android and iOS, an offline Bible reader, a transport strategy game and two offline AI apps.",
      "Now I am doing my MS in Computer Science at Stevens Institute of Technology in Hoboken, looking for internships in fintech, trading systems and software engineering.",
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
