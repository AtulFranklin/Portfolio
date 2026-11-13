// books: project picker with open/close animation
// BOOKS.mount(el, crates, projects, onOpen), BOOKS.close(id), BOOKS.openReader(id, opts)
(function () {
  "use strict";

  var PERSP_FAR = 9000; // near flat, matches the pile
  var PERSP_NEAR = 2000; // strong perspective for cover swing
  var OPEN_MS = 1150;
  var CLOSE_MS = 1000;
  var ASPECT = 0.7; // cover width / cover height
  var DIM = 0.6; // open book opacity under the cards
  var MOBILE_Q = "(max-width: 720px)";
  var TURN_MS = 820;
  var TURN_FAST_MS = 440;

  var EMBLEMS = {
    fintech: '<path d="M6 4v16M6 8h-2v7h4V8zM12 3v18M10 6h4v6h-4zM18 6v14M16 10h4v6h-4z"/>',
    apps: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.5h3"/>',
    tools: '<path d="M12 2.5l2.2 6.6 6.8.1-5.5 4.1 2 6.6L12 16l-5.5 3.9 2-6.6L3 9.2l6.8-.1z"/>',
    engineering:
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.4"/>',
  };
  var EMBLEM_FALLBACK = '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>';
  EMBLEMS.star = EMBLEM_FALLBACK; // "icon: star" in book.txt

  /* pile shape per slot: w share, x/z px, r tilt, v spine */
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

  /* ---- helpers ---- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isMobile() {
    return !!(window.matchMedia && window.matchMedia(MOBILE_Q).matches);
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
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
  /* cloth colour: darkened accent */
  function clothVars(hex) {
    var c = hexToHsl(hex), h = c[0];
    var s = Math.max(0.2, Math.min(0.46, c[1] * 0.5));
    // nudge hue toward amber
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
  /* emblem: icon field, then id, then star */
  function emblem(crate, cls) {
    var c = crate || {};
    var icon = String(c.icon || "").toLowerCase();
    var has = function (k) { return !!k && Object.prototype.hasOwnProperty.call(EMBLEMS, k); };
    var path = has(icon) ? EMBLEMS[icon] : has(c.id) ? EMBLEMS[c.id] : EMBLEM_FALLBACK;
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + path + "</svg>";
  }
  function info(id) {
    var crate = null, idx = -1;
    for (var i = 0; i < S.crates.length; i++) if (S.crates[i].id === id) { crate = S.crates[i]; idx = i; }
    var list = projectsIn(id);
    return { crate: crate, idx: idx, list: list, n: list.length, years: yearSpan(list) };
  }

  /* spine face, shared by pile and clone */
  function spineHTML(inf) {
    var c = inf.crate;
    return (
      '<span class="bk-cap bk-cap-l"><i></i><i></i></span>' +
      emblem(c, "bk-emb") +
      '<span class="bk-label"><span class="bk-title">' + esc(c.title) + "</span></span>" +
      '<span class="bk-meta"><span>' + esc(countLabel(inf.n)) + "</span>" + (inf.years ? "<span>" + esc(inf.years) + "</span>" : "") + "</span>" +
      '<span class="bk-cap bk-cap-r"><i></i><i></i></span>'
    );
  }

  /* ---- mount ---- */
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
    if (!isMobile()) {
      openReader(id, { btn: btn });
      return;
    }
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

  /* ---- geometry ---- */
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

  /* same transform list per keyframe so it interpolates */
  function tf(p, D) {
    return (
      "translate3d(" + (p.x - D.CW / 2).toFixed(2) + "px," + (p.y - D.CH / 2).toFixed(2) + "px," + p.z.toFixed(2) + "px) " +
      "rotate(" + p.r.toFixed(3) + "deg) scale(" + p.s.toFixed(4) + ") rotateY(" + p.ry.toFixed(3) + "deg) rotateX(" +
      p.rx.toFixed(3) + "deg) rotateZ(" + p.rz.toFixed(3) + "deg)"
    );
  }

  /* poses: P0 pile, P1 out, P2 turn, P3 facing, P4 open */
  function poses(g, D) {
    var s0 = g.L / D.CH;
    var depth = D.CW * s0; // depth at pile scale
    var a = (Math.asin(Math.min(0.5, g.d / depth)) * 180) / Math.PI; // match the pile's top/end slivers
    var P0 = { x: g.cx, y: g.cy, z: -depth / 2, r: g.rot, s: s0, ry: -a, rx: 90 - a, rz: -90 };
    var P1 = { x: g.cx - 16, y: g.cy + 6, z: -depth / 2 + 40, r: g.rot - 1.6, s: s0 * 1.03, ry: -a - 5, rx: 90 - a - 9, rz: -90 };
    var P3 = { x: D.cx, y: D.cy, z: -D.CT / 2, r: 0, s: 1, ry: 0, rx: 0, rz: 0 };
    var mix = function (k, a1, b1) { return a1 + (b1 - a1) * k; };
    var P2 = {
      x: mix(0.55, P1.x, P3.x), y: mix(0.55, P1.y, P3.y) - Math.min(70, D.vh * 0.08), z: 140 * (D.k || 1),
      r: -3, s: mix(0.6, P1.s, 1), ry: -22, rx: 38, rz: -38,
    };
    var P4 = { x: D.cx + D.shift, y: D.cy, z: -D.CT / 2, r: 0, s: 1, ry: 0, rx: 0, rz: 0 };
    return { P0: P0, P1: P1, P2: P2, P3: P3, P4: P4 };
  }

  /* ---- flying book ---- */
  function modelHTML(inf, g, D, rd) {
    var c = inf.crate;
    var u = D.CW / 100;
    var name = (window.SITE && window.SITE.name) || "";
    var vol = inf.idx + 1, of = S.crates.length;
    var contents = inf.list
      .slice(0, 7)
      .map(function (p) {
        return '<li><span class="bk-ct">' + esc(p.title) + '</span><span class="bk-dots"></span><span class="bk-cy">' + esc(p.year) + "</span></li>";
      })
      .join("");
    var half = D.CT / 2;
    var skin = clothVars(c.color);
    var first = rd
      ? '<div class="bk-f bk-page bk-page-rd" style="transform:translateZ(' + (half - 1.5) + 'px)">' + tocHTML(inf, true) + "</div>"
      : '<div class="bk-f bk-page" style="transform:translateZ(' + (half - 1.5) + 'px)">' +
        '<p class="bk-pg-no">' + pad(vol) + " / " + pad(of) + "</p>" +
        emblem(c, "bk-pg-emb") +
        '<h3 class="bk-pg-title">' + esc(c.title) + "</h3>" +
        '<p class="bk-pg-meta">' + esc(countLabel(inf.n)) + (inf.years ? " · " + esc(inf.years) : "") + "</p>" +
        '<p class="bk-pg-h">Contents</p><ol class="bk-pg-list">' + contents + "</ol>" +
        "</div>";
    return (
      '<div class="bk-model" style="' + skin + "--bk-u:" + u.toFixed(3) + "px;width:" + D.CW + "px;height:" + D.CH + 'px">' +
      '<div class="bk-f bk-back" style="transform:translateZ(' + -half + 'px) rotateY(180deg)"></div>' +
      first +
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
      emblem(c, "bk-cv-emb") +
      '<p class="bk-cv-title">' + esc(c.title) + "</p>" +
      '<span class="bk-cv-rule"></span>' +
      '<p class="bk-cv-meta">' + esc(countLabel(inf.n)) + "</p>" +
      '<p class="bk-cv-foot">' + (inf.years ? esc(inf.years) : "") + (name ? "<span>" + esc(name) + "</span>" : "") + "</p>" +
      "</div>" +
      '<div class="bk-f bk-cover-in">' + plateHTML(inf) + "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function plateHTML(inf) {
    var name = (window.SITE && window.SITE.name) || "";
    return '<div class="bk-plate"><span>Ex libris</span><b>' + esc(name || inf.crate.title) + "</b></div>";
  }

  function modelParts(stage) {
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

  function buildStage(inf, g, D, rd) {
    var stage = document.createElement("div");
    stage.className = "bk-stage" + (rd ? " bk-stage-rd" : "");
    if (!rd) stage.setAttribute("aria-hidden", "true");
    stage.innerHTML =
      '<div class="bk-scrim"' + (rd ? ' aria-hidden="true"' : "") + "></div>" +
      '<div class="bk-shadow" aria-hidden="true"></div>' +
      '<div class="bk-view" aria-hidden="true"' + (rd ? " inert" : "") + ">" + modelHTML(inf, g, D, rd) + "</div>";
    if (!rd) document.body.appendChild(stage);
    return modelParts(stage);
  }

  function placeShadow(el, D) {
    // shadow under spread, squeezed while closed
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
            try { a.commitStyles(); } catch (_) { /* may be detached */ }
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
    // hide pile copy after clone paints
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
      // cards on top, dim the book
      var dim = parts.view.animate([{ opacity: 1 }, { opacity: DIM }], { duration: 420, easing: "ease-out", fill: "forwards" });
      S.open.dim = dim;
    });
  }

  /* ---- close ---- */
  function close() {
    if (S.open && S.open.reader) return closeReader();
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
      // paint pile book first, avoids flicker
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

  /* ---- reader (desktop) ---- */
  function readerDims(g) {
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = window.innerHeight;
    var top = 70, bot = 78; // close pill, page controls
    var CH = Math.min(vh * 0.84, vh - top - bot, Math.min(vw - 96, 1200) / 2 / ASPECT);
    CH = Math.floor(Math.max(CH, 300) / 2) * 2;
    var CW = Math.round(CH * ASPECT);
    var CT = Math.max(14, Math.min(CH * 0.16, (CH * g.T) / g.L));
    return {
      vw: vw, vh: vh, CW: CW, CH: CH, CT: CT, shift: CW / 2, k: CH / 560,
      cx: Math.round(vw / 2), cy: Math.round(top + (vh - top - bot) / 2),
    };
  }

  /* fake pile geometry, no pile copy */
  function originGeom(rect) {
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = window.innerHeight;
    var r = rect && rect.width > 0 && rect.height > 0 ? rect : null;
    return {
      cx: r ? r.left + r.width / 2 : vw / 2, cy: r ? r.top + r.height / 2 : vh / 2,
      w: r ? r.width : 0, h: r ? r.height : 0, L: 560, T: 56, rot: 0, d: 22, origin: true,
    };
  }

  function originPoses(g, D) {
    var base = poses(g, D);
    var s0 = g.w ? Math.max(0.08, Math.min(0.3, Math.max(g.w / D.CW, g.h / D.CH) * 0.9)) : 0.22;
    var mix = function (k, a1, b1) { return a1 + (b1 - a1) * k; };
    var P0 = { x: g.cx, y: g.cy, z: -D.CT / 2, r: -5, s: s0, ry: 0, rx: 0, rz: 0 };
    var P1 = { x: g.cx, y: g.cy - 8, z: 30 * D.k, r: -6, s: s0 * 1.12, ry: -10, rx: 8, rz: 0 };
    var P3 = base.P3;
    var P2 = {
      x: mix(0.55, P1.x, P3.x), y: mix(0.55, P1.y, P3.y) - Math.min(50, D.vh * 0.06), z: 140 * D.k,
      r: -3, s: mix(0.6, P1.s, 1), ry: -20, rx: 12, rz: 0,
    };
    return { P0: P0, P1: P1, P2: P2, P3: P3, P4: base.P4 };
  }

  /* page html */
  function tocHTML(inf, inert) {
    var c = inf.crate;
    var rows = inf.list
      .map(function (p, i) {
        return (
          '<li><button type="button" class="bk-toc-row" data-spread="' + (i + 1) + '"' + (inert ? ' tabindex="-1"' : "") + ">" +
          '<span class="bk-ct">' + esc(p.title) + '</span><span class="bk-dots"></span><span class="bk-cy">' + esc(p.year) + "</span></button></li>"
        );
      })
      .join("");
    return (
      '<div class="bk-pc bk-pc-toc bk-scroll">' +
      '<p class="bk-pg-no">' + pad(inf.idx + 1) + " / " + pad(S.crates.length) + "</p>" +
      emblem(c, "bk-pg-emb") +
      '<h3 class="bk-pg-title">' + esc(c.title) + "</h3>" +
      '<p class="bk-pg-meta">' + esc(countLabel(inf.n)) + (inf.years ? " · " + esc(inf.years) : "") + "</p>" +
      '<p class="bk-pg-h">Contents</p><ol class="bk-pg-list">' + rows + "</ol></div>"
    );
  }

  function runHead(inf) {
    return '<p class="bk-rh">Vol. ' + pad(inf.idx + 1) + " · " + esc(inf.crate.title) + "</p>";
  }

  function leftHTML(inf, p, i) {
    var tags = (p.tags || []).map(function (t) { return '<li class="bk-tag">' + esc(t) + "</li>"; }).join("");
    var img = p.image
      ? '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + ' cover" loading="lazy" decoding="async" width="1200" height="750" onerror="this.style.display=\'none\'">'
      : "";
    return (
      '<div class="bk-pc bk-pc-l">' + runHead(inf) +
      '<div class="bk-pc-scroll bk-scroll">' +
      '<figure class="bk-print"><span class="bk-print-ph">' + emblem(inf.crate, "bk-print-emb") + "</span>" + img +
      '<i class="bk-tape bk-tape-a"></i><i class="bk-tape bk-tape-b"></i></figure>' +
      (p.year ? '<p class="bk-pk">' + esc(p.year) + "</p>" : "") +
      '<h3 class="bk-pt">' + esc(p.title) + "</h3>" +
      (tags ? '<ul class="bk-tags" aria-label="Tags">' + tags + "</ul>" : "") +
      "</div>" +
      '<p class="bk-pn">' + 2 * (i + 1) + "</p></div>"
    );
  }

  function rightHTML(inf, p, i) {
    var pts = (p.points || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    var links = (p.links || [])
      .map(function (l) {
        return '<a href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.label) + ' <span aria-hidden="true">→</span></a>';
      })
      .join("");
    return (
      '<div class="bk-pc bk-pc-r"><p class="bk-rh bk-rh-r">' + esc(p.title) + "</p>" +
      '<div class="bk-pc-scroll bk-scroll">' +
      '<p class="bk-sec">About</p><p class="bk-blurb">' + esc(p.blurb || "") + "</p>" +
      (pts ? '<p class="bk-sec">Highlights</p><ul class="bk-pts">' + pts + "</ul>" : "") +
      (links ? '<div class="bk-links">' + links + "</div>" : "") +
      "</div>" +
      '<p class="bk-pn">' + (2 * (i + 1) + 1) + "</p></div>"
    );
  }

  function endHTML(inf) {
    var c = inf.crate;
    var next = S.crates.length > 1 ? S.crates[(inf.idx + 1) % S.crates.length] : null;
    return (
      '<div class="bk-pc bk-pc-l bk-pc-fin">' + runHead(inf) +
      '<div class="bk-pc-scroll bk-scroll bk-fin">' +
      emblem(c, "bk-pg-emb") +
      '<h3 class="bk-fin-t">End of Vol. ' + pad(inf.idx + 1) + "</h3>" +
      '<p class="bk-pg-meta">' + esc(c.title) + " · " + esc(countLabel(inf.n)) + "</p>" +
      '<span class="bk-fin-rule"></span>' +
      '<div class="bk-fin-acts">' +
      (next
        ? '<button type="button" class="btn btn-primary btn-sm" data-bk-next="' + esc(next.id) + '">Next book: ' + esc(next.title) + ' <span aria-hidden="true">→</span></button>'
        : "") +
      '<button type="button" class="btn btn-secondary btn-sm" data-bk-close>Back to shelf</button>' +
      "</div></div>" +
      '<p class="bk-pn">' + (2 * inf.n + 2) + "</p></div>"
    );
  }

  function node(html) {
    var t = document.createElement("div");
    t.innerHTML = html;
    return t.firstChild;
  }

  /* move a page, keep its scroll */
  function scrollers(el) {
    var list = Array.prototype.slice.call(el.querySelectorAll(".bk-scroll"));
    if (el.classList && el.classList.contains("bk-scroll")) list.unshift(el);
    return list;
  }
  function move(el, parent, before) {
    var sc = scrollers(el).map(function (x) { return x.scrollTop; });
    parent.insertBefore(el, before || null);
    scrollers(el).forEach(function (x, i) { if (sc[i]) x.scrollTop = sc[i]; });
  }
  function copyPage(el) {
    var c = el.cloneNode(true);
    c.__src = el;
    return c;
  }
  function syncScroll(c) {
    if (!c || !c.__src) return;
    var a = scrollers(c.__src), b = scrollers(c);
    b.forEach(function (x, i) { if (a[i] && a[i].scrollTop) x.scrollTop = a[i].scrollTop; });
  }

  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ICON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function buildReader(o) {
    var inf = o.inf, stage = o.parts.stage;
    var R = { L: [null], R: [node(tocHTML(inf, false))], cur: 0, want: 0, turning: false, chained: false };
    inf.list.forEach(function (p, i) {
      R.L.push(node(leftHTML(inf, p, i)));
      R.R.push(node(rightHTML(inf, p, i)));
    });
    R.L.push(node(endHTML(inf)));
    R.R.push(null);
    R.last = R.R.length - 1;

    var head = document.createElement("div");
    head.className = "bk-rd-head";
    head.innerHTML =
      '<div class="pill-head"><span id="bkTitle">' + esc(inf.crate.title) + "</span>" +
      '<button type="button" class="icon-btn" data-bk-close aria-label="Close book">' + ICON_X + "</button></div>";

    var rd = document.createElement("div");
    rd.className = "bk-rd";
    rd.innerHTML =
      '<div class="bk-rd-board bk-rd-board-l">' + plateHTML(inf) + "</div>" +
      '<div class="bk-rd-board bk-rd-board-r"></div>' +
      '<div class="bk-sheet bk-sheet-l bk-slot-l" hidden></div>' +
      '<div class="bk-sheet bk-sheet-r bk-slot-r"></div>' +
      '<div class="bk-cast bk-cast-l" aria-hidden="true"></div><div class="bk-cast bk-cast-r" aria-hidden="true"></div>' +
      '<div class="bk-turn" aria-hidden="true"></div>' +
      '<button type="button" class="bk-edge bk-edge-l" data-turn="-1" tabindex="-1" aria-hidden="true" hidden></button>' +
      '<button type="button" class="bk-edge bk-edge-r" data-turn="1" tabindex="-1" aria-hidden="true"></button>';

    var bar = document.createElement("div");
    bar.className = "bk-rd-bar";
    bar.innerHTML =
      '<div class="bk-bar-in">' +
      '<button type="button" class="icon-btn bk-nav" data-turn="-1" aria-label="Previous page" aria-disabled="true">' + ICON_L + "</button>" +
      '<span class="bk-count" aria-hidden="true"></span>' +
      '<button type="button" class="icon-btn bk-nav" data-turn="1" aria-label="Next page">' + ICON_R + "</button>" +
      "</div>";

    var live = document.createElement("p");
    live.className = "bk-sr";
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");

    stage.appendChild(head);
    stage.appendChild(rd);
    stage.appendChild(bar);
    stage.appendChild(live);

    R.el = {
      head: head, rd: rd, bar: bar, live: live,
      slotL: rd.querySelector(".bk-slot-l"), slotR: rd.querySelector(".bk-slot-r"),
      castL: rd.querySelector(".bk-cast-l"), castR: rd.querySelector(".bk-cast-r"),
      turn: rd.querySelector(".bk-turn"),
      edgeL: rd.querySelector(".bk-edge-l"), edgeR: rd.querySelector(".bk-edge-r"),
      prev: bar.querySelectorAll(".bk-nav")[0], next: bar.querySelectorAll(".bk-nav")[1],
      count: bar.querySelector(".bk-count"),
    };
    o.rd = R;
    setSlot(R.el.slotR, R.R[0]);
    syncUI(o);
  }

  function layoutReader(o) {
    var D = o.D, E = o.rd.el;
    var left = D.cx + D.shift - D.CW / 2 - D.CW;
    var top = D.cy - D.CH / 2;
    var st = E.rd.style;
    E.rd.setAttribute("style", clothVars(o.inf.crate.color));
    st.left = left + "px";
    st.top = top + "px";
    st.width = D.CW * 2 + "px";
    st.height = D.CH + "px";
    st.setProperty("--bk-u", (D.CW / 100).toFixed(3) + "px");
    st.setProperty("--bk-persp", Math.round(D.CW * 4.2) + "px");
    E.head.style.top = Math.max(8, top - 58) + "px";
    E.bar.style.top = top + D.CH + 16 + "px";
  }

  function setSlot(slot, el) {
    if (slot.firstChild !== el || slot.childNodes.length > 1) {
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      if (el) move(el, slot);
    }
    slot.hidden = !el;
    if (el) scrollers(el).forEach(moreHint);
  }

  /* fade hint while more to scroll */
  function moreHint(x) {
    x.classList.toggle("is-more", x.scrollHeight - x.scrollTop - x.clientHeight > 2);
  }

  /* page edges, one line per leaf */
  function stackShadow(n, dir) {
    var out = [];
    for (var i = 1; i <= Math.min(4, n); i++) {
      out.push(dir * i * 1.5 + "px " + (i * 0.75).toFixed(2) + "px 0 " + (i % 2 ? "var(--bk-paper-edge)" : "var(--bk-paper-line)"));
    }
    return out.length ? out.join(",") : "0 0 0 transparent";
  }

  function spreadLabel(o, s) {
    var R = o.rd;
    if (s === 0) return "Contents";
    if (s === R.last) return "End of Vol. " + pad(o.inf.idx + 1);
    return o.inf.list[s - 1].title;
  }

  function syncUI(o) {
    var R = o.rd, E = R.el, s = R.cur;
    E.count.textContent = s + 1 + " / " + (R.last + 1);
    E.prev.setAttribute("aria-disabled", s === 0 ? "true" : "false");
    E.next.setAttribute("aria-disabled", s === R.last ? "true" : "false");
    E.edgeL.hidden = s === 0;
    E.edgeR.hidden = s === R.last;
    E.slotL.style.setProperty("--bk-stack", stackShadow(s - 1, -1));
    E.slotR.style.setProperty("--bk-stack", stackShadow(R.last - s - 1, 1));
  }

  function announce(o) {
    var R = o.rd;
    R.el.live.textContent = spreadLabel(o, R.cur) + ", " + (R.cur + 1) + " of " + (R.last + 1);
  }

  /* ---- page turn ---- */
  function nav(d) {
    var o = S.open;
    if (!o || !o.rd || o.closing) return;
    var R = o.rd;
    go((R.turning ? R.want : R.cur) + d);
  }

  function go(s) {
    var o = S.open;
    if (!o || !o.rd || o.closing || S.busy) return;
    var R = o.rd;
    R.want = Math.max(0, Math.min(R.last, s));
    pump(o);
  }

  function pump(o) {
    var R = o.rd;
    if (R.turning || o.closing) return;
    if (R.want === R.cur) {
      R.chained = false;
      return;
    }
    var from = R.cur, to = R.want;
    // keep focus off pages that move
    var ae = document.activeElement;
    if (ae && R.el.rd.contains(ae)) (to > from ? R.el.next : R.el.prev).focus({ preventScroll: true });
    R.turning = true;
    preload(o, to);
    var run = reduced() ? fadeTurn(o, from, to) : leafTurn(o, from, to, R.chained);
    R.turnP = run.then(function () {
      R.cur = to;
      R.turning = false;
      syncUI(o);
      preload(o, to);
      if (o.closing) return;
      if (R.want !== R.cur) {
        R.chained = true;
        pump(o);
      } else {
        R.chained = false;
        announce(o);
      }
    });
    return R.turnP;
  }

  function finished(anims) {
    return Promise.all(anims.map(function (a) { return a.finished.catch(function () {}); }));
  }

  function leafTurn(o, from, to, fast) {
    var R = o.rd, E = R.el, fwd = to > from;
    var ks = [];
    for (var k = Math.min(from, to); k < Math.max(from, to); k++) ks.push(k);
    if (ks.length > 4) ks = [ks[0], ks[Math.round((ks.length - 1) / 3)], ks[Math.round(((ks.length - 1) * 2) / 3)], ks[ks.length - 1]];
    if (!fwd) ks.reverse();
    var m = ks.length;
    var dur = m > 1 ? (fast ? 560 : 680) : fast ? TURN_FAST_MS : TURN_MS;
    var gap = m > 1 ? Math.round(Math.min(150, 420 / m)) : 0;
    var lift = Math.round(o.D.CW * 0.06);
    var ease = "cubic-bezier(.42,.04,.28,1)";
    var clones = [];

    var leaves = ks.map(function (k) {
      var f = (fwd && k === from) || (!fwd && k === to) ? R.R[k] : copyPage(R.R[k]);
      var b = (fwd && k === to - 1) || (!fwd && k === from - 1) ? R.L[k + 1] : copyPage(R.L[k + 1]);
      var leaf = document.createElement("div");
      leaf.className = "bk-leaf";
      leaf.style.transform = "rotateY(" + (fwd ? 0 : -180) + "deg)";
      leaf.innerHTML =
        '<div class="bk-sheet bk-sheet-r bk-leaf-f"><i class="bk-leaf-sh"></i></div>' +
        '<div class="bk-sheet bk-sheet-l bk-leaf-b"><i class="bk-leaf-sh"></i></div>';
      E.turn.appendChild(leaf);
      move(f, leaf.firstChild, leaf.firstChild.firstChild);
      move(b, leaf.lastChild, leaf.lastChild.firstChild);
      if (f.__src) clones.push(f);
      if (b.__src) clones.push(b);
      return leaf;
    });
    clones.forEach(syncScroll);
    // page under the leaf
    if (fwd) setSlot(E.slotR, R.R[to]);
    else setSlot(E.slotL, R.L[to]);

    var a0 = fwd ? 0 : -180, a1 = fwd ? -180 : 0;
    var anims = [];
    leaves.forEach(function (leaf, i) {
      var t = { duration: dur, delay: i * gap, easing: ease, fill: "both" };
      anims.push(
        leaf.animate(
          [
            { transform: "translateZ(0px) rotateY(" + a0 + "deg)" },
            { transform: "translateZ(" + lift + "px) rotateY(-90deg)", offset: 0.5 },
            { transform: "translateZ(0px) rotateY(" + a1 + "deg)" },
          ],
          t
        )
      );
      anims.push(leaf.animate([{ zIndex: 100 - i }, { zIndex: 200 + i }], t));
      Array.prototype.forEach.call(leaf.querySelectorAll(".bk-leaf-sh"), function (sh) {
        anims.push(sh.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], t));
      });
    });
    // cast shadow on the pages beneath
    var tt = { duration: dur + gap * (m - 1), easing: ease, fill: "both" };
    var near = fwd ? E.castR : E.castL, far = fwd ? E.castL : E.castR;
    anims.push(
      near.animate(
        [
          { opacity: 0, transform: "scaleX(1)" },
          { opacity: 1, transform: "scaleX(.6)", offset: 0.3 },
          { opacity: 0, transform: "scaleX(.08)", offset: 0.5 },
          { opacity: 0, transform: "scaleX(.08)" },
        ],
        tt
      ),
      far.animate(
        [
          { opacity: 0, transform: "scaleX(.08)" },
          { opacity: 0, transform: "scaleX(.08)", offset: 0.5 },
          { opacity: 1, transform: "scaleX(.6)", offset: 0.7 },
          { opacity: 0, transform: "scaleX(1)" },
        ],
        tt
      )
    );

    return finished(anims).then(function () {
      if (fwd) setSlot(E.slotL, R.L[to]);
      else setSlot(E.slotR, R.R[to]);
      anims.forEach(function (a) { a.cancel(); });
      while (E.turn.firstChild) E.turn.removeChild(E.turn.firstChild);
    });
  }

  /* reduced motion: crossfade */
  function fadeTurn(o, from, to) {
    var R = o.rd, E = R.el;
    var snap = document.createElement("div");
    snap.className = "bk-fade";
    var pairs = [], was = [E.slotL.hidden, E.slotR.hidden];
    [E.slotL, E.slotR].forEach(function (sl) {
      if (sl.hidden || !sl.firstChild) return;
      var c = sl.cloneNode(true);
      c.firstChild.__src = sl.firstChild;
      pairs.push(c.firstChild);
      snap.appendChild(c);
    });
    E.rd.insertBefore(snap, E.castL);
    pairs.forEach(syncScroll);
    setSlot(E.slotL, R.L[to]);
    setSlot(E.slotR, R.R[to]);
    var t = { duration: 240, easing: "ease-out", fill: "both" };
    var anims = [snap.animate([{ opacity: 1 }, { opacity: 0 }], t)];
    [E.slotL, E.slotR].forEach(function (sl, i) {
      if (was[i] && !sl.hidden) anims.push(sl.animate([{ opacity: 0 }, { opacity: 1 }], t));
    });
    return finished(anims).then(function () {
      anims.forEach(function (a) { a.cancel(); });
      if (snap.parentNode) snap.parentNode.removeChild(snap);
    });
  }

  /* warm the cache for nearby prints */
  function preload(o, s) {
    [s, s + 1, s + 2, s - 1].forEach(function (k) {
      var p = o.inf.list[k - 1];
      if (!p || !p.image || o.warm[k]) return;
      o.warm[k] = true;
      var img = o.rd.L[k] && o.rd.L[k].querySelector("img");
      if (img) img.loading = "eager";
    });
  }

  /* ---- reader open / close ---- */
  function lock(on) {
    document.body.classList.toggle("modal-open", on);
    if (on) window.dispatchEvent(new CustomEvent("desk:modal", { detail: true }));
  }

  function openReader(id, opts) {
    opts = opts || {};
    if (S.busy || S.open) return Promise.resolve();
    var inf = info(id);
    if (!inf.crate) return Promise.resolve();
    var btn = opts.btn && document.contains(opts.btn) ? opts.btn : null;
    var g = btn ? pileGeom(btn) : originGeom(opts.originRect);
    var D = readerDims(g);
    var target = 0;
    if (opts.project != null) {
      inf.list.forEach(function (p, i) { if (p.title === opts.project) target = i + 1; });
    }
    var parts = buildStage(inf, g, D, true);
    var dlg = document.createElement("dialog");
    dlg.className = "bk-dlg";
    dlg.setAttribute("aria-labelledby", "bkTitle");
    dlg.setAttribute("autofocus", "");
    dlg.tabIndex = -1;
    dlg.appendChild(parts.stage);
    var o = {
      id: id, btn: btn, inf: inf, g: g, D: D, parts: parts, dlg: dlg, reader: true,
      returnTo: btn || document.activeElement, persp: Math.round(PERSP_NEAR * D.k), warm: {},
    };
    buildReader(o);
    layoutReader(o);
    placeShadow(parts.shadow, D);
    document.body.appendChild(dlg);
    S.open = o;
    S.busy = true;
    lock(true);
    bindReader(o);
    dlg.showModal();
    dlg.focus({ preventScroll: true });
    scrollers(o.rd.el.rd).forEach(moreHint);
    if (btn) btn.classList.add("bk-out");
    preload(o, target);

    var ready = function () {
      S.busy = false;
      var stage = parts.stage;
      stage.classList.add("is-ready");
      setTimeout(function () { if (S.open === o && !o.closing) stage.classList.add("is-flat"); }, 220);
      o.rd.el.next.focus({ preventScroll: true });
      if (o.closeReq) return closeReader();
      if (target) {
        o.rd.chained = true;
        go(target);
      } else announce(o);
    };

    if (reduced()) {
      if (target) {
        o.rd.cur = o.rd.want = target;
        setSlot(o.rd.el.slotL, o.rd.L[target]);
        setSlot(o.rd.el.slotR, o.rd.R[target]);
        syncUI(o);
      }
      target = 0;
      parts.stage.classList.add("is-ready", "is-flat", "is-calm");
      parts.scrim.style.opacity = 1;
      parts.shadow.style.opacity = 1;
      var fade = parts.stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
      return (o.openP = finished([fade]).then(function () {
        S.busy = false;
        o.rd.el.next.focus({ preventScroll: true });
        if (o.closeReq) return closeReader();
        announce(o);
      }));
    }

    var P = btn ? poses(g, D) : originPoses(g, D);
    parts.model.style.transform = tf(P.P0, D);
    parts.view.style.perspective = PERSP_FAR + "px";
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
          { perspective: o.persp + "px", offset: 0.55 },
          { perspective: o.persp + "px", offset: 1 },
        ],
        { duration: T, fill: "forwards" }
      ),
      parts.hinge.animate(
        [
          { transform: hingeTf(D, 0), easing: "cubic-bezier(.5,0,.3,1)" },
          { transform: hingeTf(D, -183), offset: 0.86, easing: "cubic-bezier(.3,0,.4,1)" },
          { transform: hingeTf(D, -180) },
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
    if (!btn) anims.push(parts.model.animate([{ opacity: 0 }, { opacity: 1, offset: 0.16 }, { opacity: 1 }], { duration: T, fill: "forwards" }));
    return (o.openP = settle(anims).then(ready));
  }

  /* current spread onto the 3d faces */
  function showModel(o) {
    var R = o.rd, s = R.cur, parts = o.parts;
    if (o.stale) {
      parts.view.innerHTML = modelHTML(o.inf, o.g, o.D, true);
      o.parts = parts = modelParts(parts.stage);
      o.stale = false;
    }
    var page = parts.page, cin = parts.hinge.querySelector(".bk-cover-in");
    page.innerHTML = "";
    page.classList.toggle("bk-page-end", !R.R[s]);
    var clones = [];
    if (R.R[s]) {
      var c = copyPage(R.R[s]);
      page.appendChild(c);
      clones.push(c);
    }
    var old = cin.querySelector(".bk-sheet");
    if (old) cin.removeChild(old);
    if (R.L[s]) {
      var sh = document.createElement("div");
      sh.className = "bk-sheet bk-sheet-l";
      var cl = copyPage(R.L[s]);
      sh.appendChild(cl);
      cin.appendChild(sh);
      clones.push(cl);
    }
    clones.forEach(syncScroll);
    parts.model.style.transform = tf(poses(o.g, o.D).P4, o.D);
    parts.view.style.perspective = o.persp + "px";
    parts.hinge.style.transform = hingeTf(o.D, -180);
    parts.stage.classList.remove("is-flat", "is-ready");
  }

  function finishClose(o) {
    return new Promise(function (res) {
      requestAnimationFrame(function () {
        try { if (o.dlg.open) o.dlg.close(); } catch (_) {}
        if (o.dlg.parentNode) o.dlg.parentNode.removeChild(o.dlg);
        S.open = null;
        S.busy = false;
        document.body.classList.remove("modal-open");
        window.dispatchEvent(new CustomEvent("desk:modal", { detail: false }));
        window.dispatchEvent(new CustomEvent("desk:crateclose", { detail: o.id }));
        var f = o.returnTo;
        if (f && f !== document.body && document.contains(f) && typeof f.focus === "function") f.focus({ preventScroll: true });
        res();
      });
    });
  }

  function closeReader() {
    var o = S.open;
    if (!o || !o.reader) return Promise.resolve();
    if (o.closeP) return o.closeP;
    if (S.busy) {
      o.closeReq = true;
      return o.openP || Promise.resolve();
    }
    if (o.rd.turning) {
      o.rd.want = o.rd.cur;
      return o.rd.turnP.then(closeReader);
    }
    o.closing = true;
    S.busy = true;
    document.body.classList.remove("modal-open");
    var parts = o.parts, D = o.D;

    if (reduced()) {
      var fade = parts.stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" });
      return (o.closeP = finished([fade]).then(function () {
        if (o.btn) o.btn.classList.remove("bk-out");
        return finishClose(o);
      }));
    }

    showModel(o);
    parts = o.parts;
    var btn = o.btn;
    var still = btn && document.contains(btn);
    var P = btn ? poses(still ? pileGeom(btn) : o.g, D) : originPoses(o.g, D);
    var T = CLOSE_MS;
    var anims = [
      parts.hinge.animate(
        [
          { transform: hingeTf(D, -180), easing: "cubic-bezier(.5,0,.3,1)" },
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
          { perspective: o.persp + "px", offset: 0 },
          { perspective: o.persp + "px", offset: 0.4, easing: "cubic-bezier(.5,0,.7,1)" },
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
    if (!btn) anims.push(parts.model.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: T, fill: "forwards" }));
    return (o.closeP = settle(anims).then(function () {
      if (still) btn.classList.remove("bk-out");
      return finishClose(o);
    }));
  }

  function nextBook(id) {
    var o = S.open;
    if (!o || o.closing || S.busy) return;
    var fromPile = !!o.btn;
    closeReader().then(function () {
      var btn = null;
      if (fromPile && S.root) {
        Array.prototype.forEach.call(S.root.querySelectorAll(".bk-book"), function (b) {
          if (b.getAttribute("data-book-id") === id) btn = b;
        });
      }
      if (btn) {
        var r = btn.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) btn = null;
      }
      openReader(id, btn ? { btn: btn } : {});
    });
  }

  function bindReader(o) {
    var dlg = o.dlg;
    dlg.addEventListener("click", function (e) {
      var t = e.target;
      if (!t.closest) return;
      if (t === dlg || t.classList.contains("bk-scrim")) {
        if (!S.busy) closeReader();
        return;
      }
      var b = t.closest("[data-bk-close]");
      if (b) return closeReader();
      b = t.closest("[data-bk-next]");
      if (b) return nextBook(b.getAttribute("data-bk-next"));
      b = t.closest("[data-turn]");
      if (b) {
        if (b.getAttribute("aria-disabled") !== "true") nav(+b.getAttribute("data-turn"));
        return;
      }
      b = t.closest("[data-spread]");
      if (b) go(+b.getAttribute("data-spread"));
    });
    dlg.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key;
      if (k === "Escape") {
        e.preventDefault();
        closeReader();
      } else if (k === "ArrowRight" || k === "ArrowLeft") {
        e.preventDefault();
        nav(k === "ArrowRight" ? 1 : -1);
      } else if ((k === "Home" || k === "End") && !(e.target.closest && e.target.closest(".bk-scroll"))) {
        e.preventDefault();
        go(k === "Home" ? 0 : o.rd.last);
      }
    });
    dlg.addEventListener(
      "scroll",
      function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains("bk-scroll")) moreHint(t);
      },
      true
    );
    dlg.addEventListener("cancel", function (e) {
      e.preventDefault();
      closeReader();
    });
    // forced close, e.g. double esc
    dlg.addEventListener("close", function () {
      if (S.open !== o || o.closeP) return;
      o.closing = true;
      o.closeP = Promise.resolve();
      if (o.btn) o.btn.classList.remove("bk-out");
      finishClose(o);
    });
  }

  function isOpen() {
    return !!(S.open && S.open.reader);
  }

  /* keep open book centred on resize */
  window.addEventListener("resize", function () {
    var o = S.open;
    if (!o || S.busy) return;
    if (o.reader) {
      if (o.closing) return;
      o.D = readerDims(o.g);
      o.persp = Math.round(PERSP_NEAR * o.D.k);
      o.stale = true;
      layoutReader(o);
      placeShadow(o.parts.shadow, o.D);
      scrollers(o.rd.el.rd).forEach(moreHint);
      return;
    }
    var D = viewDims(o.g);
    // keep size, just reposition
    D.CW = o.D.CW; D.CH = o.D.CH; D.CT = o.D.CT;
    D.shift = Math.max(0, Math.min(D.CW / 2, D.vw / 2 - 16 - D.CW / 2));
    o.D = D;
    o.parts.model.style.transform = tf(poses(o.g, D).P4, D);
    placeShadow(o.parts.shadow, D);
  });

  window.BOOKS = { mount: mount, close: close, openReader: openReader, isOpen: isOpen };
})();
