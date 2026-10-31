/* view counter */
(function () {
  "use strict";

  const BASE = (window.SITE && +window.SITE.rev) || 0;
  const API = "https://abacus.jasoncameron.dev";
  const NS = "atulfranklin-portfolio";
  const KEY = "views";
  const TIMEOUT_MS = 4000;

  const el = document.querySelector("[data-views]");
  if (!el) return;

  // storage can throw in private mode
  function read(store, k) {
    try { return window[store].getItem(k); } catch (e) { return null; }
  }
  function write(store, k, v) {
    try { window[store].setItem(k, String(v)); } catch (e) { /* ignore */ }
  }

  const isLocal = location.protocol === "file:" ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)$/.test(location.hostname);

  // local visit count, once per session
  if (!read("sessionStorage", "views-local")) {
    const n = parseInt(read("localStorage", "views-local"), 10) || 0;
    write("localStorage", "views-local", n + 1);
    write("sessionStorage", "views-local", "1");
  }

  function show(total) {
    const text = total.toLocaleString("en-US");
    el.textContent = text + " views";
    el.setAttribute("aria-label", text + " page views");
    el.classList.add("ready");
  }

  function fallback() {
    const last = parseInt(read("localStorage", "views-last"), 10);
    if (last > 0) return show(last);
    show(BASE + (parseInt(read("localStorage", "views-local"), 10) || 0));
  }

  function call(action) {
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), TIMEOUT_MS);
    return fetch(API + "/" + action + "/" + NS + "/" + KEY, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("views " + r.status);
        return r.json();
      })
      .then((d) => {
        if (d === null) return null;
        const v = Number(d && d.value);
        if (!isFinite(v)) throw new Error("views bad data");
        return v;
      })
      .finally(() => clearTimeout(timer));
  }

  function hitOnce() {
    return call("hit").then((v) => {
      if (v !== null) write("sessionStorage", "views-hit", "1");
      return v;
    });
  }

  // once per session, no counting on localhost
  const hit = !isLocal && !read("sessionStorage", "views-hit");

  (hit ? hitOnce() : call("get"))
    .then((v) => (v === null && !hit && !isLocal ? hitOnce() : v))
    .then((v) => {
      if (v === null) return fallback();
      write("localStorage", "views-last", BASE + v);
      show(BASE + v);
    })
    .catch(fallback);
})();
