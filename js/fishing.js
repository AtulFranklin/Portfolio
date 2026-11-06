// ice fishing game engine
// registers in ATUL_GAMES, draws through FISHART
(function () {
  "use strict";

  var W = 800, H = 500;
  var KEY = "atulos-fishing-best";
  var MAX_WORMS = 30;
  var PTS = { tuna: 10, grouper: 30 };
  var SPEED = { tuna: [70, 105], grouper: [55, 80], swordfish: [300, 380] };
  var DRAG = { tuna: 1, grouper: 0.88 };
  var DEF_SIZE = {
    tuna: { w: 64, h: 30 }, grouper: { w: 104, h: 52 }, swordfish: { w: 150, h: 40 },
    shark: { w: 230, h: 84 }, eel: { w: 160, h: 24 }, jelly: { w: 56, h: 78 }, trash: { w: 44, h: 56 }
  };
  var DEF_MOUTH = { tuna: 30, grouper: 50, swordfish: 46 };
  var FONT = "\"VT323\", monospace";
  var INK = "#14202b";

  /* ---- helpers ---- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function num(v, d) { return typeof v === "number" && isFinite(v) ? v : d; }
  function art() { return window.FISHART || null; }
  function reducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; }
  }
  function loadBest() {
    try { return Math.max(0, parseInt(window.localStorage.getItem(KEY), 10) || 0); } catch (_) { return 0; }
  }
  function saveBest(v) {
    try { window.localStorage.setItem(KEY, String(v)); } catch (_) { /* private mode */ }
  }
  function segDist(x1, y1, x2, y2, px, py) {
    var dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
    var u = l ? clamp(((px - x1) * dx + (py - y1) * dy) / l, 0, 1) : 0;
    var qx = x1 + u * dx - px, qy = y1 + u * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }
  function inEll(px, py, cx, cy, a, b) {
    var dx = (px - cx) / a, dy = (py - cy) / b;
    return dx * dx + dy * dy <= 1;
  }
  function segHitsEll(x1, y1, x2, y2, cx, cy, a, b) {
    return segDist((x1 - cx) / a, (y1 - cy) / b, (x2 - cx) / a, (y2 - cy) / b, 0, 0) <= 1;
  }
  function geo() {
    var A = art() || {};
    var hole = A.HOLE || {}, tip = A.ROD_TIP || {}, size = {}, mouth = {}, k;
    for (k in DEF_SIZE) {
      var s = A.SIZE && A.SIZE[k];
      size[k] = { w: num(s && s.w, DEF_SIZE[k].w), h: num(s && s.h, DEF_SIZE[k].h) };
    }
    for (k in DEF_MOUTH) mouth[k] = num(A.MOUTH && A.MOUTH[k], DEF_MOUTH[k]);
    return {
      ice: num(A.ICE_Y, 150),
      hole: { x: num(hole.x, 520), y: num(hole.y, 150), rx: num(hole.rx, 36), ry: num(hole.ry, 9) },
      tip: { x: num(tip.x, 520), y: num(tip.y, 48) },
      size: size, mouth: mouth
    };
  }

  /* ---- fallback art ---- */
  var FB = {
    background: function (g) {
      var K = geo(), wg = g.createLinearGradient(0, K.ice, 0, H);
      g.fillStyle = "#dfe9f1"; g.fillRect(0, 0, W, K.ice);
      g.fillStyle = "#f4f8fb"; g.fillRect(0, K.ice - 32, W, 32);
      g.fillStyle = "#b9cfdd"; g.fillRect(0, K.ice - 6, W, 6);
      wg.addColorStop(0, "#6fb3d6"); wg.addColorStop(1, "#1f4e79");
      g.fillStyle = wg; g.fillRect(0, K.ice, W, H - K.ice);
      g.fillStyle = "#1f4e79";
      g.beginPath(); g.ellipse(K.hole.x, K.hole.y, K.hole.rx, K.hole.ry, 0, 0, Math.PI * 2); g.fill();
    },
    surface: function (g) {
      var K = geo();
      g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(0, K.ice, W, 2);
    },
    crate: function (g, n) {
      g.fillStyle = "#a0703c"; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.fillRect(70, 84, 140, 36); g.strokeRect(70, 84, 140, 36);
      g.fillStyle = "#f4f8fb"; g.font = "20px " + FONT; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(n + " FISH", 140, 103);
    },
    wormCan: function (g) {
      g.fillStyle = "#8b8f98"; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.fillRect(708, 96, 26, 24); g.strokeRect(708, 96, 26, 24);
    },
    boy: function (g, t, mood) {
      var bob = mood === "sad" ? 6 : Math.sin(t * 2) * 1.5, arm = mood === "cheer" ? -30 : 0;
      g.strokeStyle = INK; g.lineWidth = 2.5;
      g.fillStyle = "#7b7f88"; g.fillRect(590, 96, 40, 24); g.strokeRect(590, 96, 40, 24);
      g.fillStyle = "#b8382c"; g.fillRect(588, 56 + bob, 44, 42); g.strokeRect(588, 56 + bob, 44, 42);
      g.fillStyle = "#f2c9a0"; g.beginPath(); g.arc(610, 42 + bob, 15, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.arc(604, 42 + bob, 4, 0, Math.PI * 2); g.arc(616, 42 + bob, 4, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(592, 70 + bob); g.lineTo(560, 70 + bob + arm); g.lineTo(520, 48); g.stroke();
    },
    line: function (g, x1, y1, x2, y2, slack) {
      g.strokeStyle = "rgba(20,32,43,.8)"; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(x1, y1);
      g.quadraticCurveTo((x1 + x2) / 2 + (slack || 0) * 14, (y1 + y2) / 2, x2, y2); g.stroke();
    },
    hook: function (g, x, y, baited, t) {
      g.strokeStyle = "#5d616a"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x, y + 4); g.arc(x - 4, y + 4, 4, 0, Math.PI); g.stroke();
      if (baited) {
        g.strokeStyle = "#e07a8a"; g.lineWidth = 4; g.lineCap = "round";
        g.beginPath(); g.moveTo(x - 6, y + 2);
        g.quadraticCurveTo(x, y + 10 + Math.sin(t * 8) * 3, x + 6, y + 4); g.stroke();
      }
    },
    fish: function (g, kind, x, y, dir, t, hooked) {
      var K = geo(), s = K.size[kind] || DEF_SIZE.tuna;
      var col = { tuna: "#e8b93a", grouper: "#e0614a", swordfish: "#4a78a8" }[kind] || "#e8b93a";
      g.translate(x, y);
      if (hooked) { g.translate(0, K.mouth[kind] || 0); g.rotate(-Math.PI / 2 * dir); }
      g.scale(dir, 1);
      g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-s.w / 2 + 10, 0); g.lineTo(-s.w / 2 - 4, -s.h / 3); g.lineTo(-s.w / 2 - 4, s.h / 3); g.closePath();
      g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, s.w / 2 - 6, s.h / 2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(s.w / 2 - 16, -3, 2.5, 0, Math.PI * 2); g.fill();
    },
    hazard: function (g, kind, x, y, dir, t) {
      var s = geo().size[kind] || DEF_SIZE.trash;
      var col = { shark: "#8a96a3", eel: "#3d6b3a", jelly: "rgba(190,110,200,.8)", trash: "#9aa3ab" }[kind];
      g.translate(x, y); g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 2.5;
      if (kind === "trash") {
        g.rotate(Math.sin(t * 1.5) * 0.3 * dir);
        g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h); g.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
        return;
      }
      g.beginPath(); g.ellipse(0, 0, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    splash: function (g, x, y, p) {
      g.strokeStyle = "rgba(255,255,255," + (1 - p) + ")"; g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, y, 20 + p * 40, 6 + p * 10, 0, 0, Math.PI * 2); g.stroke();
    },
    zap: function (g, x, y, p) {
      var i, a;
      g.strokeStyle = "rgba(255,230,90," + (1 - p) + ")"; g.lineWidth = 3;
      for (i = 0; i < 8; i++) {
        a = i / 8 * Math.PI * 2;
        g.beginPath(); g.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
        g.lineTo(x + Math.cos(a) * (20 + p * 30), y + Math.sin(a) * (20 + p * 30)); g.stroke();
      }
    },
    snap: function (g, x, y, p) {
      g.strokeStyle = "rgba(20,32,43," + (1 - p) + ")"; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x - 10 - p * 14, y - 10 - p * 14); g.lineTo(x + 10 + p * 14, y + 10 + p * 14);
      g.moveTo(x + 10 + p * 14, y - 10 - p * 14); g.lineTo(x - 10 - p * 14, y + 10 + p * 14); g.stroke();
    },
    popText: function (g, text, x, y, p) {
      g.globalAlpha = 1 - p * p; g.fillStyle = INK; g.font = "30px " + FONT;
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, x, y - p * 34);
    },
    wormIcon: function (g, x, y, s) {
      g.strokeStyle = "#e07a8a"; g.lineWidth = 4 * (s || 1); g.lineCap = "round";
      g.beginPath(); g.moveTo(x - 9 * s, y + 2 * s);
      g.quadraticCurveTo(x - 3 * s, y - 8 * s, x + 2 * s, y); g.quadraticCurveTo(x + 6 * s, y + 6 * s, x + 10 * s, y - 2 * s);
      g.stroke();
    },
    thumb: function (canvas) {
      var c = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
      c.save(); c.setTransform(w / W, 0, 0, h / H, 0, 0);
      FB.background(c, 0); FB.fish(c, "tuna", 300, 300, 1, 0, false); FB.fish(c, "grouper", 620, 400, -1, 0, false);
      FB.boy(c, 0, "idle"); FB.line(c, 520, 48, 520, 260, 0); FB.hook(c, 520, 260, true, 0);
      c.restore();
    }
  };

  /* ---- engine ---- */
  function create(canvas, opts) {
    opts = opts || {};
    var g = canvas.getContext("2d");
    var K = geo();
    var ICE = K.ice, HOLE = K.hole, TIP = K.tip, SIZE = K.size, MOUTH = K.mouth;
    var TOP = ICE + 14, BOT = H - 18;
    var reduced = reducedMotion();
    var view = { cw: 0, ch: 0, dpr: 1, s: 1, ox: 0, oy: 0 };
    var raf = 0, last = 0, userPaused = false, dead = false, ro = null, timers = [];
    var keys = {}, auto = true;
    var S = {
      phase: "ready", t: 0, elapsed: 0, score: 0, worms: MAX_WORMS, caught: 0,
      best: loadBest(), reason: null, newBest: false,
      hook: { x: HOLE.x, y: ICE + 110, tx: 0, ty: ICE + 110, baited: true },
      ptr: null, hooked: null, fish: [], haz: [], warns: [], fx: [],
      rebaitT: 0, cutT: 0, moodT: 0, dieT: 0, shake: 0, shakeAmp: 0,
      nx: { fish: 0.4, jelly: 0, trash: 0, eel: 0, shark: 0, swordfish: 0 }
    };

    if (!canvas.hasAttribute("tabindex")) canvas.setAttribute("tabindex", "0");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.outline = "none";

    // draw through FISHART, fallback on miss
    function draw(name, a, b, c, d, e, f, h2) {
      var A = art();
      g.save();
      try {
        if (A && typeof A[name] === "function") A[name](g, a, b, c, d, e, f, h2);
        else FB[name](g, a, b, c, d, e, f, h2);
      } catch (_) {
        g.restore(); g.save();
        try { FB[name](g, a, b, c, d, e, f, h2); } catch (_2) { /* skip */ }
      }
      g.restore();
    }
    function later(fn, ms) {
      var id = setTimeout(function () {
        timers.splice(timers.indexOf(id), 1);
        if (!dead) fn();
      }, ms);
      timers.push(id);
    }

    /* ---- state out ---- */
    var lastSig = "";
    function pub() { return S.phase === "dying" ? "play" : S.phase; }
    function snapshot() {
      var p = pub();
      return {
        phase: p, score: S.score, worms: S.worms, caught: S.caught, best: S.best,
        reason: p === "over" ? S.reason : null, newBest: p === "over" ? S.newBest : false
      };
    }
    function emit(force) {
      var s = snapshot();
      var sig = [s.phase, s.score, s.worms, s.caught, s.best, s.reason, s.newBest].join("|");
      if (!force && sig === lastSig) return;
      lastSig = sig;
      if (typeof opts.onState === "function") {
        try { opts.onState(s); } catch (_) { /* shell error */ }
      }
    }

    /* ---- difficulty ---- */
    function diff() { return clamp(S.elapsed / 100 + S.caught / 40, 0, 1); }
    function isDrifter(k) { return k === "jelly" || k === "trash"; }
    function hazRoom(k) {
      var n = 0, i;
      if (isDrifter(k)) {
        for (i = 0; i < S.haz.length; i++) if (S.haz[i].kind === k) n++;
        return n < 3 + Math.floor(diff() * 1.99);
      }
      for (i = 0; i < S.haz.length; i++) if (!isDrifter(S.haz[i].kind)) n++;
      return n + S.warns.length < 2 + Math.floor(diff() * 1.99);
    }
    function speedIn(r) { return lerp(r[0], r[1], clamp(Math.random() * 0.75 + diff() * 0.25, 0, 1)); }

    /* ---- spawning ---- */
    function pickKind() {
      var r = Math.random();
      return r < 0.9 ? "tuna" : "grouper";
    }
    function addFish(kind, x, y, dir, sp) {
      var f = {
        kind: kind, x: x, y: y, by: y, dir: dir || 1,
        sp: sp || rand(SPEED[kind][0], SPEED[kind][1]), ph: rand(0, 6.28), nb: false
      };
      S.fish.push(f);
      return f;
    }
    function spawnFish(onScreen) {
      var kind = pickKind(), dir = Math.random() < 0.5 ? 1 : -1, w = SIZE[kind].w;
      var x = onScreen ? rand(80, W - 80) : dir > 0 ? -w / 2 - 10 : W + w / 2 + 10;
      addFish(kind, x, rand(ICE + 50, H - 30), dir);
    }
    function addHaz(kind, x, y, dir, sp) {
      var h = { kind: kind, x: x, y: y, bx: x, by: y, dir: dir || 1, sp: sp || 60, ph: rand(0, 6.28), cut: false };
      S.haz.push(h);
      return h;
    }
    function hazEll(h, k) {
      var s = SIZE[h.kind];
      return { a: s.w / 2 * k, b: s.h / 2 * k };
    }
    function trySpawn(kind) {
      var i, x, y, dir, ok;
      if (kind === "eel" || kind === "jelly" || kind === "trash") {
        dir = Math.random() < 0.5 ? 1 : -1;
        x = dir > 0 ? -SIZE[kind].w / 2 - 10 : W + SIZE[kind].w / 2 + 10;
        for (i = 0; i < 8; i++) {
          y = rand(kind === "jelly" ? ICE + 92 : ICE + 60, H - 40);
          ok = true;
          S.haz.forEach(function (h) { if (h.kind !== "shark" && h.kind !== "swordfish" && Math.abs(h.by - y) < 38) ok = false; });
          if (ok) break;
        }
        if (!ok) return false;
        addHaz(kind, x, y, dir, speedIn(LANE_SPEED[kind]));
        return true;
      }
      if (kind === "shark" || kind === "swordfish") {
        var busy = false;
        S.warns.forEach(function (w) { if (w.kind === kind) busy = true; });
        S.haz.forEach(function (h) { if (h.kind === kind) busy = true; });
        if (busy) return false;
        dir = Math.random() < 0.5 ? 1 : -1;
        S.warns.push({ kind: kind, dir: dir, y: rand(ICE + 60, H - 50), t: 0.6, sp: speedIn(kind === "shark" ? [240, 320] : SPEED.swordfish) });
        return true;
      }
      return false;
    }
    var LANE_SPEED = { eel: [90, 140], jelly: [45, 75], trash: [50, 85] };
    var GAP = { jelly: [3.9, 5.4], trash: [5.3, 7.3], eel: [9, 12] };
    function nextGap(kind) {
      var d = diff();
      if (kind === "shark") return lerp(rand(11, 16), rand(7, 8.5), d);
      if (kind === "swordfish") return lerp(rand(11, 16), rand(6.5, 8.5), d);
      return rand(GAP[kind][0], GAP[kind][1]) * (1 - 0.55 * d);
    }
    function autoHazards(dt) {
      var grace = S.elapsed < 5;
      ["jelly", "trash", "eel", "shark", "swordfish"].forEach(function (k) {
        S.nx[k] -= dt;
        if (S.nx[k] > 0 || grace) return;
        if (hazRoom(k) && trySpawn(k)) S.nx[k] = nextGap(k);
        else S.nx[k] = rand(0.6, 1.1);
      });
    }

    /* ---- hook ---- */
    function setPointer(lx, ly) {
      S.ptr = { x: lx, y: ly };
      if (S.phase !== "play") return;
      S.hook.ty = clamp(ly, TOP, BOT);
      S.hook.tx = clamp((lx - HOLE.x) * 0.3, -70, 70);
    }
    function moveHook(dt) {
      var hk = S.hook, tx, ty, max, dy, step;
      if (S.phase === "play") {
        var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0), vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        if (vy) hk.ty = clamp(hk.ty + vy * 380 * dt, TOP, BOT);
        if (vx) hk.tx = clamp(hk.tx + vx * 180 * dt, -70, 70);
        tx = HOLE.x + hk.tx; ty = hk.ty;
      } else if (S.phase === "ready") {
        tx = HOLE.x; ty = ICE + 110 + Math.sin(S.t * 0.9) * 8;
      } else {
        tx = hk.x; ty = hk.y + Math.sin(S.t * 1.3) * 0.3;
      }
      if (S.cutT > 0) { hk.y = TOP; hk.x = lerp(hk.x, HOLE.x, Math.min(1, dt * 10)); return; }
      // hook easing
      max = 600 * dt * (S.hooked ? DRAG[S.hooked.kind] : 1);
      dy = ty - hk.y;
      step = dy * Math.min(1, dt * 14);
      hk.y = clamp(hk.y + clamp(step, -max, max), TOP, BOT);
      hk.x += (tx - hk.x) * Math.min(1, dt * 9);
    }

    /* ---- fish ---- */
    function mouthOf(f) { return { x: f.x + f.dir * MOUTH[f.kind], y: f.y }; }
    function canBite() {
      return S.phase === "play" && S.hook.baited && !S.hooked && S.cutT <= 0 && S.rebaitT <= 0;
    }
    function moveFish(dt) {
      var hk = S.hook, lure = canBite(), i, f, m0, m1, ahead, dy, w;
      for (i = S.fish.length - 1; i >= 0; i--) {
        f = S.fish[i];
        m0 = mouthOf(f);
        // lure pull
        if (lure && !f.nb) {
          ahead = (hk.x - f.x) * f.dir;
          dy = hk.y - f.by;
          if (ahead > 0 && ahead < 170 && Math.abs(dy) < 55) f.by += clamp(dy, -26 * dt, 26 * dt);
        }
        f.x += f.dir * f.sp * dt;
        f.y = f.by + Math.sin(S.t * 1.7 + f.ph) * 4;
        w = SIZE[f.kind].w;
        if ((f.dir > 0 && f.x - w / 2 > W + 40) || (f.dir < 0 && f.x + w / 2 < -40)) { S.fish.splice(i, 1); continue; }
        if (lure && !f.nb && canBite()) {
          m1 = mouthOf(f);
          if (segDist(m0.x, m0.y, m1.x, m1.y, hk.x, hk.y) <= 18) bite(f, i);
        }
      }
    }
    function bite(f, i) {
      S.fish.splice(i, 1);
      S.hooked = { kind: f.kind, dir: f.dir };
      if (!reduced) S.fx.push({ type: "bubbles", x: S.hook.x, y: S.hook.y, age: 0, dur: 0.6 });
    }
    function land() {
      var k = S.hooked.kind, pts = PTS[k];
      S.score += pts;
      S.caught++;
      S.worms = Math.max(0, S.worms - 1);
      S.fx.push({ type: "fly", kind: k, dir: S.hooked.dir, x: S.hook.x, y: S.hook.y, age: 0, dur: 0.7 });
      S.fx.push({ type: "splash", x: HOLE.x, y: HOLE.y, age: 0, dur: 0.6 });
      S.fx.push({ type: "pop", text: "+" + pts, x: HOLE.x, y: HOLE.y - 26, age: 0, dur: 0.9 });
      S.hooked = null;
      S.hook.baited = false;
      S.rebaitT = 0.4;
      S.moodT = 0.8;
      if (S.worms <= 0) die("worms", 0.8);
    }
    function freeHooked(dir) {
      var k = S.hooked.kind;
      var f = addFish(k, S.hook.x, S.hook.y + MOUTH[k] * 0.5, dir, rand(SPEED[k][0], SPEED[k][1]) * 1.8);
      f.nb = true;
      S.hooked = null;
    }

    /* ---- hazards ---- */
    var WOB = { eel: [2.2, 10], jelly: [1.6, 14], trash: [0.9, 6], shark: [1.2, 3], swordfish: [1.7, 2] };
    function moveHaz(dt) {
      var i, h, s, wb;
      for (i = S.haz.length - 1; i >= 0; i--) {
        h = S.haz[i];
        s = SIZE[h.kind];
        wb = WOB[h.kind] || WOB.shark;
        h.x += h.dir * h.sp * dt;
        h.y = h.by + Math.sin(S.t * wb[0] + h.ph) * wb[1];
        if ((h.dir > 0 && h.x - s.w / 2 > W + 40) || (h.dir < 0 && h.x + s.w / 2 < -40)) S.haz.splice(i, 1);
      }
    }
    function moveWarns(dt) {
      var i, w, k, s;
      for (i = S.warns.length - 1; i >= 0; i--) {
        w = S.warns[i];
        k = w.kind || "shark";
        s = SIZE[k];
        w.t -= dt;
        if (w.t > 0) continue;
        S.warns.splice(i, 1);
        if (S.phase === "play") addHaz(k, w.dir > 0 ? -s.w / 2 + 6 : W + s.w / 2 - 6, w.y, w.dir, w.sp);
      }
    }
    function hookHit(h) {
      var e = hazEll(h, 0.8), hk = S.hook, k, a, b, cy, i, ang;
      if (inEll(hk.x, hk.y, h.x, h.y, e.a + 9, e.b + 9)) return true;
      if (!S.hooked) return false;
      k = S.hooked.kind;
      a = SIZE[k].h / 2 * 0.7; b = SIZE[k].w / 2 * 0.7; cy = hk.y + MOUTH[k];
      if (inEll(hk.x, cy, h.x, h.y, e.a, e.b)) return true;
      for (i = 0; i < 8; i++) {
        ang = i / 8 * Math.PI * 2;
        if (inEll(hk.x + Math.cos(ang) * a, cy + Math.sin(ang) * b, h.x, h.y, e.a, e.b)) return true;
      }
      return false;
    }
    function lineHit(h) {
      var s = SIZE[h.kind], a = s.w / 2 * 0.85, b = s.h / 2 * 0.75, hk = S.hook;
      if (inEll(hk.x, hk.y, h.x, h.y, a + 9, b + 9)) return true;
      return segHitsEll(HOLE.x, HOLE.y, hk.x, hk.y, h.x, h.y, a, b);
    }
    function cutLine(h) {
      var hk = S.hook, py = clamp(h.y, HOLE.y, hk.y);
      var px = hk.y > HOLE.y ? lerp(HOLE.x, hk.x, (py - HOLE.y) / (hk.y - HOLE.y)) : hk.x;
      h.cut = true;
      S.fx.push({ type: "snap", x: px, y: py, age: 0, dur: 0.6 });
      S.fx.push({ type: "pop", text: "-1", x: HOLE.x, y: HOLE.y - 26, age: 0, dur: 0.9 });
      S.worms = Math.max(0, S.worms - 1);
      if (S.hooked) freeHooked(h.dir);
      hk.baited = false;
      hk.y = TOP;
      S.cutT = 0.8;
      S.rebaitT = 0;
      shake(3, 0.25);
      if (S.worms <= 0) die("worms", 0.9);
    }
    function collide() {
      var i, h;
      for (i = 0; i < S.haz.length; i++) {
        h = S.haz[i];
        if (h.kind === "shark" || h.kind === "swordfish") {
          if (!h.cut && S.cutT <= 0 && lineHit(h)) cutLine(h);
        } else if (S.cutT <= 0 && hookHit(h)) {
          hitBy(h);
          return;
        }
        if (S.phase !== "play") return;
      }
    }
    function hitBy(h) {
      var hk = S.hook;
      S.fx.push({ type: h.kind === "trash" ? "snap" : "zap", x: hk.x, y: hk.y, age: 0, dur: 0.9 });
      shake(6, 0.4);
      die(h.kind, 0.9);
    }
    function shake(amp, dur) {
      if (reduced) return;
      S.shake = dur;
      S.shakeAmp = amp;
    }

    /* ---- phases ---- */
    function die(reason, delay) {
      S.phase = "dying";
      S.reason = reason;
      S.dieT = delay;
      S.hook.baited = false;
      S.cutT = 0;
      S.rebaitT = 0;
      S.warns.length = 0;
    }
    function finishOver() {
      S.phase = "over";
      S.newBest = false;
      if (S.score > S.best) {
        S.best = S.score;
        S.newBest = true;
        saveBest(S.best);
      }
      emit();
    }
    function newGame() {
      if (dead) return;
      reduced = reducedMotion();
      S.phase = "play";
      S.elapsed = 0;
      S.score = 0;
      S.worms = MAX_WORMS;
      S.caught = 0;
      S.best = Math.max(S.best, loadBest());
      S.reason = null;
      S.newBest = false;
      S.hooked = null;
      S.haz.length = 0;
      S.warns.length = 0;
      S.fx.length = 0;
      S.fish.forEach(function (f) { f.nb = false; });
      S.rebaitT = 0; S.cutT = 0; S.moodT = 0; S.dieT = 0; S.shake = 0;
      S.hook.baited = true;
      S.hook.ty = S.ptr ? clamp(S.ptr.y, TOP, BOT) : clamp(S.hook.y, TOP, BOT);
      S.hook.tx = S.ptr ? clamp((S.ptr.x - HOLE.x) * 0.3, -70, 70) : 0;
      S.nx.jelly = rand(5, 6.5);
      S.nx.trash = rand(6.5, 8);
      S.nx.eel = rand(10, 12);
      S.nx.shark = rand(15, 16.5);
      S.nx.swordfish = rand(20, 22);
      keys = {};
      try { canvas.focus({ preventScroll: true }); } catch (_) { /* old browser */ }
      emit();
      render();
    }

    /* ---- update ---- */
    function update(dt) {
      var ph = S.phase, wdt = ph === "dying" ? dt * 0.35 : dt, i, f;
      S.t += dt;
      if (ph === "play") S.elapsed += dt;
      if (S.moodT > 0) S.moodT -= dt;
      if (S.shake > 0) S.shake -= dt;
      if (S.rebaitT > 0) {
        S.rebaitT -= dt;
        if (S.rebaitT <= 0 && ph === "play" && S.worms > 0) S.hook.baited = true;
      }
      if (S.cutT > 0) {
        S.cutT -= dt;
        if (S.cutT <= 0 && ph === "play" && S.worms > 0) S.hook.baited = true;
      }
      moveHook(dt);
      if (auto) {
        S.nx.fish -= wdt;
        if (S.nx.fish <= 0) {
          S.nx.fish = rand(1.4, 2.6);
          if (S.fish.length < 3) spawnFish(false);
        }
        if (ph === "play") autoHazards(dt);
      }
      moveFish(wdt);
      moveHaz(wdt);
      moveWarns(dt);
      if (S.phase === "play") {
        if (S.hooked && S.hook.y <= ICE + 16) land();
        if (S.phase === "play") collide();
      }
      for (i = S.fx.length - 1; i >= 0; i--) {
        f = S.fx[i];
        f.age += dt;
        if (f.age >= f.dur) S.fx.splice(i, 1);
      }
      if (S.phase === "dying") {
        S.dieT -= dt;
        if (S.dieT <= 0) finishOver();
      }
      emit();
    }

    /* ---- render ---- */
    function mood() {
      if (S.phase === "over") return "sad";
      if (S.phase === "dying") return S.reason === "worms" && S.moodT > 0 ? "cheer" : "sad";
      if (S.moodT > 0) return "cheer";
      return S.hooked ? "reel" : "idle";
    }
    function letterbox() {
      var v = view, gr, y0, y1, a, b;
      if (v.ox < 0.5 && v.oy < 0.5) return;
      y0 = v.oy + ICE * v.s; y1 = v.oy + H * v.s;
      a = clamp(y0 / v.ch, 0, 1); b = clamp(y1 / v.ch, a, 1);
      gr = g.createLinearGradient(0, 0, 0, v.ch);
      gr.addColorStop(0, "#dfe9f1");
      gr.addColorStop(a, "#dfe9f1");
      gr.addColorStop(a, "#6fb3d6");
      gr.addColorStop(b, "#1f4e79");
      gr.addColorStop(1, "#1f4e79");
      g.fillStyle = gr;
      g.fillRect(0, 0, v.cw, v.ch);
    }
    function drawWarn(w) {
      var x = w.dir > 0 ? 0 : W, p = 1 - w.t / 0.6, pulse = 0.5 + 0.5 * Math.sin(S.t * 22);
      var bx = w.dir > 0 ? 26 : W - 26, gr;
      g.save();
      gr = g.createRadialGradient(x, w.y, 4, x, w.y, 110);
      gr.addColorStop(0, "rgba(10,24,40," + (0.5 * p + 0.15) + ")");
      gr.addColorStop(1, "rgba(10,24,40,0)");
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, w.y, 110, 42, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e8c35c"; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.arc(bx, w.y, 14 + pulse * 2, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = INK; g.font = "26px " + FONT; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("!", bx, w.y + 1);
      g.restore();
    }
    function drawFx(f) {
      var p = clamp(f.age / f.dur, 0, 1), i, sc;
      if (f.type === "splash") draw("splash", f.x, f.y, p);
      else if (f.type === "zap") draw("zap", f.x, f.y, p);
      else if (f.type === "snap") draw("snap", f.x, f.y, p);
      else if (f.type === "pop") draw("popText", f.text, f.x, f.y, p);
      else if (f.type === "fly") {
        g.save();
        g.beginPath(); g.rect(0, 0, W, ICE); g.clip();
        sc = 1 - p * 0.45;
        g.translate(lerp(f.x, 150, Math.pow(p, 2.2)), lerp(f.y, 96, p) - Math.sin(Math.PI * p) * 120);
        g.scale(sc, sc);
        draw("fish", f.kind, 0, 0, f.dir, S.t, true);
        g.restore();
      } else if (f.type === "bubbles") {
        g.save();
        g.strokeStyle = "rgba(255,255,255," + (0.8 * (1 - p)) + ")";
        g.lineWidth = 1.5;
        for (i = 0; i < 7; i++) {
          g.beginPath();
          g.arc(f.x + Math.sin(i * 2.3) * (6 + p * 16), f.y - p * (20 + i * 5), 2 + (i % 3), 0, Math.PI * 2);
          g.stroke();
        }
        g.restore();
      }
    }
    function hud() {
      var txt = "x " + S.worms, sc = "Score " + S.score, w1, w2, pw;
      g.save();
      g.font = "26px " + FONT;
      w1 = g.measureText(txt).width; w2 = g.measureText(sc).width;
      pw = 44 + w1 + 18 + w2 + 12;
      g.fillStyle = "rgba(244,248,251,.92)"; g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(12, 10, pw, 34, 5); else g.rect(12, 10, pw, 34);
      g.fill(); g.stroke();
      g.restore();
      draw("wormIcon", 32, 27, 1);
      g.save();
      g.font = "26px " + FONT; g.fillStyle = INK; g.textBaseline = "middle"; g.textAlign = "left";
      g.fillText(txt, 50, 28);
      g.fillStyle = "#b9cfdd"; g.fillRect(50 + w1 + 9, 17, 2, 20);
      g.fillStyle = INK; g.fillText(sc, 50 + w1 + 18, 28);
      g.restore();
    }
    function render() {
      var v = view, hk = S.hook, i, sx = 0, sy = 0, flying = 0, slack, h, f;
      if (dead || !v.cw || !v.ch) return;
      g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      g.clearRect(0, 0, v.cw, v.ch);
      letterbox();
      if (S.shake > 0 && !reduced) {
        sx = (Math.random() - 0.5) * 2 * S.shakeAmp;
        sy = (Math.random() - 0.5) * 2 * S.shakeAmp;
      }
      g.translate(v.ox + sx * v.s, v.oy + sy * v.s);
      g.scale(v.s, v.s);
      g.save();
      g.beginPath(); g.rect(0, 0, W, H); g.clip();

      draw("background", S.t);

      // underwater
      g.save();
      g.beginPath(); g.rect(0, ICE, W, H - ICE); g.clip();
      for (i = 0; i < S.fish.length; i++) {
        f = S.fish[i];
        draw("fish", f.kind, f.x, f.y, f.dir, S.t + f.ph, false);
      }
      for (i = 0; i < S.haz.length; i++) {
        h = S.haz[i];
        if (h.kind === "swordfish") draw("fish", h.kind, h.x, h.y, h.dir, S.t + h.ph, false);
        else draw("hazard", h.kind, h.x, h.y, h.dir, S.t + h.ph);
      }
      slack = S.cutT > 0 ? 1 : S.hooked ? 0 : 0.06;
      draw("line", HOLE.x, HOLE.y, hk.x, hk.y, slack);
      if (S.hooked) draw("fish", S.hooked.kind, hk.x, hk.y, S.hooked.dir, S.t, true);
      draw("hook", hk.x, hk.y, hk.baited, S.t);
      g.restore();

      draw("line", TIP.x, TIP.y, HOLE.x, HOLE.y, 0);
      draw("surface", S.t);
      for (i = 0; i < S.fx.length; i++) if (S.fx[i].type === "fly") flying++;
      draw("crate", Math.max(0, S.caught - flying));
      draw("wormCan", S.t);
      draw("boy", S.t, mood());
      for (i = 0; i < S.fx.length; i++) drawFx(S.fx[i]);
      for (i = 0; i < S.warns.length; i++) drawWarn(S.warns[i]);
      hud();
      g.restore();
    }

    /* ---- loop ---- */
    function running() { return !dead && !userPaused && !document.hidden; }
    function frame(now) {
      var dt;
      raf = 0;
      if (!running()) return;
      dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (!view.cw) fit();
      update(clamp(dt, 0, 0.05));
      render();
      raf = window.requestAnimationFrame(frame);
    }
    function start() {
      if (raf || !running()) return;
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }

    /* ---- sizing ---- */
    function watch() {
      if (ro || typeof window.ResizeObserver !== "function" || !canvas.parentNode) return;
      ro = new window.ResizeObserver(function () { fit(); });
      ro.observe(canvas.parentNode);
    }
    function fit() {
      if (dead) return;
      watch();
      var r = canvas.getBoundingClientRect(), cw = r.width, ch = r.height;
      var dpr = Math.min(2, window.devicePixelRatio || 1), bw, bh;
      if (cw > 0 && ch < 2) {
        canvas.style.height = Math.round(cw * H / W) + "px";
        ch = canvas.getBoundingClientRect().height;
      }
      if (cw < 1 || ch < 1) { view.cw = 0; view.ch = 0; return; }
      bw = Math.round(cw * dpr); bh = Math.round(ch * dpr);
      if (canvas.width !== bw) canvas.width = bw;
      if (canvas.height !== bh) canvas.height = bh;
      view.cw = cw; view.ch = ch; view.dpr = dpr;
      view.s = Math.min(cw / W, ch / H);
      view.ox = (cw - W * view.s) / 2;
      view.oy = (ch - H * view.s) / 2;
      render();
    }
    function toLogical(e) {
      var r = canvas.getBoundingClientRect(), v = view;
      if (!v.s) return null;
      return { x: (e.clientX - r.left - v.ox) / v.s, y: (e.clientY - r.top - v.oy) / v.s };
    }

    /* ---- input ---- */
    var KEYMAP = {
      ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right"
    };
    function onMove(e) {
      var p = toLogical(e);
      if (p) setPointer(p.x, p.y);
    }
    function onDown(e) {
      onMove(e);
      if (e.pointerType === "touch") {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* no capture */ }
      }
      try { canvas.focus({ preventScroll: true }); } catch (_) { /* old browser */ }
    }
    function onUp(e) {
      try { if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } catch (_) { /* no capture */ }
    }
    function onKey(e) {
      var k = KEYMAP[e.key];
      if (!k || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      keys[k] = e.type === "keydown";
    }
    function onBlur() { keys = {}; }
    function onVis() {
      if (document.hidden) stop();
      else start();
    }

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("keydown", onKey);
    canvas.addEventListener("keyup", onKey);
    canvas.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", fit);

    // starter school of fish
    for (var n = 0; n < 2; n++) spawnFish(true);
    fit();
    start();
    later(function () { emit(true); }, 0);

    /* ---- test hook ---- */
    var dbg = {
      state: function () { return S; },
      geo: function () { return K; },
      auto: function (on) { auto = !!on; },
      spawn: function (kind, x, y, dir, sp) {
        if (PTS[kind]) return addFish(kind, x, y, dir, sp);
        if (kind === "shark" && sp == null) sp = 280;
        if (kind === "swordfish" && sp == null) sp = 340;
        return addHaz(kind, x, y, dir, sp);
      },
      hook: function (y, x, snap) {
        S.hook.ty = clamp(y, TOP, BOT);
        if (x != null) S.hook.tx = clamp(x - HOLE.x, -70, 70);
        if (snap) { S.hook.y = S.hook.ty; S.hook.x = HOLE.x + S.hook.tx; }
      },
      step: function (sec, fps) {
        var n2 = Math.max(1, Math.round((sec || 0) * (fps || 60)));
        for (var j = 0; j < n2 && !dead; j++) update(1 / (fps || 60));
        render();
      },
      running: function () { return !!raf; }
    };

    return {
      newGame: newGame,
      pause: function () { userPaused = true; stop(); },
      resume: function () { if (dead) return; userPaused = false; start(); },
      resize: fit,
      destroy: function () {
        if (dead) return;
        stop();
        dead = true;
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("keydown", onKey);
        canvas.removeEventListener("keyup", onKey);
        canvas.removeEventListener("blur", onBlur);
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("resize", fit);
        if (ro) { ro.disconnect(); ro = null; }
        while (timers.length) clearTimeout(timers.pop());
        opts = {};
      },
      phase: pub,
      _dbg: dbg
    };
  }

  /* ---- registry ---- */
  window.ATUL_GAMES = window.ATUL_GAMES || [];
  window.ATUL_GAMES.push({
    id: "fishing",
    name: "Fishing",
    blurb: "Drop a worm through the ice and reel in what bites.",
    best: loadBest,
    thumb: function (canvas) {
      var A = art();
      try {
        if (A && typeof A.thumb === "function") { A.thumb(canvas); return; }
      } catch (_) { /* fallback below */ }
      try { FB.thumb(canvas); } catch (_2) { /* no canvas */ }
    },
    create: create
  });
})();
