/* scene.js - "Atul's Desk": a night trading desk in Three.js.
   Classic script that dynamically imports three (via the importmap in index.html),
   so the page also works when opened straight from disk.
   Every object action is also reachable through normal HTML links on the page. */
(async function () {
  "use strict";
  const S = window.SITE;
  const DESK = window.DESK;
  const host = document.getElementById("scene");
  const loader = document.getElementById("loader");
  const labelEl = document.getElementById("sceneLabel");
  const reduce = DESK.reduceMotion;
  const isFile = location.protocol === "file:";

  function fail() {
    document.getElementById("sceneFallback").hidden = false;
    const hint = document.getElementById("heroHint");
    if (hint) hint.hidden = true;
    loader.classList.add("done");
  }

  // WebGL available?
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return fail();
  } catch (_) { return fail(); }

  // Phones get the flat, Sienna-style object grid instead of the 3D desk (see index.html .m-desk).
  // ?snap=<object> is a render-only mode used to export those object images.
  const SNAP = new URLSearchParams(location.search).get("snap");
  if (!SNAP && window.matchMedia("(max-width: 720px)").matches) { loader.classList.add("done"); return; }

  const params = new URLSearchParams(location.search);
  const DEBUG = params.has("debug");
  const FXQ = params.get("fx");          // "0" = no post-processing, "1".."3" = fixed quality (no auto-tuning)
  const tStart = performance.now();

  let THREE, RoundedBoxGeometry, mergeGeometries;
  try {
    THREE = await import("three");
    [{ RoundedBoxGeometry }, { mergeGeometries }] = await Promise.all([
      import("three/addons/geometries/RoundedBoxGeometry.js"),
      import("three/addons/utils/BufferGeometryUtils.js"),
    ]);
  } catch (e) {
    console.warn("Three.js could not load", e);
    return fail();
  }
  // Optional extras: the window's area light and the post-processing chain.
  // If any of them fails to load, the desk still renders, just more plainly.
  let RectAreaLightUniformsLib = null, PP = null;
  const optional = [
    import("three/addons/lights/RectAreaLightUniformsLib.js")
      .then((m) => { RectAreaLightUniformsLib = m.RectAreaLightUniformsLib; })
      .catch(() => {}),
  ];
  if (!SNAP && FXQ !== "0") {
    optional.push(Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
      import("three/addons/postprocessing/SMAAPass.js"),
      import("three/addons/postprocessing/ShaderPass.js"),
    ]).then((m) => {
      PP = {
        EffectComposer: m[0].EffectComposer, RenderPass: m[1].RenderPass, GTAOPass: m[2].GTAOPass,
        UnrealBloomPass: m[3].UnrealBloomPass, OutputPass: m[4].OutputPass, SMAAPass: m[5].SMAAPass, ShaderPass: m[6].ShaderPass,
      };
    }).catch((e) => { console.warn("Post-processing unavailable, rendering directly", e); }));
  }

  const FONT = '"Geist", system-ui, sans-serif';
  const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
  const C = { amber: "#F5B041", up: "#3DDC97", down: "#FF6B6B", paper: "#F3EEE4", ink: "#16130E" };

  // The view out of the window: a photo (assets/skyline.jpg) when it can be used,
  // otherwise the procedural 3D city further down.
  const SKY_PHOTO = "assets/skyline.jpg";
  const skyPhotoP = Promise.race([loadImage(SKY_PHOTO), new Promise((r) => setTimeout(() => r(null), 5000))]);
  // wait briefly for fonts so canvas textures use Geist
  const fontsP = Promise.race([
    Promise.all([document.fonts.load('700 64px "Geist"'), document.fonts.load('500 32px "Geist Mono"')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => {});

  /* ---------------- seeded random ---------------- */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  /* ---------------- procedural material textures ----------------
     Everything is painted into canvases at load time (no downloads): a height field per
     surface gives the albedo, a normal map (from the height) and a roughness map that all
     agree with each other. Generated while the skyline photo and fonts are loading. */
  let tseed = 20261031;
  const trnd = () => ((tseed = (tseed * 16807) % 2147483647) - 1) / 2147483646;
  const RT = new Float32Array(65536);
  for (let i = 0; i < RT.length; i++) RT[i] = trnd();
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
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function pix(w, h) { const c = mkCanvas(w, h), g = c.getContext("2d"), id = g.createImageData(w, h); return { c, g, id, d: id.data }; }
  function grayCanvas(arr, w, h) {
    const P = pix(w, h), d = P.d;
    for (let i = 0, n = w * h; i < n; i++) { const v = arr[i] * 255, j = i * 4; d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 255; }
    P.g.putImageData(P.id, 0, 0);
    return P.c;
  }
  function normalCanvas(hf, w, h, k) {   // tangent-space normal map (OpenGL / three convention)
    const P = pix(w, h), d = P.d;
    for (let y = 0; y < h; y++) {
      const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, yr = y * w;
      for (let x = 0; x < w; x++) {
        const xm = x === 0 ? w - 1 : x - 1, xp = x === w - 1 ? 0 : x + 1;
        const dx = (hf[yr + xp] - hf[yr + xm]) * k, dy = (hf[yp + x] - hf[ym + x]) * k;
        const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), j = (yr + x) * 4;
        d[j] = (0.5 - 0.5 * dx * inv) * 255; d[j + 1] = (0.5 + 0.5 * dy * inv) * 255; d[j + 2] = (0.5 + 0.5 * inv) * 255; d[j + 3] = 255;
      }
    }
    P.g.putImageData(P.id, 0, 0);
    return P.c;
  }

  /* smoked oak, long planks running toward the window. Tile = 3 m x 3 m, 16 planks across. */
  function genFloor(N) {
    const COLS = 16, PW = N / COLS;
    const A = pix(N, N), d = A.d, R = new Float32Array(N * N), H = new Float32Array(N * N);
    const warp = new Float32Array(N), tl = new Float32Array(N);
    for (let c = 0; c < COLS; c++) {
      const lens = []; let rem = N;
      while (rem > 0) { let L = Math.round(N * (0.34 + trnd() * 0.4)); if (rem - L < N * 0.28) L = rem; lens.push(L); rem -= L; }
      let y0 = (trnd() * N) | 0;
      for (const L of lens) { plank(c * PW, y0, L); y0 = (y0 + L) % N; }
    }
    function plank(x0, y0, L) {
      const tone = 0.78 + trnd() * 0.36, warm = (trnd() - 0.5) * 0.12, rb = 0.3 + trnd() * 0.14;
      const cath = trnd() < 0.6, cu = PW * (0.15 + trnd() * 0.7);
      const ca = (0.5 + trnd() * 1.4) / PW, cb = (trnd() < 0.5 ? -1 : 1) * (0.015 + trnd() * 0.035);
      const freq = 1 / (4.5 + trnd() * 6);
      const p1 = trnd() * 6.3, p2 = trnd() * 6.3, f1 = (0.5 + trnd() * 1.5) * 6.283 / L, f2 = (2 + trnd() * 4) * 6.283 / L;
      const a1 = 2 + trnd() * 7, a2 = 0.5 + trnd() * 2, no = trnd() * 5000;
      for (let v = 0; v < L; v++) {
        warp[v] = a1 * Math.sin(v * f1 + p1) + a2 * Math.sin(v * f2 + p2) + 6 * n1(v * 0.012 + no);
        tl[v] = 1 + 0.14 * (n1(v * 0.006 + no + 999) - 0.5);
      }
      const sx = (trnd() * 256) | 0, sy = (trnd() * 256) | 0;
      for (let v = 0; v < L; v++) {
        const row = ((y0 + v) % N) * N, w = warp[v], t1 = tone * tl[v], ev = Math.min(v, L - 1 - v);
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
          const k = t1 * (1 - 0.32 * lw) * (1 + 0.1 * fib) * (pore ? 0.7 : 1) * (e === 0 ? 0.32 : e === 1 ? 0.72 : 1);
          const i = row + x0 + u, j = i * 4;
          d[j] = 112 * k * (1 + warm); d[j + 1] = 86 * k; d[j + 2] = 64 * k * (1 - warm); d[j + 3] = 255;
          H[i] = (0.6 + 0.08 * lw + 0.05 * fib - (pore ? 0.16 : 0)) * bev;
          R[i] = rb + (pore ? 0.2 : 0) + (e < 2 ? 0.35 : 0) + 0.07 * (1 - lw);
        }
      }
    }
    A.g.putImageData(A.id, 0, 0);
    return { map: A.c, normal: normalCanvas(H, N, N, 3), rough: grayCanvas(R, N, N) };
  }

  /* solid walnut top: staves glued edge to edge along the length, cathedral + straight grain,
     the odd streak of pale sapwood. u = desk width (x), rows = desk depth (z). */
  function genDesk(W, Hh) {
    const A = pix(W, Hh), d = A.d, R = new Float32Array(W * Hh), H = new Float32Array(W * Hh);
    const warp = new Float32Array(W), tl = new Float32Array(W);
    let y0 = 0;
    while (y0 < Hh) {
      let bh = Math.round(Hh * (0.13 + trnd() * 0.08));
      if (Hh - (y0 + bh) < Hh * 0.1) bh = Hh - y0;
      board(y0, bh); y0 += bh;
    }
    function board(b0, bh) {
      const tone = 0.84 + trnd() * 0.3, cath = trnd() < 0.7, cv = bh * (0.2 + trnd() * 0.6);
      const ca = (0.5 + trnd() * 1.6) / bh, cb = (trnd() < 0.5 ? -1 : 1) * (0.008 + trnd() * 0.02);
      const freq = 1 / (5 + trnd() * 8), sap = trnd() < 0.3 ? (trnd() < 0.5 ? 0 : 1) : -1;
      const p1 = trnd() * 6.3, f1 = (0.6 + trnd() * 1.2) * 6.283 / W, a1 = 3 + trnd() * 10, no = trnd() * 5000;
      for (let x = 0; x < W; x++) {
        warp[x] = a1 * Math.sin(x * f1 + p1) + 8 * n1(x * 0.01 + no) + 2 * n1(x * 0.05 + no);
        tl[x] = 1 + 0.16 * (n1(x * 0.004 + no + 333) - 0.5);
      }
      const sx = (trnd() * 256) | 0, sy = (trnd() * 256) | 0;
      for (let v = 0; v < bh; v++) {
        const row = (b0 + v) * W, dv = v - cv;
        const sapK = sap < 0 ? 0 : Math.max(0, 1 - ((sap === 0 ? v : bh - 1 - v) / bh) / 0.2);
        const glue = v === 0 ? 0.8 : 1;
        for (let x = 0; x < W; x++) {
          const f = cath ? dv * dv * ca + x * cb + warp[x] * 0.6 : v + warp[x];
          let r = f * freq; r -= Math.floor(r);
          const lw = r * r * r;
          const fib = h2((x >> 2) + sx, v + sy) - 0.5;
          const pore = h2((x >> 3) + sx * 7, v * 3 + sy) > 0.962;
          const m = 0.22 + 0.62 * lw;
          let cr = 128 + (60 - 128) * m, cg = 82 + (37 - 82) * m, cbl = 52 + (23 - 52) * m;
          if (sapK > 0) { const s = sapK * sapK * 0.75; cr += (168 - cr) * s; cg += (128 - cg) * s; cbl += (88 - cbl) * s; }
          const k = tone * tl[x] * (1 + 0.1 * fib) * (pore ? 0.72 : 1) * glue;
          const i = row + x, j = i * 4;
          d[j] = cr * k; d[j + 1] = cg * k; d[j + 2] = cbl * k; d[j + 3] = 255;
          H[i] = 0.6 + 0.05 * lw + 0.05 * fib - (pore ? 0.12 : 0);
          R[i] = 0.56 + (pore ? 0.16 : 0) + 0.06 * lw;
        }
      }
    }
    A.g.putImageData(A.id, 0, 0);
    return { map: A.c, normal: normalCanvas(H, W, Hh, 2.2), rough: grayCanvas(R, W, Hh) };
  }

  /* hand-trowelled plaster (light grey, tinted per material). Tiles seamlessly. */
  function genPlaster(N) {
    const A = pix(N, N), d = A.d, R = new Float32Array(N * N), H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, j = i * 4;
      const hgt = fbm2((x / N) * 8, (y / N) * 8, 8, 5), m = fbm2((x / N) * 4 + 31, (y / N) * 4 + 17, 4, 4);
      const a = 206 + 46 * (m - 0.5) + 22 * (hgt - 0.5) + 6 * (h2(x, y) - 0.5);
      d[j] = a; d[j + 1] = a * 0.975; d[j + 2] = a * 0.95; d[j + 3] = 255;
      H[i] = hgt + 0.012 * (h2(x + 91, y + 13) - 0.5);
      R[i] = Math.min(1, 0.8 + 0.34 * (m - 0.5) + 0.05 * (hgt - 0.5));
    }
    A.g.putImageData(A.id, 0, 0);
    return { map: A.c, normal: normalCanvas(H, N, N, 5), rough: grayCanvas(R, N, N) };
  }

  /* wool rug: the design (albedo) plus a separate tiling pile normal map */
  function genRug(W, Hh) {
    const P = pix(W, Hh), g = P.g;
    g.fillStyle = "#4A3A30"; g.fillRect(0, 0, W, Hh);
    const band = (inset, lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(inset, inset, W - inset * 2, Hh - inset * 2); };
    band(10, 20, "#33271F"); band(40, 6, "#A27840"); band(54, 2, "#7E6038"); band(66, 1.5, "#665036");
    const id = g.getImageData(0, 0, W, Hh), d = id.data;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 4;
      const k = (0.8 + 0.4 * h2(x, y)) * (0.92 + 0.16 * fbm2(x / 37, y / 37, 256, 2)) * (1 + 0.05 * Math.sin(y * 2.2));
      d[j] *= k; d[j + 1] *= k; d[j + 2] *= k;
    }
    g.putImageData(id, 0, 0);
    const N = 256, H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      H[y * N + x] = 0.45 * h2(x, y) + 0.35 * h2(x >> 1, (y >> 1) + 101) + 0.2 * Math.abs(Math.sin((x * Math.PI) / 4) * Math.sin((y * Math.PI) / 4));
    }
    return { map: P.c, normal: normalCanvas(H, N, N, 1.4) };
  }

  /* pebbled leather desk pad with a stitched border */
  function genLeather(W, Hh) {
    const A = pix(W, Hh), d = A.d, R = new Float32Array(W * Hh), H = new Float32Array(W * Hh);
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
    A.g.putImageData(A.id, 0, 0);
    return { map: A.c, normal: normalCanvas(H, W, Hh, 1.6), rough: grayCanvas(R, W, Hh) };
  }

  /* pine crate boards: three planks per face, worn edges, grime in the seams, nail heads */
  function genCrate(W, Hh) {
    const A = pix(W, Hh), d = A.d, R = new Float32Array(W * Hh), H = new Float32Array(W * Hh);
    const rows = [[0, 112], [112, 160], [272, 112]];
    for (const [b0, bh] of rows) {
      const tone = 0.86 + trnd() * 0.24, freq = 1 / (6 + trnd() * 6), no = trnd() * 4000, a1 = 3 + trnd() * 6;
      const kx = (trnd() < 0.5 ? 0.12 : 0.7) * W + trnd() * 0.18 * W, ky = bh * (0.3 + trnd() * 0.4), kr = 4 + trnd() * 4, knot = trnd() < 0.7;
      for (let v = 0; v < bh; v++) for (let x = 0; x < W; x++) {
        const i = (b0 + v) * W + x, j = i * 4;
        let f = v + a1 * Math.sin(x * 0.006 + no) + 5 * n1(x * 0.015 + no);
        let kd = 0;
        if (knot) { const dx = x - kx, dy = v - ky, q = dx * dx * 0.35 + dy * dy; f += (60 * kr * kr) / (q + kr * kr) * Math.sign(dy || 1); kd = Math.exp(-q / (kr * kr)); }
        let r = f * freq; r -= Math.floor(r);
        const lw = r * r * r, fib = h2((x >> 2) + 50, v + b0) - 0.5;
        const e = Math.min(v, bh - 1 - v), ex = Math.min(x, W - 1 - x, b0 + v, Hh - 1 - b0 - v);
        const grime = e < 6 ? 0.62 + 0.38 * (e / 6) : 1;
        const wearEdge = ex < 14 ? 0.8 + 0.2 * (ex / 14) : 1;
        const m = 0.25 + 0.6 * lw;
        const k = tone * (1 + 0.1 * fib) * grime * wearEdge * (1 - 0.35 * kd) * (0.94 + 0.12 * fbm2(x / 60, (b0 + v) / 60, 256, 2));
        d[j] = (178 + (124 - 178) * m) * k; d[j + 1] = (128 + (82 - 128) * m) * k; d[j + 2] = (82 + (48 - 82) * m) * k; d[j + 3] = 255;
        H[i] = (0.62 + 0.06 * lw + 0.05 * fib) * (e >= 4 ? 1 : e === 3 ? 0.9 : e === 2 ? 0.75 : e === 1 ? 0.5 : 0.1);
        R[i] = 0.72 + 0.12 * (1 - grime) + 0.06 * lw;
      }
      // nail heads near both ends of the plank
      for (const nx of [18, W - 19]) for (const ny of bh > 130 ? [bh * 0.3, bh * 0.7] : [bh * 0.5]) {
        const cx = nx, cy = b0 + ny;
        for (let y = Math.floor(cy - 8); y <= cy + 8; y++) for (let x = Math.floor(cx - 8); x <= cx + 8; x++) {
          const q = Math.hypot(x - cx, y - cy); if (q > 6.5) continue;
          const i = y * W + x, j = i * 4, s = q < 5.5 ? 1 : 0.6;
          const lit = 0.75 + 0.5 * Math.max(0, -(x - cx) - (y - cy)) / 8;
          d[j] = 70 * lit * s; d[j + 1] = 64 * lit * s; d[j + 2] = 58 * lit * s;
          H[i] = 0.7 + 0.12 * Math.sqrt(Math.max(0, 1 - (q / 6) * (q / 6)));
          R[i] = 0.45;
        }
      }
    }
    A.g.putImageData(A.id, 0, 0);
    // light scuffs
    const g = A.g;
    for (let s = 0; s < 40; s++) {
      g.strokeStyle = `rgba(230,200,160,${0.05 + trnd() * 0.08})`; g.lineWidth = 0.6 + trnd();
      const x = trnd() * W, y = trnd() * Hh, a = (trnd() - 0.5) * 0.6, l = 8 + trnd() * 30;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return { map: A.c, H, rough: grayCanvas(R, W, Hh) };
  }
  function genBatten(W, Hh) {           // corner posts: grain runs along the post (image y)
    const A = pix(W, Hh), d = A.d, H = new Float32Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 4;
      let r = (x + 4 * Math.sin(y * 0.01) + 3 * n1(y * 0.02)) / 9; r -= Math.floor(r);
      const lw = r * r * r, e = Math.min(x, W - 1 - x), fib = h2(x + 9, (y >> 2) + 40) - 0.5;
      const k = (1 - 0.35 * lw) * (1 + 0.1 * fib) * (e < 10 ? 0.7 + 0.03 * e : 1) * 0.8;
      d[j] = 170 * k; d[j + 1] = 120 * k; d[j + 2] = 76 * k; d[j + 3] = 255;
      H[i] = (0.6 + 0.05 * lw + 0.04 * fib) * (e >= 8 ? 1 : 0.3 + 0.7 * Math.sqrt(e / 8));
    }
    A.g.putImageData(A.id, 0, 0);
    return { map: A.c, normal: normalCanvas(H, W, Hh, 2) };
  }
  function genMicro(N) {                // orange-peel micro texture for plastics / powder coat
    const H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = 0.7 * vn(x / 3, y / 3, N / 3 | 0) + 0.3 * h2(x, y);
    return normalCanvas(H, N, N, 0.9);
  }
  const idle = () => new Promise((r) => setTimeout(r, 0));
  async function genTextures() {
    const t0 = performance.now(), out = {}, log = [];
    const step = async (name, fn) => { const t = performance.now(); out[name] = fn(); log.push(name + " " + Math.round(performance.now() - t)); await idle(); };
    await step("floor", () => genFloor(1536));
    await step("desk", () => genDesk(2048, 1024));
    await step("plaster", () => genPlaster(512));
    await step("rug", () => genRug(1024, 640));
    await step("leather", () => genLeather(1024, 424));
    await step("crate", () => genCrate(640, 384));
    await step("batten", () => genBatten(128, 512));
    await step("micro", () => genMicro(129));
    if (DEBUG) console.log("[scene] textures", Math.round(performance.now() - t0), "ms:", log.join(", "));
    return out;
  }
  const TX = await genTextures();
  await Promise.all([fontsP].concat(optional));
  const skyPhoto = await skyPhotoP;

  /* ---------------- renderer / scene / camera ---------------- */
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const useFX = !!PP;
  // With post-processing the anti-aliasing comes from SMAA, so the canvas itself skips MSAA.
  const renderer = new THREE.WebGLRenderer({ antialias: !useFX, powerPreference: "high-performance", alpha: !!SNAP, preserveDrawingBuffer: !!SNAP });
  const DPR = window.devicePixelRatio || 1;
  // pixel ratio per quality level: the post chain costs per pixel, so it runs a little below retina
  const prFor = (lvl) => Math.min(DPR, mobile ? 1.5 : !useFX ? 1.75 : lvl >= 2 ? 1.5 : 1.25);
  renderer.setPixelRatio(prFor(3));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;        // updated once per frame in draw(), not again in the AO pass
  host.appendChild(renderer.domElement);
  if (RectAreaLightUniformsLib) RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#07080B");
  scene.fog = new THREE.Fog("#57557F", 150, 560);   // dusk haze over the city; far beyond the room

  const pmrem = new THREE.PMREMGenerator(renderer);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 900);
  const camHome = new THREE.Vector3(0, 2.2, 5.1);
  const lookHome = new THREE.Vector3(0.05, 0.62, -0.35);
  const camStart = new THREE.Vector3(-0.6, 3.4, 7.6);

  /* ---------------- texture helpers ---------------- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function canvasTex(w, h, draw, opts = {}) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    draw(g, w, h);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.userData = { canvas: cv, ctx: g };
    return t;
  }
  function tex(cv, { srgb = true, repeat = null } = {}) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.userData = { canvas: cv };
    return t;
  }
  function loadImage(src) {
    // From file:// the browser treats images as cross-origin, so WebGL can't use them.
    if (isFile) return Promise.resolve(null);
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // box UVs from world position (metres / tile), so plaster keeps one scale on every wall piece
  function worldUV(geo, tile) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (ax > 0.5) uv.setXY(i, z / tile, y / tile);
      else if (ay > 0.5) uv.setXY(i, x / tile, z / tile);
      else uv.setXY(i, x / tile, y / tile);
    }
    uv.needsUpdate = true;
    return geo;
  }

  /* ---------------- materials ---------------- */
  const FLOOR_TILE = 3;                  // metres per floor texture tile
  function half(cv) { const c = mkCanvas(cv.width >> 1, cv.height >> 1); c.getContext("2d").drawImage(cv, 0, 0, c.width, c.height); return c; }
  const T = {
    floor: tex(TX.floor.map, { repeat: [1, 1] }), floorN: tex(TX.floor.normal, { srgb: false, repeat: [1, 1] }), floorR: tex(half(TX.floor.rough), { srgb: false, repeat: [1, 1] }),
    desk: tex(TX.desk.map), deskN: tex(TX.desk.normal, { srgb: false }), deskR: tex(half(TX.desk.rough), { srgb: false }),
    plaster: tex(TX.plaster.map, { repeat: [1, 1] }), plasterN: tex(TX.plaster.normal, { srgb: false, repeat: [1, 1] }), plasterR: tex(TX.plaster.rough, { srgb: false, repeat: [1, 1] }),
    rug: tex(TX.rug.map), rugN: tex(TX.rug.normal, { srgb: false, repeat: [18, 11] }),
    leather: tex(TX.leather.map), leatherN: tex(TX.leather.normal, { srgb: false }), leatherR: tex(TX.leather.rough, { srgb: false }),
    crate: tex(TX.crate.map), crateN: tex(normalCanvas(TX.crate.H, 640, 384, 2.4), { srgb: false }), crateR: tex(TX.crate.rough, { srgb: false }),
    batten: tex(TX.batten.map), battenN: tex(TX.batten.normal, { srgb: false }),
    micro: tex(TX.micro, { srgb: false, repeat: [3, 3] }),
  };
  const v2 = (a, b = a) => new THREE.Vector2(a, b);
  const M = {
    // dark warm plaster (the light grey texture is tinted down by the colour)
    wall: new THREE.MeshStandardMaterial({ color: "#5E5852", map: T.plaster, normalMap: T.plasterN, normalScale: v2(0.55), roughnessMap: T.plasterR, roughness: 1, envMapIntensity: 0.7 }),
    stone: new THREE.MeshStandardMaterial({ color: "#8E867A", map: T.plaster, normalMap: T.plasterN, normalScale: v2(0.2), roughness: 0.32, envMapIntensity: 1.1 }),
    skirting: new THREE.MeshStandardMaterial({ color: "#1C1A19", roughness: 0.42, normalMap: T.micro, normalScale: v2(0.15) }),
    floor: new THREE.MeshPhysicalMaterial({ map: T.floor, normalMap: T.floorN, normalScale: v2(0.55), roughnessMap: T.floorR, roughness: 1, clearcoat: 0.3, clearcoatRoughness: 0.24, envMapIntensity: 1 }),
    desk: new THREE.MeshPhysicalMaterial({ map: T.desk, normalMap: T.deskN, normalScale: v2(0.45), roughnessMap: T.deskR, roughness: 1, clearcoat: 0.18, clearcoatRoughness: 0.38, envMapIntensity: 0.45 }),
    deskLeg: new THREE.MeshStandardMaterial({ color: "#17181B", roughness: 0.48, metalness: 0.55, normalMap: T.micro, normalScale: v2(0.25) }),
    crateWood: new THREE.MeshStandardMaterial({ map: T.crate, normalMap: T.crateN, normalScale: v2(0.8), roughnessMap: T.crateR, roughness: 1 }),
    crateDark: new THREE.MeshStandardMaterial({ color: "#8A7666", map: T.crate, normalMap: T.crateN, roughnessMap: T.crateR, roughness: 1 }),
    batten: new THREE.MeshStandardMaterial({ map: T.batten, normalMap: T.battenN, roughness: 0.8 }),
    beige: new THREE.MeshStandardMaterial({ color: "#CDBFA6", roughness: 0.52, normalMap: T.micro, normalScale: v2(0.12) }),
    beigeDark: new THREE.MeshStandardMaterial({ color: "#8F8370", roughness: 0.62, normalMap: T.micro, normalScale: v2(0.12) }),
    black: new THREE.MeshStandardMaterial({ color: "#121318", roughness: 0.42, metalness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: "#2A2C31", roughness: 0.32, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: "#B88A45", roughness: 0.28, metalness: 0.95 }),
    alu: new THREE.MeshStandardMaterial({ color: "#3A3732", roughness: 0.36, metalness: 0.85, envMapIntensity: 1.2 }),
    paper: new THREE.MeshStandardMaterial({ color: C.paper, roughness: 0.9 }),
    gear: new THREE.MeshPhysicalMaterial({ color: "#E8E0CB", roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.2 }),
    mug: new THREE.MeshPhysicalMaterial({ color: "#E9E4DA", roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
    leather: new THREE.MeshStandardMaterial({ map: T.leather, normalMap: T.leatherN, normalScale: v2(0.6), roughnessMap: T.leatherR, roughness: 1 }),
    // window / screen glass: only the reflection of the room (env map), added on top, so the
    // view behind is never dimmed and the invisible helper lights leave no highlights in it
    glass: new THREE.MeshBasicMaterial({ color: 0x000000, combine: THREE.AddOperation, reflectivity: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  };

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight("#2C3756", "#1A120C", 0.8);
  scene.add(hemi);
  // warm bounce: lamp light scattered off the desk onto the wall and floor around it (no shadows)
  const bounce = new THREE.PointLight("#FFAE6B", 3, 7, 2);
  bounce.position.set(0.35, 1.05, -1.0);
  scene.add(bounce);

  const LAMP_CD = 20;
  const lampLight = new THREE.SpotLight("#FFC27A", LAMP_CD, 0, 0.82, 0.65, 2);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  lampLight.shadow.bias = -0.00025;
  lampLight.shadow.normalBias = 0.012;
  lampLight.shadow.camera.near = 0.12;
  lampLight.shadow.camera.far = 6;
  scene.add(lampLight, lampLight.target);

  const fill = new THREE.SpotLight("#FFB066", 9, 0, 0.9, 0.9, 2);
  fill.position.set(0.4, 2.6, 2.8);
  fill.target.position.set(0, 0.2, 0.5);
  scene.add(fill, fill.target);

  const glow = new THREE.PointLight("#FF9A3D", 1.2, 4, 2);
  scene.add(glow);

  /* ---------------- room ---------------- */
  const WALL_Z = -1.85, WIN = { x0: -2.7, x1: 2.7, y0: 1.0, y1: 3.4 };
  const WALL_T = 0.3, ROOM_X = 4.8, GLASS_Z = WALL_Z - 0.2;

  // oak plank floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 1;
  floor.receiveShadow = true;
  [T.floor, T.floorN, T.floorR].forEach((t) => t.repeat.set(30 / FLOOR_TILE, 14 / FLOOR_TILE));
  scene.add(floor);

  // wool rug under the desk, with a little thickness
  const RUG_T = 0.012;
  const rug = new THREE.Mesh(
    new RoundedBoxGeometry(4.6, RUG_T, 2.8, 2, 0.005),
    new THREE.MeshPhysicalMaterial({ map: T.rug, normalMap: T.rugN, normalScale: v2(0.7), roughness: 0.96, sheen: 0.6, sheenRoughness: 0.75, sheenColor: new THREE.Color("#5A4636"), envMapIntensity: 0.4 })
  );
  rug.position.set(0.1, RUG_T / 2, 0.15);
  rug.receiveShadow = true;
  scene.add(rug);

  // back wall with a deep window opening, side walls, skirting
  function wallBox(x0, x1, y0, y1, z0, z1, mat = M.wall) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const m = new THREE.Mesh(worldUV(geo, 1.6), mat);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  const WZ0 = WALL_Z - WALL_T;
  wallBox(-ROOM_X, WIN.x0, 0, 6, WZ0, WALL_Z); wallBox(WIN.x1, ROOM_X, 0, 6, WZ0, WALL_Z);
  wallBox(WIN.x0, WIN.x1, 0, WIN.y0, WZ0, WALL_Z); wallBox(WIN.x0, WIN.x1, WIN.y1, 6, WZ0, WALL_Z);
  wallBox(-ROOM_X - 0.2, -ROOM_X, 0, 6, WZ0, 8); wallBox(ROOM_X, ROOM_X + 0.2, 0, 6, WZ0, 8);
  {
    const sk = [];
    const skirt = (w, x, z, ry) => { const g = new RoundedBoxGeometry(w, 0.1, 0.018, 2, 0.004); g.rotateY(ry); g.translate(x, 0.05, z); sk.push(g); };
    skirt(ROOM_X * 2, 0, WALL_Z + 0.009, 0);
    skirt(10, -ROOM_X + 0.009, WALL_Z + 5, Math.PI / 2);
    skirt(10, ROOM_X - 0.009, WALL_Z + 5, Math.PI / 2);
    const m = new THREE.Mesh(mergeGeometries(sk), M.skirting);
    m.receiveShadow = true;
    scene.add(m);
  }

  const aoHidden = [];          // see-through bits the AO pass should ignore
  let winGlassMat = null;
  // window: stone sill, dark-bronze aluminium frame with mullions, transom and glazing beads, glass
  {
    const sill = new THREE.Mesh(new RoundedBoxGeometry(WIN.x1 - WIN.x0 + 0.14, 0.035, WALL_Z - GLASS_Z + 0.06, 3, 0.01), M.stone);
    sill.position.set(0, WIN.y0 - 0.0175 + 0.004, (GLASS_Z + WALL_Z + 0.06) / 2);
    sill.receiveShadow = true;
    scene.add(sill);

    const parts = [];
    const bar = (w, h, d, x, y, z) => { const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.12); g.translate(x, y, z); parts.push(g); };
    const FW = 0.07, Y0 = WIN.y0 + 0.004, XM = [-0.9, 0.9], YT = 2.3;
    bar(WIN.x1 - WIN.x0, FW, 0.11, 0, WIN.y1 - FW / 2, GLASS_Z);                  // head
    bar(WIN.x1 - WIN.x0, FW, 0.11, 0, Y0 + FW / 2, GLASS_Z);                       // bottom rail
    bar(FW, WIN.y1 - Y0, 0.11, WIN.x0 + FW / 2, (Y0 + WIN.y1) / 2, GLASS_Z);       // jambs
    bar(FW, WIN.y1 - Y0, 0.11, WIN.x1 - FW / 2, (Y0 + WIN.y1) / 2, GLASS_Z);
    XM.forEach((x) => bar(0.06, WIN.y1 - Y0 - 2 * FW, 0.14, x, (Y0 + WIN.y1) / 2, GLASS_Z + 0.012));   // mullions
    bar(WIN.x1 - WIN.x0 - 2 * FW, 0.05, 0.12, 0, YT, GLASS_Z + 0.006);                                  // transom
    // glazing beads around each pane, room side
    const cols = [[WIN.x0 + FW, XM[0] - 0.03], [XM[0] + 0.03, XM[1] - 0.03], [XM[1] + 0.03, WIN.x1 - FW]];
    const rowsY = [[Y0 + FW, YT - 0.025], [YT + 0.025, WIN.y1 - FW]];
    const B = 0.016, BZ = GLASS_Z + 0.02;
    cols.forEach(([a, b]) => rowsY.forEach(([c, e]) => {
      bar(b - a, B, 0.02, (a + b) / 2, c + B / 2, BZ); bar(b - a, B, 0.02, (a + b) / 2, e - B / 2, BZ);
      bar(B, e - c - 2 * B, 0.02, a + B / 2, (c + e) / 2, BZ); bar(B, e - c - 2 * B, 0.02, b - B / 2, (c + e) / 2, BZ);
    }));
    const frameMesh = new THREE.Mesh(mergeGeometries(parts), M.alu);
    frameMesh.castShadow = frameMesh.receiveShadow = true;
    scene.add(frameMesh);

    // A planar window can't get positionally correct reflections from an env map, so the faint
    // ghost of the lit desk and the lamp (as seen from the camera's home position) is painted on.
    winGlassMat = M.glass.clone();
    winGlassMat.color.set(0xffffff);
    winGlassMat.map = canvasTex(512, 228, (g, w, h) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
      const P = (x, y) => [((x - WIN.x0) / (WIN.x1 - WIN.x0)) * w, (1 - (y - WIN.y0) / (WIN.y1 - WIN.y0)) * h];
      const blob = (x, y, rx, ry, col) => {
        const [cx, cy] = P(x, y);
        g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
        const r = (rx / (WIN.x1 - WIN.x0)) * w, gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
      };
      blob(0.3, 1.25, 1.6, 0.45, "rgba(120,72,34,1)");    // the warm desk area
      blob(0.62, 1.5, 0.16, 0.16, "rgba(255,190,110,1)"); // the lamp
      blob(0.62, 1.5, 0.05, 0.05, "rgba(255,230,190,1)");
    });
    winGlassMat.color.setScalar(0.12);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), winGlassMat);
    glass.position.set(0, (WIN.y0 + WIN.y1) / 2, GLASS_Z - 0.004);
    glass.renderOrder = 2;
    scene.add(glass);
    aoHidden.push(glass);
  }

  // cool dusk light coming in through the window (soft, no shadows)
  let winLight = null;
  if (RectAreaLightUniformsLib) {
    winLight = new THREE.RectAreaLight("#A4A8D8", 1.1, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
    winLight.position.set(0, (WIN.y0 + WIN.y1) / 2, GLASS_Z - 0.01);
    winLight.lookAt(0, (WIN.y0 + WIN.y1) / 2, 5);
    scene.add(winLight);
  } else {
    const moon = new THREE.DirectionalLight("#8C86C8", 0.8);
    moon.position.set(-2.5, 4, -6);
    scene.add(moon);
  }


  /* ---------------- NYC skyline at dusk, outside the window ----------------
     Procedural Manhattan in the style of the classic three.js procedural city:
     every building is a box written straight into one merged geometry, faces
     sample a generated window texture, bases are darkened (fake street-level AO)
     and distance haze comes from scene fog. Two facade draw calls in total. */
  let skylineBeacon = null;
  function buildCity() {
    const LOW = mobile;
    const GROUND = -30;
    const FAR = 330;                                   // where the city meets the sky
    const ANG = 0.16;                                  // island axis, rotated a little to the right
    const FX = Math.sin(ANG), FZ = -Math.cos(ANG);     // "downtown" direction
    const RX = Math.cos(ANG), RZ = Math.sin(ANG);      // across the island
    const OX = 0, OZ = -12;
    const W = (u, d) => [OX + RX * u + FX * d, OZ + RZ * u + FZ * d];
    const inView = (x, z, pad = 18) => Math.abs(x) < 0.43 * Math.abs(z - 6) + pad;

    /* ---- value noise for clouds ---- */
    const perm = new Float32Array(256 * 256);
    for (let i = 0; i < perm.length; i++) perm[i] = rnd();
    const at = (x, y) => perm[((y & 255) << 8) + (x & 255)];
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const fbm = (x, y) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += a * noise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };

    /* ---- dusk sky with clouds and a band of far-off lights ---- */
    const skyTex = canvasTex(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#0E1029"); gr.addColorStop(0.3, "#1D2050"); gr.addColorStop(0.58, "#3B3D78");
      gr.addColorStop(0.78, "#6A64A0"); gr.addColorStop(0.9, "#9A8CBA"); gr.addColorStop(0.965, "#C2A9C4"); gr.addColorStop(1, "#D9B7B9");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const cw = 320, ch = 160, off = document.createElement("canvas");
      off.width = cw; off.height = ch;
      const og = off.getContext("2d"), img = og.createImageData(cw, ch);
      for (let y = 0; y < ch; y++) {
        const t = y / ch;                                  // 0 top .. 1 horizon
        const band = Math.max(0, Math.sin(Math.min(1, t / 0.85) * Math.PI)) * (t < 0.92 ? 1 : 0.3);
        for (let x = 0; x < cw; x++) {
          const n = fbm(x * 0.022 + 7, y * 0.085 + 3) + 0.25 * fbm(x * 0.09, y * 0.3);
          const a = Math.max(0, Math.min(1, (n - 0.54) / 0.24)) * band;
          const lit = 0.35 + 0.65 * t;                     // undersides lit by the city glow
          const k = (y * cw + x) * 4;
          const shade = 0.55 + 0.45 * Math.min(1, Math.max(0, (n - 0.5) * 2.2));
          img.data[k] = (52 + 130 * lit) * shade; img.data[k + 1] = (48 + 96 * lit) * shade; img.data[k + 2] = (98 + 110 * lit) * shade;
          img.data[k + 3] = a * 235;
        }
      }
      og.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(off, 0, 0, w, h * 0.93);
      // far horizon: low skyline silhouettes + specks of light (New Jersey / Brooklyn)
      for (let x = 0; x < w; x += 2 + rnd() * 4) {
        const bh = 2 + rnd() * rnd() * 14;
        g.fillStyle = "rgba(36,30,62,0.9)"; g.fillRect(x, h - bh - 2, 3 + rnd() * 6, bh + 2);
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rnd() < 0.7 ? "rgba(255,210,150,.9)" : "rgba(220,230,255,.9)";
        g.fillRect(rnd() * w, h - 2 - rnd() * rnd() * 14, 1, 1);
      }
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(760, 120), new THREE.MeshBasicMaterial({ map: skyTex, fog: false, toneMapped: false }));
    sky.position.set(30, GROUND - 6 + 60, -FAR - 30);
    scene.add(sky);
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 120; i++) sp.push((rnd() - 0.5) * 700, 40 + rnd() * 30, -FAR - 25);
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: "#D8DEFF", size: 0.6, fog: false, transparent: true, opacity: 0.6 })));

    /* ---- facade textures: 64 x 128 windows per tile ---- */
    function facadeTex(office) {
      return canvasTex(512, 1024, (g, w, h) => {
        g.fillStyle = office ? "#0A0D16" : "#0C0D12"; g.fillRect(0, 0, w, h);
        for (let r = 0; r < 128; r++) {
          const floorLit = office ? (rnd() < 0.38 ? 0.66 : 0.07) : 0.24 + rnd() * 0.14;
          const warm = rnd() < (office ? 0.45 : 0.85);
          let run = 0, runLit = false;
          for (let c = 0; c < 64; c++) {
            if (run-- <= 0) { run = office ? 2 + (rnd() * 8) | 0 : 0; runLit = rnd() < floorLit; }
            const lit = office ? runLit : rnd() < floorLit;
            const k = rnd();
            if (lit) {
              g.fillStyle = office
                ? (warm ? (k < 0.6 ? "#FFE2AE" : "#FFF3DA") : (k < 0.6 ? "#CFE0FF" : "#F2F6FF"))
                : (k < 0.72 ? "#FFBE6E" : k < 0.94 ? "#FFE0A6" : "#A9C6FF");
              g.globalAlpha = 0.5 + rnd() * 0.5;
            } else {
              g.fillStyle = office ? (k < 0.5 ? "#1B2540" : "#141B2E") : "#161A25";
              g.globalAlpha = 0.55 + rnd() * 0.45;
            }
            if (office) g.fillRect(c * 8, r * 8 + 1, 7, 5);
            else g.fillRect(c * 8 + 2, r * 8 + 2, 4, 5);
          }
        }
        g.globalAlpha = 1;
      }, { repeat: true });
    }

    const cityMat = (map) => {
      const m = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
        fog: true,
        vertexShader: `
          attribute vec3 aTint;
          varying vec2 vUv; varying vec3 vTint;
          #include <fog_pars_vertex>
          void main() {
            vUv = uv; vTint = aTint;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform sampler2D map;
          varying vec2 vUv; varying vec3 vTint;
          #include <fog_pars_fragment>
          void main() {
            gl_FragColor = vec4(texture2D(map, vUv).rgb * vTint, 1.0);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      });
      m.uniforms.map.value = map;
      return m;
    };

    /* ---- merged box writer ---- */
    const FLOOR = 0.42;                                  // world units per storey
    const mk = () => ({ pos: [], uv: [], tint: [], idx: [] });
    const B = [mk(), mk()];                              // 0 = office glass, 1 = masonry / residential
    function box(kind, cx, cz, w, d, y0, h, rot, bright, tintRGB) {
      const b = B[kind];
      const c = Math.cos(rot), s = Math.sin(rot);
      const P = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
      const y1 = y0 + h, ou = rnd(), ov = rnd();
      const t = tintRGB || [1, 1, 1];
      const top = [t[0] * bright, t[1] * bright, t[2] * bright];
      const lowK = y0 <= GROUND + 0.01 ? 0.16 : 0.8;
      const bot = [top[0] * lowK, top[1] * lowK, top[2] * lowK * 1.15];
      const vv0 = ov + (y0 - GROUND) / (FLOOR * 128), vv1 = ov + (y1 - GROUND) / (FLOOR * 128);
      const lens = [w, d, w, d];
      let u = ou;
      for (let i = 0; i < 4; i++) {
        const a = P[i], e = P[(i + 1) % 4], base = b.pos.length / 3;
        const u1 = u + lens[i] / (FLOOR * 64);
        b.pos.push(a[0], y0, a[1], e[0], y0, e[1], e[0], y1, e[1], a[0], y1, a[1]);
        b.uv.push(u, vv0, u1, vv0, u1, vv1, u, vv1);
        b.tint.push(...bot, ...bot, ...top, ...top);
        b.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
        u = u1;
      }
      const base = b.pos.length / 3, rf = [0.09, 0.095, 0.12];
      for (const p of P) { b.pos.push(p[0], y1, p[1]); b.uv.push(0.0008, 0.0008); b.tint.push(...rf); }
      b.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }

    /* ---- Manhattan: avenues along the island, short cross-street blocks ---- */
    const AV = 11, ST = 3.7, D0 = 26;
    const halfW = (d) => 52 - Math.max(0, d - 220) * 0.28;          // island narrows toward downtown
    const centre = (d) => Math.sin(d * 0.012) * 4;
    const district = (u, d) => Math.max(
      Math.exp(-((d - 200) ** 2) / (2 * 48 ** 2)) * Math.exp(-((u + 6) ** 2) / (2 * 30 ** 2)),         // midtown
      1.05 * Math.exp(-((d - 312) ** 2) / (2 * 14 ** 2)) * Math.exp(-((u - 4) ** 2) / (2 * 20 ** 2)) // downtown
    );
    const lights = [];                                   // street lights
    const crowns = [], redLights = [];
    const skip = LOW ? 2 : 1;
    let row = 0;
    for (let d = D0; d < FAR - 6; d += ST, row++) {
      const hw = halfW(d), cu = centre(d);
      for (let u = cu - hw; u < cu + hw - 2; u += AV) {
        const [bx, bz] = W(u + AV / 2, d + ST / 2);
        if (!inView(bx, bz)) continue;
        const parts = 1 + ((rnd() * 3) | 0);
        const pw = (AV - 1.7) / parts;
        for (let k = 0; k < parts; k++) {
          if (LOW && (k + row) % skip) continue;
          const uu = u + 0.85 + pw * (k + 0.5);
          const [x, z] = W(uu, d + ST / 2);
          const dist = district(uu, d);
          let h = 1.8 + rnd() * 2.8 + Math.pow(rnd(), 2.4) * (3 + 15 * dist);
          if (dist > 0.35 && rnd() < 0.16) h += 4 + rnd() * 6 * dist;
          const office = h > 9 || rnd() < 0.25;
          const bright = rnd() < 0.3 ? 0.3 + rnd() * 0.3 : 0.6 + rnd() * 0.7;
          const warmTint = office ? [0.95, 0.98, 1.08] : [1.05, 0.96, 0.88];
          const bw = pw * (0.78 + rnd() * 0.2), bd = (ST - 0.9) * (0.75 + rnd() * 0.25);
          box(office ? 0 : 1, x, z, bw, bd, GROUND, h, ANG, bright, warmTint);
          let topY = GROUND + h, topW = bw;
          // setbacks on taller towers
          if (h > 12 && rnd() < 0.55) { const sh = 1 + rnd() * 3 * dist; box(office ? 0 : 1, x, z, bw * 0.7, bd * 0.75, topY, sh, ANG, bright, warmTint); topY += sh; topW *= 0.7; }
          // lit crowns and aircraft lights on the tall ones
          if (h > 11 && rnd() < 0.42) crowns.push([x, topY, z, topW * (0.45 + rnd() * 0.35), 0.25 + rnd() * 0.5]);
          if (h > 13) redLights.push(x, topY + 0.35, z);
        }
      }
      // cross-street lights (every other street)
      if (row % 2 === 0) for (let u = cu - hw; u < cu + hw; u += 1.3) {
        const [x, z] = W(u, d); if (inView(x, z, 6)) lights.push(x, GROUND + 0.25, z);
      }
    }
    // avenue lights, running away down the island
    for (let u0 = -60; u0 <= 60; u0 += AV) for (let d = D0; d < FAR; d += 1.2) {
      const u = u0 + centre(d);
      if (Math.abs(u - centre(d)) > halfW(d)) continue;
      const [x, z] = W(u, d); if (inView(x, z, 6)) lights.push(x, GROUND + 0.25, z);
    }

    /* ---- the boroughs across the rivers: low-rise, mostly lights ---- */
    const RIVER_L = 26, RIVER_R = 34;
    for (let d = 40; d < FAR + 10; d += LOW ? 7 : 4.5) {
      for (const side of [-1, 1]) {
        const edge = side < 0 ? centre(d) - halfW(d) - RIVER_L : centre(d) + halfW(d) + RIVER_R;
        for (let k = 0; k < 26; k++) {
          const u = edge + side * (2 + k * 5 + rnd() * 3);
          const [x, z] = W(u, d);
          if (!inView(x, z, 30)) continue;
          box(rnd() < 0.2 ? 0 : 1, x, z, 2 + rnd() * 3, 2 + rnd() * 2.5, GROUND, 1 + rnd() * 3.5 + (rnd() < 0.04 ? 6 + rnd() * 8 : 0), ANG, 0.5 + rnd() * 0.6);
          if (rnd() < 0.6) lights.push(x + rnd() * 2, GROUND + 0.2, z + rnd() * 2);
        }
      }
    }

    /* ---- landmark-style towers (generic shapes, lit crowns) ---- */
    const glow = [];                                     // crown/spire meshes
    const crownMat = new THREE.MeshBasicMaterial({ color: "#FFE7B5", fog: true, toneMapped: false });
    const spireMat = new THREE.MeshBasicMaterial({ color: "#DCE6FF", fog: true, toneMapped: false });
    function crown(x, y, z, w, h, mat) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      m.position.set(x, y + h / 2, z); m.rotation.y = -ANG; scene.add(m); glow.push(m);
    }
    function spire(x, y, z, h, r, mat) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r, h, 6), mat);
      m.position.set(x, y + h / 2, z); scene.add(m); return m;
    }
    {   // stepped art-deco tower, midtown
      const [x, z] = W(-9, 196);
      let y = GROUND;
      [[6, 4.6, 10.5], [4.8, 3.6, 5.5], [3.6, 2.8, 2.8], [2.6, 2.2, 1.4]].forEach(([w, d, h]) => { box(1, x, z, w, d, y, h, ANG, 1.25, [1.05, 0.98, 0.9]); y += h; });
      crown(x, y, z, 2.2, 1.2, crownMat); y += 1.2;
      crown(x, y, z, 1.5, 0.9, crownMat); y += 0.9;
      spire(x, y, z, 3.4, 0.2, spireMat);
    }
    {   // spiky-crowned deco tower
      const [x, z] = W(-24, 186);
      box(0, x, z, 3.8, 3.2, GROUND, 16, ANG, 1.1);
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(1.9 - i * 0.42, 1.3, 4), crownMat); m.position.set(x, GROUND + 16 + 0.6 + i * 0.9, z); m.rotation.y = Math.PI / 4 - ANG; scene.add(m); }
      spire(x, GROUND + 19.4, z, 2.4, 0.12, spireMat);
    }
    {   // pencil towers
      [[-2, 172, 1.8, 21], [11, 206, 2.2, 18], [-17, 214, 2, 17]].forEach(([u, d, w, h]) => {
        const [x, z] = W(u, d); box(0, x, z, w, w, GROUND, h, ANG, 1.15); crown(x, GROUND + h, z, w * 0.8, 0.35, spireMat);
      });
    }
    {   // tapered supertall with a lit spire, downtown
      const [x, z] = W(5, 312);
      const H = 21;
      const geo = new THREE.CylinderGeometry(2.2, 4.4, H, 4, 1, true);
      geo.rotateY(Math.PI / 4 - ANG);
      const uvA = geo.attributes.uv, n = uvA.count, tint = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        uvA.setXY(i, uvA.getX(i) * (4 * 4.4) / (FLOOR * 64), uvA.getY(i) * H / (FLOOR * 128));
        const top = uvA.getY(i) > 0.01 ? 1.25 : 0.25;
        tint[i * 3] = 0.9 * top; tint[i * 3 + 1] = 0.98 * top; tint[i * 3 + 2] = 1.12 * top;
      }
      geo.setAttribute("aTint", new THREE.BufferAttribute(tint, 3));
      geo.translate(x, GROUND + H / 2, z);
      tower = { geo };
      crown(x, GROUND + H, z, 3.0, 0.5, spireMat);
      spire(x, GROUND + H + 0.5, z, 5.5, 0.16, spireMat);
      skylineBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: "#FF4D4D", fog: false, toneMapped: false }));
      skylineBeacon.position.set(x, GROUND + H + 6.1, z);
      scene.add(skylineBeacon);
    }

    /* ---- build the two facade meshes ---- */
    const texOffice = facadeTex(true), texRes = facadeTex(false);
    [texOffice, texRes].forEach((t) => { t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; });
    B.forEach((b, i) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute("aTint", new THREE.Float32BufferAttribute(b.tint, 3));
      geo.setIndex(b.idx);
      const mesh = new THREE.Mesh(geo, cityMat(i === 0 ? texOffice : texRes));
      mesh.frustumCulled = false;
      scene.add(mesh);
    });
    if (tower) scene.add(new THREE.Mesh(tower.geo, cityMat(texOffice)));

    /* ---- lit crowns (one instanced draw) + red aircraft lights ---- */
    if (crowns.length) {
      const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ fog: true, toneMapped: false }), crowns.length);
      const o = new THREE.Object3D(), col = new THREE.Color();
      const palette = ["#FFE9C2", "#FFF6E6", "#CFE0FF", "#FFD089", "#9CC3FF"];
      crowns.forEach(([x, y, z, w, h], i) => {
        o.position.set(x, y + h / 2, z); o.rotation.set(0, -ANG, 0); o.scale.set(w, h, w); o.updateMatrix();
        cm.setMatrixAt(i, o.matrix); cm.setColorAt(i, col.set(palette[(rnd() * palette.length) | 0]));
      });
      scene.add(cm);
    }
    {
      const rg = new THREE.BufferGeometry();
      rg.setAttribute("position", new THREE.Float32BufferAttribute(redLights, 3));
      scene.add(new THREE.Points(rg, new THREE.PointsMaterial({ color: "#FF3B30", size: 0.5, sizeAttenuation: true, fog: true, toneMapped: false })));
    }

    /* ---- ground, rivers and street lights ---- */
    const land = new THREE.Mesh(new THREE.PlaneGeometry(900, 520), new THREE.MeshBasicMaterial({ color: "#07080D", fog: true }));
    land.rotation.x = -Math.PI / 2; land.position.set(0, GROUND - 0.02, -FAR / 2); scene.add(land);
    const waterTex = canvasTex(256, 1024, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#3B3863"); gr.addColorStop(0.5, "#141A31"); gr.addColorStop(1, "#090C18");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        const y = rnd() * h, x = rnd() * w, len = 2 + rnd() * 14;
        g.fillStyle = rnd() < 0.6 ? `rgba(255,200,130,${0.25 + rnd() * 0.5})` : `rgba(190,200,255,${0.2 + rnd() * 0.4})`;
        g.fillRect(x, y, 1 + rnd(), len);
      }
    });
    const waterMat = new THREE.MeshBasicMaterial({ map: waterTex, fog: true, toneMapped: false });
    function river(sideSign, width) {
      const pts = [];
      for (let d = 0; d <= FAR + 40; d += 10) {
        const e = sideSign < 0 ? centre(d) - halfW(d) - 0.5 : centre(d) + halfW(d) + 0.5;
        pts.push(W(e, d), W(e + sideSign * width, d));
      }
      const pos = [], uv = [], idx = [];
      pts.forEach(([x, z], i) => { pos.push(x, GROUND + 0.01, z); uv.push(i % 2, Math.floor(i / 2) / (pts.length / 2)); });
      for (let i = 0; i < pts.length - 2; i += 2) sideSign < 0 ? idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2) : idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, waterMat); m.material.side = THREE.DoubleSide; scene.add(m);
    }
    river(-1, RIVER_L); river(1, RIVER_R);
    { // the harbour past the island's tip
      const hb = new THREE.Mesh(new THREE.PlaneGeometry(700, 80), waterMat);
      hb.rotation.x = -Math.PI / 2; hb.position.set(30, GROUND + 0.005, -FAR - 8); scene.add(hb);
    }
    const dot = canvasTex(32, 32, (g) => {
      const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lights, 3));
    scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: "#FFB45E", size: 0.9, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, toneMapped: false })));
  }
  var tower;

  /* ---------------- photo view (preferred) ----------------
     One textured plane far behind the window. Sized so the photo's width covers
     the whole window; its height is placed per layout in resize(). */
  let skyPlane = null;
  const skyBoost = { value: 0 };
  const SKY = { dist: 60, wDeg: 48 };
  function buildPhotoView(img) {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.needsUpdate = true;
    const w = 2 * SKY.dist * Math.tan(THREE.MathUtils.degToRad(SKY.wDeg / 2));
    const h = w * (img.height / img.width);
    const mat = new THREE.MeshBasicMaterial({ map: t, fog: false, toneMapped: false, color: "#D9D6E0" });
    // With bloom on, the brightest pixels of the photo (windows, street lights, spires) are pushed
    // above white so they - and only they - pick up a soft glow.
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBoost = skyBoost;
      sh.fragmentShader = "uniform float uBoost;\n" + sh.fragmentShader.replace("#include <map_fragment>",
        "#include <map_fragment>\n  float skyL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\n  diffuseColor.rgb *= 1.0 + uBoost * smoothstep(0.66, 0.8, skyL);");
    };
    skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    skyPlane.userData.h = h;
    skyPlane.position.set(0, 0, 5.1 - SKY.dist);
    scene.add(skyPlane);
  }
  if (skyPhoto) { buildPhotoView(skyPhoto); camera.far = 140; } else buildCity();
  camera.updateProjectionMatrix();

  /* ---------------- desk ---------------- */
  const DESK_Y = 0.76, DESK_Z = -0.62, DESK_W = 2.7, DESK_D = 1.08;
  const TOP = DESK_Y + 0.025;
  // solid walnut slab: 55 mm thick, softly radiused edges; the top surface stays at TOP
  const DESK_T = 0.055, UNDER = TOP - DESK_T;
  const deskTop = new THREE.Mesh(new RoundedBoxGeometry(DESK_W, DESK_T, DESK_D, 4, 0.011), M.desk);
  deskTop.position.set(0.05, TOP - DESK_T / 2, DESK_Z);
  deskTop.castShadow = deskTop.receiveShadow = true;
  scene.add(deskTop);
  // matte black steel sled frame: a closed rectangle each side, back stretcher, cable tray, glides
  {
    const parts = [];
    const tube = (w, h, d, x, y, z) => { const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.2); g.translate(x, y, z); parts.push(g); };
    const LX = DESK_W / 2 - 0.13, LZ = DESK_D / 2 - 0.07, S = 0.05, FOOT = 0.012;
    for (const sx of [-1, 1]) {
      const x = 0.05 + sx * LX;
      for (const sz of [-1, 1]) tube(S, UNDER - FOOT - 0.04, S, x, FOOT + 0.04 + (UNDER - FOOT - 0.04) / 2, DESK_Z + sz * LZ);   // posts
      tube(S, 0.04, LZ * 2 + S, x, FOOT + 0.02, DESK_Z);                    // foot rail
      tube(S, 0.035, LZ * 2 + S, x, UNDER - 0.0175, DESK_Z);                // top rail under the slab
      for (const sz of [-1, 1]) { const g = new THREE.CylinderGeometry(0.016, 0.018, FOOT, 16); g.translate(x, FOOT / 2, DESK_Z + sz * (LZ + 0.005)); parts.push(g); }
    }
    tube(LX * 2 - S, 0.05, 0.025, 0.05, UNDER - 0.025, DESK_Z - LZ);       // back stretcher
    // cable tray: shallow U channel hung under the back edge
    tube(1.3, 0.004, 0.11, 0.05, UNDER - 0.085, DESK_Z - LZ + 0.08);
    tube(1.3, 0.07, 0.004, 0.05, UNDER - 0.05, DESK_Z - LZ + 0.135);
    const frameMesh = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), M.deskLeg);
    frameMesh.castShadow = frameMesh.receiveShadow = true;
    scene.add(frameMesh);
  }
  // leather desk pad under the keyboard
  const PAD_T = 0.004;
  {
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.92, PAD_T, 0.38, 1, 0.0015), M.leather);
    pad.position.set(-0.34, TOP + PAD_T / 2, DESK_Z + 0.28);
    pad.rotation.y = 0.04;
    pad.receiveShadow = true; pad.castShadow = true;
    scene.add(pad);
  }
  // soft contact shadows (ambient-occlusion blobs) where things meet the desk / rug.
  // One merged mesh; with the AO pass on they are faint, without it they carry the grounding.
  const blobTex = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(0,0,0,.9)"); r.addColorStop(0.45, "rgba(0,0,0,.5)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  function blobGeo(list) {
    return mergeGeometries(list.map(([x, y, z, w, d, ry]) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.rotateY(ry || 0); g.translate(x, y, z); return g; }));
  }
  {
    const y = TOP + 0.0006;
    const blobs = new THREE.Mesh(blobGeo([
      [-0.32, y, DESK_Z - 0.2, 0.62, 0.56, 0.1],              // CRT
      [-0.28, y + PAD_T, DESK_Z + 0.27, 0.62, 0.26, 0.06],    // keyboard
      [0.62, y, DESK_Z - 0.3, 0.36, 0.22, -0.38],             // photo frame
      [-1.0, y, DESK_Z - 0.18, 0.46, 0.26, 0.32],             // role cards box
      [0.25, y, DESK_Z + 0.2, 0.24, 0.24, 0],                 // gear stand
      [0.86, y, DESK_Z + 0.22, 0.13, 0.22, -0.5],             // phone
      [-0.98, y, DESK_Z + 0.27, 0.27, 0.19, 0.18],            // envelope
      [0.98, y, DESK_Z - 0.05, 0.13, 0.13, 0],                // mug
      [1.16, y, DESK_Z - 0.3, 0.26, 0.26, 0],                 // lamp base
    ]), blobMat);
    blobs.renderOrder = 1;
    scene.add(blobs);
    aoHidden.push(blobs);
    // under the desk feet / frame, on the rug
    const fy = RUG_T + 0.0008;
    const legBlobs = new THREE.Mesh(blobGeo([-1, 1].map((sx) => [0.05 + sx * (DESK_W / 2 - 0.13), fy, DESK_Z, 0.22, DESK_D + 0.08, 0])), blobMat);
    legBlobs.renderOrder = 1;
    scene.add(legBlobs);
    aoHidden.push(legBlobs);
  }

  // LED ticker under the front edge of the desk
  const tickerTex = canvasTex(2048, 64, (g, w, h) => {
    g.fillStyle = "#050607"; g.fillRect(0, 0, w, h);
    g.font = `500 30px ${MONO}`; g.textBaseline = "middle";
    let x = 20;
    const items = S.ticker.concat(S.ticker);
    for (const [name, v] of items) {
      g.fillStyle = "#F5B041"; g.fillText(name, x, h / 2 + 1); x += g.measureText(name).width + 14;
      g.fillStyle = "#3DDC97"; g.fillText("▲ " + v, x, h / 2 + 1); x += g.measureText("▲ " + v).width + 44;
      if (x > w - 200) break;
    }
    // LED dot mask
    g.fillStyle = "rgba(0,0,0,.35)";
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
    for (let xx = 0; xx < w; xx += 4) g.fillRect(xx, 0, 1, h);
  }, { repeat: true });
  tickerTex.repeat.set(0.55, 1);
  const ticker = new THREE.Mesh(
    new THREE.BoxGeometry(DESK_W - 0.2, 0.075, 0.012),
    [M.black, M.black, M.black, M.black, new THREE.MeshBasicMaterial({ map: tickerTex, toneMapped: false }), M.black]
  );
  ticker.position.set(0.05, DESK_Y - 0.07, DESK_Z + DESK_D / 2 - 0.02);
  // (LED ticker under the desk removed)

  /* ---------------- interactive objects registry ---------------- */
  const hotspots = []; // { group, label, action, lift, base }
  function hot(group, label, action) {
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const entry = { group, label, action, lift: 0, baseY: group.position.y };
    group.userData.hot = entry;
    hotspots.push(entry);
    scene.add(group);
    return entry;
  }

  /* Desk objects that open a book (crate). Books come from assets/maintenance, so the
     crate is found by its "icon" (tools / engineering / apps), falling back to an id match.
     If no book uses that icon the object is still drawn, just not clickable. */
  function crateByIcon(icon) {
    const list = S.crates || [];
    return list.find((c) => String(c.icon || "").toLowerCase() === icon) || list.find((c) => c.id === icon) || null;
  }
  function hotCrate(group, icon, fallbackLabel) {
    const c = crateByIcon(icon);
    if (!c) {
      group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(group);
      return null;
    }
    return hot(group, c.title || fallbackLabel, () => DESK.openCrate(c.id, null, screenRect(group)));
  }

  /* ---- CRT terminal ---- */
  const crtTex = canvasTex(640, 480, () => {});
  const candles = [];
  { let v = 0.5; for (let i = 0; i < 40; i++) { const o = v; v = Math.min(0.85, Math.max(0.15, v + (rnd() - 0.47) * 0.12)); candles.push([o, v]); } }
  function drawCRT(t) {
    if (window.RETRO && typeof window.RETRO.drawScreen === "function") {
      window.RETRO.drawScreen(crtTex.userData.ctx, 640, 480, t);
      crtTex.needsUpdate = true;
      return;
    }
    const g = crtTex.userData.ctx, w = 640, h = 480;
    const bg = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h / 2, w * 0.7);
    bg.addColorStop(0, "#10261C"); bg.addColorStop(1, "#040907");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // header
    g.fillStyle = "rgba(61,220,151,.75)"; g.font = `500 20px ${MONO}`; g.textBaseline = "top";
    g.fillText("ATUL.F", 34, 28);
    g.fillStyle = "#3DDC97"; g.fillText("▲ LIVE", w - 120, 28);
    g.fillStyle = "#ECE7DD"; g.font = `700 64px ${FONT}`;
    g.fillText("WHY HIRE", 34, 70);
    g.fillStyle = "#F5B041"; g.fillText("Atul?", 34, 136);
    // chart
    const cx = 34, cy = 236, cw = w - 68, ch = 160, n = candles.length, step = cw / n;
    g.strokeStyle = "rgba(61,220,151,.12)"; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(cx, cy + (ch / 4) * i); g.lineTo(cx + cw, cy + (ch / 4) * i); g.stroke(); }
    const shift = reduce ? 0 : (t * 0.6) % 1;
    for (let i = 0; i < n; i++) {
      const [o, c] = candles[i], up = c >= o, x = cx + (i - shift) * step + step / 2;
      if (x < cx || x > cx + cw) continue;
      const yo = cy + ch * (1 - o), yc = cy + ch * (1 - c);
      g.strokeStyle = g.fillStyle = up ? "#3DDC97" : "#FF6B6B";
      g.beginPath(); g.moveTo(x, Math.min(yo, yc) - 7); g.lineTo(x, Math.max(yo, yc) + 7); g.stroke();
      g.fillRect(x - step * 0.3, Math.min(yo, yc), step * 0.6, Math.max(2, Math.abs(yc - yo)));
    }
    // prompt
    g.font = `500 22px ${MONO}`; g.fillStyle = "#F5B041";
    const blink = reduce || Math.floor(t * 2) % 2 === 0;
    g.fillText("> PRESS TO OPEN" + (blink ? " _" : ""), 34, h - 52);
    // scanlines + vignette
    g.fillStyle = "rgba(0,0,0,.22)";
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    crtTex.needsUpdate = true;
  }
  drawCRT(0);
  let crtTick = 0;
  function stepCandles() {
    candles.shift();
    const last = candles[candles.length - 1][1];
    candles.push([last, Math.min(0.85, Math.max(0.15, last + (Math.random() - 0.46) * 0.12))]);
  }

  const crt = new THREE.Group();
  const crtScreenMat = new THREE.MeshBasicMaterial({ map: crtTex, toneMapped: false });
  let crtGlass;
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.5, 0.5, 4, 0.05), M.beige);
    body.position.y = 0.33;
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.38, 0.22, 3, 0.04), M.beige);
    back.position.set(0, 0.32, -0.3);
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.42, 0.02, 3, 0.012), M.beigeDark);
    bezel.position.set(0, 0.35, 0.252);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.345), crtScreenMat);
    screen.position.set(0, 0.355, 0.265);
    crtGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.345), M.glass);   // reflections on the tube face
    crtGlass.position.set(0, 0.355, 0.2665);
    crtGlass.renderOrder = 2;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 32), M.beigeDark);
    stand.position.y = 0.04;
    const knob1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), M.black);
    knob1.rotation.x = Math.PI / 2; knob1.position.set(0.22, 0.13, 0.255);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.007, 12), new THREE.MeshBasicMaterial({ color: C.up }));
    led.position.set(0.17, 0.13, 0.252);
    crt.add(body, back, bezel, screen, crtGlass, stand, knob1, led);
    crt.position.set(-0.32, TOP, DESK_Z - 0.2);
    crt.rotation.y = 0.1;
  }
  hot(crt, "Why hire Atul?", () => DESK.openPanel("why"));
  crtGlass.castShadow = crtGlass.receiveShadow = false;
  aoHidden.push(crtGlass);
  glow.position.set(-0.3, TOP + 0.36, DESK_Z + 0.2);
  glow.color.set("#3DDC97"); glow.intensity = 0.1;

  /* ---- keyboard ---- */
  const kb = new THREE.Group();
  {
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.025, 0.17, 2, 0.008), M.beige);
    base.position.y = 0.0125;
    kb.add(base);
    const keyGeo = new RoundedBoxGeometry(0.026, 0.014, 0.026, 1, 0.004);
    const keys = new THREE.InstancedMesh(keyGeo, M.beigeDark, 15 * 5);
    const d = new THREE.Object3D(); let k = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) {
      d.position.set(-0.217 + c * 0.031, 0.031, -0.062 + r * 0.031); d.updateMatrix(); keys.setMatrixAt(k++, d.matrix);
    }
    kb.add(keys);
    kb.position.set(-0.28, TOP + PAD_T, DESK_Z + 0.27);   // resting on the leather pad
    kb.rotation.y = 0.06;
  }
  hotCrate(kb, "tools", "Tools & AI");

  /* ---- photo frame ---- */
  const frame = new THREE.Group();
  const photoMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  let frameGlass;
  {
    const PW = 0.24, PH = 0.32;
    const border = new THREE.Mesh(new RoundedBoxGeometry(PW + 0.04, PH + 0.04, 0.025, 2, 0.006), new THREE.MeshPhysicalMaterial({ color: "#2A1C12", roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.25 }));
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), photoMat);
    photo.position.z = 0.0135;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.012), new THREE.MeshStandardMaterial({ color: "#2A1C12" }));
    strut.position.set(0, -0.03, -0.07); strut.rotation.x = -0.45;
    frameGlass = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), M.glass);
    frameGlass.position.z = 0.0145; frameGlass.renderOrder = 2;
    const inner = new THREE.Group();
    inner.add(border, photo, strut, frameGlass);
    inner.position.y = (PH + 0.04) / 2;
    inner.rotation.x = -0.1;
    frame.add(inner);
    frame.position.set(0.62, TOP, DESK_Z - 0.28);
    frame.rotation.y = -0.38;
    // monogram placeholder until/unless the photo loads
    photoMat.map = canvasTex(360, 480, (g, w, h) => {
      g.fillStyle = "#1E1A16"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#F5B041"; g.font = `700 150px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("AA", w / 2, h / 2 - 20);
      g.fillStyle = "#B3AC9F"; g.font = `500 22px ${MONO}`; g.fillText("ATUL ABRAHAM", w / 2, h / 2 + 90);
    });
    loadImage(S.photo).then((im) => {
      if (!im) return;
      const t = canvasTex(480, 640, (g, w, h) => {
        // cover-crop to 3:4, keep the face near the top third
        const ar = im.width / im.height, tar = w / h;
        let sw = im.width, sh = im.height, sx = 0, sy = 0;
        if (ar > tar) { sw = im.height * tar; sx = (im.width - sw) / 2; } else { sh = im.width / tar; sy = (im.height - sh) * 0.2; }
        g.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
      });
      photoMat.map = t; photoMat.needsUpdate = true;
    });
  }
  hot(frame, "About me", () => DESK.openPanel("about"));
  frameGlass.castShadow = frameGlass.receiveShadow = false;
  aoHidden.push(frameGlass);

  /* ---- role cards holder: an open-top card box, cards standing inside it ---- */
  const roles = new THREE.Group();
  {
    const BW = 0.36, BD = 0.16, BH = 0.099, T = 0.012;            // box width / depth / wall height / wall thickness
    const shell = new THREE.MeshStandardMaterial({ color: "#1E1F24", roughness: 0.4, metalness: 0.55 });
    const inside = new THREE.MeshStandardMaterial({ color: "#0C0C0F", roughness: 0.9 });
    const wall = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), m || shell); b.position.set(x, y, z); roles.add(b); };
    wall(BW, BH, T, 0, BH / 2, BD / 2 - T / 2);                     // front lip (hides the card bottoms)
    wall(BW, BH + 0.01, T, 0, (BH + 0.01) / 2, -BD / 2 + T / 2);    // back
    wall(T, BH, BD, -BW / 2 + T / 2, BH / 2, 0);                    // sides
    wall(T, BH, BD, BW / 2 - T / 2, BH / 2, 0);
    wall(BW, 0.01, BD, 0, 0.005, 0);                                // floor
    const well = new THREE.Mesh(new THREE.PlaneGeometry(BW - 2 * T, BD - 2 * T), inside);  // dark interior seen from above
    well.rotation.x = -Math.PI / 2; well.position.y = 0.011; roles.add(well);
    const n = S.roles.length, CH = 0.112, STEP = 0.024;
    S.roles.forEach((r, i) => {
      const tex = canvasTex(512, 248, (g, w, h) => {
        g.fillStyle = "#F1ECE1"; roundRect(g, 0, 0, w, h, 12); g.fill();
        g.fillStyle = "rgba(22,19,14,.08)"; g.fillRect(0, 0, w, 3);
        g.fillStyle = C.ink; g.font = `650 42px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(r, w / 2, 33);
      });
      const card = new THREE.Mesh(new THREE.BoxGeometry(BW - 2 * T - 0.012, CH, 0.003),
        [M.paper, M.paper, M.paper, M.paper, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), M.paper]);
      const lift = (n - 1 - i) * STEP;                              // back cards stand taller
      card.position.set(0, 0.012 + CH / 2 + lift, -BD / 2 + T + 0.018 + i * ((BD - 2 * T - 0.03) / (n - 1)));
      card.rotation.x = -0.1;
      card.castShadow = true;
      roles.add(card);
    });
    roles.position.set(-1.0, TOP, DESK_Z - 0.18);
    roles.rotation.y = 0.32;
  }
  hot(roles, "About me", () => DESK.openPanel("about"));

  /* ---- polymer spur gear on a stand ---- */
  function gearGeometry(teeth = 22, rTip = 0.115, rRoot = 0.095, depth = 0.026) {
    const shape = new THREE.Shape();
    const seg = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * seg;
      const pts = [
        [rRoot, a], [rRoot, a + seg * 0.18], [rTip, a + seg * 0.32], [rTip, a + seg * 0.58], [rRoot, a + seg * 0.72],
      ];
      pts.forEach(([r, ang], j) => {
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
        if (i === 0 && j === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      });
    }
    shape.closePath();
    const bore = new THREE.Path(); bore.absarc(0, 0, 0.022, 0, Math.PI * 2, true); shape.holes.push(bore);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2, h = new THREE.Path();
      h.absarc(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.016, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2, curveSegments: 20 });
    geo.center();
    return geo;
  }
  const gearGroup = new THREE.Group();
  const gear = new THREE.Mesh(gearGeometry(), M.gear);
  {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.025, 32), M.metal);
    base.position.y = 0.0125;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 12), M.brass);
    post.position.y = 0.09;
    gear.position.y = 0.155;
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16), M.brass);
    axle.rotation.x = Math.PI / 2; axle.position.y = 0.155;
    gearGroup.add(base, post, gear, axle);
    gearGroup.position.set(0.25, TOP, DESK_Z + 0.2);
    gearGroup.rotation.y = -0.25;
  }
  hotCrate(gearGroup, "engineering", "Engineering");

  /* ---- phone with app icons ---- */
  const phoneScreen = canvasTex(300, 620, () => {});
  function drawPhone(icons) {
    const g = phoneScreen.userData.ctx, w = 300, h = 620;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1A1F2E"); bg.addColorStop(1, "#0A0C10");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = "#ECE7DD"; g.font = `600 56px ${FONT}`; g.textAlign = "center"; g.fillText("Apps", w / 2, 112);
    g.font = `500 15px ${MONO}`; g.fillStyle = "#8C8679"; g.fillText("BY ATUL", w / 2, 140);
    const apps = [
      ["Productivity+", "#2563EB", "P+", "productivity-plus"], ["Bible+", "#7A4E2D", "B+", "bible-plus"],
      ["Reminders+", "#06D6A0", "R+", "reminders-plus"], ["Transit", "#F5B041", "WT", null],
      ["Roulette", "#B3261E", "GR", null], ["Trade", "#16A34A", "TP", null],
    ];
    apps.forEach(([name, col, ab, key], i) => {
      const x = 40 + (i % 3) * 82, y = 190 + Math.floor(i / 3) * 120, s = 62;
      g.save(); roundRect(g, x, y, s, s, 16); g.clip();
      if (key && icons && icons[key]) g.drawImage(icons[key], x, y, s, s);
      else { g.fillStyle = col; g.fillRect(x, y, s, s); g.fillStyle = "#fff"; g.font = `700 24px ${FONT}`; g.textAlign = "center"; g.fillText(ab, x + s / 2, y + s / 2 + 8); }
      g.restore();
      g.fillStyle = "#B3AC9F"; g.font = `500 13px ${FONT}`; g.textAlign = "center"; g.fillText(name, x + s / 2, y + s + 22);
    });
    g.fillStyle = "rgba(255,255,255,.5)"; roundRect(g, w / 2 - 50, h - 22, 100, 6, 3); g.fill();
    phoneScreen.needsUpdate = true;
  }
  drawPhone(null);
  Promise.all(["productivity-plus", "bible-plus", "reminders-plus"].map((k) => loadImage(`assets/icons/${k}.png`))).then((ims) => {
    if (ims.some(Boolean)) drawPhone({ "productivity-plus": ims[0], "bible-plus": ims[1], "reminders-plus": ims[2] });
  });
  const phone = new THREE.Group();
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.009, 0.175, 3, 0.004), M.black);
    body.position.y = 0.0045;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.077, 0.164), new THREE.MeshBasicMaterial({ map: phoneScreen, toneMapped: false }));
    scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0095;
    phone.add(body, scr);
    phone.position.set(0.86, TOP, DESK_Z + 0.22);
    phone.rotation.y = -0.5;
  }
  hotCrate(phone, "apps", "Mobile Apps");

  /* ---- envelope ---- */
  const envelope = new THREE.Group();
  {
    const top = canvasTex(440, 280, (g, w, h) => {
      g.fillStyle = "#EDE4D2"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(22,19,14,.12)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * 0.55); g.lineTo(w, 0); g.stroke();
      // stamp
      g.fillStyle = "#F5B041"; g.fillRect(w - 92, 20, 70, 84);
      g.strokeStyle = "#1A1206"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(w - 84, 88); g.lineTo(w - 66, 62); g.lineTo(w - 52, 74); g.lineTo(w - 32, 40); g.stroke();
      g.fillStyle = C.ink; g.font = `600 30px ${FONT}`; g.textAlign = "left";
      g.fillText("Leave a message", 30, h - 74);
      g.fillStyle = "#5A5347"; g.font = `500 19px ${MONO}`;
      g.fillText("ATUL ABRAHAM · HOBOKEN", 30, h - 40);
    });
    const env = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.006, 0.14), [M.paper, M.paper, new THREE.MeshStandardMaterial({ map: top, roughness: 0.9 }), M.paper, M.paper, M.paper]);
    env.position.y = 0.003;
    envelope.add(env);
    envelope.position.set(-0.98, TOP, DESK_Z + 0.27);
    envelope.rotation.y = 0.18;
  }
  hot(envelope, "Leave a message", () => DESK.openPanel("contact"));

  /* ---- mug (decor) ---- */
  {
    const mug = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 32, 1, true), M.mug);
    cup.position.y = 0.05;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), M.mug); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.002;
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.039, 24), new THREE.MeshStandardMaterial({ color: "#2A160A", roughness: 0.2 }));
    coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.085;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 10, 20, Math.PI), M.mug);
    handle.rotation.z = -Math.PI / 2; handle.position.set(0.042, 0.05, 0);
    mug.add(cup, bottom, coffee, handle);
    mug.position.set(0.98, TOP, DESK_Z - 0.05);
    mug.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(mug);
  }

  /* ---- desk lamp (click to toggle) ---- */
  function rod(a, b, r, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 12), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  }
  const lamp = new THREE.Group();
  const bulbMat = new THREE.MeshBasicMaterial({ color: "#FFE2B0" });
  const shadeInMat = new THREE.MeshBasicMaterial({ color: "#FFB866", side: THREE.BackSide });
  const lampHead = [];
  const LAMP_BASE = new THREE.Vector3(1.16, TOP, DESK_Z - 0.3);
  const L0 = new THREE.Vector3(0, 0.03, 0), J1 = new THREE.Vector3(-0.02, 0.46, -0.04), J2 = new THREE.Vector3(-0.3, 0.66, 0.12);
  const SH = new THREE.Vector3(-0.4, 0.6, 0.18);
  const lampAim = new THREE.Vector3(0.0, TOP, DESK_Z + 0.08);
  const lampDir = new THREE.Vector3().subVectors(lampAim, SH.clone().add(LAMP_BASE)).normalize();
  {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.03, 40), M.black);
    base.position.y = 0.015;
    const shadeMat = new THREE.MeshStandardMaterial({ color: "#1A1B20", roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.17, 40, 1, true), shadeMat);
    shade.position.copy(SH);
    shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lampDir);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), M.black);
    cap.position.copy(SH).addScaledVector(lampDir, -0.08);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 16), bulbMat);
    bulb.position.copy(SH).addScaledVector(lampDir, 0.03);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.098, 40), new THREE.MeshBasicMaterial({ color: "#FFD08A", side: THREE.DoubleSide, transparent: true, opacity: 0.35 }));
    inner.position.copy(SH).addScaledVector(lampDir, 0.085);
    inner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), lampDir);
    const j1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), M.brass); j1.position.copy(J1);
    const j2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), M.brass); j2.position.copy(J2);
    // warm inside of the shade, lit by the bulb
    const shadeIn = new THREE.Mesh(new THREE.ConeGeometry(0.097, 0.165, 40, 1, true), shadeInMat);
    shadeIn.position.copy(shade.position); shadeIn.quaternion.copy(shade.quaternion);
    lamp.add(base, rod(L0, J1, 0.01, M.black), rod(J1, J2, 0.009, M.black), rod(J2, cap.position, 0.008, M.black), j1, j2, cap, shade, shadeIn, bulb, inner);
    lamp.position.copy(LAMP_BASE);
    lampHead.push(cap, shade, shadeIn, bulb, inner);
  }
  const lampEntry = hot(lamp, "Lamp - click to switch", () => setLamp(!lampOn));
  lampHead.forEach((m) => { m.castShadow = false; });
  aoHidden.push(lampHead[4]);
  lampEntry.noLift = true;
  const lampWorld = SH.clone().add(LAMP_BASE).addScaledVector(lampDir, 0.04);
  lampLight.position.copy(lampWorld);
  lampLight.target.position.copy(lampAim);
  let lampOn = true, lampLevel = 1;
  function setLamp(on) { lampOn = on; }

  /* ---- crates on the floor ---- */
  const crateGroups = [];
  const CRATE = { w: 0.6, h: 0.36, d: 0.44, t: 0.022 };
  // corner posts, shared by every crate
  const battenGeo = (() => {
    const { w, h, d } = CRATE, bt = 0.034, o = 0.008;
    return mergeGeometries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
      const g = new RoundedBoxGeometry(bt, h - 0.004, bt, 2, 0.005);
      g.translate(sx * (w / 2 - bt / 2 + o), h / 2, sz * (d / 2 - bt / 2 + o));
      return g;
    }));
  })();
  const crateBlobGeo = blobGeo([[0, RUG_T + 0.0008, 0, CRATE.w + 0.2, CRATE.d + 0.2, 0]]);
  // Front board with a paper label stapled on the middle plank (640 x 384 = the 0.6 x 0.36 m face)
  function crateFront(c) {
    const LW = 640, LH = 384, cv = mkCanvas(LW, LH), cx = cv.getContext("2d");
    cx.drawImage(TX.crate.map, 0, 0);
    cx.font = `650 50px ${FONT}`;
    const tw = Math.min(520, cx.measureText(c.title).width);
    const pw = Math.min(580, tw + 60), ph = 136, px = (LW - pw) / 2, py = 192 - ph / 2;
    cx.save();
    cx.translate(LW / 2, 192); cx.rotate(-0.012); cx.translate(-LW / 2, -192);
    cx.fillStyle = "rgba(20,10,4,.35)"; roundRect(cx, px + 3, py + 5, pw, ph, 4); cx.fill();
    const pg = cx.createLinearGradient(0, py, 0, py + ph);
    pg.addColorStop(0, "#EFE6D2"); pg.addColorStop(1, "#E2D6BD");
    cx.fillStyle = pg; roundRect(cx, px, py, pw, ph, 4); cx.fill();
    for (let k = 0; k < 900; k++) { cx.fillStyle = `rgba(90,70,40,${trnd() * 0.05})`; cx.fillRect(px + trnd() * pw, py + trnd() * ph, 1.5, 1.5); }
    cx.fillStyle = "#231C14"; cx.textAlign = "center"; cx.textBaseline = "middle";
    cx.fillText(c.title, LW / 2, py + 60, 520);
    cx.fillStyle = c.color; cx.fillRect(LW / 2 - 34, py + 100, 68, 6);
    cx.fillStyle = "#9A968E";                                   // staples
    cx.fillRect(px + 14, py + 10, 22, 3); cx.fillRect(px + pw - 36, py + 10, 22, 3);
    cx.restore();
    // the paper sits flat over the plank grain in the normal map too
    const H = Float32Array.from(TX.crate.H);
    for (let y = Math.floor(py); y < py + ph; y++) for (let x = Math.floor(px); x < px + pw; x++) {
      const e = Math.min(x - px, px + pw - x, y - py, py + ph - y);
      H[y * LW + x] = e < 2 ? 0.66 + 0.02 * e : 0.7;
    }
    return new THREE.MeshStandardMaterial({ map: tex(cv), normalMap: tex(normalCanvas(H, LW, LH, 2.4), { srgb: false }), normalScale: v2(0.8), roughnessMap: T.crateR, roughness: 1 });
  }
  S.crates.forEach((c, i) => {
    const g = new THREE.Group();
    const { w, h, d, t } = CRATE;
    const front = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), [M.crateWood, M.crateWood, M.crateWood, M.crateWood, crateFront(c), M.crateWood]);
    front.position.set(0, h / 2, d / 2 - t / 2);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), M.crateWood); back.position.set(0, h / 2, -d / 2 + t / 2);
    const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, d - t * 2), M.crateWood); left.position.set(-w / 2 + t / 2, h / 2, 0);
    const right = left.clone(); right.position.x = w / 2 - t / 2;
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), M.crateDark); bottom.position.y = t / 2;
    const posts = new THREE.Mesh(battenGeo, M.batten);
    const blob = new THREE.Mesh(crateBlobGeo, blobMat); blob.renderOrder = 1;
    blob.raycast = () => {};             // the shadow is not part of the hit area
    g.userData.blob = blob;
    g.add(front, back, left, right, bottom, posts, blob);
    // paper slips (one per project)
    const ps = S.projects.filter((p) => p.crate === c.id);
    ps.forEach((p, k) => {
      const tex = canvasTex(400, 260, (cx, W, H) => {
        cx.fillStyle = k % 2 ? "#EFE8DA" : "#F6F1E7"; cx.fillRect(0, 0, W, H);
        cx.fillStyle = c.color; cx.fillRect(0, 0, W, 10);
        cx.fillStyle = "#16130E"; cx.font = `700 34px ${FONT}`; cx.textAlign = "left"; cx.textBaseline = "top";
        cx.fillText(p.title, 22, 30);
        cx.fillStyle = "#5A5347"; cx.font = `500 20px ${MONO}`; cx.fillText(p.year, 22, 76);
      });
      const slipMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
      const slip = new THREE.Mesh(new THREE.BoxGeometry(w - 0.09, 0.3, 0.006), [M.paper, M.paper, M.paper, M.paper, slipMat, M.paper]);
      const z = d / 2 - 0.07 - k * ((d - 0.12) / Math.max(1, ps.length));
      slip.position.set((rnd() - 0.5) * 0.03, 0.17 + 0.05 + (k === ps.length - 1 ? 0.03 : rnd() * 0.04), z);
      slip.rotation.x = -0.12 - rnd() * 0.08; slip.rotation.z = (rnd() - 0.5) * 0.05;
      slip.userData.base = { y: slip.position.y, z: slip.position.z, rx: slip.rotation.x };
      (g.userData.slips = g.userData.slips || []).push(slip);
      g.add(slip);
      // real cover image if we can use it (served over http/https)
      loadImage(p.image).then((im) => {
        if (!im) return;
        const t2 = canvasTex(400, 260, (cx, W, H) => {
          cx.fillStyle = "#F6F1E7"; cx.fillRect(0, 0, W, H);
          cx.drawImage(im, 10, 10, W - 20, H - 20);
        });
        slipMat.map = t2; slipMat.needsUpdate = true;
      });
    });
    // Floor layout. Up to 4 crates: exactly the original row / 2x2 grid.
    // More than 4 (extra books in assets/maintenance): crates shrink so the row keeps
    // the same width, and the portrait grid grows to 3+ columns over 2 rows.
    const n = S.crates.length;
    if (n <= 4) {
      g.userData.rowPos = new THREE.Vector3(-1.38 + i * 0.92, 0, 0.62 + (i % 2 ? 0.08 : 0));
      g.userData.rowRot = (i - 1.5) * -0.06 + (rnd() - 0.5) * 0.06;
      g.userData.gridPos = new THREE.Vector3((i % 2 ? 0.44 : -0.4), 0, 0.42 + Math.floor(i / 2) * 0.95);
      g.userData.gridRot = (i % 2 ? -0.12 : 0.12);
      g.userData.rowScale = g.userData.gridScale = 1;
    } else {
      const rs = 4 / n, mid = (n - 1) / 2;
      g.userData.rowPos = new THREE.Vector3((i - mid) * 0.92 * rs, 0, 0.62 + (i % 2 ? 0.08 * rs : 0));
      g.userData.rowRot = (i - mid) * -0.06 * rs + (rnd() - 0.5) * 0.06;
      const cols = Math.ceil(n / 2), gs = 2 / cols, col = i % cols, row = Math.floor(i / cols);
      g.userData.gridPos = new THREE.Vector3(0.02 + (col - (cols - 1) / 2) * 0.84 * gs, 0, 0.42 + row * 0.95 * gs);
      g.userData.gridRot = 0.12 * (1 - (2 * col) / (cols - 1));
      g.userData.rowScale = rs;
      g.userData.gridScale = gs;
    }
    g.userData.rowPos.y = g.userData.gridPos.y = RUG_T - 0.004;   // settled into the rug pile
    g.scale.setScalar(g.userData.rowScale);
    g.position.copy(g.userData.rowPos);
    g.rotation.y = g.userData.rowRot;
    const entry = hot(g, `${c.title} · ${ps.length} project${ps.length === 1 ? "" : "s"}`, () => openFromCrate(entry, c.id));
    blob.castShadow = blob.receiveShadow = false;
    aoHidden.push(blob);
    entry.slipT = 0; entry.slipTarget = 0;
    crateGroups.push(entry);
  });

  /* ---- crate opening: slips flip up out of the crate, then the cards fly out ---- */
  function screenRect(obj) {
    const box = new THREE.Box3().setFromObject(obj), r = host.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const x = r.left + ((v.x + 1) / 2) * r.width, y = r.top + ((1 - v.y) / 2) * r.height;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }
  let crateBusy = false;
  function openFromCrate(entry, id) {
    if (crateBusy) return;
    if (reduce) return DESK.openCrate(id, null, screenRect(entry.group));
    crateBusy = true;
    entry.slipTarget = 1;
    setTimeout(() => { crateBusy = false; DESK.openCrate(id, null, screenRect(entry.group)); }, 430);
  }
  window.addEventListener("desk:crateclose", () => { crateGroups.forEach((e) => (e.slipTarget = 0)); });
  function animateSlips(dt) {
    for (const e of crateGroups) {
      if (Math.abs(e.slipTarget - e.slipT) < 0.001 && e.slipT === e.slipTarget) continue;
      e.slipT += (e.slipTarget - e.slipT) * Math.min(1, dt * (e.slipTarget ? 9 : 6));
      if (Math.abs(e.slipTarget - e.slipT) < 0.002) e.slipT = e.slipTarget;
      const t = e.slipT, slips = e.group.userData.slips || [], n = slips.length;
      slips.forEach((sl, k) => {
        const b = sl.userData.base, f = n - 1 - k;     // front slip lifts highest
        sl.position.y = b.y + t * (0.2 + f * 0.05);
        sl.position.z = b.z + t * (0.05 - f * 0.012);
        sl.rotation.x = b.rx + t * (0.55 - f * 0.12);
      });
    }
  }

  /* ---------------- reflections: this room, baked into a PMREM environment ----------------
     Instead of a generic studio, the reflection map holds the room itself: the dusk window
     with the skyline in it, the warm lamp and its pool of light on the desk, the CRT glow.
     Two versions (lamp on / off), so switching the lamp also changes the reflections. */
  const envWindowTex = (() => {
    if (skyPhoto) { const t = new THREE.Texture(skyPhoto); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }
    return canvasTex(64, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#1D2050"); gr.addColorStop(0.6, "#6A64A0"); gr.addColorStop(0.8, "#C2A9C4"); gr.addColorStop(1, "#2A2238");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  })();
  function buildEnv(lampIsOn) {
    const es = new THREE.Scene();
    const P = new THREE.Vector3(0.05, 1.15, -0.4);           // probe: just above the desk
    const basic = (color, opts) => new THREE.MeshBasicMaterial(Object.assign({ color }, opts || {}));
    const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x - P.x, y - P.y, z - P.z); es.add(m); return m; };
    put(new THREE.BoxGeometry(ROOM_X * 2, 4.2, 9.5), basic(new THREE.Color(0.0055, 0.005, 0.0048), { side: THREE.BackSide }), 0, 2.1, WALL_Z + 4.75);
    put(new THREE.PlaneGeometry(ROOM_X * 2, 9), basic(new THREE.Color(0.011, 0.0075, 0.0055)), 0, 0.003, WALL_Z + 4.5).rotation.x = -Math.PI / 2;
    const wy = (WIN.y0 + WIN.y1) / 2, wh = WIN.y1 - WIN.y0;
    put(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, wh), basic(new THREE.Color(0.45, 0.45, 0.5), { map: envWindowTex }), 0, wy, GLASS_Z);
    for (const x of [-0.9, 0.9]) put(new THREE.PlaneGeometry(0.06, wh), basic(0x050505), x, wy, GLASS_Z + 0.01);
    put(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, 0.05), basic(0x050505), 0, 2.3, GLASS_Z + 0.01);
    if (lampIsOn) {
      put(new THREE.SphereGeometry(0.05, 16, 12), basic(new THREE.Color(60, 38, 18)), lampWorld.x, lampWorld.y, lampWorld.z);
      put(new THREE.CircleGeometry(0.55, 32), basic(new THREE.Color(0.5, 0.28, 0.12)), lampAim.x, TOP + 0.002, lampAim.z).rotation.x = -Math.PI / 2;
      put(new THREE.CircleGeometry(1.2, 32), basic(new THREE.Color(0.06, 0.035, 0.018)), 0.8, 1.4, WALL_Z + 0.01);   // lamp spill on the wall
    }
    const rt = pmrem.fromScene(es, 0.02, 0.05, 30);
    es.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    return rt.texture;
  }
  /* fewer draw calls: boxes with a material per face (paper slips, labels, cards, envelope)
     get their index buffer regrouped so each distinct material is drawn once, not once per face.
     This matters three times over: main pass, AO normal pass and the lamp's shadow map. */
  function packGroups(mesh) {
    const geo = mesh.geometry, mats = mesh.material;
    if (!Array.isArray(mats) || !geo.index) return;
    const uniq = [...new Set(mats)];
    if (uniq.length === geo.groups.length) return;
    const idx = geo.index.array, out = [], groups = [];
    uniq.forEach((m, mi) => {
      const start = out.length;
      for (const gr of geo.groups) if (mats[gr.materialIndex] === m) for (let i = gr.start; i < gr.start + gr.count; i++) out.push(idx[i]);
      groups.push([start, out.length - start, mi]);
    });
    const g2 = geo.clone();
    g2.setIndex(out); g2.clearGroups();
    groups.forEach(([a, b, c]) => g2.addGroup(a, b, c));
    mesh.geometry = g2;
    mesh.material = uniq;
  }
  scene.traverse((o) => { if (o.isMesh) packGroups(o); });
  // paper slips stay inside their crates: the crate walls' shadows and the AO cover them
  crateGroups.forEach((e) => (e.group.userData.slips || []).forEach((sl) => { sl.castShadow = false; }));

  const envOn = buildEnv(true), envOff = buildEnv(false);
  scene.environment = M.glass.envMap = winGlassMat.envMap = envOn;

  /* ---------------- post-processing ----------------
     Render (HDR) -> GTAO (half res) -> bloom (only things brighter than white: bulb, shade,
     screen, brightest city lights) -> ACES + sRGB -> SMAA -> vignette + dither.
     Quality levels: 3 = all, 2 = no AO, 1 = SMAA only (lower pixel ratio), 0 = no composer.
     Unless ?fx= pins a level, the level steps down by itself if frames take too long. */
  let composer = null, gtaoPass = null, bloomPass = null;
  let fxLevel = useFX ? Math.max(1, Math.min(3, +FXQ || 3)) : 0;
  let autoFX = useFX && !FXQ;
  if (useFX) {
    try {
      composer = new PP.EffectComposer(renderer);
      composer.addPass(new PP.RenderPass(scene, camera));
      gtaoPass = new PP.GTAOPass(scene, camera, 256, 256);
      gtaoPass.updateGtaoMaterial({ radius: 0.3, distanceExponent: 1.6, thickness: 1, scale: 1.1, samples: 16 });
      gtaoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      gtaoPass.blendIntensity = 0.85;
      const gSet = gtaoPass.setSize.bind(gtaoPass);              // AO at half resolution
      gtaoPass.setSize = (w, h) => gSet(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
      const gRender = gtaoPass.render.bind(gtaoPass);            // glass / decals stay out of the AO
      gtaoPass.render = (a, b, c, d, e) => { for (const o of aoHidden) o.visible = false; gRender(a, b, c, d, e); for (const o of aoHidden) o.visible = true; };
      composer.addPass(gtaoPass);
      bloomPass = new PP.UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.45, 2.6);
      composer.addPass(bloomPass);
      composer.addPass(new PP.OutputPass());
      composer.addPass(new PP.SMAAPass(256, 256));
      composer.addPass(new PP.ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            float v = smoothstep(0.98, 0.38, length((vUv - 0.5) * vec2(1.0, 1.2)));
            c.rgb *= mix(0.8, 1.0, v);
            c.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
            gl_FragColor = c;
          }`,
      }));
    } catch (e) {
      console.warn("Post-processing setup failed, rendering directly", e);
      composer = null; fxLevel = 0; autoFX = false;
    }
  }
  const SKY_TINT = new THREE.Color("#D9D6E0"), SKY_TINT_FX = new THREE.Color("#D9D6E0").multiplyScalar(1.12);
  function applyFX(level) {
    fxLevel = level;
    if (gtaoPass) gtaoPass.enabled = level >= 3;
    if (bloomPass) bloomPass.enabled = level >= 2;
    blobMat.opacity = level >= 3 ? 0.45 : 0.8;
    crtScreenMat.color.setScalar(composer ? 1.1 : 1);
    if (skyPlane) skyPlane.material.color.copy(composer ? SKY_TINT_FX : SKY_TINT);
    skyBoost.value = level >= 2 ? 3 : 0;
    resize();
  }
  function draw(dt) {
    renderer.shadowMap.needsUpdate = true;      // once per frame (the AO pass re-renders the scene)
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
  }

  /* ---------------- layout / resize ---------------- */
  let W = 1, H = 1, portrait = false;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const pr = prFor(fxLevel);
    if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); }
    const aspect = W / H;
    portrait = aspect < 0.9;
    camera.aspect = aspect;
    // crates: one row on wide screens, a 2x2 stack on tall phones
    crateGroups.forEach(({ group }) => {
      group.position.copy(portrait ? group.userData.gridPos : group.userData.rowPos);
      group.rotation.y = portrait ? group.userData.gridRot : group.userData.rowRot;
      group.scale.setScalar((portrait ? group.userData.gridScale : group.userData.rowScale) || 1);
    });
    if (skyPlane) {
      // top edge of the photo: keeps the spires inside the window on each layout
      const topY = portrait ? 2.4 : aspect < 1.25 ? 6.6 : 8.15;
      skyPlane.position.y = topY - skyPlane.userData.h / 2;
    }
    if (portrait) {
      camera.fov = 50;
      camHome.set(0.05, 4.1, 6.2);
      lookHome.set(0.05, 0.35, 0.2);
      // push the scene down so the title sits on the night sky
      camera.setViewOffset(W, H, 0, -H * 0.2, W, H);
    } else {
      camera.fov = aspect < 1.25 ? 42 : 34;
      camHome.set(0, 2.2, aspect < 1.25 ? 5.9 : 5.1);
      lookHome.set(0.05, 0.78, -0.3);
      // shift the scene right so the hero copy has room on the left
      const shift = aspect > 1.3 ? -W * 0.11 : 0;
      camera.setViewOffset(W, H, shift, -H * 0.04, W, H);
    }
    camera.updateProjectionMatrix();
  }
  applyFX(fxLevel);           // also runs resize()
  window.addEventListener("resize", resize);

  /* ---------------- pointer / picking ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-9, -9);
  const parallax = new THREE.Vector2(0, 0);
  const parallaxSmooth = new THREE.Vector2(0, 0);
  let hovered = null, downAt = null;
  const canvas = renderer.domElement;
  const hotMeshes = () => hotspots.map((h) => h.group);

  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hotMeshes(), true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.hot) o = o.parent;
    return o ? o.userData.hot : null;
  }
  function setHover(h) {
    hovered = h;
    canvas.style.cursor = h ? "pointer" : "default";
    labelEl.classList.toggle("on", !!h);
    if (h) labelEl.textContent = h.label;
  }
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    parallax.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    if (e.pointerType === "mouse") setHover(pick(e.clientX, e.clientY));
  });
  canvas.addEventListener("pointerleave", () => { setHover(null); parallax.set(0, 0); });
  canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved > 10) return;
    const h = pick(e.clientX, e.clientY);
    if (h) {
      if (e.pointerType !== "mouse") { setHover(h); setTimeout(() => setHover(null), 900); }
      h.action();
    }
  });

  /* ---------------- render loop ---------------- */
  let visible = true, modalOpen = false, running = false, ready = false;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; kick(); }, { threshold: 0.01 }).observe(host);
  window.addEventListener("desk:modal", (e) => { modalOpen = e.detail; kick(); });
  document.addEventListener("visibilitychange", kick);

  const clock = new THREE.Clock();
  let introT = reduce ? 1 : 0;
  const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3(), labelPos = new THREE.Vector3(), labelBox = new THREE.Box3();
  // quality governor: if frames keep missing ~40 fps, drop one post-processing level (never back up)
  const perf = { skip: 60, n: 0, sum: 0 };
  function governor(dt) {
    if (!autoFX || fxLevel <= 1) return;
    if (perf.skip > 0) { perf.skip--; return; }
    perf.sum += dt;
    if (++perf.n < 90) return;
    const avg = perf.sum / perf.n;
    perf.n = 0; perf.sum = 0;
    if (avg > 1 / 40) {
      applyFX(fxLevel - 1);
      perf.skip = 30;
      if (DEBUG) console.log("[scene] slow frames (" + Math.round(avg * 1000) + " ms), quality level", fxLevel);
    }
  }
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function frame_() {
    if (!(visible && !modalOpen && !document.hidden)) { running = false; return; }
    requestAnimationFrame(frame_);
    const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05);
    if (DEBUG) renderer.info.reset();
    const t = clock.elapsedTime;

    // intro dolly
    if (introT < 1) introT = Math.min(1, introT + dt / 2.4);
    const k = easeOut(introT);
    tmpV.lerpVectors(camStart, camHome, k);
    // ease the pointer itself (frame-rate independent), so fast flicks glide instead of snapping
    if (!reduce) {
      const k = 1 - Math.exp(-dt * 2.2);
      parallaxSmooth.x += (THREE.MathUtils.clamp(parallax.x, -1, 1) - parallaxSmooth.x) * k;
      parallaxSmooth.y += (THREE.MathUtils.clamp(parallax.y, -1, 1) - parallaxSmooth.y) * k;
    }
    const px = parallaxSmooth.x, py = parallaxSmooth.y;
    tmpV.x += px * 0.26; tmpV.y += -py * 0.1;
    camera.position.copy(tmpV);
    tmpL.copy(lookHome); tmpL.x += px * 0.05;
    camera.lookAt(tmpL);

    // hover lift
    for (const h of hotspots) {
      const target = h === hovered && !h.noLift ? 1 : 0;
      h.lift += (target - h.lift) * Math.min(1, dt * 10);
      if (!h.noLift) h.group.position.y = h.baseY + h.lift * 0.035;
    }

    animateSlips(dt);

    // gear spin (polymer gear, slow)
    if (!reduce) gear.rotation.z -= dt * (hovered && hovered.group === gearGroup ? 1.6 : 0.45);

    // ticker scroll
    if (!reduce) tickerTex.offset.x = (tickerTex.offset.x + dt * 0.035) % 1;

    // CRT at ~12 fps, new candle every ~1.6 s
    crtTick += dt;
    if (crtTick > 0.08) { crtTick = 0; drawCRT(t); }
    if (!reduce && Math.floor(t / 1.6) !== Math.floor((t - dt) / 1.6)) stepCandles();

    // lamp fade
    lampLevel += ((lampOn ? 1 : 0) - lampLevel) * Math.min(1, dt * 8);
    lampLight.intensity = LAMP_CD * lampLevel;
    fill.intensity = 3 + 6 * lampLevel;
    // with bloom the bulb and the inside of the shade go brighter than white so only they glow
    const L = lampLevel, hdr = composer ? 1 + 7 * L : 1;
    bulbMat.color.setRGB((0.25 + 0.75 * L) * hdr, (0.22 + 0.67 * L) * hdr, (0.18 + 0.51 * L) * hdr);
    const si = (0.03 + 0.97 * L) * (composer ? 2.8 : 1);
    shadeInMat.color.setRGB(si, 0.5 * si, 0.16 * si);
    const env = L > 0.5 ? envOn : envOff;
    if (scene.environment !== env) scene.environment = M.glass.envMap = winGlassMat.envMap = env;
    winGlassMat.color.setScalar(0.02 + 0.1 * L);

    if (skylineBeacon) skylineBeacon.visible = reduce || Math.floor(t * 1.2) % 2 === 0;

    // label follows hovered object
    if (hovered) {
      const box = labelBox.setFromObject(hovered.group);
      labelPos.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(camera);
      labelEl.style.left = ((labelPos.x + 1) / 2) * W + "px";
      labelEl.style.top = ((1 - labelPos.y) / 2) * H + "px";
    }

    draw(dt);
    governor(rawDt);
    frames++;
  }
  let frames = 0;
  if (DEBUG) renderer.info.autoReset = false;
  if (DEBUG) window.__deskDebug = () => ({ frames, fxLevel, lampOn, lampLevel: +lampLevel.toFixed(3), pr: renderer.getPixelRatio(), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs.length, meshes: (() => { let m = 0, g = 0, cast = 0; scene.traverse((o) => { if (o.isMesh && o.visible) { const n = Array.isArray(o.material) ? o.geometry.groups.length : 1; m++; g += n; if (o.castShadow) cast += n; } }); return { m, g, cast }; })() });
  function kick() {
    if (running || SNAP || !ready) return;
    if (visible && !modalOpen && !document.hidden) {
      running = true; clock.getDelta();
      perf.n = 0; perf.sum = 0; perf.skip = Math.max(perf.skip, 20);
      requestAnimationFrame(frame_);
    }
  }

  // first frame, then reveal
  if (SNAP) return snapObject(SNAP);

  camera.position.copy(reduce ? camHome : camStart);
  camera.lookAt(lookHome);
  // compile every shader up front (in parallel where the browser can) so the intro doesn't hitch
  try {
    if (renderer.extensions.has("KHR_parallel_shader_compile")) await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 3000))]);
    else renderer.compile(scene, camera);
  } catch (_) {}
  draw(0);
  ready = true;
  kick();
  setTimeout(() => loader.classList.add("done"), 150);
  if (DEBUG) console.log("[scene] first frame after", Math.round(performance.now() - tStart), "ms, quality level", fxLevel);

  /* ---------------- render-only mode: one object on a transparent background ---------------- */
  function buildNameplate() {
    const g = new THREE.Group();
    const tex = canvasTex(720, 300, (c, w, h) => {
      c.fillStyle = "#F7F4EE"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#A32638"; c.fillRect(0, 0, w, 14);
      c.textAlign = "center"; c.fillStyle = "#16130E";
      c.font = `800 92px ${FONT}`; c.fillText("STEVENS", w / 2, 128);
      c.fillStyle = "#A32638"; c.fillRect(w / 2 - 150, 150, 300, 5);
      c.fillStyle = "#3A342C"; c.font = `600 30px ${FONT}`; c.fillText("INSTITUTE OF TECHNOLOGY", w / 2, 202);
      c.fillStyle = "#6A6256"; c.font = `500 24px ${MONO}`; c.fillText("MS COMPUTER SCIENCE · HOBOKEN", w / 2, 252);
    });
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.15, 0.006), [M.paper, M.paper, M.paper, M.paper, face, M.paper]);
    card.position.y = 0.09; card.rotation.x = -0.32;
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.03, 0.09, 2, 0.008), M.metal);
    base.position.y = 0.015;
    g.add(base, card);
    g.position.set(0.3, TOP, DESK_Z + 0.25);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    return g;
  }
  async function snapObject(name) {
    const targets = { crt, roles, frame, envelope, gear: gearGroup, phone, lamp };
    const target = name === "nameplate" ? buildNameplate() : targets[name];
    if (!target) { window.__snap = "unknown"; return; }
    if (name === "crt" && window.RETRO && RETRO.drawScreen) { RETRO.drawScreen(crtTex.userData.ctx, 640, 480, 1.0); crtTex.needsUpdate = true; } else drawCRT(0.2);
    scene.background = null; scene.fog = null;
    renderer.setClearColor(0x000000, 0);
    // product-shot lighting for the phone images: neutral studio reflections, not the night room
    try {
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      scene.environment = M.glass.envMap = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    } catch (_) {}
    hemi.intensity = 1.1; bounce.visible = false; glow.intensity = 0.5;
    if (winLight) winLight.visible = false;
    const key2 = new THREE.DirectionalLight("#8C86C8", 1.0);
    key2.position.set(-2.5, 4, -6);
    scene.add(key2);
    renderer.toneMappingExposure = 1.05;
    lampHead.slice(0, 3).forEach((m) => { m.castShadow = true; });   // the light is off the lamp here, so the head can cast
    // hide everything that is not a light or the target
    scene.children.forEach((o) => { if (!o.isLight && o !== target && o !== lampLight.target && o !== fill.target) o.visible = false; });
    target.visible = true;
    target.position.y = TOP;
    if (name === "envelope") { target.rotation.x = 0.55; target.position.y = TOP + 0.04; }
    // soft contact shadow under the object
    const box = new THREE.Box3().setFromObject(target), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.32 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.set(c.x, TOP + 0.001, c.z); catcher.receiveShadow = true;
    scene.add(catcher);
    // light it evenly from the front-top so every object reads well
    lampLight.position.set(c.x + 0.5, TOP + 1.4, c.z + 0.9); lampLight.target.position.copy(c); lampLight.intensity = 16;
    fill.position.set(c.x - 0.8, TOP + 0.9, c.z + 1.6); fill.target.position.copy(c); fill.intensity = 5;
    const S2 = 1100;
    renderer.setPixelRatio(1); renderer.setSize(S2, S2, false);
    camera.clearViewOffset(); camera.aspect = 1; camera.fov = 26; camera.updateProjectionMatrix();
    const dir = new THREE.Vector3(0.18, 0.42, 1).normalize();
    const r = Math.max(size.x, size.y, size.z) * 0.62;
    const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.copy(c).addScaledVector(dir, dist);
    camera.lookAt(c);
    loader.classList.add("done");
    await new Promise((res) => setTimeout(res, 2500)); // photo / covers load
    if (name === "crt" && window.RETRO && RETRO.drawScreen) { RETRO.drawScreen(crtTex.userData.ctx, 640, 480, 1.0); crtTex.needsUpdate = true; }
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    window.__snap = renderer.domElement.toDataURL("image/png");
  }
})();
