// loads assets/maintenance/*.txt into window.SITE, then starts the site
// format: "key: value", --- separates entries, # = comment
(function () {
  "use strict";

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
    whyHire: { keys: ["heading", "stat", "label", "text"] },
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
  function blocks(path, text, format, required) {
    if (text == null) return null;
    try {
      var res = parseBlocks(text, format);
      reportWarnings(path, res.warnings);
      return res.entries.filter(function (e, i) {
        var ok = required.some(function (k) { return str(e[k]).trim(); });
        if (!ok) report(path, "entry " + (i + 1) + " has no " + required.join(" or ") + ", skipped", "warn");
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
    var why = blocks(ROOT + "why-hire-me/why-hire-me.txt", t.whyHire, FORMATS.whyHire, ["heading", "stat", "text"]);
    if (why) S.whyHire = why.map(buildWhy);
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
