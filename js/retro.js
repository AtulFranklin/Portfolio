/* =========================================================
   retro.js - the "Why hire me" computer.
   An early-90s workstation: CRT power-on, boot log, setup
   progress, a patterned desktop, then a word-processor window
   with the "Why hire me" document.

   API (classic script, load after content.js, before app.js):
     RETRO.open()                    full-screen experience in a <dialog>
     RETRO.close()                   closes it
     RETRO.drawScreen(ctx, w, h, t)  draws the 3D monitor's screen texture
     RETRO.sectionHTML()             static window for the on-page section
   Any element with [data-retro-open] opens the computer on click.
   ========================================================= */
(function () {
  "use strict";

  var S = window.SITE || {};
  var WHY = Array.isArray(S.whyHire) ? S.whyHire : [];
  var LINKS = S.links || {};
  var DOC_NAME = "why_hire_atul.doc";

  /* ---------------- small helpers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function reduced() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; }
  }
  function storeGet(k) { try { return window.sessionStorage.getItem(k); } catch (_) { return null; } }
  function storeSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (_) { /* private mode */ } }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
  function fullName() { return S.name || "Atul Abraham"; }
  function firstName() { return fullName().split(" ")[0]; }

  /* ---------------- pixel art ----------------
     Icons are drawn on a tiny pixel grid, then written out as
     crisp SVG paths (DOM) or fillRects (canvas). */
  var PAL = {
    k: "#111214", w: "#ffffff", l: "#e4e6ea", g: "#c3c6cc", d: "#7b7f88",
    b: "#2c4c7c", y: "#e8c35c", Y: "#fff0bd", o: "#a98224", r: "#b8382c",
    n: "#8b6a3e", c: "#3f7f84", a: "#f5b041", A: "#c47f12",
  };
  function Pix(w, h) { this.w = w; this.h = h; this.a = []; for (var i = 0; i < w * h; i++) this.a.push(""); }
  Pix.prototype.p = function (x, y, c) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = c;
    return this;
  };
  Pix.prototype.r = function (x, y, w, h, c) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.p(x + i, y + j, c);
    return this;
  };
  Pix.prototype.b = function (x, y, w, h, c) {
    return this.r(x, y, w, 1, c).r(x, y + h - 1, w, 1, c).r(x, y, 1, h, c).r(x + w - 1, y, 1, h, c);
  };
  Pix.prototype.art = function (x, y, rows) {
    for (var j = 0; j < rows.length; j++) {
      for (var i = 0; i < rows[j].length; i++) {
        var ch = rows[j][i];
        if (ch !== ".") this.p(x + i, y + j, ch);
      }
    }
    return this;
  };
  Pix.prototype.runs = function () {
    var out = [], w = this.w, a = this.a;
    for (var y = 0; y < this.h; y++) {
      var x = 0;
      while (x < w) {
        var c = a[y * w + x];
        if (!c) { x++; continue; }
        var e = x + 1;
        while (e < w && a[y * w + e] === c) e++;
        out.push([x, y, e - x, c]);
        x = e;
      }
    }
    return out;
  };
  Pix.prototype.svg = function (size, cls) {
    var paths = {};
    this.runs().forEach(function (r) {
      (paths[r[3]] = paths[r[3]] || []).push("M" + r[0] + " " + r[1] + "h" + r[2] + "v1h-" + r[2] + "z");
    });
    var body = Object.keys(paths).map(function (c) {
      return '<path fill="' + (PAL[c] || c) + '" d="' + paths[c].join("") + '"/>';
    }).join("");
    return '<svg class="' + (cls || "") + '" viewBox="0 0 ' + this.w + " " + this.h + '" width="' + size +
      '" height="' + size + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + body + "</svg>";
  };
  Pix.prototype.paint = function (g, x, y, s) {
    this.runs().forEach(function (r) {
      g.fillStyle = PAL[r[3]] || r[3];
      g.fillRect(x + r[0] * s, y + r[1] * s, r[2] * s, s);
    });
  };

  /* A sheet of paper with a folded corner and a 1px drop shadow. */
  function page32() {
    var P = new Pix(32, 32), x0 = 6, y0 = 2, w = 20, h = 28, f = 6, i, j;
    P.r(x0, y0, w, h, "w");
    for (j = 0; j < f; j++) for (i = x0 + w - f + j; i < x0 + w; i++) P.p(i, y0 + j, "");
    P.r(x0, y0, 1, h, "k").r(x0, y0 + h - 1, w, 1, "k").r(x0, y0, w - f, 1, "k").r(x0 + w - 1, y0 + f, 1, h - f, "k");
    for (j = 0; j <= f; j++) P.p(x0 + w - f - 1 + j, y0 + j, "k");
    P.r(x0 + w - f - 1, y0, 1, f + 1, "k").r(x0 + w - f - 1, y0 + f, f + 1, 1, "k");
    for (j = 1; j < f; j++) for (i = x0 + w - f; i < x0 + w - f - 1 + j; i++) P.p(i, y0 + j, "g");
    P.r(x0 + w, y0 + f + 1, 1, h - f, "d").r(x0 + 1, y0 + h, w, 1, "d");
    return P;
  }
  var ICONS32 = {
    doc: function () {
      var P = page32();
      P.r(9, 10, 9, 2, "b");
      [14, 12, 14, 9, 13, 7].forEach(function (len, i) { P.r(9, 14 + i * 2, len, 1, "d"); });
      return P;
    },
    resume: function () {
      var P = page32();
      P.r(9, 6, 8, 2, "k").r(9, 9, 6, 1, "d").r(9, 12, 14, 1, "b");
      [13, 11, 13, 8].forEach(function (len, i) { P.r(9, 14 + i * 2, len, 1, "d"); });
      P.r(3, 21, 12, 7, "r").b(3, 21, 12, 7, "k").r(5, 23, 8, 1, "w").r(5, 25, 5, 1, "w");
      return P;
    },
    folder: function () {
      var P = new Pix(32, 32);
      P.r(3, 5, 10, 1, "k").p(2, 6, "k").p(2, 7, "k").p(13, 6, "k").p(14, 7, "k");
      P.r(3, 6, 10, 2, "y").p(13, 7, "y");
      P.r(2, 8, 28, 19, "y").b(2, 8, 28, 19, "k");
      P.r(3, 9, 26, 1, "Y").r(3, 9, 1, 17, "Y").r(3, 6, 1, 2, "Y");
      P.r(3, 12, 26, 1, "o").r(3, 25, 26, 1, "o").r(28, 9, 1, 17, "o");
      P.r(3, 27, 28, 1, "d").r(30, 9, 1, 19, "d");
      return P;
    },
    mail: function () {
      var P = new Pix(32, 32), i, dy;
      P.r(2, 8, 28, 18, "w").b(2, 8, 28, 18, "k");
      for (i = 0; i < 14; i++) { dy = Math.round(i * 9 / 13); P.p(3 + i, 9 + dy, "k"); P.p(28 - i, 9 + dy, "k"); }
      P.r(3, 25, 26, 1, "l");
      P.r(22, 11, 5, 6, "r").b(22, 11, 5, 6, "k").r(23, 12, 3, 1, "Y");
      P.r(3, 26, 28, 1, "d").r(30, 9, 1, 18, "d");
      return P;
    },
    trash: function () {
      var P = new Pix(32, 32), x;
      P.b(12, 3, 8, 4, "k");
      P.r(8, 9, 16, 19, "g").r(8, 9, 1, 19, "k").r(23, 9, 1, 19, "k").r(8, 27, 16, 1, "k");
      P.r(9, 10, 1, 17, "l");
      for (x = 11; x <= 20; x += 3) P.r(x, 11, 1, 14, "d");
      P.r(6, 6, 20, 3, "g").b(6, 6, 20, 3, "k").r(7, 7, 18, 1, "l");
      P.r(24, 10, 1, 18, "d").r(9, 28, 16, 1, "d");
      return P;
    },
    monitor: function () {
      var P = new Pix(32, 32);
      P.r(3, 3, 26, 20, "g").b(3, 3, 26, 20, "k").r(4, 4, 24, 1, "l");
      P.r(6, 6, 20, 13, "c").b(6, 6, 20, 13, "k");
      P.r(8, 9, 7, 1, "Y").r(8, 11, 11, 1, "Y").r(8, 13, 5, 1, "Y");
      P.r(12, 23, 8, 2, "d").r(7, 25, 18, 4, "g").b(7, 25, 18, 4, "k").r(20, 26, 3, 1, "a");
      return P;
    },
  };

  var ART16 = {
    lamp: [
      "................",
      "........kkkk....",
      ".......kaaaak...",
      "......kaaaaaak..",
      ".....kkkkkkkkkk.",
      "......k.........",
      ".....k..........",
      "....k...........",
      "...k............",
      "....k...........",
      ".....k..........",
      "......k.........",
      "....kkkkkk......",
      "...kddddddk.....",
      "...kkkkkkkk.....",
    ],
    new: [
      "................",
      "..kkkkkkkk......",
      "..kwwwwwwkk.....",
      "..kwwwwwwkwk....",
      "..kwwwwwwkkkk...",
      "..kwwwwwwwwwk...",
      "..kwwwwwwwwwk...",
      "..kwwwwwwwwwk...",
      "..kwwwwwwwwwk...",
      "..kwwwwwwwwwk...",
      "..kwwwwwwwwwk...",
      "..kwwwwwwwwwk...",
      "..kwwwwwwwwwk...",
      "..kkkkkkkkkkk...",
    ],
    open: [
      "................",
      "................",
      "................",
      ".kkkk...........",
      "kYyyyk..........",
      "kYyyyykkkkkkk...",
      "kYyyyyyyyyyyk...",
      "kYyykkkkkkkkkkkk",
      "kYykyyyyyyyyyyk.",
      "kYkyyyyyyyyyyk..",
      "kkyyyyyyyyyyyk..",
      "kkyyyyyyyyyyk...",
      "kkkkkkkkkkkkk...",
    ],
    save: [
      "................",
      ".kkkkkkkkkkkkk..",
      ".kbkgggggggkbk..",
      ".kbkggggkggkbk..",
      ".kbkggggkggkbk..",
      ".kbkgggggggkbk..",
      ".kbbkkkkkkkbbk..",
      ".kbbbbbbbbbbbk..",
      ".kbkkkkkkkkkbk..",
      ".kbkwwwwwwwkbk..",
      ".kbkwdddddwkbk..",
      ".kbkwwwwwwwkbk..",
      ".kbkwdddddwkbk..",
      ".kbkwwwwwwwkbk..",
      ".kkkkkkkkkkkkk..",
    ],
    print: [
      "................",
      "....kkkkkkkk....",
      "....kwwwwwwk....",
      "....kwddddwk....",
      "....kwwwwwwk....",
      "..kkkkkkkkkkkk..",
      ".kggggggggggggk.",
      ".kgggggggggrggk.",
      ".kggggggggggggk.",
      ".kddddddddddddk.",
      ".kkkwwwwwwwwkkk.",
      "...kwddddddwk...",
      "...kwwwwwwwwk...",
      "...kkkkkkkkkk...",
    ],
    cut: [
      "................",
      "....k.....k.....",
      "....k.....k.....",
      "....kk...kk.....",
      ".....k...k......",
      ".....kk.kk......",
      "......kkk.......",
      ".......k........",
      "......kkk.......",
      "...bbbb.bbbb....",
      "..b...bb...b....",
      "..b...bb...b....",
      "..b...bb...b....",
      "...bbb..bbb.....",
    ],
    copy: [
      "................",
      "kkkkkk..........",
      "kwwwwkk.........",
      "kwddwkwk........",
      "kwwwwkkkk.......",
      "kwdddddwk.......",
      "kwwwwkkkkkk.....",
      "kwdddkwwwwkk....",
      "kwwwwkwddwkwk...",
      "kwdddkwwwwkkkk..",
      "kwwwwkwddddddk..",
      "kkkkkkwwwwwwwk..",
      ".....kwddddddk..",
      ".....kwwwwwwwk..",
      ".....kkkkkkkkk..",
    ],
    paste: [
      "................",
      "....kkkkk.......",
      "..kkkgggkkk.....",
      ".knnkkkkknnk....",
      ".knnnnnnnnnk....",
      ".knnkkkkkkkkkk..",
      ".knnkwwwwwwwwk..",
      ".knnkwddddddwk..",
      ".knnkwwwwwwwwk..",
      ".knnkwdddddwwk..",
      ".knnkwwwwwwwwk..",
      ".knnkwddddddwk..",
      ".knnkwwwwwwwwk..",
      ".kkkkkkkkkkkkk..",
    ],
    undo: [
      "................",
      "................",
      "....k...........",
      "...kk...........",
      "..kbkkkkkkk.....",
      ".kbbbbbbbbbkk...",
      "..kbkkkkkkkbbk..",
      "...kk......kbbk.",
      "....k.......kbk.",
      ".............kbk",
      ".............kbk",
      "............kbk.",
      "...........kbk..",
      "..........kk....",
    ],
  };
  function icon16(name) { return new Pix(16, 16).art(0, 1, ART16[name]); }
  function alignIcon(kind) {
    var P = new Pix(16, 16), lens = [12, 8, 12, 8, 12];
    lens.forEach(function (len, i) {
      var x = kind === "left" ? 2 : kind === "right" ? 14 - len : Math.round((16 - len) / 2);
      if (kind === "justify") { x = 2; len = i === 4 ? 7 : 12; }
      P.r(x, 3 + i * 2, len, 1, "k");
    });
    return P;
  }
  function closeGlyph() {
    var P = new Pix(10, 10);
    for (var i = 0; i < 9; i++) { P.p(i, i, "k").p(i + 1, i, "k").p(8 - i, i, "k").p(9 - i, i, "k"); }
    return P;
  }
  var svgCache = {};
  function svgIcon(key, size, make, cls) {
    var k = key + "@" + size + (cls || "");
    if (!svgCache[k]) svgCache[k] = make().svg(size, cls);
    return svgCache[k];
  }

  /* ---------------- document markup ---------------- */
  function todayLine() {
    try {
      return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    } catch (_) { return ""; }
  }
  function mailHref() { return "mailto:" + (LINKS.email || ""); }

  /* opts.h = heading level for the document title (items use h + 1) */
  function docHTML(opts) {
    var h = opts.h, h2 = h + 1;
    var items = WHY.map(function (w) {
      return '<h' + h2 + ' class="rt-doc-h">' + esc(w.heading || (w.stat + " " + w.label)) + "</h" + h2 + ">" +
        '<p class="rt-doc-p">' + esc(w.text) + "</p>";
    }).join("");
    var lead = S.about && S.about.lead ? '<p class="rt-doc-lead">' + esc(S.about.lead) + "</p>" : "";
    var email = LINKS.email
      ? 'write to me at <a href="' + esc(mailHref()) + '">' + esc(LINKS.email) + "</a>"
      : "write to me";
    var resume = S.resume
      ? ', or open <a href="' + esc(S.resume) + '" target="_blank" rel="noopener">my resume (PDF)</a>'
      : "";
    return '<article class="rt-page">' +
      '<p class="rt-doc-date">' + esc(S.place || "") + "<br>" + esc(todayLine()) + "</p>" +
      "<h" + h + ' class="rt-doc-title">Why hire ' + esc(fullName()) + "</h" + h + ">" +
      lead + items +
      '<p class="rt-doc-p rt-doc-close">Thanks for reading. If any of this fits what your team needs, ' + email + resume + ".</p>" +
      '<p class="rt-doc-sign">' + esc(fullName()) + '<span class="rt-caret" aria-hidden="true"></span></p>' +
      "</article>";
  }

  function rulerHTML() {
    var nums = "";
    for (var i = 1; i <= 8; i++) nums += '<span class="rt-ruler-n" style="--i:' + i + '">' + i + "</span>";
    return '<div class="rt-ruler" aria-hidden="true"><div class="rt-ruler-scale">' +
      '<span class="rt-ruler-text">' + nums + "</span>" +
      '<span class="rt-ind rt-ind-l"></span><span class="rt-ind rt-ind-r"></span></div></div>';
  }

  function toolbarHTML() {
    function tb(key, make, extra) {
      return '<span class="rt-tool' + (extra || "") + '">' + svgIcon(key, 16, make) + "</span>";
    }
    function sep() { return '<span class="rt-tsep"></span>'; }
    return '<div class="rt-toolbar" aria-hidden="true">' +
      '<span class="rt-tgroup rt-tg-file">' +
      tb("new", function () { return icon16("new"); }) +
      tb("open", function () { return icon16("open"); }) +
      tb("save", function () { return icon16("save"); }) + sep() +
      tb("print", function () { return icon16("print"); }) + sep() + "</span>" +
      '<span class="rt-tgroup rt-tg-edit">' +
      tb("cut", function () { return icon16("cut"); }) +
      tb("copy", function () { return icon16("copy"); }) +
      tb("paste", function () { return icon16("paste"); }) +
      tb("undo", function () { return icon16("undo"); }) + sep() + "</span>" +
      '<span class="rt-select rt-font"><span>Times New Roman</span><i></i></span>' +
      '<span class="rt-select rt-size"><span>12</span><i></i></span>' + sep() +
      '<span class="rt-tool rt-glyph rt-on"><b>B</b></span><span class="rt-tool rt-glyph"><i>I</i></span><span class="rt-tool rt-glyph"><u>U</u></span>' +
      '<span class="rt-tgroup rt-tg-align">' + sep() +
      tb("al", function () { return alignIcon("left"); }, " rt-on") +
      tb("ac", function () { return alignIcon("center"); }) +
      tb("ar", function () { return alignIcon("right"); }) +
      tb("aj", function () { return alignIcon("justify"); }) + "</span>" +
      "</div>";
  }

  function menusHTML(live) {
    var names = ["File", "Edit", "View", "Insert", "Format", "Tools", "Help"];
    var rest = names.slice(1).map(function (n, i) {
      return '<span class="rt-menu rt-m' + (i + 1) + '"><u>' + n[0] + "</u>" + n.slice(1) + "</span>";
    }).join("");
    if (!live) return '<div class="rt-menus" aria-hidden="true"><span class="rt-menu"><u>F</u>ile</span>' + rest + "</div>";
    var items = "";
    if (S.resume) items += '<a class="rt-mi" href="' + esc(S.resume) + '" target="_blank" rel="noopener">Open resume (PDF)...</a>';
    if (LINKS.email) items += '<a class="rt-mi" href="' + esc(mailHref()) + '">Send as e-mail...</a>';
    items += '<span class="rt-msep" role="separator"></span>';
    items += '<button type="button" class="rt-mi" data-retro-close>Exit and shut down</button>';
    return '<div class="rt-menus">' +
      '<div class="rt-filewrap"><button type="button" class="rt-menu rt-menu-btn" aria-expanded="false" aria-controls="rtFileMenu"><u>F</u>ile</button>' +
      '<div class="rt-dropdown" id="rtFileMenu" hidden>' + items + "</div></div>" +
      '<span aria-hidden="true" class="rt-menus-rest">' + rest + "</span></div>";
  }

  /* The word-processor window. live = inside the dialog (real buttons), else static for the page. */
  function windowHTML(live) {
    var close = live
      ? '<button type="button" class="rt-wbtn rt-closebox" data-retro-close aria-label="Close document and shut down">' + svgIcon("x", 10, closeGlyph) + "</button>"
      : '<span class="rt-wbtn rt-closebox" aria-hidden="true">' + svgIcon("x", 10, closeGlyph) + "</span>";
    var words = 0;
    WHY.forEach(function (w) { words += ((w.heading || w.label) + " " + w.text).split(/\s+/).length + 1; });
    if (S.about && S.about.lead) words += S.about.lead.split(/\s+/).length;
    return '<div class="rt-win' + (live ? " rt-win-live" : " rt-win-static") + '">' +
      '<div class="rt-titlebar">' + close +
      '<span class="rt-title"' + (live ? "" : ' aria-hidden="true"') + ">" + DOC_NAME + "</span>" +
      '<span class="rt-wbtns" aria-hidden="true"><span class="rt-wbtn rt-min"><i></i></span><span class="rt-wbtn rt-max"><i></i></span></span>' +
      "</div>" +
      menusHTML(live) + toolbarHTML() + rulerHTML() +
      '<div class="rt-work"' + (live ? ' tabindex="0" role="region" aria-label="Document: ' + DOC_NAME + '"' : "") + ">" +
      docHTML({ h: live ? 2 : 3 }) + "</div>" +
      '<div class="rt-status" aria-hidden="true"><span>Page 1 of 1</span><span>Ln 1</span><span>Col 1</span>' +
      '<span class="rt-st-words">' + (words + 40) + ' words</span><span class="rt-st-ins">INS</span></div>' +
      "</div>";
  }

  /* ---------------- on-page section ---------------- */
  function sectionHTML() {
    return '<div class="rt-section">' +
      '<div class="rt-plate">' + windowHTML(false) + "</div>" +
      '<div class="rt-cta">' +
      '<button type="button" class="btn btn-primary rt-bootbtn" data-retro-open>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M6.6 6.6a7.5 7.5 0 1 0 10.8 0"/></svg>Boot it up</button>' +
      '<p class="rt-cta-note">Opens the same document on a 1990s workstation.</p>' +
      "</div></div>";
  }

  /* ---------------- full-screen experience ---------------- */
  var dlg = null, screen = null, runId = 0, lastFocus = null, clockTimer = 0, closing = false, skipped = false;

  function deskHTML() {
    var icons = [
      ["doc", DOC_NAME, null],
      ["folder", "Projects", { href: "#projects", nav: true }],
      ["resume", "Resume", S.resume ? { href: S.resume, blank: true } : null],
      ["mail", "Mail", LINKS.email ? { href: mailHref() } : null],
      ["trash", "Trash", null],
    ];
    var iconsHTML = icons.map(function (ic) {
      var svg = svgIcon(ic[0], 32, ICONS32[ic[0]], "rt-icon-img");
      var cls = "rt-icon rt-icon-" + ic[0];
      var label = '<span class="rt-icon-label">' + esc(ic[1]).replace(/_/g, "_<wbr>") + "</span>";
      if (ic[2]) {
        return '<a class="' + cls + '" href="' + esc(ic[2].href) + '"' +
          (ic[2].blank ? ' target="_blank" rel="noopener"' : "") + (ic[2].nav ? " data-retro-nav" : "") + ">" + svg + label + "</a>";
      }
      return '<span class="' + cls + '" aria-hidden="true">' + svg + label + "</span>";
    }).join("");

    var setup = '<div class="rt-setup" aria-hidden="true"><div class="rt-win rt-win-dialog">' +
      '<div class="rt-titlebar"><span class="rt-wbtn rt-closebox">' + svgIcon("x", 10, closeGlyph) + '</span><span class="rt-title">Setup</span><span class="rt-wbtns"></span></div>' +
      '<div class="rt-setup-body">' + svgIcon("monitor", 64, ICONS32.monitor, "rt-setup-icon") +
      '<div class="rt-setup-text"><p class="rt-setup-h">Setting up ATUL-OS...</p>' +
      '<p class="rt-setup-sub">Please wait while Setup copies ' + esc(firstName()) + "'s work to your desk.</p>" +
      '<div class="rt-progress"><div class="rt-progress-well">' + new Array(25).join("<i></i>") + "</div>" + '<span class="rt-progress-pct">0%</span></div>' +
      '<p class="rt-setup-file">Copying: <span>/portfolio</span></p></div></div></div></div>';

    return '<div class="rt-desk">' +
      '<div class="rt-menubar">' +
      '<span class="rt-mb-left" aria-hidden="true">' + svgIcon("lamp", 16, function () { return icon16("lamp"); }, "rt-mb-lamp") +
      '<span class="rt-mb-item rt-mb-strong">Desk</span><span class="rt-mb-item">File</span><span class="rt-mb-item rt-mb-x">Edit</span>' +
      '<span class="rt-mb-item rt-mb-x">View</span><span class="rt-mb-item rt-mb-x">Window</span></span>' +
      '<span class="rt-mb-right"><button type="button" class="rt-mb-item rt-mb-shut" data-retro-close>Shut down</button>' +
      '<span class="rt-clock" aria-hidden="true"></span></span>' +
      "</div>" +
      '<div class="rt-icons">' + iconsHTML + "</div>" +
      setup +
      windowHTML(true) +
      "</div>";
  }

  function screenHTML() {
    return '<div class="rt-content">' +
      '<div class="rt-boot" aria-hidden="true"><div class="rt-boot-log"></div></div>' +
      deskHTML() +
      "</div>" +
      '<div class="rt-beam" aria-hidden="true"></div>' +
      '<div class="rt-glass" aria-hidden="true"></div>' +
      '<div class="rt-bootctl"><button type="button" class="rt-btn rt-skip">Skip <span aria-hidden="true">&gt;&gt;</span><span class="rt-sr"> the boot sequence</span></button>' +
      '<button type="button" class="rt-btn rt-off" data-retro-close>Power off</button></div>' +
      '<p class="rt-sr rt-live" aria-live="polite"></p>';
  }

  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "rt-dlg";
    dlg.setAttribute("aria-label", "Why hire Atul - retro computer");
    dlg.innerHTML =
      '<div class="rt-room">' +
      '<div class="rt-monitor">' +
      '<div class="rt-recess"><div class="rt-screen" data-stage="off"></div></div>' +
      '<div class="rt-chin">' +
      '<span class="rt-badge" aria-hidden="true">ATUL-OS <em>2.6</em></span>' +
      '<span class="rt-vents" aria-hidden="true"></span>' +
      '<span class="rt-led" aria-hidden="true"></span>' +
      '<button type="button" class="rt-power" data-retro-close aria-label="Shut down"><span aria-hidden="true"></span></button>' +
      "</div></div></div>";
    document.body.appendChild(dlg);
    screen = dlg.querySelector(".rt-screen");

    dlg.addEventListener("click", function (e) {
      var t = e.target;
      if (t === dlg || (t.classList && t.classList.contains("rt-room"))) { shutdown(); return; }
      if (t.closest("[data-retro-close]")) { e.preventDefault(); shutdown(); return; }
      if (t.closest(".rt-skip")) { skip(); return; }
      if (t.closest("[data-retro-nav]")) { close(); return; } /* let the #hash navigation happen */
      var mb = t.closest(".rt-menu-btn");
      if (mb) { toggleFile(mb.getAttribute("aria-expanded") !== "true"); return; }
      if (!t.closest(".rt-dropdown")) toggleFile(false);
    });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && fileOpen()) {
        e.preventDefault(); e.stopPropagation();
        toggleFile(false);
        var b = dlg.querySelector(".rt-menu-btn"); if (b) b.focus();
      }
    });
    dlg.addEventListener("cancel", function (e) {
      if (!closing) { e.preventDefault(); shutdown(); }
    });
    dlg.addEventListener("close", onClosed);
  }

  function fileOpen() {
    var b = dlg && dlg.querySelector(".rt-menu-btn");
    return !!(b && b.getAttribute("aria-expanded") === "true");
  }
  function toggleFile(on) {
    var b = dlg.querySelector(".rt-menu-btn"), m = dlg.querySelector(".rt-dropdown");
    if (!b || !m) return;
    b.setAttribute("aria-expanded", on ? "true" : "false");
    m.hidden = !on;
    if (on) { var first = m.querySelector(".rt-mi"); if (first) first.focus(); }
  }

  function setStage(s) { if (screen) screen.setAttribute("data-stage", s); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function tickClock() {
    var c = dlg && dlg.querySelector(".rt-clock");
    if (!c) return;
    var d = new Date();
    var day = d.toLocaleDateString("en-US", { weekday: "short" });
    var time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    c.textContent = day + " " + time;
  }

  function open() {
    if (!dlg) build();
    if (dlg.open) return;
    lastFocus = document.activeElement;
    closing = false;
    skipped = false;
    screen.innerHTML = screenHTML();
    screen.classList.remove("rt-poweroff");
    dlg.classList.add("rt-on");
    tickClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(tickClock, 10000);
    dlg.showModal();
    document.body.classList.add("modal-open");
    window.dispatchEvent(new CustomEvent("desk:modal", { detail: true }));

    var run = ++runId;
    if (reduced()) { finish(true); return; }
    var fast = storeGet("retroBooted") === "1";
    storeSet("retroBooted", "1");
    setStage("power");
    var skipBtn = screen.querySelector(".rt-skip");
    if (skipBtn) skipBtn.focus();
    sequence(run, fast);
  }

  function alive(run) { return run === runId && !skipped && dlg && dlg.open && !closing; }

  function sequence(run, fast) {
    setStage("power");
    wait(fast ? 260 : 480)
      .then(function () { if (!alive(run)) throw 0; setStage("boot"); return bootLog(run, fast); })
      .then(function () { if (!alive(run)) throw 0; if (!fast) { setStage("setup"); return setupProgress(run); } })
      .then(function () { if (!alive(run)) throw 0; setStage("desk"); return wait(fast ? 100 : 220); })
      .then(function () { if (!alive(run)) throw 0; return zoom(run, fast ? 200 : 280); })
      .then(function () { if (!alive(run)) throw 0; finish(); })
      .catch(function () { /* cancelled */ });
  }

  /* Boot log: [text, delay before it, optional suffix printed after a pause] */
  function bootLines(fast) {
    var n = (S.projects || []).length || 14;
    if (fast) {
      return [
        ["ATUL-OS 2.6 (hoboken) warm restart", 40],
        ["memory ........................ ok", 70],
        ["loading " + DOC_NAME + " ...", 90, " done"],
      ];
    }
    return [
      ["ATUL-OS Boot PROM, Rev 2.6", 30],
      ["(c) 2026 " + fullName() + ". All rights reserved.", 50],
      ["", 20],
      ["@mem", 40],
      ["CPU 0: mechanical engineer, retooled for code", 60],
      ["Probing devices", 50],
      ["  sd0  B.TECH   VIT Chennai, 2025 ..", 40, " ok"],
      ["  sd1  MS CS    Stevens, 2028 ......", 40, " spinning up"],
      ["  st0  TAPE     whirlpool_bom.xls ..", 40, " automated"],
      ["", 20],
      ["Booting ATUL-OS 2.6 (hoboken) #1", 70],
      ["fsck /portfolio: clean, " + n + " projects", 60],
      ["mounting /portfolio ...........", 40, " done"],
      ["mounting /resume (read-only) ..", 40, " done"],
      ["loading " + DOC_NAME + " ....", 40, " done"],
      ["starting window system ...", 60],
    ];
  }

  function bootLog(run, fast) {
    var log = screen.querySelector(".rt-boot-log");
    var lines = bootLines(fast);
    var i = 0;
    function line(text) {
      var d = document.createElement("div");
      d.className = "rt-bl";
      d.textContent = text || " ";
      log.appendChild(d);
      return d;
    }
    function memCheck() {
      var d = line("Testing memory ...... 0K");
      var total = 16384, steps = 8, k = 0;
      return new Promise(function (res) {
        (function step() {
          if (!alive(run)) return res();
          k++;
          var v = Math.min(total, Math.round((total / steps) * k / 64) * 64);
          d.textContent = "Testing memory ...... " + v + "K" + (k >= steps ? "  OK" : "");
          if (k >= steps) return res();
          setTimeout(step, 28);
        })();
      });
    }
    function next() {
      if (!alive(run) || i >= lines.length) return Promise.resolve();
      var L = lines[i++];
      return wait(L[1]).then(function () {
        if (!alive(run)) return;
        if (L[0] === "@mem") return memCheck();
        var d = line(L[0]);
        if (L[2]) {
          return wait(fast ? 80 : 70).then(function () {
            if (!alive(run)) return;
            var s = document.createElement("span");
            s.className = "rt-bl-ok";
            s.textContent = L[2];
            d.appendChild(s);
          });
        }
      }).then(next);
    }
    return next().then(function () { return wait(fast ? 80 : 120); });
  }

  function setupProgress(run) {
    var segs = screen.querySelectorAll(".rt-progress-well i");
    var pct = screen.querySelector(".rt-progress-pct");
    var file = screen.querySelector(".rt-setup-file span");
    var files = (S.projects || []).map(function (p) { return "/portfolio/" + slug(p.crate || "misc") + "/" + slug(p.title); });
    files.push("/resume/" + (S.resume ? String(S.resume).split("/").pop() : "resume.pdf"));
    files.push("/docs/" + DOC_NAME);
    /* uneven steps, with a stall, like a real installer */
    var plan = [[6, 60], [17, 50], [29, 60], [38, 50], [47, 50], [58, 50], [62, 140], [70, 50], [83, 50], [91, 50], [100, 60]];
    var i = 0;
    return new Promise(function (res) {
      (function step() {
        if (!alive(run)) return res();
        if (i >= plan.length) return setTimeout(res, 160);
        var p = plan[i];
        var lit = Math.floor(p[0] * segs.length / 100);
        for (var j = 0; j < segs.length; j++) segs[j].classList.toggle("on", j < lit);
        pct.textContent = p[0] + "%";
        if (files.length) file.textContent = files[Math.min(files.length - 1, Math.floor(i * files.length / plan.length))];
        i++;
        setTimeout(step, p[1]);
      })();
    });
  }

  function zoom(run, dur) {
    var desk = screen.querySelector(".rt-desk");
    var from = screen.querySelector(".rt-icon-doc .rt-icon-img");
    var to = screen.querySelector(".rt-win-live");
    if (!desk || !from || !to) return Promise.resolve();
    var D = desk.getBoundingClientRect(), A = from.getBoundingClientRect(), B = to.getBoundingClientRect();
    if (!A.width || A.left > D.right || A.top > D.bottom) {
      /* icon hidden (small screens): zoom from the centre of the window */
      A = { left: B.left + B.width / 2 - 16, top: B.top + B.height / 2 - 16, width: 32, height: 32 };
    }
    var n = 9, k = 0, trail = [];
    desk.classList.add("rt-zooming");
    return new Promise(function (res) {
      (function step() {
        if (!alive(run)) { cleanup(); return res(); }
        k++;
        var f = k / n, e = 1 - Math.pow(1 - f, 2);
        var r = document.createElement("span");
        r.className = "rt-zoom";
        r.style.left = (A.left + (B.left - A.left) * e - D.left) + "px";
        r.style.top = (A.top + (B.top - A.top) * e - D.top) + "px";
        r.style.width = (A.width + (B.width - A.width) * e) + "px";
        r.style.height = (A.height + (B.height - A.height) * e) + "px";
        desk.appendChild(r);
        trail.push(r);
        if (trail.length > 3) trail.shift().remove();
        if (k >= n) { setTimeout(function () { cleanup(); res(); }, 40); return; }
        setTimeout(step, dur / n);
      })();
      function cleanup() { trail.forEach(function (t) { t.remove(); }); desk.classList.remove("rt-zooming"); }
    });
  }

  function finish(forceFocus) {
    if (!screen) return;
    screen.querySelectorAll(".rt-zoom").forEach(function (z) { z.remove(); });
    setStage("doc");
    var live = screen.querySelector(".rt-live");
    if (live) live.textContent = DOC_NAME + " is open.";
    var a = document.activeElement;
    if (forceFocus || !a || a === document.body || a === dlg || !dlg.contains(a) || a.classList.contains("rt-skip")) {
      var work = screen.querySelector(".rt-work");
      if (work) work.focus({ preventScroll: true });
    }
  }

  function skip() {
    skipped = true;
    runId++;
    finish();
  }

  function shutdown() {
    if (!dlg || !dlg.open || closing) return;
    closing = true;
    runId++;
    dlg.classList.remove("rt-on");
    if (reduced()) { dlg.close(); return; }
    screen.classList.add("rt-poweroff");
    setTimeout(function () { if (dlg.open) dlg.close(); }, 420);
  }

  function close() {
    if (dlg && dlg.open) { closing = true; runId++; dlg.close(); }
  }

  function onClosed() {
    runId++;
    closing = false;
    clearInterval(clockTimer);
    dlg.classList.remove("rt-on");
    if (screen) { screen.classList.remove("rt-poweroff"); setStage("off"); screen.innerHTML = ""; }
    document.body.classList.remove("modal-open");
    window.dispatchEvent(new CustomEvent("desk:modal", { detail: false }));
    if (lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === "function") {
      try { lastFocus.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    }
    lastFocus = null;
  }

  /* [data-retro-open] anywhere on the page opens the computer */
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("[data-retro-open]");
    if (t) { e.preventDefault(); open(); }
  });

  /* ---------------- 3D monitor screen texture ----------------
     Static parts are painted once into an offscreen canvas;
     each frame only blits it and draws the clock, caret and button. */
  var DS = { base: null, fx: null, key: "" };
  var UI_FONT = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
  var SERIF = '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", serif';
  /* layout in 640x480 units */
  var L3 = { win: [20, 44, 520, 420], page: [42, 142, 476, 286], btn: [364, 380, 134, 38] };

  function mkCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  function bevel(g, x, y, w, h, up) {
    g.fillStyle = "#c3c6cc"; g.fillRect(x, y, w, h);
    g.fillStyle = up ? "#ffffff" : "#5d616a"; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h);
    g.fillStyle = up ? "#5d616a" : "#ffffff"; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
  }
  function buildStatic(w, h) {
    var base = mkCanvas(w, h), g = base.getContext("2d");
    g.save();
    g.scale(w / 640, h / 480);
    g.imageSmoothingEnabled = false;

    /* desktop pattern */
    var tile = mkCanvas(4, 4), tg = tile.getContext("2d");
    tg.fillStyle = "#4b7a78"; tg.fillRect(0, 0, 4, 4);
    tg.fillStyle = "#578785"; tg.fillRect(0, 0, 1, 1); tg.fillRect(2, 2, 1, 1);
    tg.fillStyle = "#426e6c"; tg.fillRect(2, 0, 1, 1);
    g.save(); g.scale(2, 2); g.fillStyle = g.createPattern(tile, "repeat"); g.fillRect(0, 0, 320, 240); g.restore();

    /* menu bar */
    g.fillStyle = "#e1e2e4"; g.fillRect(0, 0, 640, 30);
    g.fillStyle = "#111214"; g.fillRect(0, 30, 640, 2);
    icon16("lamp").paint(g, 10, 6, 1.2);
    g.font = "700 17px " + UI_FONT; g.textBaseline = "middle";
    var mx = 40;
    ["Desk", "File", "Edit", "View"].forEach(function (m) { g.fillText(m, mx, 16); mx += g.measureText(m).width + 20; });

    /* desktop icons */
    [["folder", "Projects", 76], ["resume", "Resume", 172], ["trash", "Trash", 380]].forEach(function (ic) {
      ICONS32[ic[0]]().paint(g, 572, ic[2], 1.6);
      g.font = "700 13px " + UI_FONT; g.textAlign = "center";
      var tw = g.measureText(ic[1]).width + 8;
      g.fillStyle = "#ffffff"; g.fillRect(598 - tw / 2, ic[2] + 54, tw, 17);
      g.fillStyle = "#111214"; g.fillText(ic[1], 598, ic[2] + 63);
      g.textAlign = "left";
    });

    /* window */
    var W = L3.win, x = W[0], y = W[1], ww = W[2], wh = W[3];
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x + 6, y + 6, ww, wh);
    g.fillStyle = "#111214"; g.fillRect(x - 1, y - 1, ww + 2, wh + 2);
    bevel(g, x, y, ww, wh, true);
    /* title bar */
    g.fillStyle = "#2f5076"; g.fillRect(x + 5, y + 5, ww - 10, 30);
    bevel(g, x + 8, y + 8, 24, 24, true);
    g.fillStyle = "#111214"; g.fillRect(x + 14, y + 18, 12, 4);
    bevel(g, x + ww - 60, y + 8, 24, 24, true); g.fillStyle = "#111214"; g.fillRect(x + ww - 51, y + 17, 6, 6);
    bevel(g, x + ww - 32, y + 8, 24, 24, true); g.fillRect(x + ww - 27, y + 13, 14, 14); g.fillStyle = "#c3c6cc"; g.fillRect(x + ww - 25, y + 15, 10, 10);
    g.fillStyle = "#ffffff"; g.font = "700 19px " + UI_FONT; g.textAlign = "center";
    g.fillText(DOC_NAME, x + ww / 2, y + 21);
    g.textAlign = "left";
    /* menus + toolbar */
    g.fillStyle = "#111214"; g.font = "15px " + UI_FONT;
    mx = x + 12;
    ["File", "Edit", "View", "Insert", "Format", "Tools"].forEach(function (m) { g.fillText(m, mx, y + 49); mx += g.measureText(m).width + 16; });
    g.fillStyle = "#8b8f98"; g.fillRect(x + 5, y + 60, ww - 10, 1);
    var tx = x + 10;
    ["new", "open", "save", "print", "cut", "copy", "paste"].forEach(function (k, i) {
      icon16(k).paint(g, tx, y + 66, 1.25); tx += 26 + (i === 2 || i === 3 ? 8 : 0);
    });
    g.fillStyle = "#ffffff"; g.fillRect(tx + 6, y + 65, 150, 22);
    g.fillStyle = "#5d616a"; g.fillRect(tx + 6, y + 65, 150, 1); g.fillRect(tx + 6, y + 65, 1, 22);
    g.fillStyle = "#111214"; g.font = "14px " + SERIF; g.fillText("Times New Roman", tx + 11, y + 77);
    bevel(g, tx + 138, y + 66, 18, 20, true);
    g.beginPath(); g.moveTo(tx + 142, y + 73); g.lineTo(tx + 152, y + 73); g.lineTo(tx + 147, y + 79); g.fill();
    /* workspace + page */
    g.fillStyle = "#7d8088"; g.fillRect(x + 5, y + 92, ww - 10, wh - 120);
    var P = L3.page;
    g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(P[0] + 5, P[1] + 5, P[2], P[3]);
    g.fillStyle = "#ffffff"; g.fillRect(P[0], P[1], P[2], P[3]);
    g.fillStyle = "#111214";
    g.font = "700 80px " + SERIF; g.textBaseline = "alphabetic";
    g.fillText("WHY HIRE", P[0] + 26, P[1] + 84);
    g.font = "700 104px " + SERIF;
    g.fillText("ATUL?", P[0] + 26, P[1] + 184);
    var aw = g.measureText("ATUL?").width;
    DS.caretX = P[0] + 26 + aw + 8;
    g.fillRect(P[0] + 28, P[1] + 194, aw - 4, 5);
    g.font = "italic 21px " + SERIF; g.fillStyle = "#3a3c40";
    g.fillText(WHY.length + " reasons, one page.", P[0] + 28, P[1] + 262);
    /* status bar */
    g.fillStyle = "#111214"; g.font = "13px " + UI_FONT; g.textBaseline = "middle";
    g.fillText("Page 1 of 1     Ln 1     Col 1", x + 12, y + wh - 14);
    g.restore();

    /* CRT overlay: scanlines + vignette */
    var fx = mkCanvas(w, h), f = fx.getContext("2d");
    f.fillStyle = "rgba(0,0,0,.16)";
    for (var sy = 0; sy < h; sy += 3) f.fillRect(0, sy, w, 1);
    var vg = f.createRadialGradient(w / 2, h / 2, h * 0.38, w / 2, h / 2, w * 0.66);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.5)");
    f.fillStyle = vg; f.fillRect(0, 0, w, h);

    DS.base = base; DS.fx = fx; DS.key = w + "x" + h;
  }

  function drawScreen(ctx, w, h, t) {
    w = w || 640; h = h || 480; t = t || 0;
    if (DS.key !== w + "x" + h) buildStatic(w, h);
    ctx.drawImage(DS.base, 0, 0);
    var still = reduced();
    ctx.save();
    ctx.scale(w / 640, h / 480);
    /* clock */
    var d = new Date();
    var time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    ctx.font = "700 17px " + UI_FONT; ctx.textBaseline = "middle"; ctx.textAlign = "right";
    ctx.fillStyle = "#111214"; ctx.fillText(time, 628, 16);
    ctx.textAlign = "left";
    /* caret */
    var P = L3.page;
    if (still || Math.floor(t * 1.8) % 2 === 0) { ctx.fillStyle = "#111214"; ctx.fillRect(DS.caretX || 400, P[1] + 106, 6, 84); }
    /* OPEN button: blinks between raised and pressed/inverted */
    var B = L3.btn, on = still || Math.floor(t * 1.4) % 2 === 0;
    ctx.fillStyle = "#111214"; ctx.fillRect(B[0] - 2, B[1] - 2, B[2] + 4, B[3] + 4);
    if (on) { bevel(ctx, B[0], B[1], B[2], B[3], true); ctx.fillStyle = "#111214"; }
    else { ctx.fillStyle = "#2f5076"; ctx.fillRect(B[0], B[1], B[2], B[3]); ctx.fillStyle = "#ffffff"; }
    ctx.font = "700 22px " + UI_FONT; ctx.textAlign = "center";
    ctx.fillText("[ OPEN ]", B[0] + B[2] / 2, B[1] + B[3] / 2 + 1);
    ctx.textAlign = "left";
    ctx.restore();
    ctx.drawImage(DS.fx, 0, 0);
  }

  window.RETRO = { open: open, close: close, drawScreen: drawScreen, sectionHTML: sectionHTML };
})();
