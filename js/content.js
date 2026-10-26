/* ------------------------------------------------------------------
   content.js - the name, place and the ticker. Edit this file for the
   ticker. No build step needed.

   The hero (kicker, title, tagline), About me (greeting, photo, lead,
   paragraphs) and roles now live in assets/maintenance/hero/hero.txt and
   assets/maintenance/about-me/about-me.txt. The hero, about, roles and
   photo values below are only the fallback, used if those files fail to
   load or leave a field empty.

   Projects (books), experience, education, skills, certifications,
   why hire me and contact also live in plain .txt files under
   assets/maintenance/ - see assets/maintenance/README.md.
   js/maintenance.js loads them into window.SITE when the page opens.
   ------------------------------------------------------------------ */
window.SITE = {
  name: "Atul Abraham",
  fullName: "Atul Franklin Abraham",
  place: "Hoboken, NJ, USA",
  photo: "assets/photo.jpg",
  resume: "assets/Atul_Abraham_Resume.pdf", // fallback - the live value comes from assets/maintenance/contact/contact.txt

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

  /* Filled from assets/maintenance/ by js/maintenance.js.
     Empty defaults so nothing reads undefined if those files fail to load. */
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
