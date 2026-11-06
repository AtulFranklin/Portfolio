// ice fishing game sounds
// web audio synth, no files
(function () {
  "use strict";

  var KEY = "atulos-sound";
  var ctx = null, master = null, comp = null, noiseBuf = null;
  var last = {}, held = false, away = false;
  var reelRate = 0, reelTimer = 0;
  var ambWant = false, amb = null;

  /* ---- helpers ---- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function enabled() {
    try { return window.localStorage.getItem(KEY) !== "0"; } catch (_) { return true; }
  }
  function live() { return !!ctx && !held && !away && enabled(); }
  function now() { return ctx.currentTime; }

  /* ---- context ---- */
  function make() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = enabled() ? 0.45 : 0.0001;
    comp.connect(master);
    master.connect(ctx.destination);
    var n = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = b.getChannelData(0), i;
    for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b;
    return ctx;
  }
  function unlock() {
    try {
      if (!ctx && !make()) return;
      held = false;
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      startReel();
      if (ambWant && enabled()) ambStart();
    } catch (_) { /* no audio */ }
  }
  // run context only when not held or tab away
  function sync() {
    try {
      if (!ctx) return;
      if (held || away) { if (ctx.state === "running" && ctx.suspend) ctx.suspend(); }
      else if (enabled() && ctx.state === "suspended" && ctx.resume) ctx.resume();
    } catch (_) { /* ignore */ }
  }
  function suspend() { held = true; sync(); }
  function resume() {
    held = false;
    sync();
    try { startReel(); } catch (_) { /* ignore */ }
  }

  /* ---- voice builders ---- */
  function env(t, peak, a, dur) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(comp);
    return g;
  }
  // tone with pitch glide
  function tone(type, f0, f1, t, dur, vol, a) {
    var o = ctx.createOscillator(), g = env(t, vol, a || 0.008, dur);
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.03);
    return o;
  }
  // filtered noise burst with cutoff sweep
  function noise(type, f0, f1, q, t, dur, vol, a) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = env(t, vol, a || 0.01, dur);
    s.buffer = noiseBuf;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(f);
    f.connect(g);
    s.start(t, rand(0, 1.5));
    s.stop(t + dur + 0.03);
    return s;
  }

  /* ---- one shots ---- */
  var VOICE = {
    start: function (t) {
      noise("bandpass", 3200, 400, 1.2, t, 0.32, 0.22, 0.03);
      tone("sine", 520, 190, t + 0.36, 0.14, 0.3, 0.005);
      noise("lowpass", 900, 300, 0.7, t + 0.36, 0.12, 0.12, 0.005);
    },
    bite: function (t) {
      tone("square", 330, 250, t, 0.07, 0.14);
      tone("square", 330, 250, t + 0.11, 0.07, 0.14);
      var i;
      for (i = 0; i < 4; i++) tone("sine", rand(250, 330), rand(480, 700), t + 0.24 + i * 0.06, 0.07, 0.1, 0.005);
    },
    land: function (t, o) {
      noise("bandpass", 2400, 600, 0.9, t, 0.28, 0.2, 0.01);
      var notes = o && o.kind === "grouper" ? [659, 784, 1047] : [784, 1047];
      var i, step = notes.length > 2 ? 0.09 : 0.1;
      for (i = 0; i < notes.length; i++) {
        tone("square", notes[i], 0, t + 0.18 + i * step, 0.16, 0.1);
        tone("triangle", notes[i] * 2, 0, t + 0.18 + i * step, 0.14, 0.05);
      }
    },
    cut: function (t) {
      tone("sawtooth", 1100, 140, t, 0.3, 0.1, 0.004);
      tone("triangle", 2200, 280, t, 0.2, 0.06, 0.004);
      noise("highpass", 3000, 3000, 0.7, t + 0.03, 0.04, 0.2, 0.002);
    },
    zap: function (t) {
      var a = ctx.createOscillator(), b = ctx.createOscillator();
      var m = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      var f = ctx.createBiquadFilter(), g = env(t, 0.1, 0.01, 0.5);
      a.type = "sawtooth"; b.type = "square";
      a.frequency.setValueAtTime(110, t);
      b.frequency.setValueAtTime(117, t);
      a.frequency.exponentialRampToValueAtTime(70, t + 0.5);
      b.frequency.exponentialRampToValueAtTime(75, t + 0.5);
      lfo.frequency.value = 38;
      lg.gain.value = 0.5;
      m.gain.value = 0.5;
      lfo.connect(lg);
      lg.connect(m.gain);
      f.type = "lowpass";
      f.frequency.value = 1800;
      a.connect(m);
      b.connect(m);
      m.connect(f);
      f.connect(g);
      a.start(t); b.start(t); lfo.start(t);
      a.stop(t + 0.55); b.stop(t + 0.55); lfo.stop(t + 0.55);
      noise("bandpass", 4000, 2500, 2, t, 0.35, 0.05, 0.01);
    },
    clank: function (t) {
      var p = [410, 687, 1043, 1471, 2150], i;
      for (i = 0; i < p.length; i++) tone("square", p[i], 0, t, 0.28 - i * 0.04, 0.06 / (1 + i * 0.4), 0.002);
      noise("bandpass", 1800, 1800, 3, t, 0.05, 0.12, 0.002);
    },
    warn: function (t) {
      tone("sine", 880, 0, t, 0.28, 0.14, 0.01);
      tone("sine", 880, 0, t + 0.2, 0.34, 0.11, 0.01);
    },
    rebait: function (t) {
      tone("sine", 220, 520, t, 0.07, 0.07, 0.004);
      noise("lowpass", 700, 350, 0.7, t, 0.06, 0.05, 0.004);
    },
    over: function (t) {
      var n = [392, 330, 262, 196], i;
      for (i = 0; i < n.length; i++) {
        tone("square", n[i], n[i] * 0.97, t + i * 0.2, i === 3 ? 0.5 : 0.18, 0.09, 0.01);
        tone("triangle", n[i] / 2, 0, t + i * 0.2, i === 3 ? 0.5 : 0.18, 0.08, 0.01);
      }
    },
    best: function (t) {
      var n = [523, 659, 784, 1047, 784, 1047], i;
      for (i = 0; i < n.length; i++) {
        var d = i === 5 ? 0.4 : 0.1;
        tone("square", n[i], 0, t + i * 0.1, d, 0.08, 0.006);
        tone("triangle", n[i] * 2, 0, t + i * 0.1, d, 0.04, 0.006);
      }
    },
    toggle: function (t) {
      tone("triangle", 660, 880, t, 0.1, 0.12, 0.005);
    }
  };

  function play(name, opts) {
    try {
      if (!live() || !VOICE[name]) return;
      var ms = Date.now();
      if (last[name] && ms - last[name] < 60) return;
      last[name] = ms;
      VOICE[name](now() + 0.01, opts || {});
    } catch (_) { /* ignore */ }
  }

  /* ---- reel ratchet ---- */
  function tick() {
    var t = now() + 0.005, p = rand(0.92, 1.1);
    noise("bandpass", 2600 * p, 1800 * p, 2.5, t, 0.03, 0.12, 0.002);
    tone("square", 1250 * p, 800 * p, t, 0.025, 0.045, 0.002);
  }
  function reelLoop() {
    reelTimer = 0;
    try {
      if (reelRate <= 0 || !live()) return;
      tick();
      var ms = clamp(140 - (reelRate - 0.1) / 0.9 * 95, 45, 140);
      reelTimer = setTimeout(reelLoop, ms * rand(0.92, 1.08));
    } catch (_) { /* ignore */ }
  }
  function startReel() {
    if (reelRate > 0 && !reelTimer && live()) reelTimer = setTimeout(reelLoop, 0);
  }
  function reel(rate) {
    try {
      reelRate = clamp(+rate || 0, 0, 1);
      if (reelRate <= 0) {
        if (reelTimer) clearTimeout(reelTimer);
        reelTimer = 0;
      } else startReel();
    } catch (_) { /* ignore */ }
  }

  /* ---- ambient bed ---- */
  function ambStart() {
    if (amb || !ctx) return;
    var t = now(), n = {};
    n.out = ctx.createGain();
    n.out.gain.setValueAtTime(0.0001, t);
    n.out.gain.exponentialRampToValueAtTime(0.04, t + 0.6);
    n.out.connect(comp);
    // wind
    n.src = ctx.createBufferSource();
    n.src.buffer = noiseBuf;
    n.src.loop = true;
    n.bp = ctx.createBiquadFilter();
    n.bp.type = "bandpass";
    n.bp.frequency.value = 520;
    n.bp.Q.value = 0.8;
    n.lfo = ctx.createOscillator();
    n.lfo.frequency.value = 0.11;
    n.lg = ctx.createGain();
    n.lg.gain.value = 220;
    n.lfo.connect(n.lg);
    n.lg.connect(n.bp.frequency);
    n.src.connect(n.bp);
    n.bp.connect(n.out);
    // under-ice hum
    n.hum = ctx.createOscillator();
    n.hum.type = "sine";
    n.hum.frequency.value = 55;
    n.hg = ctx.createGain();
    n.hg.gain.value = 0.35;
    n.hum.connect(n.hg);
    n.hg.connect(n.out);
    n.src.start(t, rand(0, 1.5));
    n.lfo.start(t);
    n.hum.start(t);
    amb = n;
  }
  function ambStop() {
    var n = amb;
    if (!n) return;
    amb = null;
    try {
      var t = now();
      n.out.gain.cancelScheduledValues(t);
      n.out.gain.setValueAtTime(Math.max(n.out.gain.value, 0.0001), t);
      n.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      n.src.stop(t + 0.7);
      n.lfo.stop(t + 0.7);
      n.hum.stop(t + 0.7);
    } catch (_) { /* ignore */ }
  }
  function ambient(on) {
    try {
      ambWant = !!on;
      if (!ambWant) ambStop();
      else if (ctx && enabled()) ambStart();
    } catch (_) { /* ignore */ }
  }

  /* ---- enable / stop ---- */
  function setEnabled(on) {
    on = !!on;
    try { window.localStorage.setItem(KEY, on ? "1" : "0"); } catch (_) { /* private mode */ }
    try {
      if (ctx) {
        var t = now();
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
        master.gain.exponentialRampToValueAtTime(on ? 0.45 : 0.0001, t + 0.08);
        if (on) {
          if (ctx.state === "suspended" && !held && !away && ctx.resume) ctx.resume();
          if (ambWant) ambStart();
          startReel();
        } else {
          ambStop();
          if (reelTimer) clearTimeout(reelTimer);
          reelTimer = 0;
        }
      }
      if (on) play("toggle");
    } catch (_) { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent(KEY, { detail: { on: on } })); } catch (_) { /* ignore */ }
  }
  function stopAll() {
    reel(0);
    ambient(false);
  }

  try {
    document.addEventListener("visibilitychange", function () {
      away = !!document.hidden; sync();
    });
  } catch (_) { /* no document */ }

  window.FISHSFX = {
    enabled: enabled,
    setEnabled: setEnabled,
    unlock: unlock,
    play: play,
    reel: reel,
    ambient: ambient,
    suspend: suspend,
    resume: resume,
    stopAll: stopAll
  };
})();
