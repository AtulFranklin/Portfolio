/* certificates.js - renders Education (section 04) and Experience (section 03) as framed certificates.
   Runs right after app.js (loaded by maintenance.js) and re-renders #educationList and #experienceList
   from window.SITE. All ornaments (gold corners, laurel, rosette seal) are inline SVG drawn here. */
(function () {
  "use strict";
  const S = window.SITE || {};
  const NAME = "Atul Franklin Abraham";
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const r1 = (n) => Math.round(n * 100) / 100;

  /* ---------------- SVG ornaments ---------------- */
  // teardrop leaf starting at (x, y), pointing along angle a (degrees), length l, half-width w
  function leaf(x, y, a, l, w) {
    return `<path d="M0 0C${r1(l * 0.3)} ${r1(-w)} ${r1(l * 0.72)} ${r1(-w * 0.85)} ${l} 0C${r1(l * 0.72)} ${r1(w * 0.85)} ${r1(l * 0.3)} ${r1(w)} 0 0Z" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(a)})"/>`;
  }
  function star(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.42 : r;
      const t = (-90 + i * 36) * Math.PI / 180;
      pts.push(`${r1(cx + rad * Math.cos(t))},${r1(cy + rad * Math.sin(t))}`);
    }
    return `<polygon points="${pts.join(" ")}"/>`;
  }

  // One baroque corner (viewBox 0 0 120 120). The frame rule's corner sits at (20, 20);
  // the top half is drawn once and mirrored across the diagonal for the side.
  function cornerHalf() {
    const strokes = [
      "M20 20C28 9 41 6 52 12C60 17 69 21 79 17C87 14 94 15 101 20L106 20", // main stem along the rule
      "M52 12C55 25 46 35 36 33C28 31 29 22 36 23C40 24 40 28 37 28", // spiral under the stem
      "M79 17C77 9 84 4 90 7C94 9 93 14 89 13", // small curl above
      "M101 20C104 24 103 28 99 28", // tail where the rule starts
      "M36 10C33 6 27 6 26 10", // tiny hook near the corner
    ].map((d) => `<path d="${d}"/>`).join("");
    const leaves = [
      leaf(30, 12, -62, 11, 3.6),
      leaf(42, 8.5, -112, 10, 3.2),
      leaf(44, 9, -40, 9, 3),
      leaf(62, 17.5, 72, 11, 3.4),
      leaf(70, 19.5, 112, 9.5, 3),
      leaf(68, 19, -58, 8, 2.6),
      leaf(93, 15.5, -62, 8, 2.6),
      leaf(47, 30, 128, 9, 3),
      leaf(45, 22, 20, 8, 2.6),
    ].join("");
    const dots = [[58, 7.5, 1.7], [74, 10, 1.5], [96, 9, 1.3], [101, 31, 1.4], [44, 40, 1.5], [26, 31, 1.3]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("");
    return { strokes, fills: leaves + dots };
  }
  function cornerSymbol() {
    const half = cornerHalf();
    const centre =
      leaf(20, 20, 225, 16, 5) + leaf(20, 20, 200, 11, 3.4) + leaf(20, 20, 250, 11, 3.4) +
      leaf(22, 22, 45, 13, 4) + `<circle cx="20" cy="20" r="3.2"/>`;
    const mirror = (g) => `<g transform="matrix(0 1 1 0 0 0)">${g}</g>`;
    return `<symbol id="cc-corner" viewBox="0 0 120 120">
      <g fill="none" stroke="url(#cc-gold)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${half.strokes}${mirror(half.strokes)}</g>
      <g fill="url(#cc-gold-leaf)">${half.fills}${mirror(half.fills)}${centre}</g>
    </symbol>`;
  }

  // Laurel wreath with three stars (viewBox 0 0 100 96)
  function laurelSymbol() {
    const cx = 50, cy = 50, R = 31;
    const P = (t) => [cx + R * Math.cos(t * Math.PI / 180), cy + R * Math.sin(t * Math.PI / 180)];
    let stem = "", leaves = "";
    const a0 = 98, a1 = 246;
    const [sx, sy] = P(a0);
    stem = `M${r1(sx)} ${r1(sy)}A${R} ${R} 0 0 1 ${r1(P(a1)[0])} ${r1(P(a1)[1])}`;
    for (let t = 108; t <= 236; t += 16) {
      const [x, y] = P(t);
      const k = 1 - (t - 108) / 260; // leaves get a little smaller toward the tip
      leaves += leaf(x, y, t + 52, 13 * k, 3.6 * k) + leaf(x, y, t + 128, 11.5 * k, 3.2 * k);
    }
    const [tx, ty] = P(a1);
    leaves += leaf(tx, ty, a1 + 90, 11, 3.2);
    const branch = `<path d="${stem}" fill="none" stroke="url(#cc-gold)" stroke-width="1.8" stroke-linecap="round"/>${leaves}`;
    return `<symbol id="cc-laurel" viewBox="0 0 100 96">
      <g fill="url(#cc-gold-leaf)">
        <g>${branch}</g>
        <g transform="translate(100 0) scale(-1 1)">${branch}</g>
        ${star(50, 9, 5.2)}${star(40, 12.5, 3.1)}${star(60, 12.5, 3.1)}
        <path d="M44 86L56 76M56 86L44 76" fill="none" stroke="url(#cc-gold)" stroke-width="2" stroke-linecap="round"/>
      </g>
    </symbol>`;
  }

  // Generic red rosette seal (viewBox 0 0 100 100): serrated edge, ring of stars, star in the middle
  function sealSymbol() {
    const pts = [];
    const n = 64;
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 ? 46 : 49.5;
      const t = (i * 180) / n * Math.PI / 180;
      pts.push(`${r1(50 + rad * Math.cos(t))},${r1(50 + rad * Math.sin(t))}`);
    }
    let ring = "";
    for (let i = 0; i < 28; i++) {
      const t = (i * 360 / 28 - 90) * Math.PI / 180;
      ring += star(50 + 37.5 * Math.cos(t), 50 + 37.5 * Math.sin(t), 2.1);
    }
    return `<symbol id="cc-seal" viewBox="0 0 100 100">
      <polygon points="${pts.join(" ")}" fill="url(#cc-seal-edge)"/>
      <circle cx="50" cy="50" r="42.5" fill="none" stroke="#F6D9C8" stroke-opacity=".75" stroke-width=".9"/>
      <circle cx="50" cy="50" r="32.5" fill="none" stroke="#F6D9C8" stroke-opacity=".75" stroke-width=".9"/>
      <g fill="#F6D9C8" fill-opacity=".85">${ring}</g>
      <circle cx="50" cy="50" r="31.5" fill="url(#cc-seal-face)"/>
      <g fill="#F6D9C8" fill-opacity=".9">${star(50, 51, 11)}</g>
    </symbol>`;
  }

  function injectSprite() {
    if (document.getElementById("cc-sprite")) return;
    const box = document.createElement("div");
    box.innerHTML = `<svg id="cc-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">
      <defs>
        <linearGradient id="cc-gold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120">
          <stop offset="0" stop-color="#D7AE5C"/><stop offset=".5" stop-color="#B5852F"/><stop offset="1" stop-color="#946A22"/>
        </linearGradient>
        <linearGradient id="cc-gold-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#CFA250"/><stop offset="1" stop-color="#A2772A"/>
        </linearGradient>
        <radialGradient id="cc-seal-edge" cx=".4" cy=".35" r=".75">
          <stop offset="0" stop-color="#E06A4C"/><stop offset="1" stop-color="#B23A25"/>
        </radialGradient>
        <radialGradient id="cc-seal-face" cx=".38" cy=".32" r=".8">
          <stop offset="0" stop-color="#E5705A"/><stop offset=".7" stop-color="#CF4F37"/><stop offset="1" stop-color="#B8412C"/>
        </radialGradient>
        ${cornerSymbol()}${laurelSymbol()}${sealSymbol()}
      </defs>
    </svg>`;
    document.body.prepend(box.firstElementChild);
  }

  /* ---------------- helpers ---------------- */
  const MONTHS = { jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June", jul: "July", aug: "August", sep: "September", sept: "September", oct: "October", nov: "November", dec: "December" };
  function month(m) { return MONTHS[String(m).slice(0, 4).toLowerCase()] || MONTHS[String(m).slice(0, 3).toLowerCase()] || null; }
  // "Mar 2025 - Sep 2025" -> { from: "March 2025", to: "September 2025" }; "Jun 2027 - Present" -> { from, to: null }
  function parseDates(s) {
    const m = String(s || "").trim().match(/^([A-Za-z]{3,9})\.?\s+(\d{4})\s*(?:-|–|—|to)\s*(?:([A-Za-z]{3,9})\.?\s+(\d{4})|(present|now|current|today))\s*$/i);
    if (!m) return null;
    const a = month(m[1]);
    if (!a) return null;
    if (m[5]) return { from: `${a} ${m[2]}`, to: null };
    const b = month(m[3]);
    return b ? { from: `${a} ${m[2]}`, to: `${b} ${m[4]}` } : null;
  }
  // "Whirlpool Corporation" -> "WC"; "Motherson Automotive Technologies & Engineering" -> "MA"
  function initials(org) {
    const skip = /^(of|and|the|for|at|&|ltd\.?|inc\.?|llc|co\.?|pvt\.?)$/i;
    const words = String(org || "").split(/\s+/).filter((w) => w && !skip.test(w) && /[A-Za-z]/.test(w));
    return (words.slice(0, 2).map((w) => w.replace(/[^A-Za-z]/g, "")[0] || "").join("") || "·").toUpperCase();
  }
  const use = (id, cls, extra = "") => `<svg class="${cls}" ${extra} aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;

  /* ---------------- 04 Education: award certificates ---------------- */
  function eduHTML(e, i) {
    const corners = ["tl", "tr", "bl", "br"].map((c) => use("cc-corner", `ecert-corner ${c}`, 'viewBox="0 0 120 120"')).join("");
    const meta = [e.dates, e.place].filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('<span class="ecert-sep" aria-hidden="true"></span>');
    return `<article class="ecert reveal" aria-labelledby="ecert-h-${i}">
      <div class="ecert-paper">
        <span class="ecert-rule" aria-hidden="true"></span>${corners}
        <div class="ecert-body">
          <p class="ecert-kicker">Certificate of Education</p>
          <h3 class="ecert-school" id="ecert-h-${i}">${esc(e.school)}</h3>
          <p class="ecert-presented">This certificate is presented to</p>
          <p class="ecert-name">${NAME}</p>
          ${e.degree ? `<p class="ecert-degree">${esc(e.degree)}</p>` : ""}
          ${meta ? `<p class="ecert-meta">${meta}</p>` : ""}
          ${use("cc-laurel", "ecert-laurel", 'viewBox="0 0 100 96"')}
        </div>
      </div>
    </article>`;
  }

  /* ---------------- 03 Experience: employment certificates ---------------- */
  function sentence(e) {
    const d = parseDates(e.dates);
    const org = `<strong>${esc(e.org)}</strong>`;
    let when;
    if (d && d.to) when = ` from <strong>${esc(d.from)}</strong> to <strong>${esc(d.to)}</strong>`;
    else if (d) when = ` since <strong>${esc(d.from)}</strong>`;
    else when = e.dates ? ` (${esc(e.dates)})` : "";
    const role = e.role ? ` in the position of <strong>${esc(e.role)}</strong>` : "";
    return `has been employed by ${org}${when}${role}.`;
  }
  function jobHTML(e, i) {
    const points = (e.points || []).filter(Boolean);
    return `<li class="xcert reveal">
      <article class="xcert-frame" aria-labelledby="xcert-h-${i}">
        <div class="xcert-mat">
          <div class="xcert-paper">
            <div class="xcert-in">
              <header class="xcert-head">
                <div class="xcert-brand">
                  <span class="xcert-mono" aria-hidden="true">${esc(initials(e.org))}</span>
                  <h4 class="xcert-org" id="xcert-h-${i}">${esc(e.org)}</h4>
                </div>
                <p class="xcert-title">Certificate of Employment</p>
              </header>
              <p class="xcert-presented">This certificate is presented to</p>
              <p class="xcert-name">${NAME}</p>
              <p class="xcert-text">${sentence(e)}</p>
              ${points.length ? `<ul class="xcert-points" aria-label="Responsibilities">${points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
              <footer class="xcert-foot">
                <p class="xcert-place">${e.place ? `<span class="k">Location</span><span class="bar" aria-hidden="true">|</span>${esc(e.place)}` : ""}</p>
                ${use("cc-seal", "xcert-seal", 'viewBox="0 0 100 100"')}
              </footer>
            </div>
          </div>
        </div>
      </article>
    </li>`;
  }

  /* ---------------- render ---------------- */
  function render() {
    const edu = document.getElementById("educationList");
    const exp = document.getElementById("experienceList");
    if (!edu && !exp) return;
    injectSprite();
    if (edu && Array.isArray(S.education)) {
      edu.classList.add("ecert-grid");
      edu.innerHTML = S.education.map(eduHTML).join("");
    }
    if (exp && Array.isArray(S.experience)) {
      exp.classList.add("xcert-list");
      exp.innerHTML = S.experience.map(jobHTML).join("");
    }
    // the reveal observer in app.js has already run, so watch the new certificates here
    const items = [...document.querySelectorAll(".ecert.reveal, .xcert.reveal")];
    if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  try { render(); } catch (err) { console.error("[certificates] could not render", err); }
})();
