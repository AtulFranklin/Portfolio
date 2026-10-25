/* books.js - the "stack of books" project picker.
   window.BOOKS.mount(el, crates, projects, onOpen) renders a pile of books (one per crate).
   Clicking a book plays an opening animation, then calls onOpen(crateId, originRect),
   where originRect is the DOMRect of the opened book's first page.
   window.BOOKS.close(crateId) plays it back into the pile and returns a Promise.
   Classic script, no dependencies. All classes are prefixed "bk-". */
(function () {
  "use strict";

  var PERSP_FAR = 9000; // near-orthographic at the start so the clone matches the flat pile
  var PERSP_NEAR = 2000; // dramatic perspective for the cover swing
  var OPEN_MS = 1150;
  var CLOSE_MS = 1000;
  var ASPECT = 0.7; // cover width / cover height
  var DIM = 0.6; // opacity of the open book while the card stack is on top of it

  var EMBLEMS = {
    fintech: '<path d="M6 4v16M6 8h-2v7h4V8zM12 3v18M10 6h4v6h-4zM18 6v14M16 10h4v6h-4z"/>',
    apps: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.5h3"/>',
    tools: '<path d="M12 2.5l2.2 6.6 6.8.1-5.5 4.1 2 6.6L12 16l-5.5 3.9 2-6.6L3 9.2l6.8-.1z"/>',
    engineering:
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.4"/>',
  };
  var EMBLEM_FALLBACK = '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>';

  /* Per-position shape of the pile, top to bottom (cycled for more than 4 books).
     w: length as a share of the pile, x: sideways offset px, z: pushed back px, r: tilt deg, v: spine style. */
  var SHAPES = [
    { w: 0.83, x: 18, z: 0, r: -0.35, v: 0 },
    { w: 0.95, x: 0, z: 5, r: 0.25, v: 1 },
    { w: 0.88, x: 26, z: 0, r: -0.2, v: 2 },
    { w: 1.0, x: 6, z: 2, r: 0.12, v: 1 },
    { w: 0.9, x: 14, z: 3, r: -0.3, v: 0 },
  ];

  var S = {
    root: null,
    crates: [],
    projects: [],
    onOpen: null,
    busy: false,
    open: null, // { id, btn, stage, model, hinge, page, scrim, shadow, dims }
    pending: null,
  };

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function hexToHsl(hex) {
    var m = String(hex || "").replace("#", "");
    if (m.length === 3) m = m.replace(/./g, "$&$&");
    var n = parseInt(m, 16);
    if (isNaN(n) || m.length !== 6) return [30, 0.3, 0.5];
    var r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hsl(h, s, l) {
    return "hsl(" + h.toFixed(1) + " " + (Math.max(0, Math.min(1, s)) * 100).toFixed(1) + "% " + (Math.max(0, Math.min(1, l)) * 100).toFixed(1) + "%)";
  }
  /* Bookcloth colours: the crate accent darkened and desaturated so it sits in the warm night UI. */
  function clothVars(hex) {
    var c = hexToHsl(hex), h = c[0];
    var s = Math.max(0.2, Math.min(0.46, c[1] * 0.5));
    // warm the hue a touch toward amber so blues and greens still feel lamp-lit
    var l = 0.27;
    return (
      "--bk-c:" + hsl(h, s, l) + ";--bk-hi:" + hsl(h, s * 0.95, l + 0.085) + ";--bk-lo:" + hsl(h, s, l - 0.075) +
      ";--bk-deep:" + hsl(h, s * 0.9, l - 0.135) + ";--bk-lit:" + hsl(h, s * 0.9, l + 0.05) + ";"
    );
  }
  function projectsIn(id) {
    return S.projects.filter(function (p) { return p.crate === id; });
  }
  function yearSpan(list) {
    var ys = list
      .map(function (p) { return String(p.year == null ? "" : p.year).trim(); })
      .filter(function (y) { return /^\d{4}$/.test(y); })
      .map(Number);
    if (!ys.length) return "";
    var a = Math.min.apply(null, ys), b = Math.max.apply(null, ys);
    return a === b ? String(a) : a + "-" + b;
  }
  function countLabel(n) {
    return n + " project" + (n === 1 ? "" : "s");
  }
  function emblem(id, cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (EMBLEMS[id] || EMBLEM_FALLBACK) + "</svg>";
  }
  function info(id) {
    var crate = null, idx = -1;
    for (var i = 0; i < S.crates.length; i++) if (S.crates[i].id === id) { crate = S.crates[i]; idx = i; }
    var list = projectsIn(id);
    return { crate: crate, idx: idx, list: list, n: list.length, years: yearSpan(list) };
  }

  /* The spine face, shared by the pile and the flying clone so the hand-off is pixel-identical. */
  function spineHTML(inf) {
    var c = inf.crate;
    return (
      '<span class="bk-cap bk-cap-l"><i></i><i></i></span>' +
      emblem(c.id, "bk-emb") +
      '<span class="bk-label"><span class="bk-title">' + esc(c.title) + "</span></span>" +
      '<span class="bk-meta"><span>' + esc(countLabel(inf.n)) + "</span>" + (inf.years ? "<span>" + esc(inf.years) + "</span>" : "") + "</span>" +
      '<span class="bk-cap bk-cap-r"><i></i><i></i></span>'
    );
  }

  /* ---------------- mount ---------------- */
  function mount(el, crates, projects, onOpen) {
    if (!el) return window.BOOKS;
    S.crates = crates || [];
    S.projects = projects || [];
    S.onOpen = typeof onOpen === "function" ? onOpen : function () {};
    S.root = el;
    el.classList.add("bk-host");

    var total = S.crates.length;
    var html = S.crates
      .map(function (c, i) {
        var inf = info(c.id);
        var sh = SHAPES[i % SHAPES.length];
        var style =
          clothVars(c.color) +
          "--bk-w:" + sh.w + ";--bk-x:" + sh.x + "px;--bk-z:" + sh.z + "px;--bk-r:" + sh.r + "deg;--bk-n:" + Math.min(inf.n, 7) + ";z-index:" + (total - i) + ";";
        var name = "Open " + c.title + " - " + countLabel(inf.n);
        return (
          '<div class="bk-item" role="listitem" style="' + style + '">' +
          '<button type="button" class="bk-book bk-v' + sh.v + '" data-book-id="' + esc(c.id) + '" aria-label="' + esc(name) + '">' +
          '<span class="bk-top" aria-hidden="true"></span>' +
          '<span class="bk-end" aria-hidden="true"></span>' +
          '<span class="bk-spine" aria-hidden="true">' + spineHTML(inf) + "</span>" +
          "</button></div>"
        );
      })
      .join("");
    el.innerHTML = '<div class="bk-pile" role="list">' + html + "</div>";

    Array.prototype.forEach.call(el.querySelectorAll(".bk-book"), function (btn) {
      btn.addEventListener("click", onBookClick);
    });
    return window.BOOKS;
  }

  function onBookClick(e) {
    e.preventDefault();
    var btn = e.currentTarget;
    if (S.busy || S.open) return;
    var id = btn.getAttribute("data-book-id");
    if (reduced()) {
      callOpen(id, btn.getBoundingClientRect());
      return;
    }
    S.pending = openBook(id, btn);
  }

  function callOpen(id, rect) {
    try {
      S.onOpen(id, rect);
    } catch (err) {
      if (window.console) console.error(err);
    }
  }

  /* ---------------- geometry ---------------- */
  function pileGeom(btn) {
    var r = btn.getBoundingClientRect();
    var t = getComputedStyle(btn).transform;
    var rot = 0;
    if (t && t !== "none") {
      var m = t.match(/matrix\(([^)]+)\)/);
      if (m) {
        var v = m[1].split(",").map(parseFloat);
        rot = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
      }
    }
    var d = parseFloat(getComputedStyle(btn).getPropertyValue("--bk-d")) || 22;
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, L: btn.offsetWidth, T: btn.offsetHeight, rot: rot, d: d };
  }

  function viewDims(g) {
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = window.innerHeight;
    var CH = Math.min(vh * 0.64, 560, (vw - 56) / ASPECT);
    CH = Math.max(CH, 200);
    var CW = CH * ASPECT;
    var CT = Math.max(14, Math.min(CH * 0.16, (CH * g.T) / g.L));
    var shift = Math.max(0, Math.min(CW / 2, vw / 2 - 16 - CW / 2));
    return { vw: vw, vh: vh, CW: CW, CH: CH, CT: CT, shift: shift, cx: vw / 2, cy: vh / 2 + Math.min(18, vh * 0.02) };
  }

  /* One transform shape for every keyframe so the browser interpolates each function separately. */
  function tf(p, D) {
    return (
      "translate3d(" + (p.x - D.CW / 2).toFixed(2) + "px," + (p.y - D.CH / 2).toFixed(2) + "px," + p.z.toFixed(2) + "px) " +
      "rotate(" + p.r.toFixed(3) + "deg) scale(" + p.s.toFixed(4) + ") rotateY(" + p.ry.toFixed(3) + "deg) rotateX(" +
      p.rx.toFixed(3) + "deg) rotateZ(" + p.rz.toFixed(3) + "deg)"
    );
  }

  /* Poses: P0 lying in the pile (spine to the viewer, cover up), P1 slid out, P2 turning, P3 facing, P4 shifted open. */
  function poses(g, D) {
    var s0 = g.L / D.CH;
    var depth = D.CW * s0; // apparent depth of the book at pile scale
    var a = (Math.asin(Math.min(0.5, g.d / depth)) * 180) / Math.PI; // shows the same top and end slivers as the flat pile
    var P0 = { x: g.cx, y: g.cy, z: -depth / 2, r: g.rot, s: s0, ry: -a, rx: 90 - a, rz: -90 };
    var P1 = { x: g.cx - 16, y: g.cy + 6, z: -depth / 2 + 40, r: g.rot - 1.6, s: s0 * 1.03, ry: -a - 5, rx: 90 - a - 9, rz: -90 };
    var P3 = { x: D.cx, y: D.cy, z: -D.CT / 2, r: 0, s: 1, ry: 0, rx: 0, rz: 0 };
    var mix = function (k, a1, b1) { return a1 + (b1 - a1) * k; };
    var P2 = {
      x: mix(0.55, P1.x, P3.x), y: mix(0.55, P1.y, P3.y) - Math.min(70, D.vh * 0.08), z: 140,
      r: -3, s: mix(0.6, P1.s, 1), ry: -22, rx: 38, rz: -38,
    };
    var P4 = { x: D.cx + D.shift, y: D.cy, z: -D.CT / 2, r: 0, s: 1, ry: 0, rx: 0, rz: 0 };
    return { P0: P0, P1: P1, P2: P2, P3: P3, P4: P4 };
  }

  /* ---------------- the flying book ---------------- */
  function buildStage(inf, g, D) {
    var c = inf.crate;
    var stage = document.createElement("div");
    stage.className = "bk-stage";
    stage.setAttribute("aria-hidden", "true");
    var u = D.CW / 100;
    var name = (window.SITE && window.SITE.name) || "";
    var vol = inf.idx + 1, of = S.crates.length;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var contents = inf.list
      .slice(0, 7)
      .map(function (p) {
        return '<li><span class="bk-ct">' + esc(p.title) + '</span><span class="bk-dots"></span><span class="bk-cy">' + esc(p.year) + "</span></li>";
      })
      .join("");
    var half = D.CT / 2;
    var skin = clothVars(c.color);
    stage.innerHTML =
      '<div class="bk-scrim"></div>' +
      '<div class="bk-shadow"></div>' +
      '<div class="bk-view">' +
      '<div class="bk-model" style="' + skin + "--bk-u:" + u.toFixed(3) + "px;width:" + D.CW + "px;height:" + D.CH + 'px">' +
      '<div class="bk-f bk-back" style="transform:translateZ(' + -half + 'px) rotateY(180deg)"></div>' +
      '<div class="bk-f bk-page" style="transform:translateZ(' + (half - 1.5) + 'px)">' +
      '<p class="bk-pg-no">' + pad(vol) + " / " + pad(of) + "</p>" +
      emblem(c.id, "bk-pg-emb") +
      '<h3 class="bk-pg-title">' + esc(c.title) + "</h3>" +
      '<p class="bk-pg-meta">' + esc(countLabel(inf.n)) + (inf.years ? " · " + esc(inf.years) : "") + "</p>" +
      '<p class="bk-pg-h">Contents</p><ol class="bk-pg-list">' + contents + "</ol>" +
      "</div>" +
      '<div class="bk-f bk-mspine" style="width:' + D.CT + "px;height:" + D.CH + "px;transform:translateZ(" + -half + 'px) rotateY(-90deg)">' +
      '<div class="bk-spine bk-v' + SHAPES[inf.idx % SHAPES.length].v + '" style="width:' + g.L + "px;height:" + g.T + "px;left:" + (D.CT / 2 - g.L / 2) + "px;top:" + (D.CH / 2 - g.T / 2) +
      "px;transform:rotate(90deg) scale(" + (D.CH / g.L).toFixed(5) + ')">' + spineHTML(inf) + "</div></div>" +
      '<div class="bk-f bk-fore" style="width:' + D.CT + "px;height:" + D.CH + "px;left:" + D.CW + "px;transform:translateZ(" + half + 'px) rotateY(90deg)"></div>' +
      '<div class="bk-f bk-head" style="width:' + D.CW + "px;height:" + D.CT + "px;transform:translateZ(" + -half + 'px) rotateX(90deg)"></div>' +
      '<div class="bk-f bk-tail" style="width:' + D.CW + "px;height:" + D.CT + "px;top:" + D.CH + "px;transform:translateZ(" + half + 'px) rotateX(-90deg)"></div>' +
      '<div class="bk-hinge" style="transform:translateZ(' + half + 'px) rotateY(0deg)">' +
      '<div class="bk-f bk-cover-out">' +
      '<span class="bk-cv-frame"></span>' +
      '<p class="bk-cv-vol">Vol. ' + pad(vol) + "</p>" +
      emblem(c.id, "bk-cv-emb") +
      '<p class="bk-cv-title">' + esc(c.title) + "</p>" +
      '<span class="bk-cv-rule"></span>' +
      '<p class="bk-cv-meta">' + esc(countLabel(inf.n)) + "</p>" +
      '<p class="bk-cv-foot">' + (inf.years ? esc(inf.years) : "") + (name ? "<span>" + esc(name) + "</span>" : "") + "</p>" +
      "</div>" +
      '<div class="bk-f bk-cover-in"><div class="bk-plate"><span>Ex libris</span><b>' + esc(name || c.title) + "</b></div></div>" +
      "</div>" +
      "</div>" +
      "</div>";
    document.body.appendChild(stage);
    return {
      stage: stage,
      scrim: stage.querySelector(".bk-scrim"),
      shadow: stage.querySelector(".bk-shadow"),
      view: stage.querySelector(".bk-view"),
      model: stage.querySelector(".bk-model"),
      hinge: stage.querySelector(".bk-hinge"),
      page: stage.querySelector(".bk-page"),
    };
  }

  function placeShadow(el, D) {
    // the shadow spans the open spread; before the cover opens it is squeezed under the closed book
    el.style.width = D.CW * 2 + "px";
    el.style.height = D.CH * 0.94 + "px";
    el.style.left = D.cx + D.shift - D.CW * 1.5 + "px";
    el.style.top = D.cy - D.CH * 0.47 + 18 + "px";
  }

  function hingeTf(D, deg) {
    return "translateZ(" + D.CT / 2 + "px) rotateY(" + deg + "deg)";
  }

  function settle(anims) {
    return Promise.all(
      anims.map(function (a) {
        return a.finished.then(
          function () {
            try { a.commitStyles(); } catch (_) { /* element may be detached */ }
            a.cancel();
          },
          function () {}
        );
      })
    );
  }

  function openBook(id, btn) {
    var inf = info(id);
    if (!inf.crate) return Promise.resolve();
    S.busy = true;
    var g = pileGeom(btn);
    var D = viewDims(g);
    var P = poses(g, D);
    var parts = buildStage(inf, g, D);
    placeShadow(parts.shadow, D);
    parts.model.style.transform = tf(P.P0, D);
    parts.view.style.perspective = PERSP_FAR + "px";
    // hide the pile copy only once the clone has been painted in its place
    btn.classList.add("bk-out");

    var T = OPEN_MS;
    var anims = [
      parts.model.animate(
        [
          { transform: tf(P.P0, D), offset: 0, easing: "cubic-bezier(.3,0,.3,1)" },
          { transform: tf(P.P1, D), offset: 0.17, easing: "cubic-bezier(.4,0,.6,1)" },
          { transform: tf(P.P2, D), offset: 0.4, easing: "cubic-bezier(.2,.6,.25,1)" },
          { transform: tf(P.P3, D), offset: 0.6, easing: "cubic-bezier(.45,0,.25,1)" },
          { transform: tf(P.P4, D), offset: 1 },
        ],
        { duration: T, fill: "forwards" }
      ),
      parts.view.animate(
        [
          { perspective: PERSP_FAR + "px", offset: 0, easing: "cubic-bezier(.5,0,.5,1)" },
          { perspective: PERSP_FAR + "px", offset: 0.15, easing: "cubic-bezier(.3,0,.3,1)" },
          { perspective: PERSP_NEAR + "px", offset: 0.55 },
          { perspective: PERSP_NEAR + "px", offset: 1 },
        ],
        { duration: T, fill: "forwards" }
      ),
      parts.hinge.animate(
        [
          { transform: hingeTf(D, 0), easing: "cubic-bezier(.5,0,.3,1)" },
          { transform: hingeTf(D, -174), offset: 0.84, easing: "cubic-bezier(.3,0,.4,1)" },
          { transform: hingeTf(D, -166) },
        ],
        { duration: T * 0.42, delay: T * 0.58, fill: "both" }
      ),
      parts.scrim.animate(
        [{ opacity: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 1 }],
        { duration: T, fill: "forwards", easing: "ease-out" }
      ),
      parts.shadow.animate(
        [
          { opacity: 0, transform: "translateX(" + -D.shift + "px) scaleX(.5)", offset: 0 },
          { opacity: 0, transform: "translateX(" + -D.shift + "px) scaleX(.5)", offset: 0.45 },
          { opacity: 0.7, transform: "translateX(" + -D.shift + "px) scaleX(.5)", offset: 0.6 },
          { opacity: 1, transform: "translateX(0px) scaleX(1)", offset: 1 },
        ],
        { duration: T, fill: "forwards", easing: "cubic-bezier(.45,0,.25,1)" }
      ),
    ];

    return settle(anims).then(function () {
      S.open = { id: id, btn: btn, inf: inf, g: g, D: D, parts: parts };
      S.busy = false;
      var rect = parts.page.getBoundingClientRect();
      callOpen(id, rect);
      // the card stack takes over: the book stays behind it, slightly dimmed
      var dim = parts.view.animate([{ opacity: 1 }, { opacity: DIM }], { duration: 420, easing: "ease-out", fill: "forwards" });
      S.open.dim = dim;
    });
  }

  /* ---------------- close ---------------- */
  function close() {
    if (S.busy && S.pending) {
      return S.pending.then(function () { return close(); });
    }
    var o = S.open;
    if (!o) return Promise.resolve();
    S.busy = true;
    var parts = o.parts, D = o.D;
    var btn = o.btn;
    var still = btn && document.contains(btn);
    var g = still ? pileGeom(btn) : o.g;
    var P = poses(g, D);
    var T = CLOSE_MS;
    if (o.dim) { try { o.dim.cancel(); } catch (_) {} }

    var anims = [
      parts.view.animate([{ opacity: DIM }, { opacity: 1, offset: 0.18 }, { opacity: 1 }], { duration: T, fill: "forwards" }),
      parts.hinge.animate(
        [
          { transform: hingeTf(D, -166), easing: "cubic-bezier(.5,0,.3,1)" },
          { transform: hingeTf(D, 0) },
        ],
        { duration: T * 0.4, fill: "both" }
      ),
      parts.model.animate(
        [
          { transform: tf(P.P4, D), offset: 0, easing: "cubic-bezier(.5,0,.3,1)" },
          { transform: tf(P.P3, D), offset: 0.4, easing: "cubic-bezier(.45,0,.6,1)" },
          { transform: tf(P.P2, D), offset: 0.62, easing: "cubic-bezier(.3,0,.3,1)" },
          { transform: tf(P.P1, D), offset: 0.84, easing: "cubic-bezier(.4,0,.2,1)" },
          { transform: tf(P.P0, D), offset: 1 },
        ],
        { duration: T, fill: "forwards", composite: "replace" }
      ),
      parts.view.animate(
        [
          { perspective: PERSP_NEAR + "px", offset: 0 },
          { perspective: PERSP_NEAR + "px", offset: 0.4, easing: "cubic-bezier(.5,0,.7,1)" },
          { perspective: PERSP_FAR + "px", offset: 0.85 },
          { perspective: PERSP_FAR + "px", offset: 1 },
        ],
        { duration: T, fill: "forwards" }
      ),
      parts.scrim.animate([{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0, offset: 0.85 }, { opacity: 0 }], {
        duration: T, fill: "forwards", easing: "ease-in",
      }),
      parts.shadow.animate(
        [
          { opacity: 1, transform: "translateX(0px) scaleX(1)" },
          { opacity: 0.7, transform: "translateX(" + -D.shift + "px) scaleX(.5)", offset: 0.4 },
          { opacity: 0, transform: "translateX(" + -D.shift + "px) scaleX(.5)", offset: 0.6 },
          { opacity: 0, transform: "translateX(" + -D.shift + "px) scaleX(.5)" },
        ],
        { duration: T, fill: "forwards", easing: "cubic-bezier(.45,0,.25,1)" }
      ),
    ];

    return settle(anims).then(function () {
      if (still) btn.classList.remove("bk-out");
      // let the pile book paint before the clone goes, so there is no flicker
      return new Promise(function (res) {
        requestAnimationFrame(function () {
          if (parts.stage.parentNode) parts.stage.parentNode.removeChild(parts.stage);
          S.open = null;
          S.busy = false;
          S.pending = null;
          res();
        });
      });
    });
  }

  /* Keep an open book centred if the window changes size. */
  window.addEventListener("resize", function () {
    var o = S.open;
    if (!o || S.busy) return;
    var D = viewDims(o.g);
    // keep the original model size (it holds the text layout); just move it
    D.CW = o.D.CW; D.CH = o.D.CH; D.CT = o.D.CT;
    D.shift = Math.max(0, Math.min(D.CW / 2, D.vw / 2 - 16 - D.CW / 2));
    o.D = D;
    o.parts.model.style.transform = tf(poses(o.g, D).P4, D);
    placeShadow(o.parts.shadow, D);
  });

  window.BOOKS = { mount: mount, close: close };
})();
