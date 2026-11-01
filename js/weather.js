/* weather + local time */
(function () {
  "use strict";

  const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
  const WX_API = "https://api.open-meteo.com/v1/forecast";
  const TTL_MS = 15 * 60 * 1000;
  const STALE_MS = 60 * 60 * 1000;
  const RETRY_MS = 5 * 60 * 1000;
  const TIMEOUT_MS = 6000;

  const el = document.querySelector("[data-weather]");
  if (!el) return;

  const SITE = window.SITE || {};
  const loc = SITE.location || {};
  const placeEl = document.querySelector("[data-place]");
  const place = String(loc.place || SITE.place || (placeEl && placeEl.textContent) || "").trim();
  if (!place) return;
  const city = place.split(",")[0].trim();

  // us states + dc
  const STATES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
    CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
    LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
    MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
    NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
    OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
    WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  };
  const COUNTRIES = {
    "usa": "us", "us": "us", "u.s.": "us", "u.s.a.": "us", "united states": "us",
    "united states of america": "us", "america": "us",
    "uk": "gb", "u.k.": "gb", "united kingdom": "gb", "great britain": "gb", "britain": "gb", "england": "gb",
  };

  // weather icons
  const CLOUD = '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>';
  const CLOUD_TOP = '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/>';
  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    cloud: CLOUD,
    rain: CLOUD_TOP + '<path d="M16 14v6M8 14v6M12 16v6"/>',
    snow: CLOUD_TOP + '<path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
  };

  // wmo code -> icon + label
  function describe(code, isDay) {
    const c = Number(code);
    if (c === 0 || c === 1) return { icon: isDay === 0 ? "moon" : "sun", text: c === 0 ? "clear" : "mostly clear" };
    if (c === 2) return { icon: "cloud", text: "partly cloudy" };
    if (c === 3) return { icon: "cloud", text: "cloudy" };
    if (c === 45 || c === 48) return { icon: "cloud", text: "foggy" };
    if (c >= 51 && c <= 57) return { icon: "rain", text: "drizzle" };
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { icon: "rain", text: "rain" };
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { icon: "snow", text: "snow" };
    if (c >= 95 && c <= 99) return { icon: "rain", text: "thunderstorms" };
    return { icon: "cloud", text: "cloudy" };
  }

  // storage can throw in private mode
  function readJSON(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }

  let warned = false;
  function warn(err) {
    if (warned) return;
    warned = true;
    console.warn("[weather] " + (err && err.message ? err.message : err));
  }

  function getJSON(url) {
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), TIMEOUT_MS);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined })
      .then((r) => {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .finally(() => clearTimeout(timer));
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  /* ---- geocode ---- */

  function norm(s) { return String(s || "").trim().toLowerCase(); }

  // best match on state / country, else first
  function pick(results) {
    const parts = place.split(",").slice(1).map((p) => p.trim()).filter(Boolean);
    let best = results[0];
    let bestScore = 0;
    results.forEach((r) => {
      const fields = [norm(r.admin1), norm(r.country), norm(r.country_code)];
      let score = 0;
      parts.forEach((p) => {
        const opts = [norm(p), norm(STATES[p.toUpperCase()]), COUNTRIES[norm(p)] || ""].filter(Boolean);
        if (opts.some((o) => fields.indexOf(o) !== -1)) score++;
      });
      if (score > bestScore) { best = r; bestScore = score; }
    });
    return best;
  }

  function geocode() {
    const key = "wx-geo:" + place.toLowerCase();
    const hit = readJSON(key);
    if (hit && num(hit.lat) !== null && num(hit.lon) !== null) return Promise.resolve(hit);
    const url = GEO_API + "?name=" + encodeURIComponent(city) + "&count=10&language=en&format=json";
    return getJSON(url).then((d) => {
      const list = (d && Array.isArray(d.results)) ? d.results : [];
      if (!list.length) throw new Error("place not found: " + place);
      const r = pick(list);
      const out = { lat: Number(r.latitude), lon: Number(r.longitude), tz: r.timezone || null };
      if (num(out.lat) === null || num(out.lon) === null) throw new Error("bad geocode data");
      writeJSON(key, out);
      return out;
    });
  }

  /* ---- state ---- */

  let coords = null;
  let wxKey = "";
  let tz = null;
  let off = null;
  let wx = null;
  let busy = false;
  let nextTry = 0;
  let tick = 0;
  let fmt = null;

  function setZone(zone, offset) {
    if (num(offset) !== null) off = num(offset);
    if (!zone || zone === tz) return;
    try {
      fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone });
      tz = zone;
    } catch (e) {
      fmt = null;
    }
  }

  // clock at the place
  function clock() {
    if (fmt) return fmt.format(new Date());
    if (off === null) return "";
    try {
      return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" })
        .format(new Date(Date.now() + off * 1000));
    } catch (e) {
      return "";
    }
  }

  /* ---- render ---- */

  let last = "";
  function render() {
    const time = clock();
    const fresh = wx && Date.now() - wx.t < STALE_MS;
    let html = "";
    let label = "";

    if (fresh) {
      const d = describe(wx.code, wx.day);
      const f = Math.round(wx.f);
      const c = Math.round((wx.f - 32) * 5 / 9);
      const temps = f + "°F / " + c + "°C";
      html = '<svg class="wx-' + d.icon + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[d.icon] + "</svg>" +
        '<span class="wx-temp">' + temps + "</span>";
      label = "Weather in " + city + ": " + d.text + ", " + f + "°F (" + c + "°C)";
      if (time) {
        html += '<span class="wx-time">' + time + "</span>";
        label += ", local time " + time;
      }
    } else if (time) {
      html = '<span class="wx-time">' + time + "</span>";
      label = "Local time in " + city + ": " + time;
    }

    if (html === last) return;
    last = html;
    el.innerHTML = html;
    if (html) {
      el.setAttribute("aria-label", label);
      el.classList.add("ready");
    } else {
      el.removeAttribute("aria-label");
      el.classList.remove("ready");
    }
  }

  /* ---- forecast ---- */

  function stale() { return !wx || Date.now() - wx.t >= TTL_MS; }

  function refresh() {
    if (!coords || busy || Date.now() < nextTry || !stale()) return;
    busy = true;
    const url = WX_API + "?latitude=" + coords.lat + "&longitude=" + coords.lon +
      "&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=auto";
    getJSON(url)
      .then((d) => {
        const cur = d && d.current;
        const f = num(cur && cur.temperature_2m);
        if (f === null) throw new Error("bad forecast data");
        wx = { t: Date.now(), f: f, code: num(cur.weather_code), day: num(cur.is_day), tz: d.timezone || null, off: num(d.utc_offset_seconds) };
        writeJSON(wxKey, wx);
        setZone(wx.tz, wx.off);
      })
      .catch((err) => {
        nextTry = Date.now() + RETRY_MS;
        warn(err);
      })
      .then(() => {
        busy = false;
        render();
      });
  }

  // tick on the minute
  function schedule() {
    clearTimeout(tick);
    tick = setTimeout(() => {
      render();
      refresh();
      schedule();
    }, 60000 - (Date.now() % 60000) + 50);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(tick);
      return;
    }
    render();
    refresh();
    schedule();
  });

  function start(c) {
    coords = { lat: c.lat, lon: c.lon };
    wxKey = "wx:" + coords.lat.toFixed(3) + "," + coords.lon.toFixed(3);
    if (c.tz) setZone(c.tz, null);
    const cached = readJSON(wxKey);
    if (cached && num(cached.t) !== null && num(cached.f) !== null) {
      wx = cached;
      setZone(cached.tz, cached.off);
    }
    render();
    refresh();
    if (!document.hidden) schedule();
  }

  try {
    const lat = num(loc.lat);
    const lon = num(loc.lon);
    const exact = lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    (exact ? Promise.resolve({ lat: lat, lon: lon, tz: null }) : geocode())
      .then(start)
      .catch(warn);
  } catch (err) {
    warn(err);
  }
})();
