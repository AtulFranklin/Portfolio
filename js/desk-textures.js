/* desk-textures.js - procedural desk textures, workers or main thread */
(function () {
  "use strict";
  const IN_WORKER = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
  const FLOOR_N = 1536, DESK_W = 4096, DESK_H = 1536;

  /* ---------------- seeded random + noise ---------------- */
  let tseed = 20261031;
  const trnd = () => ((tseed = (tseed * 16807) % 2147483647) - 1) / 2147483646;
  let RT = null, LAYOUT = null;
  const h2 = (x, y) => RT[((y & 255) << 8) | (x & 255)];
  const n1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return RT[i & 65535] * (1 - u) + RT[(i + 1) & 65535] * u; };
  function vn(x, y, p) {               // value noise, tiles every p lattice cells
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const a = h2(x0, y0), b = h2(x1, y0), c = h2(x0, y1), d = h2(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm2(x, y, p, oct) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let o = 0; o < oct; o++) { s += a * vn(x * f, y * f, p * f); n += a; a *= 0.5; f *= 2; }
    return s / n;
  }

  /* ---------------- plank + board layout ---------------- */
  function layout() {
    if (LAYOUT) return LAYOUT;
    RT = new Float32Array(65536);
    for (let i = 0; i < RT.length; i++) RT[i] = trnd();
    LAYOUT = { floor: floorLayout(FLOOR_N), desk: deskLayout(DESK_W, DESK_H) };
    return LAYOUT;
  }
  function floorLayout(N) {
    const COLS = 16, PW = N / COLS, out = [];
    for (let c = 0; c < COLS; c++) {
      const lens = []; let rem = N;
      while (rem > 0) { let L = Math.round(N * (0.34 + trnd() * 0.4)); if (rem - L < N * 0.28) L = rem; lens.push(L); rem -= L; }
      let y0 = (trnd() * N) | 0;
      for (const L of lens) { out.push(plank(c * PW, y0, L)); y0 = (y0 + L) % N; }
    }
    function plank(x0, y0, L) {
      const tone = 0.78 + trnd() * 0.36, warm = (trnd() - 0.5) * 0.12, rb = 0.3 + trnd() * 0.14;
      const cath = trnd() < 0.6, cu = PW * (0.15 + trnd() * 0.7);
      const ca = (0.5 + trnd() * 1.4) / PW, cb = (trnd() < 0.5 ? -1 : 1) * (0.015 + trnd() * 0.035);
      const freq = 1 / (4.5 + trnd() * 6);
      const p1 = trnd() * 6.3, p2 = trnd() * 6.3, f1 = (0.5 + trnd() * 1.5) * 6.283 / L, f2 = (2 + trnd() * 4) * 6.283 / L;
      const a1 = 2 + trnd() * 7, a2 = 0.5 + trnd() * 2, no = trnd() * 5000;
      const sx = (trnd() * 256) | 0, sy = (trnd() * 256) | 0;
      return { x0, y0, L, tone, warm, rb, cath, cu, ca, cb, freq, p1, p2, f1, f2, a1, a2, no, sx, sy };
    }
    return out;
  }
  function deskLayout(W, Hh) {
    const out = [];
    let y0 = 0;
    while (y0 < Hh) {
      let bh = Math.round(Hh * (0.13 + trnd() * 0.08));
      if (Hh - (y0 + bh) < Hh * 0.1) bh = Hh - y0;
      out.push(board(y0, bh)); y0 += bh;
    }
    function board(b0, bh) {
      const tone = 0.84 + trnd() * 0.3, cath = trnd() < 0.7, cv = bh * (0.2 + trnd() * 0.6);
      const ca = (0.5 + trnd() * 1.6) / bh, cb = (trnd() < 0.5 ? -1 : 1) * (0.008 + trnd() * 0.02);
      const freq = 1 / (5 + trnd() * 8), sap = trnd() < 0.3 ? (trnd() < 0.5 ? 0 : 1) : -1;
      const p1 = trnd() * 6.3, f1 = (0.6 + trnd() * 1.2) * 6.283 / W, a1 = 3 + trnd() * 10, no = trnd() * 5000;
      const sx = (trnd() * 256) | 0, sy = (trnd() * 256) | 0;
      return { b0, bh, tone, cath, cv, ca, cb, freq, sap, p1, f1, a1, no, sx, sy };
    }
    return out;
  }

  /* ---------------- bands ---------------- */
  // band rows + one wrapped halo row each side
  function band(h, part, of) {
    const y0 = Math.round((h * part) / of), y1 = Math.round((h * (part + 1)) / of);
    const full = of === 1, ws = full ? 0 : (y0 - 1 + h) % h, wn = full ? h : y1 - y0 + 2;
    return { h, y0, y1, rows: y1 - y0, wn, win: (r) => { const k = (((r - ws) % h) + h) % h; return k < wn ? k : -1; } };
  }
  function normalRows(hf, w, k, B) {   // tangent-space normal map (opengl convention)
    const { h, y0, y1, win } = B, d = new Uint8ClampedArray(w * B.rows * 4);
    for (let y = y0; y < y1; y++) {
      const ym = win((y - 1 + h) % h) * w, yp = win((y + 1) % h) * w, yr = win(y) * w, o = (y - y0) * w;
      for (let x = 0; x < w; x++) {
        const xm = x === 0 ? w - 1 : x - 1, xp = x === w - 1 ? 0 : x + 1;
        const dx = (hf[yr + xp] - hf[yr + xm]) * k, dy = (hf[yp + x] - hf[ym + x]) * k;
        const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), j = (o + x) * 4;
        d[j] = (0.5 - 0.5 * dx * inv) * 255; d[j + 1] = (0.5 + 0.5 * dy * inv) * 255; d[j + 2] = (0.5 + 0.5 * inv) * 255; d[j + 3] = 255;
      }
    }
    return d;
  }
  function grayRows(arr) {
    const d = new Uint8ClampedArray(arr.length * 4);
    for (let i = 0, n = arr.length; i < n; i++) { const v = arr[i] * 255, j = i * 4; d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 255; }
    return d;
  }

  /* smoked oak planks, 3 m tile, 16 planks */
  function genFloor(B) {
    const N = FLOOR_N, PW = N / 16, { win, y0: by0, rows } = B;
    const d = new Uint8ClampedArray(N * rows * 4), R = new Float32Array(N * rows), H = new Float32Array(N * B.wn);
    const warp = new Float32Array(N), tl = new Float32Array(N);
    for (const p of layout().floor) {
      const { x0, y0, L, tone, warm, rb, cath, cu, ca, cb, freq, p1, p2, f1, f2, a1, a2, no, sx, sy } = p;
      for (let v = 0; v < L; v++) {
        warp[v] = a1 * Math.sin(v * f1 + p1) + a2 * Math.sin(v * f2 + p2) + 6 * n1(v * 0.012 + no);
        tl[v] = 1 + 0.14 * (n1(v * 0.006 + no + 999) - 0.5);
      }
      for (let v = 0; v < L; v++) {
        const ry = (y0 + v) % N, hr = win(ry);
        if (hr < 0) continue;
        const cr = ry - by0, inBand = cr >= 0 && cr < rows;
        const w = warp[v], t1 = tone * tl[v], ev = Math.min(v, L - 1 - v);
        const vf = (v >> 2) + sy, vp = (v >> 3) + sy * 3;
        for (let u = 0; u < PW; u++) {
          const du = u - cu;
          const f = cath ? du * du * ca + v * cb + w * 0.6 : u + w;
          let r = f * freq; r -= Math.floor(r);
          const lw = r * r * r;
          const fib = h2(u + sx, vf) - 0.5;
          const pore = h2(u * 3 + sx + 77, vp) > 0.962 - 0.04 * (1 - lw);
          const e = Math.min(u, PW - 1 - u, ev);
          const bev = e >= 3 ? 1 : e === 2 ? 0.86 : e === 1 ? 0.5 : 0.08;
          H[hr * N + x0 + u] = (0.6 + 0.08 * lw + 0.05 * fib - (pore ? 0.16 : 0)) * bev;
          if (!inBand) continue;
          const k = t1 * (1 - 0.32 * lw) * (1 + 0.1 * fib) * (pore ? 0.7 : 1) * (e === 0 ? 0.32 : e === 1 ? 0.72 : 1);
          const i = cr * N + x0 + u, j = i * 4;
          d[j] = 112 * k * (1 + warm); d[j + 1] = 86 * k; d[j + 2] = 64 * k * (1 - warm); d[j + 3] = 255;
          R[i] = rb + (pore ? 0.2 : 0) + (e < 2 ? 0.35 : 0) + 0.07 * (1 - lw);
        }
      }
    }
    return { map: d, normal: normalRows(H, N, 3, B), rough: grayRows(R) };
  }

  /* walnut top: glued staves, mixed grain */
  function genDesk(B) {
    const W = DESK_W, { win, y0: by0, rows } = B;
    const d = new Uint8ClampedArray(W * rows * 4), R = new Float32Array(W * rows), H = new Float32Array(W * B.wn);
    const warp = new Float32Array(W), tl = new Float32Array(W);
    for (const b of layout().desk) {
      const { b0, bh, tone, cath, cv, ca, cb, freq, sap, p1, f1, a1, no, sx, sy } = b;
      let used = false;
      for (let v = 0; v < bh && !used; v++) used = win(b0 + v) >= 0;
      if (!used) continue;
      for (let x = 0; x < W; x++) {
        warp[x] = a1 * Math.sin(x * f1 + p1) + 8 * n1(x * 0.01 + no) + 2 * n1(x * 0.05 + no);
        tl[x] = 1 + 0.16 * (n1(x * 0.004 + no + 333) - 0.5);
      }
      for (let v = 0; v < bh; v++) {
        const hr = win(b0 + v);
        if (hr < 0) continue;
        const cr = b0 + v - by0, inBand = cr >= 0 && cr < rows;
        const dv = v - cv;
        const sapK = sap < 0 ? 0 : Math.max(0, 1 - ((sap === 0 ? v : bh - 1 - v) / bh) / 0.2);
        const glue = v === 0 ? 0.8 : 1;
        for (let x = 0; x < W; x++) {
          const f = cath ? dv * dv * ca + x * cb + warp[x] * 0.6 : v + warp[x];
          let r = f * freq; r -= Math.floor(r);
          const lw = r * r * r;
          const fib = h2((x >> 2) + sx, v + sy) - 0.5;
          const pore = h2((x >> 3) + sx * 7, v * 3 + sy) > 0.962;
          H[hr * W + x] = 0.6 + 0.05 * lw + 0.05 * fib - (pore ? 0.12 : 0);
          if (!inBand) continue;
          const m = 0.22 + 0.62 * lw;
          let cr2 = 128 + (60 - 128) * m, cg = 82 + (37 - 82) * m, cbl = 52 + (23 - 52) * m;
          if (sapK > 0) { const s = sapK * sapK * 0.75; cr2 += (168 - cr2) * s; cg += (128 - cg) * s; cbl += (88 - cbl) * s; }
          const k = tone * tl[x] * (1 + 0.1 * fib) * (pore ? 0.72 : 1) * glue;
          const i = cr * W + x, j = i * 4;
          d[j] = cr2 * k; d[j + 1] = cg * k; d[j + 2] = cbl * k; d[j + 3] = 255;
          R[i] = 0.56 + (pore ? 0.16 : 0) + 0.06 * lw;
        }
      }
    }
    return { map: d, normal: normalRows(H, W, 2.2, B), rough: grayRows(R) };
  }

  /* trowelled plaster, tiles seamlessly */
  function genPlaster(N) {
    const d = new Uint8ClampedArray(N * N * 4), R = new Float32Array(N * N), H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, j = i * 4;
      const hgt = fbm2((x / N) * 8, (y / N) * 8, 8, 5), m = fbm2((x / N) * 4 + 31, (y / N) * 4 + 17, 4, 4);
      const a = 206 + 46 * (m - 0.5) + 22 * (hgt - 0.5) + 6 * (h2(x, y) - 0.5);
      d[j] = a; d[j + 1] = a * 0.975; d[j + 2] = a * 0.95; d[j + 3] = 255;
      H[i] = hgt + 0.012 * (h2(x + 91, y + 13) - 0.5);
      R[i] = Math.min(1, 0.8 + 0.34 * (m - 0.5) + 0.05 * (hgt - 0.5));
    }
    return { map: d, normal: normalRows(H, N, 5, band(N, 0, 1)), rough: grayRows(R) };
  }

  /* wool rug: shading factors + tiling pile normal */
  function genRug(W, Hh) {
    const K = new Float64Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      K[y * W + x] = (0.8 + 0.4 * h2(x, y)) * (0.92 + 0.16 * fbm2(x / 37, y / 37, 256, 2)) * (1 + 0.05 * Math.sin(y * 2.2));
    }
    const N = 256, H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      H[y * N + x] = 0.45 * h2(x, y) + 0.35 * h2(x >> 1, (y >> 1) + 101) + 0.2 * Math.abs(Math.sin((x * Math.PI) / 4) * Math.sin((y * Math.PI) / 4));
    }
    return { k: K, normal: normalRows(H, N, 1.4, band(N, 0, 1)) };
  }
  // rug border on a real canvas, read back once
  function rugBase(c) {
    const g = c.getContext("2d"), W = c.width, Hh = c.height;
    g.fillStyle = "#4A3A30"; g.fillRect(0, 0, W, Hh);
    const bandRect = (inset, lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(inset, inset, W - inset * 2, Hh - inset * 2); };
    bandRect(10, 20, "#33271F"); bandRect(40, 6, "#A27840"); bandRect(54, 2, "#7E6038"); bandRect(66, 1.5, "#665036");
    return g.getImageData(0, 0, W, Hh);
  }
  // wool shading on top
  function paintRug(c, id, K) {
    const d = id.data;
    for (let i = 0, n = K.length; i < n; i++) { const k = K[i], j = i * 4; d[j] *= k; d[j + 1] *= k; d[j + 2] *= k; }
    c.getContext("2d").putImageData(id, 0, 0);
  }

  /* pebbled leather pad, stitched border */
  function genLeather(W, Hh) {
    const d = new Uint8ClampedArray(W * Hh * 4), R = new Float32Array(W * Hh), H = new Float32Array(W * Hh);
    const IN = 16;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 4;
      const p = 1 - Math.abs(vn(x * 0.16, y * 0.16, 256) - 0.5) * 2, q = fbm2(x / 90, y / 90, 256, 3);
      const onLine = (Math.abs(x - IN) < 1.5 && y > IN && y < Hh - IN) || (Math.abs(x - (W - 1 - IN)) < 1.5 && y > IN && y < Hh - IN) ||
        (Math.abs(y - IN) < 1.5 && x > IN && x < W - IN) || (Math.abs(y - (Hh - 1 - IN)) < 1.5 && x > IN && x < W - IN);
      const along = Math.abs(y - IN) < 1.5 || Math.abs(y - (Hh - 1 - IN)) < 1.5 ? x : y;
      const stitch = onLine && along % 11 < 7;
      const edge = Math.min(x, y, W - 1 - x, Hh - 1 - y);
      let k = (0.86 + 0.18 * p) * (0.92 + 0.16 * q) * (edge < 3 ? 0.7 : 1);
      if (stitch) { d[j] = 120; d[j + 1] = 92; d[j + 2] = 66; } else { d[j] = 52 * k; d[j + 1] = 33 * k; d[j + 2] = 24 * k; }
      d[j + 3] = 255;
      H[i] = 0.5 + 0.18 * p + (stitch ? 0.25 : onLine ? -0.15 : 0) - (edge < 2 ? 0.2 : 0);
      R[i] = stitch ? 0.8 : 0.4 + 0.2 * (1 - p) + 0.1 * q;
    }
    return { map: d, normal: normalRows(H, W, 1.6, band(Hh, 0, 1)), rough: grayRows(R) };
  }

  function genMicro(N) {                // orange-peel texture for plastics
    const H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = 0.7 * vn(x / 3, y / 3, N / 3 | 0) + 0.3 * h2(x, y);
    return { normal: normalRows(H, N, 0.9, band(N, 0, 1)) };
  }

  /* ---------------- jobs ---------------- */
  const SIZE = { floor: [FLOOR_N, FLOOR_N], desk: [DESK_W, DESK_H], plaster: [512, 512], rug: [640, 400], leather: [1024, 424], micro: [129, 129] };
  // longest first, desk split into bands
  function plan(n) {
    const jobs = [], db = Math.min(4, Math.max(2, n)), fb = n >= 6 ? 2 : 1;
    for (let i = 0; i < db; i++) jobs.push({ tex: "desk", part: i, of: db });
    for (let i = 0; i < fb; i++) jobs.push({ tex: "floor", part: i, of: fb });
    ["rug", "plaster", "leather", "micro"].forEach((tex) => jobs.push({ tex, part: 0, of: 1 }));
    return jobs;
  }
  function run(job) {
    const t = performance.now(), [w, h] = SIZE[job.tex];
    layout();
    const B = band(h, job.part, job.of);
    const out = job.tex === "desk" ? genDesk(B) : job.tex === "floor" ? genFloor(B)
      : job.tex === "plaster" ? genPlaster(w) : job.tex === "rug" ? genRug(w, h) : job.tex === "leather" ? genLeather(w, h) : genMicro(w);
    out.y0 = B.y0; out.rows = B.rows;
    out.ms = Math.round(performance.now() - t);
    return out;
  }

  /* ---------------- worker side ---------------- */
  if (IN_WORKER) {
    self.onmessage = (e) => {
      const { i, job } = e.data;
      try {
        const out = run(job);
        self.postMessage({ i, out }, ["map", "normal", "rough", "k"].filter((k) => out[k]).map((k) => out[k].buffer));
      } catch (err) {
        self.postMessage({ i, err: String(err) });
      }
    };
    return;
  }

  /* ---------------- main thread: pool + canvases ---------------- */
  const SRC = document.currentScript && document.currentScript.src;
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function paint(cv, buf, y0, rows) { cv.getContext("2d").putImageData(new ImageData(buf, cv.width, rows), 0, y0); }
  let started = null;
  function start() {
    if (started) return started;
    const t0 = performance.now(), n = Math.max(2, (navigator.hardwareConcurrency || 4) - 1);
    const jobs = plan(n), log = new Array(jobs.length), TX = {};
    const R = window.DESK_TEX.stats = { mode: "", ms: 0, done: 0, jobs: "" };
    for (const k of ["floor", "desk", "plaster", "leather"]) { const [w, h] = SIZE[k]; TX[k] = { map: mkCanvas(w, h), normal: mkCanvas(w, h), rough: mkCanvas(w, h) }; }
    TX.rug = { map: mkCanvas(SIZE.rug[0], SIZE.rug[1]), normal: mkCanvas(256, 256) };
    TX.micro = mkCanvas(SIZE.micro[0], SIZE.micro[1]);
    let rugId = null;
    const take = (i, out) => {
      const { tex, part, of } = jobs[i], t = TX[tex];
      log[i] = tex + (of > 1 ? part : "") + " " + out.ms + "@" + Math.round(performance.now() - t0);
      if (tex === "micro") paint(t, out.normal, 0, t.height);
      else if (tex === "rug") { paintRug(t.map, rugId || rugBase(t.map), out.k); paint(t.normal, out.normal, 0, 256); }
      else { paint(t.map, out.map, out.y0, out.rows); paint(t.normal, out.normal, out.y0, out.rows); paint(t.rough, out.rough, out.y0, out.rows); }
    };
    started = new Promise((resolve) => {
      const pool = [], got = new Array(jobs.length);
      let next = 0, left = jobs.length, dead = false;
      const finish = () => {
        R.ms = Math.round(performance.now() - t0); R.done = performance.now(); R.jobs = log.join(", ");
        resolve(TX);
      };
      // main thread fallback, one texture per tick
      const fallback = async () => {
        if (dead) return;
        dead = true;
        pool.forEach((w) => w.terminate());
        R.mode = pool.length ? "main (workers failed)" : "main";
        for (let i = 0; i < jobs.length; i++) {
          if (got[i]) continue;
          await new Promise((r) => setTimeout(r, 0));
          take(i, run(jobs[i]));
        }
        finish();
      };
      const feed = (w) => { if (next < jobs.length) { const i = next++; w.postMessage({ i, job: jobs[i] }); } };
      if (!SRC || location.protocol === "file:" || typeof Worker === "undefined") { fallback(); return; }
      try {
        const count = Math.min(n, jobs.length);
        R.mode = "workers " + count;
        for (let k = 0; k < count; k++) {
          const w = new Worker(SRC);
          pool.push(w);
          w.onmessage = (e) => {
            if (dead) return;
            const { i, out, err } = e.data;
            if (err) { console.warn("[desk-textures] worker failed", err); fallback(); return; }
            got[i] = true;
            feed(w);
            take(i, out);
            if (--left === 0) { pool.forEach((p) => p.terminate()); finish(); }
          };
          w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); fallback(); };
        }
        // two jobs in flight per worker
        for (let r = 0; r < 2; r++) pool.forEach(feed);
        rugId = rugBase(TX.rug.map);
      } catch (_) { fallback(); }
    });
    return started;
  }
  window.DESK_TEX = { start };
})();
