// loads assets/maintenance/*.txt into window.SITE, then starts the site
// format: "key: value", --- separates entries, # = comment
(function () {
  "use strict";

  /* ---- lite desk, slow pcs ---- */
  var PERF_DAYS = 30;            // keep a gpu check this long
  var BENCH_MS = 40;             // gpu test slower than this = flat desk
  function store(kind) { try { return window[kind]; } catch (_) { return null; } }
  function goLite() {
    if (window.DESK_LITE) return;
    window.DESK_LITE = true;
    document.documentElement.classList.add("desk-lite");
    var ss = store("sessionStorage"), ls = store("localStorage");
    if (window.DESK_TEX && window.DESK_TEX.stop) window.DESK_TEX.stop();
    var ld = document.getElementById("loader");
    if (ld) ld.classList.add("done");
    // way back to the 3d desk
    var hero = document.getElementById("top");
    if (hero && !hero.querySelector(".lite-3d")) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "lite-3d mono";
      b.textContent = "Load the 3D desk";
      b.addEventListener("click", function () {
        try { if (ss) ss.setItem("desk-3d", "1"); if (ls) ls.setItem("desk-perf", "full:" + Date.now()); } catch (_) {}
        location.reload();
      });
      hero.appendChild(b);
    }
    window.dispatchEvent(new CustomEvent("desk:lite"));
  }
  window.DESK_GO_LITE = goLite;

  // gpu check: software renderers, tiny limits, slow fill rate
  function slowGPU() {
    var c = document.createElement("canvas"), gl = null, ms = 0;
    c.width = c.height = 512;
    try { gl = c.getContext("webgl", { failIfMajorPerformanceCaveat: true, antialias: false, depth: false }); } catch (_) {}
    if (!gl) return "no fast webgl";
    try {
      var dbg = gl.getExtension("WEBGL_debug_renderer_info");
      var name = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
      if (/swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i.test(name)) return "software gpu";
      if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096) return "small textures";
      var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      var prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;varying vec2 u;void main(){u=p;gl_Position=vec4(p,0.,1.);}"));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, "precision highp float;varying vec2 u;uniform float k;void main(){float v=u.x*k;for(int i=0;i<48;i++){v=sin(v*1.7+u.y)*cos(v+u.x)+.3;}gl_FragColor=vec4(v,v*.5,u,1.);}"));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return "";
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      var px = new Uint8Array(4), k = gl.getUniformLocation(prog, "k");
      var run = function (n) { for (var i = 0; i < n; i++) { gl.uniform1f(k, 1 + i); gl.drawArrays(gl.TRIANGLES, 0, 3); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      run(1); // warm up
      var t0 = performance.now();
      run(6);
      ms = performance.now() - t0;
      window.DESK_BENCH = { gpu: name, ms: Math.round(ms * 10) / 10 };
    } catch (_) { return ""; } finally {
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    }
    return ms > BENCH_MS ? "slow gpu" : "";
  }

  /* ---- desk preload, desktop only ---- */
  // runs before the txt fetches
  (function preload() {
    try {
      var q = new URLSearchParams(location.search), snap = q.get("snap");
      if (!snap && window.matchMedia("(max-width: 720px)").matches) return;
      var ss = store("sessionStorage"), ls = store("localStorage");
      var force3d = q.get("desk") === "3d" || (ss && ss.getItem("desk-3d") === "1");
      if (!snap && !force3d) {
        // saved verdict, else check the machine now
        var saved = String((ls && ls.getItem("desk-perf")) || "").split(":");
        var fresh = saved[1] && Date.now() - +saved[1] < PERF_DAYS * 864e5;
        var why = "";
        if (q.get("desk") === "lite") why = "asked";
        else if (fresh) why = saved[0] === "lite" ? "saved" : "";
        else {
          if (!window.WebGLRenderingContext) why = "no webgl";
          else if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) why = "2 cores";
          else if (navigator.deviceMemory && navigator.deviceMemory <= 2) why = "low memory";
          else why = slowGPU();
          try { if (ls) ls.setItem("desk-perf", (why ? "lite" : "full") + ":" + Date.now()); } catch (_) {}
        }
        window.DESK_WHY = why;
        if (q.has("debug")) console.log("[desk] perf check:", why || "ok", window.DESK_BENCH || "");
        if (why) { goLite(); return; }
      }
      if (!window.WebGLRenderingContext) return;
      var DP = window.DESK_PRELOAD = {};
      var imp = new Function("u", "return import(u)");
      var add = "three/addons/";
      var quiet = function (p) { p.catch(function () {}); return p; };
      DP.three = quiet(imp("three"));
      DP.rbox = quiet(imp(add + "geometries/RoundedBoxGeometry.js"));
      DP.merge = quiet(imp(add + "utils/BufferGeometryUtils.js"));
      DP.area = quiet(imp(add + "lights/RectAreaLightUniformsLib.js"));
      // gl probe once workers are going, post fx needs webgl2
      var probe = function () {
        try {
          DP.gl2 = !!document.createElement("canvas").getContext("webgl2");
          if (DP.gl2 && !snap && q.get("fx") !== "0") {
            DP.fx = quiet(Promise.all(["EffectComposer", "RenderPass", "GTAOPass", "UnrealBloomPass", "OutputPass", "ShaderPass"].map(function (m) { return imp(add + "postprocessing/" + m + ".js"); })));
          }
        } catch (_) { /* scene.js probes again */ }
      };
      DP.tex = quiet(new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = "js/desk-textures.js";
        s.onload = function () {
          try { res(window.DESK_TEX.start()); } catch (e) { rej(e); }
          setTimeout(probe, 0);
        };
        s.onerror = function (e) { rej(e); probe(); };
        document.head.appendChild(s);
      }));
      if (location.protocol !== "file:") {
        DP.sky = new Promise(function (res) {
          var im = new Image();
          im.onload = function () { res(im); };
          im.onerror = function () { res(null); };
          im.src = "assets/skyline.jpg";
        });
      }
    } catch (_) { /* scene.js loads its own */ }
  })();

  /* ---- loading terminal: fun facts, one after another ---- */
  (function funFacts() {
    var box = document.getElementById("loader");
    var text = box && box.querySelector(".tl-text"), tag = box && box.querySelector(".tl-tag");
    if (!text || window.DESK_LITE || window.matchMedia("(max-width: 720px)").matches) return;
    var facts = ((window.SITE && window.SITE.funFacts) || []).slice();
    var order = [], n = 0, timer = 0, readFirst;
    // desk waits until the first fact is read
    var READ_MS = 1500;
    window.DESK_LOADER = { firstFact: new Promise(function (res) { readFirst = res; }) };
    if (!facts.length) readFirst();
    var done = function () { return box.classList.contains("done"); };
    fetch("assets/maintenance/loading/fun-facts.txt", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (t) {
        var got = String(t || "").split(/\r\n|\r|\n/).map(function (l) { return l.trim(); })
          .filter(function (l) { return l && l.charAt(0) !== "#"; });
        if (got.length) { facts = got; order = []; }
      })
      .catch(function () {});
    function pick() {
      if (!order.length) order = facts.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; });
      return facts[order.pop()];
    }
    // type a fact, hold, next one
    function next() {
      if (done() || !facts.length) return readFirst();
      var f = pick(), i = 0;
      n++;
      tag.textContent = "fun fact #" + n + ": ";
      text.textContent = "";
      (function type() {
        if (done()) return;
        text.textContent = f.slice(0, ++i);
        if (i >= f.length && n === 1) setTimeout(readFirst, READ_MS);
        timer = setTimeout(i < f.length ? type : next, i < f.length ? 18 : 2600);
      })();
    }
    timer = setTimeout(next, 250);
  })();

  var ROOT = "assets/maintenance/";
  var PROJECTS_DIR = ROOT + "projects/";
  var ABOUT_DIR = ROOT + "about-me/";
  var HERO_FILE = ROOT + "hero/hero.txt";
  var ABOUT_FILE = ABOUT_DIR + "about-me.txt";
  var LOCATION_FILE = ROOT + "location.txt";
  var SCRIPTS = ["js/books.js", "js/retro.js", "js/app.js", "js/stats.js", "js/weather.js", "js/certificates.js", "js/letter.js", "js/lounge.js", "js/scene.js"];
  var DEFAULT_COLOR = "#F5B041";
  var ICONS = ["fintech", "apps", "tools", "engineering", "star"];
  var FETCH_TIMEOUT_MS = 10000;

  // known keys only, other colons stay text
  // list = "- " items, repeat = can appear many times
  var FORMATS = {
    book: { keys: ["title", "blurb", "color", "icon"] },
    projects: { keys: ["title", "year", "image", "blurb", "points", "tags", "link"], list: "points", repeat: ["link"] },
    experience: { keys: ["org", "role", "place", "dates", "points"], list: "points" },
    education: { keys: ["school", "degree", "place", "dates"] },
    certifications: { keys: ["name", "issuer", "date"] },
    whyHire: { keys: ["title", "heading", "stat", "label", "text"] },
    whyNote: { keys: ["note"] },
    contact: { keys: ["email", "linkedin", "github", "studio", "resume", "headline", "headline accent", "message", "form key"] },
    hero: { keys: ["kicker", "title", "tagline"] },
    about: { keys: ["greeting", "photo", "lead", "paragraph", "roles"], repeat: ["paragraph"] },
    location: { keys: ["place", "lat", "lon"] },
  };

  /* ---- text helpers ---- */

  // split lines, drop BOM, any newline style
  function toLines(text) {
    return String(text == null ? "" : text).replace(/^﻿/, "").split(/\r\n|\r|\n/);
  }
  function isComment(trimmed) { return trimmed.charAt(0) === "#"; }
  function isSeparator(trimmed) { return /^-{3,}$/.test(trimmed); }
  // "Headline_Accent" -> "headline accent"
  function normKey(k) { return String(k).trim().toLowerCase().replace(/[\s_-]+/g, " "); }

  /* ---- block parser ---- */
  // returns { entries, warnings }
  function parseBlocks(text, format) {
    var known = {};
    (format.keys || []).forEach(function (k) { known[normKey(k)] = true; });
    var listKey = format.list || null;
    var repeat = {};
    (format.repeat || []).forEach(function (k) { repeat[normKey(k)] = true; });

    var entries = [];
    var warnings = [];
    var cur = null;   // current entry
    var last = null;  // target for continuation lines

    function start() {
      cur = { _keys: 0 };
      last = null;
    }
    function finish() {
      if (cur && cur._keys > 0) {
        delete cur._keys;
        entries.push(cur);
      }
      cur = null;
      last = null;
    }

    toLines(text).forEach(function (raw, i) {
      var lineNo = i + 1;
      var line = raw.replace(/\s+$/, ""); // trims trailing \r too
      var t = line.trim();
      if (!t || isComment(t)) return;
      if (isSeparator(t)) { finish(); return; }
      if (!cur) start();

      // "- item" -> list
      var item = /^[-*•]\s+(.*)$/.exec(t);
      if (item && listKey) {
        if (!cur[listKey]) cur[listKey] = [];
        cur[listKey].push(item[1].trim());
        cur._keys++;
        last = { key: listKey, index: cur[listKey].length - 1 };
        return;
      }

      // "key: value", known keys only
      var kv = /^([A-Za-z][A-Za-z _-]*?)\s*:\s*(.*)$/.exec(t);
      if (kv && known[normKey(kv[1])]) {
        var key = normKey(kv[1]);
        var val = kv[2].trim();
        if (key === listKey) {
          // "points:" alone starts the list
          if (!cur[listKey]) cur[listKey] = [];
          if (val) cur[listKey].push(val);
          cur._keys++;
          last = val ? { key: listKey, index: cur[listKey].length - 1 } : { afterList: true };
        } else if (repeat[key]) {
          if (!cur[key]) cur[key] = [];
          cur[key].push(val);
          cur._keys++;
          last = { key: key, index: cur[key].length - 1 };
        } else {
          if (Object.prototype.hasOwnProperty.call(cur, key)) {
            warnings.push({ line: lineNo, msg: 'a second "' + key + ':" in the same entry (is a --- line missing above it?)' });
          }
          cur[key] = val;
          cur._keys++;
          last = { key: key };
        }
        return;
      }

      // continues previous field
      if (!last || last.afterList) {
        warnings.push({
          line: lineNo,
          msg: last
            ? 'start each point with "- ", this line was ignored: "' + clip(t) + '"'
            : 'text that is not under a field was ignored: "' + clip(t) + '"',
        });
        return;
      }
      if (last.index != null) {
        var arr = cur[last.key];
        arr[last.index] = (arr[last.index] ? arr[last.index] + " " : "") + t;
      } else {
        cur[last.key] = (cur[last.key] ? cur[last.key] + " " : "") + t;
      }
    });
    finish();
    return { entries: entries, warnings: warnings };
  }

  /* skills: "Category: items", no colon = continuation */
  function parseSkills(text) {
    var rows = [];
    var warnings = [];
    toLines(text).forEach(function (raw, i) {
      var t = raw.trim();
      if (!t || isComment(t) || isSeparator(t)) return;
      var at = t.indexOf(":");
      if (at > 0) {
        rows.push([t.slice(0, at).trim(), t.slice(at + 1).trim()]);
      } else if (rows.length) {
        var r = rows[rows.length - 1];
        r[1] = (r[1] ? r[1] + " " : "") + t;
      } else {
        warnings.push({ line: i + 1, msg: 'no "Category:" before this text, ignored: "' + clip(t) + '"' });
      }
    });
    return { rows: rows, warnings: warnings };
  }

  /* books.txt: one folder per line, in order */
  function parseBookList(text) {
    var seen = {};
    var out = [];
    toLines(text).forEach(function (raw) {
      var t = raw.trim().replace(/\/+$/, "");
      if (!t || isComment(t) || seen[t]) return;
      seen[t] = true;
      out.push(t);
    });
    return out;
  }

  /* images: bare name = book folder, "/" = site root, http = as is */
  function resolveIn(dir, name) {
    var v = String(name || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v) || v.indexOf("/") !== -1) return v;
    return dir + v;
  }
  function resolveImage(folder, name) { return resolveIn(PROJECTS_DIR + folder + "/", name); }
  // photo: bare name = about-me folder
  function resolvePhoto(name) { return resolveIn(ABOUT_DIR, name); }

  function splitTags(v) {
    return String(v || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }
  // "Label | url" -> { label, href }, bare url = "Link"
  function parseLink(v) {
    var s = String(v || "").trim();
    if (!s) return null;
    var bar = s.indexOf("|");
    if (bar === -1) return { label: "Link", href: s };
    var label = s.slice(0, bar).trim();
    var href = s.slice(bar + 1).trim();
    if (!href) return null;
    return { label: label || "Link", href: href };
  }
  function normColor(v) {
    var s = String(v || "").trim();
    if (!s) return { color: DEFAULT_COLOR, ok: true };
    if (s.charAt(0) !== "#") s = "#" + s;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return { color: s.toUpperCase(), ok: true };
    return { color: DEFAULT_COLOR, ok: false };
  }
  function str(v) { return v == null ? "" : String(v); }
  function clip(s) { s = String(s); return s.length > 60 ? s.slice(0, 57) + "..." : s; }

  /* ---- builders: entries -> SITE shapes ---- */
  function buildCrate(folder, entry) {
    var e = entry || {};
    var col = normColor(e.color);
    return {
      id: folder,
      title: str(e.title) || folder,
      blurb: str(e.blurb),
      color: col.color,
      icon: str(e.icon).toLowerCase(),
      _colorOk: col.ok,
    };
  }
  function buildProject(folder, e) {
    return {
      crate: folder,
      title: str(e.title),
      year: str(e.year),
      image: resolveImage(folder, e.image),
      blurb: str(e.blurb),
      points: (e.points || []).filter(Boolean),
      tags: splitTags(e.tags),
      links: (e.link || []).map(parseLink).filter(Boolean),
    };
  }
  function buildExperience(e) {
    return { org: str(e.org), place: str(e.place), role: str(e.role), dates: str(e.dates), points: (e.points || []).filter(Boolean) };
  }
  function buildEducation(e) {
    return { school: str(e.school), place: str(e.place), degree: str(e.degree), dates: str(e.dates) };
  }
  function buildCert(e) { return [str(e.name), str(e.issuer), str(e.date)]; }
  function buildWhy(e) { return { heading: str(e.heading), stat: str(e.stat), label: str(e.label), text: str(e.text) }; }
  // settings block = title only, not a card
  function isWhySettings(e) {
    return !!e && Object.prototype.hasOwnProperty.call(e, "title") &&
      !["heading", "stat", "label", "text"].some(function (k) { return str(e[k]).trim(); });
  }
  // h2 text, adds the section dot
  function whyHeading(title) {
    var t = str(title).trim();
    return /[?!.]$/.test(t) ? t : t + ".";
  }
  /* hero/about: empty = not set, keeps content.js value */
  function buildHero(e) {
    e = e || {};
    return { kicker: str(e.kicker).trim(), title: str(e.title).trim(), tagline: str(e.tagline).trim() };
  }
  function buildAbout(e) {
    e = e || {};
    return {
      greeting: str(e.greeting).trim(),
      photo: resolvePhoto(e.photo),
      lead: str(e.lead).trim(),
      body: (e.paragraph || []).map(function (p) { return str(p).trim(); }).filter(Boolean),
      roles: splitTags(e.roles),
    };
  }
  // number in -max..max, empty = null
  function parseCoord(v, max) {
    var s = str(v).trim();
    if (!s) return { value: null, ok: true };
    var n = Number(s);
    if (!/^[-+]?\d+(\.\d+)?$/.test(s) || !isFinite(n) || Math.abs(n) > max) return { value: null, ok: false };
    return { value: n, ok: true };
  }
  /* location: place + optional lat/lon pair */
  function buildLocation(e) {
    e = e || {};
    var lat = parseCoord(e.lat, 90);
    var lon = parseCoord(e.lon, 180);
    var pairOk = (lat.value == null) === (lon.value == null);
    return {
      place: str(e.place).trim(),
      lat: pairOk ? lat.value : null,
      lon: pairOk ? lon.value : null,
      _latOk: lat.ok,
      _lonOk: lon.ok,
      _pairOk: pairOk,
    };
  }

  var API = {
    FORMATS: FORMATS,
    parseBlocks: parseBlocks,
    parseSkills: parseSkills,
    parseBookList: parseBookList,
    resolveImage: resolveImage,
    resolvePhoto: resolvePhoto,
    parseLink: parseLink,
    splitTags: splitTags,
    buildCrate: buildCrate,
    buildProject: buildProject,
    buildHero: buildHero,
    buildAbout: buildAbout,
    buildLocation: buildLocation,
    isWhySettings: isWhySettings,
    whyHeading: whyHeading,
  };

  // Node: export parsers only
  if (typeof window === "undefined" || typeof document === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = API;
    return;
  }
  window.MAINTENANCE = API;

  /* ==== browser: load all, then start ==== */
  var S = (window.SITE = window.SITE || {});
  var problems = []; // { file, msg, kind: "error" | "warn" }

  function report(file, msg, kind) {
    problems.push({ file: file, msg: msg, kind: kind || "error" });
    var text = "[maintenance] " + file + ": " + msg;
    if (kind === "warn") console.warn(text);
    else console.error(text);
  }
  function reportWarnings(file, warnings) {
    (warnings || []).forEach(function (w) { report(file, "line " + w.line + " - " + w.msg, "warn"); });
  }

  // fetch text, null on failure
  function getText(path) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS) : null;
    var p;
    try {
      p = fetch(path, { cache: "no-cache", signal: ctrl ? ctrl.signal : undefined });
    } catch (err) {
      p = Promise.reject(err);
    }
    return p
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 404 ? "file not found (404)" : "HTTP " + r.status);
        return r.text();
      })
      .then(
        function (t) { if (timer) clearTimeout(timer); return t; },
        function (err) {
          if (timer) clearTimeout(timer);
          var msg = err && err.name === "AbortError" ? "timed out" : (err && err.message) || "could not be loaded";
          if (location.protocol === "file:") msg = "blocked (page opened as a file)";
          report(path, msg, "error");
          return null;
        }
      );
  }

  // parse block file, skip entries without required field
  // take(e) = true pulls an entry out (settings block)
  function blocks(path, text, format, required, take) {
    if (text == null) return null;
    try {
      var res = parseBlocks(text, format);
      reportWarnings(path, res.warnings);
      var n = 0;
      return res.entries.filter(function (e) {
        if (take && take(e)) return false;
        n++;
        var ok = required.some(function (k) { return str(e[k]).trim(); });
        if (!ok) report(path, "entry " + n + " has no " + required.join(" or ") + ", skipped", "warn");
        return ok;
      });
    } catch (err) {
      report(path, "could not be read (" + (err && err.message) + ")", "error");
      return null;
    }
  }
  function single(path, text, format) {
    var list = blocks(path, text, format, format.keys);
    if (!list) return null;
    if (list.length > 1) report(path, "has " + list.length + " entries, only the first one is used", "warn");
    return list[0] || {};
  }

  function loadBook(folder) {
    var dir = PROJECTS_DIR + folder + "/";
    return Promise.all([getText(dir + "book.txt"), getText(dir + "projects.txt")]).then(function (r) {
      var bookPath = dir + "book.txt", projPath = dir + "projects.txt";
      var crate = buildCrate(folder, single(bookPath, r[0], FORMATS.book));
      if (!crate._colorOk) report(bookPath, "color is not a hex code like #F5B041, using the default", "warn");
      if (crate.icon && ICONS.indexOf(crate.icon) === -1) report(bookPath, 'unknown icon "' + crate.icon + '" (use ' + ICONS.join(", ") + "), showing the star", "warn");
      delete crate._colorOk;
      var projects = (blocks(projPath, r[1], FORMATS.projects, ["title"]) || []).map(function (e) { return buildProject(folder, e); });
      return { crate: crate, projects: projects };
    });
  }

  function loadAll() {
    var books = getText(PROJECTS_DIR + "books.txt").then(function (text) {
      if (text == null) return null;
      var folders = parseBookList(text);
      if (!folders.length) report(PROJECTS_DIR + "books.txt", "lists no books", "warn");
      return Promise.all(folders.map(loadBook));
    });
    var files = {
      experience: getText(ROOT + "experience/experience.txt"),
      education: getText(ROOT + "education-and-skills/education.txt"),
      skills: getText(ROOT + "education-and-skills/skills.txt"),
      certifications: getText(ROOT + "education-and-skills/certifications.txt"),
      whyHire: getText(ROOT + "why-hire-me/why-hire-me.txt"),
      whyNote: getText(ROOT + "why-hire-me/closing.txt"),
      contact: getText(ROOT + "contact/contact.txt"),
      hero: getText(HERO_FILE),
      about: getText(ABOUT_FILE),
      location: getText(LOCATION_FILE),
    };
    var names = Object.keys(files);
    return Promise.all([books].concat(names.map(function (k) { return files[k]; }))).then(function (res) {
      var got = {};
      names.forEach(function (k, i) { got[k] = res[i + 1]; });
      apply(res[0], got);
    });
  }

  // hero/about: copy only set fields
  function applyHero(text) {
    var e = single(HERO_FILE, text, FORMATS.hero);
    if (!e) return;
    var h = buildHero(e);
    S.hero = S.hero || {};
    FORMATS.hero.keys.forEach(function (k) {
      if (h[k]) S.hero[k] = h[k];
      else report(HERO_FILE, k + " is empty, using the value from js/content.js", "warn");
    });
  }
  function applyAbout(text) {
    var e = single(ABOUT_FILE, text, FORMATS.about);
    if (!e) return;
    var a = buildAbout(e);
    S.about = S.about || {};
    function missing(k) { report(ABOUT_FILE, k + " is empty, using the value from js/content.js", "warn"); }
    if (a.greeting) S.about.greeting = a.greeting; else missing("greeting");
    if (a.photo) S.photo = a.photo; else missing("photo");
    if (a.lead) S.about.lead = a.lead; else missing("lead");
    if (a.body.length) S.about.body = a.body; else missing("paragraph");
    if (a.roles.length) S.roles = a.roles; else missing("roles");
  }

  function applyLocation(text) {
    var e = single(LOCATION_FILE, text, FORMATS.location);
    if (!e) return;
    var l = buildLocation(e);
    if (!l._latOk) report(LOCATION_FILE, "lat is not a number between -90 and 90, ignored", "warn");
    if (!l._lonOk) report(LOCATION_FILE, "lon is not a number between -180 and 180, ignored", "warn");
    else if (l._latOk && !l._pairOk) report(LOCATION_FILE, "lat and lon go together, looking the spot up from place", "warn");
    if (l.place) S.place = l.place;
    else report(LOCATION_FILE, "place is empty, using the value from js/content.js", "warn");
    S.location = { place: str(S.place), lat: l.lat, lon: l.lon };
  }

  /* ---- why hire: settings block + cards ---- */
  function applyWhy(text) {
    var path = ROOT + "why-hire-me/why-hire-me.txt";
    var title = null;
    var why = blocks(path, text, FORMATS.whyHire, ["heading", "stat", "text"], function (e) {
      if (!isWhySettings(e)) return false;
      if (title != null) report(path, 'a second "title:" block, only the first one is used', "warn");
      else title = str(e.title).trim();
      return true;
    });
    if (!why) return;
    why.forEach(function (e) {
      if (!Object.prototype.hasOwnProperty.call(e, "title")) return;
      // title stuck to a card
      if (title == null) {
        title = str(e.title).trim();
        report(path, 'put a --- line under "title:" so it sits in its own block above the first card', "warn");
      } else report(path, '"title:" only goes in the block at the top, the one inside a card is ignored', "warn");
    });
    if (title) S.whyTitle = title;
    else report(path, title == null ? 'no "title:" at the top, using the value from js/content.js' : "title is empty, using the value from js/content.js", "warn");
    S.whyHire = why.map(buildWhy);
  }

  // write loaded data into window.SITE
  function apply(books, t) {
    applyHero(t.hero);
    applyAbout(t.about);
    applyLocation(t.location);
    if (books) {
      S.crates = books.map(function (b) { return b.crate; });
      S.projects = [].concat.apply([], books.map(function (b) { return b.projects; }));
    }
    var exp = blocks(ROOT + "experience/experience.txt", t.experience, FORMATS.experience, ["org", "role"]);
    if (exp) S.experience = exp.map(buildExperience);
    var edu = blocks(ROOT + "education-and-skills/education.txt", t.education, FORMATS.education, ["school", "degree"]);
    if (edu) S.education = edu.map(buildEducation);
    var certs = blocks(ROOT + "education-and-skills/certifications.txt", t.certifications, FORMATS.certifications, ["name"]);
    if (certs) S.certifications = certs.map(buildCert);
    if (t.skills != null) {
      var sk = parseSkills(t.skills);
      reportWarnings(ROOT + "education-and-skills/skills.txt", sk.warnings);
      S.skills = sk.rows;
    }
    applyWhy(t.whyHire);
    var wn = single(ROOT + "why-hire-me/closing.txt", t.whyNote, FORMATS.whyNote);
    if (wn && str(wn.note).trim()) S.whyNote = str(wn.note).trim();
    var c = single(ROOT + "contact/contact.txt", t.contact, FORMATS.contact);
    if (c) {
      S.links = {
        email: str(c.email).replace(/^mailto:/i, ""),
        linkedin: str(c.linkedin),
        github: str(c.github),
        studio: str(c.studio),
      };
      if (str(c.resume)) S.resume = str(c.resume);
      S.contact = { headline: str(c.headline), headlineAccent: str(c["headline accent"]), message: str(c.message), formKey: str(c["form key"]) };
    }
  }

  // safe defaults if loading failed
  function ensureDefaults() {
    ["crates", "projects", "experience", "education", "certifications", "skills", "whyHire", "roles", "ticker"].forEach(function (k) {
      if (!Array.isArray(S[k])) S[k] = [];
    });
    S.links = S.links || {};
    ["email", "linkedin", "github", "studio"].forEach(function (k) { if (S.links[k] == null) S.links[k] = ""; });
    S.contact = S.contact || { headline: "", headlineAccent: "", message: "", formKey: "" };
    S.hero = S.hero || { kicker: "", title: "", tagline: "" };
    S.about = S.about || { greeting: "", lead: "", body: [] };
    if (!Array.isArray(S.about.body)) S.about.body = [];
    if (S.resume == null) S.resume = "";
    S.whyTitle = str(S.whyTitle).trim() || "Why hire Atul?";
    if (!S.location || typeof S.location !== "object") S.location = { place: str(S.place), lat: null, lon: null };
    if (!S.location.place) S.location.place = str(S.place);
    if (typeof S.location.lat !== "number" || typeof S.location.lon !== "number") S.location.lat = S.location.lon = null;
  }

  // place text in brand + footer
  function fillPlace() {
    if (!S.place) return;
    var els = document.querySelectorAll("[data-place]");
    for (var i = 0; i < els.length; i++) els[i].textContent = S.place;
  }

  // why title in links, h2, dot label
  function fillWhyTitle() {
    var els = document.querySelectorAll("[data-why-title]");
    for (var i = 0; i < els.length; i++) {
      var v = els[i].getAttribute("data-why-title");
      if (v === "label") els[i].setAttribute("aria-label", S.whyTitle);
      else els[i].textContent = v === "heading" ? whyHeading(S.whyTitle) : S.whyTitle;
    }
  }

  // load site scripts in order (async=false keeps order)
  function loadScripts() {
    SCRIPTS.forEach(function (src) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onerror = function () { console.error("[maintenance] could not load " + src); };
      document.body.appendChild(s);
    });
  }

  /* ---- problems banner (file:// + localhost) ---- */
  function showBanner(title, lines) {
    var box = document.createElement("div");
    box.setAttribute("role", "status");
    box.setAttribute("data-maintenance-banner", "");
    box.style.cssText = [
      "position:fixed", "left:16px", "bottom:16px", "z-index:2147483000",
      "max-width:min(560px, calc(100vw - 32px))", "max-height:45vh", "overflow:auto", "box-sizing:border-box",
      "padding:12px 40px 12px 14px", "background:var(--ink-2, #181C25)", "color:var(--text, #ECE7DD)",
      "border:1px solid var(--amber, #F5B041)", "border-radius:var(--r-md, 14px)",
      "box-shadow:var(--shadow-card, 0 24px 60px -20px rgba(0,0,0,.6))",
      "font:12.5px/1.5 var(--mono, ui-monospace, Menlo, monospace)",
    ].join(";");
    var h = document.createElement("strong");
    h.textContent = title;
    h.style.cssText = "display:block;color:var(--amber, #F5B041);font-weight:500;margin-bottom:4px";
    box.appendChild(h);
    if (lines.length) {
      var ul = document.createElement("ul");
      ul.style.cssText = "margin:4px 0 0;padding-left:16px;color:var(--text-2, #B3AC9F)";
      lines.forEach(function (l) {
        var li = document.createElement("li");
        li.textContent = l;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    var x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "×";
    x.style.cssText = "position:absolute;top:6px;right:8px;width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--text-2, #B3AC9F);font:18px/1 var(--mono, monospace);cursor:pointer";
    x.addEventListener("click", function () { box.remove(); });
    box.appendChild(x);
    document.body.appendChild(box);
  }
  function maybeBanner() {
    var host = location.hostname;
    var isFile = location.protocol === "file:";
    var isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)$/.test(host);
    if (isFile) {
      if (problems.length) {
        showBanner("Preview mode", ["Opened as a file, so the browser blocks the maintenance files. Double-click preview.command (or run python3 -m http.server 8000) to see the full site."]);
      }
      return;
    }
    if (isLocal && problems.length) {
      showBanner(
        "assets/maintenance - " + problems.length + " problem" + (problems.length === 1 ? "" : "s"),
        problems.map(function (p) { return p.file + ": " + p.msg; })
      );
    }
    // live site: console only
  }

  /* ---- go ---- */
  var resolveReady;
  window.SITE_READY = new Promise(function (r) { resolveReady = r; });

  var started = false;
  function startSite() {
    if (started) return;
    started = true;
    try { ensureDefaults(); } catch (_) { /* keep going */ }
    try { fillPlace(); } catch (_) { /* keep going */ }
    try { fillWhyTitle(); } catch (_) { /* keep going */ }
    try { resolveReady(S); } catch (_) { /* keep going */ }
    try { loadScripts(); } catch (err) { console.error("[maintenance] could not start the site scripts", err); }
    try { maybeBanner(); } catch (_) { /* banner is optional */ }
  }

  var run;
  try { run = loadAll(); } catch (err) { run = Promise.reject(err); }
  run.then(startSite, function (err) {
    console.error("[maintenance] loading failed, starting the site without it", err);
    startSite();
  });
})();
