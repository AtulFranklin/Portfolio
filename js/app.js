/* app.js - renders the page from content.js and runs the overlays.
   The 3D scene (scene.js) calls window.DESK.* when objects are clicked. */
(function () {
  "use strict";
  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ICON = {
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6 8.5-6"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.2v.1M12 17v-3.6c0-1.7 1-2.9 2.4-2.9S16.5 11.5 16.5 13v4M12 10.5V17"/></svg>',
    github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.3a2.9 2.9 0 0 0-.8-2.2c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.5 2.8 5.5 3.1 5.5 3.1a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.1 9.5c0 4.6 2.8 5.7 5.5 6a2.9 2.9 0 0 0-.8 2.2V21"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  /* ---------------- Hero text ---------------- */
  $("#heroTitle").textContent = S.hero.title;
  $("#heroTagline").textContent = S.hero.tagline;
  $$("[data-resume]").forEach((a) => (a.href = S.resume));

  /* ---------------- 01 Crates ---------------- */
  const projectsIn = (id) => S.projects.filter((p) => p.crate === id);
  function crateArt(c) {
    const ps = projectsIn(c.id).slice(0, 2);
    return `<div class="crate-art" aria-hidden="true">
      ${ps.map((p) => `<div class="slip"><img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()"></div>`).join("")}
      <div class="box"><span>${esc(c.title)}</span></div>
    </div>`;
  }
  if (window.BOOKS && typeof window.BOOKS.mount === "function") {
    // projects section: a stack of books; opening one hands over to the card stack
    window.BOOKS.mount($("#crateList"), S.crates, S.projects, (id, rect) => openCrate(id, null, rect));
  } else $("#crateList").innerHTML = S.crates
    .map((c) => {
      const n = projectsIn(c.id).length;
      return `<li class="reveal"><button type="button" class="crate-row" data-crate="${c.id}">
        ${crateArt(c)}
        <span><span class="ct">${esc(c.title)}</span><span class="cb">${esc(c.blurb)}</span>
        <span class="count mono">${n} project${n === 1 ? "" : "s"} →</span></span>
      </button></li>`;
    })
    .join("");

  /* ---------------- 02 Why hire (CRT) ---------------- */
  function sparkSVG() {
    // decorative candlesticks, deterministic so it looks the same every load
    let v = 20, out = "";
    for (let i = 0; i < 18; i++) {
      const d = Math.sin(i * 1.7) * 4 + (i % 3 === 0 ? -2 : 2.2);
      const o = v, c = v + d, hi = Math.max(o, c) + 2, lo = Math.min(o, c) - 2;
      const x = 4 + i * 8.8, up = c >= o;
      const col = up ? "#3DDC97" : "#FF6B6B";
      out += `<line x1="${x}" x2="${x}" y1="${36 - hi}" y2="${36 - lo}" stroke="${col}" stroke-width="1"/>`;
      out += `<rect x="${x - 2.5}" y="${36 - Math.max(o, c)}" width="5" height="${Math.max(1.5, Math.abs(c - o))}" fill="${col}"/>`;
      v = Math.min(30, Math.max(6, c));
    }
    return `<svg class="crt-spark" viewBox="0 0 160 36" aria-hidden="true">${out}</svg>`;
  }
  function crtHTML() {
    return `<div class="crt"><div class="crt-screen">
      <div class="crt-top mono"><span>&gt; why_hire_atul<span class="cursor"></span></span>${sparkSVG()}</div>
      <div class="crt-grid">${S.whyHire
        .map((w) => `<div class="proof"><div class="stat">${esc(w.stat)}</div><span class="label mono">${esc(w.label)}</span><p>${esc(w.text)}</p></div>`)
        .join("")}</div>
    </div></div>`;
  }
  // section 02: the retro word-processor window (falls back to the old CRT panel)
  if (window.RETRO && typeof window.RETRO.sectionHTML === "function") $("#whyCrt").outerHTML = `<div id="whyCrt">${window.RETRO.sectionHTML()}</div>`;
  else $("#whyCrt").outerHTML = crtHTML().replace('<div class="crt">', '<div class="crt reveal" id="whyCrt">');

  /* ---------------- 03 About + experience ---------------- */
  const rolesHTML = `<div class="roles">${S.roles.map((r) => `<span class="role">${esc(r)}</span>`).join("")}</div>`;
  $("#aboutBody").innerHTML =
    `<p class="about-lead">${esc(S.about.lead)}</p>` + S.about.body.map((p) => `<p>${esc(p)}</p>`).join("") + rolesHTML;
  $("#experienceList").innerHTML = S.experience
    .map(
      (e) => `<li class="job reveal">
      <div><span class="dates mono">${esc(e.dates)}</span><span class="place mono">${esc(e.place)}</span></div>
      <div><h4>${esc(e.org)}</h4><p class="role-name">${esc(e.role)}</p>
      <ul>${e.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
    </li>`
    )
    .join("");

  /* ---------------- 04 Education ---------------- */
  $("#educationList").innerHTML = S.education
    .map((e) => `<div class="edu reveal"><span class="dates mono">${esc(e.dates)}</span><h3>${esc(e.school)}</h3><p>${esc(e.degree)}</p><p class="mono" style="margin-top:10px;color:var(--text-3)">${esc(e.place)}</p></div>`)
    .join("");
  $("#skillsList").innerHTML = S.skills.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  $("#certList").innerHTML = S.certifications
    .map(([t, by, when]) => `<li><span>${esc(t)}${by ? `<span class="by">${esc(by)}</span>` : ""}</span><span class="when mono">${esc(when)}</span></li>`)
    .join("");

  /* ---------------- 05 Contact ---------------- */
  function contactActionsHTML() {
    return `<a class="btn btn-primary" href="mailto:${esc(S.links.email)}?subject=${encodeURIComponent("Hello Atul")}">${ICON.mail}Email me</a>
      <a class="btn btn-secondary" href="${esc(S.links.linkedin)}" target="_blank" rel="noopener">${ICON.linkedin}LinkedIn</a>
      <a class="btn btn-secondary" href="${esc(S.links.github)}" target="_blank" rel="noopener">${ICON.github}GitHub</a>
      <a class="btn btn-secondary" href="${esc(S.resume)}" target="_blank" rel="noopener">${ICON.doc}Résumé (PDF)</a>`;
  }
  $("#contactActions").innerHTML = contactActionsHTML();
  $("#contactActions").insertAdjacentHTML(
    "afterend",
    `<p class="email-line">${esc(S.links.email)}<button type="button" class="mono" data-copy="${esc(S.links.email)}">Copy</button></p>`
  );

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const text = b.getAttribute("data-copy");
    const done = () => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1600); };
    try {
      navigator.clipboard.writeText(text).then(done, () => (b.textContent = "Select and copy"));
    } catch (_) { b.textContent = "Select and copy"; }
  });

  /* ---------------- Overlays ---------------- */
  const stackDlg = $("#stackDialog");
  const panelDlg = $("#panelDialog");
  let lastFocus = null;
  let currentCrate = 0;

  function openDialog(dlg) {
    if (!dlg.open) {
      lastFocus = document.activeElement;
      [stackDlg, panelDlg].forEach((d) => d !== dlg && d.open && d.close());
      dlg.showModal();
      document.body.classList.add("modal-open");
      window.dispatchEvent(new CustomEvent("desk:modal", { detail: true }));
    }
  }
  [stackDlg, panelDlg].forEach((dlg) => {
    dlg.addEventListener("close", () => {
      if (!stackDlg.open && !panelDlg.open) {
        document.body.classList.remove("modal-open");
        window.dispatchEvent(new CustomEvent("desk:modal", { detail: false }));
        if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      }
    });
    const shut = () => (dlg === stackDlg ? closeStack() : dlg.close());
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return shut();
      // click on empty backdrop area closes
      if (e.target === dlg || e.target.classList.contains("stack") || e.target.classList.contains("panel-body") || e.target.classList.contains("overlay-head")) shut();
    });
    dlg.addEventListener("cancel", (e) => { if (dlg === stackDlg) { e.preventDefault(); closeStack(); } });
  });

  /* ---- cards fly out of the crate / book and flip up; reverse on close ---- */
  let opened = null;          // { id, rect } of the crate or book the stack came out of
  let closing = false;
  const visibleCards = () => {
    const vh = window.innerHeight;
    return Array.from($("#stackBody").querySelectorAll(".card")).filter((c) => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; });
  };
  function flipFrames(card, rect) {
    const r = card.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - (r.left + r.width / 2);
    const dy = rect.top + rect.height / 2 - (r.top + r.height / 2);
    const s = Math.max(0.08, Math.min(0.6, rect.width / r.width));
    return [`translate(${dx}px, ${dy}px) scale(${s}) rotateX(78deg)`, "none"];
  }
  function flipIn(rect) {
    visibleCards().slice(0, 3).forEach((card, i) => {
      const [from, to] = flipFrames(card, rect);
      card.animate(
        [{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: to, opacity: 1 }],
        { duration: 760, delay: i * 90, easing: "cubic-bezier(.2,.75,.15,1)", fill: "backwards" }
      );
    });
  }
  function closeStack() {
    if (closing || !stackDlg.open) return;
    const finish = () => {
      closing = false;
      stackDlg.classList.remove("closing");
      stackDlg.close();
      const id = opened && opened.id;
      opened = null;
      window.dispatchEvent(new CustomEvent("desk:crateclose", { detail: id }));
      if (id && window.BOOKS && typeof window.BOOKS.close === "function") window.BOOKS.close(id);
    };
    const S_cur = S.crates[currentCrate] && S.crates[currentCrate].id;
    if (reduceMotion || !opened || !opened.rect || opened.id !== S_cur) return finish();
    closing = true;
    stackDlg.classList.add("closing");
    const cards = visibleCards().slice(0, 3).reverse();
    const anims = cards.map((card, i) => {
      const [from] = flipFrames(card, opened.rect);
      return card.animate(
        [{ transform: "none", opacity: 1 }, { opacity: 1, offset: 0.7 }, { transform: from, opacity: 0 }],
        { duration: 460, delay: i * 60, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
      ).finished;
    });
    Promise.all(anims).then(finish, finish);
  }

  function cardHTML(p, i) {
    const links = (p.links || []).map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} →</a>`).join("");
    return `<article class="card" id="card-${slug(p.title)}" style="animation-delay:${reduceMotion ? 0 : i * 70}ms">
      <div class="card-media">
        <img src="${esc(p.image)}" alt="${esc(p.title)} cover" loading="lazy" width="1200" height="750" onerror="this.style.display='none'">
        <span class="year">${esc(p.year)}</span>
      </div>
      <div class="card-body">
        <h3>${esc(p.title)}</h3>
        <p class="blurb">${esc(p.blurb)}</p>
        ${p.points && p.points.length ? `<ul class="points">${p.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        ${links ? `<div class="card-links">${links}</div>` : ""}
      </div>
    </article>`;
  }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  function openCrate(id, focusProject, originRect) {
    const idx = Math.max(0, S.crates.findIndex((c) => c.id === id));
    currentCrate = idx;
    const c = S.crates[idx];
    $("#stackTitle").textContent = c.title;
    const body = $("#stackBody");
    body.innerHTML = projectsIn(c.id).map(cardHTML).join("");
    const next = S.crates[(idx + 1) % S.crates.length];
    $("#nextCrateBtn").innerHTML = `${esc(next.title)} <span aria-hidden="true">→</span>`;
    const fromOrigin = !!originRect && !reduceMotion && !focusProject;
    body.classList.toggle("flip", fromOrigin);
    // remember where this stack came from (kept while stepping between crates)
    if (originRect || !stackDlg.open) opened = { id: c.id, rect: originRect || null };
    openDialog(stackDlg);
    body.scrollTop = 0;
    body.focus({ preventScroll: true });
    if (fromOrigin) flipIn(originRect);
    if (focusProject) {
      const el = document.getElementById("card-" + slug(focusProject));
      if (el) setTimeout(() => {
        body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - 18;
      }, 120);
    }
  }
  function stepCrate(d) {
    const n = S.crates.length;
    openCrate(S.crates[(currentCrate + d + n) % n].id);
  }
  $("#nextCrateBtn").addEventListener("click", () => stepCrate(1));
  stackDlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); stepCrate(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); stepCrate(-1); }
  });
  // horizontal swipe = next / previous crate
  let sx = 0, sy = 0;
  stackDlg.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stackDlg.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) stepCrate(dx < 0 ? 1 : -1);
  }, { passive: true });

  const PANELS = {
    about: () => ({
      title: "About me",
      html: `<div class="panel panel-about">
        <img src="${esc(S.photo)}" alt="Portrait of Atul Abraham" width="853" height="1280">
        <div><h3>Hi, I'm Atul.</h3><p class="lead">${esc(S.about.lead)}</p>${S.about.body.map((p) => `<p>${esc(p)}</p>`).join("")}
        ${rolesHTML}
        <div class="contact-actions" style="margin-top:22px">
          <a class="btn btn-primary btn-sm" href="${esc(S.resume)}" target="_blank" rel="noopener">${ICON.doc}Résumé</a>
          <a class="btn btn-secondary btn-sm" href="#experience" data-close>Experience ↓</a>
        </div></div></div>`,
    }),
    why: () => ({ title: "Why hire Atul?", html: crtHTML() }),
    contact: () => ({
      title: "Leave a message",
      html: `<div class="panel panel-contact"><h3>Let's talk.</h3>
        <p class="lead">Email is the quickest way to reach me. I am happy to talk about internships, projects or anything on this desk.</p>
        <p>${esc(S.links.email)} <button type="button" class="btn btn-secondary btn-sm" data-copy="${esc(S.links.email)}" style="margin-left:8px">Copy</button></p>
        <div class="contact-actions">${contactActionsHTML()}</div></div>`,
    }),
    list: () => ({
      title: "All projects",
      html: `<div class="panel"><h3>Everything, as a list.</h3>${S.crates
        .map(
          (c) => `<div class="list-group"><h4>${esc(c.title)}</h4>${projectsIn(c.id)
            .map((p) => `<button type="button" class="list-row" data-crate="${c.id}" data-project="${esc(p.title)}"><span class="t">${esc(p.title)}<span class="s">${esc(p.tags.join(" · "))}</span></span><span class="y">${esc(p.year)}</span></button>`)
            .join("")}</div>`
        )
        .join("")}</div>`,
    }),
  };
  function openPanel(name) {
    if (name === "why" && window.RETRO && typeof window.RETRO.open === "function") return window.RETRO.open();
    const p = PANELS[name] && PANELS[name]();
    if (!p) return;
    $("#panelTitle").textContent = p.title;
    $("#panelBody").innerHTML = p.html;
    openDialog(panelDlg);
    $("#panelBody").scrollTop = 0;
    $("#panelBody").focus({ preventScroll: true });
  }

  // delegated triggers
  document.addEventListener("click", (e) => {
    const crateBtn = e.target.closest("[data-crate]");
    if (crateBtn) { e.preventDefault(); return openCrate(crateBtn.dataset.crate, crateBtn.dataset.project); }
    const goBtn = e.target.closest("[data-goto]");
    if (goBtn) { e.preventDefault(); const t = document.getElementById(goBtn.dataset.goto); if (t) t.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); return; }
    const openBtn = e.target.closest("[data-open]");
    if (openBtn) { e.preventDefault(); return openPanel(openBtn.dataset.open); }
  });
  $("#allProjectsBtn").addEventListener("click", () => openPanel("list"));

  /* ---------------- Scroll UI ---------------- */
  const topbar = $("#topbar");
  const onScroll = () => topbar.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const dots = $$(".dots a");
  const sections = dots.map((d) => document.getElementById(d.dataset.dot));
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) dots.forEach((d) => d.classList.toggle("on", d.dataset.dot === en.target.id));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => s && spy.observe(s));

  const rev = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); rev.unobserve(en.target); } }),
    { rootMargin: "0px 0px -8% 0px" }
  );
  $$(".reveal").forEach((el) => rev.observe(el));

  /* ---------------- API for the 3D scene ---------------- */
  window.DESK = { openCrate, openPanel, reduceMotion };
})();
