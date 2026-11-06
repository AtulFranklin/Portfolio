// ice fishing art: scene, sprites, effects
// FISHART drawing api for the fishing game
(function () {
  "use strict";

  var W = 800, H = 500, ICE_Y = 150;
  var HOLE = { x: 520, y: 150, rx: 36, ry: 9 };
  var ROD_TIP = { x: 520, y: 48 };
  var SIZE = {
    tuna: { w: 64, h: 30 }, grouper: { w: 104, h: 52 }, swordfish: { w: 150, h: 40 },
    shark: { w: 230, h: 84 }, eel: { w: 160, h: 24 }, jelly: { w: 56, h: 78 }, trash: { w: 44, h: 56 }
  };
  var MOUTH = { tuna: 30, grouper: 50, swordfish: 46 };

  var INK = "#14202b";
  var LW = 2.5;
  var TAU = Math.PI * 2;
  var ICE_BACK = 104, ICE_EDGE = 122;
  var SHAFT_L = HOLE.x - HOLE.rx, SHAFT_R = HOLE.x + HOLE.rx;
  var HUD_FONT = "\"VT323\", monospace";

  /* ---- helpers ---- */
  function ink(g, w) {
    g.strokeStyle = INK;
    g.lineWidth = w || LW;
    g.lineJoin = "round";
    g.lineCap = "round";
  }
  function ell(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU);
  }
  function fs(g, fill, w) {
    g.fillStyle = fill;
    g.fill();
    ink(g, w);
    g.stroke();
  }
  function rnd(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(p) { return 1 - Math.pow(1 - p, 3); }
  function limb(g, pts, w, color) {
    var i;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineJoin = "round";
    g.lineCap = "round";
    g.strokeStyle = INK;
    g.lineWidth = w + LW * 2;
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = w;
    g.stroke();
  }

  /* ---- offscreen cache ---- */
  var cache = {}, cacheN = 0;
  function scaleOf(g) {
    var m = g.getTransform ? g.getTransform() : null;
    if (!m) return 2;
    var s = Math.sqrt(m.a * m.a + m.b * m.b);
    return clamp(Math.ceil(s * 4) / 4, 0.25, 4);
  }
  function layer(g, key, x, y, w, h, draw) {
    var s = scaleOf(g), id = key + "@" + s, c = cache[id];
    if (!c) {
      if (cacheN > 30) { cache = {}; cacheN = 0; }
      c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * s));
      c.height = Math.max(1, Math.round(h * s));
      var cg = c.getContext("2d");
      cg.scale(c.width / w, c.height / h);
      cg.translate(-x, -y);
      draw(cg);
      cache[id] = c;
      cacheN++;
    }
    g.drawImage(c, x, y, w, h);
  }

  /* ---- sky + far shore ---- */
  function drawSky(g) {
    var gr = g.createLinearGradient(0, 0, 0, ICE_EDGE);
    gr.addColorStop(0, "#c6d8e6");
    gr.addColorStop(0.65, "#dfe9f1");
    gr.addColorStop(1, "#edf3f7");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, ICE_EDGE);

    // sun
    var sg = g.createRadialGradient(352, 34, 4, 352, 34, 60);
    sg.addColorStop(0, "rgba(255,246,214,0.95)");
    sg.addColorStop(0.3, "rgba(255,240,200,0.45)");
    sg.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = sg;
    g.fillRect(280, 0, 150, 100);
    ell(g, 352, 34, 14, 14);
    g.fillStyle = "#fff6d6";
    g.fill();

    // clouds
    cloud(g, 250, 22, 1);
    cloud(g, 455, 44, 0.75);
    cloud(g, 760, 18, 0.9);

    // far hills
    g.fillStyle = "#cfdde8";
    g.beginPath();
    g.moveTo(0, 96);
    g.bezierCurveTo(90, 70, 170, 74, 250, 88);
    g.bezierCurveTo(330, 100, 400, 72, 500, 76);
    g.bezierCurveTo(600, 80, 680, 66, 800, 84);
    g.lineTo(800, 112);
    g.lineTo(0, 112);
    g.fill();

    // pine line
    var i, x, h;
    for (i = 0; i < 44; i++) {
      x = i * 18.6 + rnd(i) * 10;
      h = 12 + rnd(i + 40) * 16;
      pine(g, x, 103, h, i % 3 === 0 ? "#a9bfcf" : "#b8cbd8");
    }

    // near snowbank
    g.fillStyle = "#e9f0f5";
    g.beginPath();
    g.moveTo(0, 104);
    g.bezierCurveTo(120, 94, 220, 100, 330, 99);
    g.bezierCurveTo(440, 98, 560, 93, 660, 99);
    g.bezierCurveTo(720, 102, 770, 97, 800, 98);
    g.lineTo(800, 112);
    g.lineTo(0, 112);
    g.fill();
  }
  function cloud(g, x, y, s) {
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.beginPath();
    g.ellipse(x, y, 30 * s, 9 * s, 0, 0, TAU);
    g.ellipse(x - 14 * s, y - 5 * s, 14 * s, 9 * s, 0, 0, TAU);
    g.ellipse(x + 10 * s, y - 8 * s, 16 * s, 11 * s, 0, 0, TAU);
    g.fill();
  }
  function pine(g, x, base, h, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x, base - h);
    g.lineTo(x + h * 0.26, base - h * 0.45);
    g.lineTo(x + h * 0.16, base - h * 0.45);
    g.lineTo(x + h * 0.36, base);
    g.lineTo(x - h * 0.36, base);
    g.lineTo(x - h * 0.16, base - h * 0.45);
    g.lineTo(x - h * 0.26, base - h * 0.45);
    g.closePath();
    g.fill();
  }

  /* ---- ice shelf ---- */
  function iceTop(g) {
    var gr = g.createLinearGradient(0, ICE_BACK, 0, ICE_EDGE);
    gr.addColorStop(0, "#dfe9f1");
    gr.addColorStop(0.5, "#f4f8fb");
    gr.addColorStop(1, "#fbfdfe");
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, ICE_EDGE);
    g.lineTo(0, 108);
    g.bezierCurveTo(60, 102, 120, 107, 200, 105);
    g.bezierCurveTo(300, 103, 380, 108, 470, 106);
    g.bezierCurveTo(560, 104, 680, 108, 800, 105);
    g.lineTo(800, ICE_EDGE);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(20,32,43,0.35)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, 108);
    g.bezierCurveTo(60, 102, 120, 107, 200, 105);
    g.bezierCurveTo(300, 103, 380, 108, 470, 106);
    g.bezierCurveTo(560, 104, 680, 108, 800, 105);
    g.stroke();

    // snow tufts + shadows
    var i, x;
    for (i = 0; i < 9; i++) {
      x = 30 + i * 92 + rnd(i + 9) * 30;
      if (Math.abs(x - HOLE.x) < 60) continue;
      ell(g, x, 111 + rnd(i) * 3, 14 + rnd(i + 2) * 10, 2.2);
      g.fillStyle = "rgba(185,207,221,0.55)";
      g.fill();
    }
    // front edge highlight
    g.fillStyle = "#ffffff";
    g.fillRect(0, ICE_EDGE - 2.5, W, 2.5);
  }

  function iceFacePath(g, x0, x1) {
    var x, step = 16;
    g.beginPath();
    g.moveTo(x0, ICE_EDGE);
    g.lineTo(x1, ICE_EDGE);
    g.lineTo(x1, ICE_Y);
    for (x = x1; x > x0; x -= step) {
      g.lineTo(Math.max(x0, x - step * 0.5), ICE_Y + 1.5 + rnd(x * 0.37) * 2.5);
      g.lineTo(Math.max(x0, x - step), ICE_Y);
    }
    g.lineTo(x0, ICE_Y);
    g.closePath();
  }
  function iceFace(g, x0, x1) {
    var gr = g.createLinearGradient(0, ICE_EDGE, 0, ICE_Y + 4);
    gr.addColorStop(0, "#e6f0f6");
    gr.addColorStop(0.55, "#cfe1ec");
    gr.addColorStop(1, "#b9cfdd");
    iceFacePath(g, x0, x1);
    g.fillStyle = gr;
    g.fill();

    g.save();
    iceFacePath(g, x0, x1);
    g.clip();
    // strata
    var i, x, y;
    g.lineWidth = 1.2;
    for (i = 0; i < 4; i++) {
      y = 128 + i * 6;
      g.strokeStyle = i % 2 ? "rgba(255,255,255,0.7)" : "rgba(143,176,197,0.45)";
      g.beginPath();
      g.moveTo(x0, y);
      for (x = x0; x <= x1 + 40; x += 40) g.quadraticCurveTo(x + 20, y + (rnd(x + i) - 0.5) * 3, x + 40, y);
      g.stroke();
    }
    // gloss streaks
    g.fillStyle = "rgba(255,255,255,0.45)";
    for (x = x0 + 20; x < x1; x += 120) {
      g.beginPath();
      g.moveTo(x, ICE_EDGE);
      g.lineTo(x + 10, ICE_EDGE);
      g.lineTo(x - 8, ICE_Y);
      g.lineTo(x - 18, ICE_Y);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(x + 16, ICE_EDGE);
      g.lineTo(x + 19, ICE_EDGE);
      g.lineTo(x + 1, ICE_Y);
      g.lineTo(x - 2, ICE_Y);
      g.closePath();
      g.fill();
    }
    // trapped bubbles
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 1;
    for (i = 0; i < 30; i++) {
      x = x0 + rnd(i * 3.1 + x0) * (x1 - x0);
      y = 127 + rnd(i * 7.3 + x0) * 19;
      ell(g, x, y, 1 + rnd(i) * 1.4, 1 + rnd(i) * 1.4);
      g.stroke();
    }
    g.restore();

    iceFacePath(g, x0, x1);
    ink(g);
    g.stroke();
  }
  function icicles(g, x0, x1) {
    var x, h;
    for (x = x0 + 14; x < x1 - 8; x += 26 + rnd(x) * 30) {
      h = 4 + rnd(x + 3) * 7;
      g.beginPath();
      g.moveTo(x - 3.5, ICE_Y);
      g.lineTo(x, ICE_Y + h);
      g.lineTo(x + 3.5, ICE_Y);
      g.closePath();
      g.fillStyle = "#c6dbe8";
      g.fill();
      ink(g, 1.6);
      g.stroke();
    }
  }
  function shaftPath(g) {
    g.beginPath();
    g.moveTo(SHAFT_L, ICE_Y);
    g.lineTo(SHAFT_L, 114);
    g.ellipse(HOLE.x, 114, HOLE.rx, 7, 0, Math.PI, TAU);
    g.lineTo(SHAFT_R, ICE_Y);
    g.closePath();
  }
  function shaft(g) {
    var gr = g.createLinearGradient(SHAFT_L, 0, SHAFT_R, 0);
    gr.addColorStop(0, "#3f6f92");
    gr.addColorStop(0.4, "#6f9dbd");
    gr.addColorStop(0.65, "#6593b4");
    gr.addColorStop(1, "#3a6789");
    g.fillStyle = gr;
    shaftPath(g);
    g.fill();
    g.save();
    shaftPath(g);
    g.clip();
    // shadow under the rim
    var dg = g.createLinearGradient(0, 107, 0, 132);
    dg.addColorStop(0, "rgba(20,45,70,0.55)");
    dg.addColorStop(1, "rgba(20,45,70,0)");
    g.fillStyle = dg;
    g.fillRect(SHAFT_L, 107, HOLE.rx * 2, 25);
    // light from below
    var lg = g.createLinearGradient(0, 130, 0, ICE_Y);
    lg.addColorStop(0, "rgba(150,210,240,0)");
    lg.addColorStop(1, "rgba(150,210,240,0.5)");
    g.fillStyle = lg;
    g.fillRect(SHAFT_L, 130, HOLE.rx * 2, ICE_Y - 130);
    // wall streaks
    g.strokeStyle = "rgba(190,225,245,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(SHAFT_L + 12, 118);
    g.lineTo(SHAFT_L + 10, ICE_Y);
    g.moveTo(SHAFT_R - 16, 119);
    g.lineTo(SHAFT_R - 15, ICE_Y);
    g.stroke();
    g.restore();
    // snow lip on the far rim
    g.beginPath();
    g.ellipse(HOLE.x, 114, HOLE.rx, 7, 0, Math.PI, TAU);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 3;
    g.stroke();
    g.beginPath();
    g.ellipse(HOLE.x, 114, HOLE.rx + 1.5, 8.5, 0, Math.PI, TAU);
    ink(g, 2);
    g.stroke();
    // shaft walls
    ink(g);
    g.beginPath();
    g.moveTo(SHAFT_L, ICE_EDGE - 1);
    g.lineTo(SHAFT_L, ICE_Y);
    g.moveTo(SHAFT_R, ICE_EDGE - 1);
    g.lineTo(SHAFT_R, ICE_Y);
    g.stroke();
  }

  /* ---- water ---- */
  function drawWater(g) {
    var gr = g.createLinearGradient(0, ICE_Y, 0, H);
    gr.addColorStop(0, "#6fb3d6");
    gr.addColorStop(0.4, "#4a8fbf");
    gr.addColorStop(1, "#1f4e79");
    g.fillStyle = gr;
    g.fillRect(0, ICE_Y, W, H - ICE_Y);

    // shade under ice
    var sg = g.createLinearGradient(0, ICE_Y, 0, ICE_Y + 40);
    sg.addColorStop(0, "rgba(16,48,82,0.32)");
    sg.addColorStop(1, "rgba(16,48,82,0)");
    g.fillStyle = sg;
    g.fillRect(0, ICE_Y, W, 40);
    // glow under hole
    var hg = g.createRadialGradient(HOLE.x, ICE_Y, 4, HOLE.x, ICE_Y + 20, 110);
    hg.addColorStop(0, "rgba(220,244,255,0.5)");
    hg.addColorStop(1, "rgba(220,244,255,0)");
    g.fillStyle = hg;
    g.fillRect(HOLE.x - 120, ICE_Y, 240, 130);

    // seabed
    g.fillStyle = "#183f63";
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, 488);
    g.bezierCurveTo(120, 480, 220, 492, 340, 486);
    g.bezierCurveTo(460, 480, 560, 490, 680, 484);
    g.bezierCurveTo(740, 481, 780, 486, 800, 484);
    g.lineTo(800, H);
    g.closePath();
    g.fill();
    rock(g, 70, 490, 26, 14);
    rock(g, 96, 493, 14, 8);
    rock(g, 300, 491, 20, 11);
    rock(g, 640, 488, 30, 15);
    rock(g, 676, 492, 13, 7);
    var i;
    g.fillStyle = "rgba(120,170,200,0.25)";
    for (i = 0; i < 26; i++) {
      ell(g, rnd(i + 70) * W, 490 + rnd(i + 90) * 9, 2 + rnd(i) * 2, 1.2);
      g.fill();
    }
  }
  function rock(g, x, y, rx, ry) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, Math.PI, TAU);
    g.closePath();
    g.fillStyle = "#24527c";
    g.fill();
    g.strokeStyle = "rgba(20,32,43,0.55)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "rgba(160,200,225,0.25)";
    g.beginPath();
    g.ellipse(x - rx * 0.3, y - ry * 0.6, rx * 0.35, ry * 0.18, -0.2, 0, TAU);
    g.fill();
  }

  function staticScene(g) {
    drawSky(g);
    iceTop(g);
    drawWater(g);
    shaft(g);
    iceFace(g, -4, SHAFT_L);
    iceFace(g, SHAFT_R, W + 4);
    icicles(g, 0, SHAFT_L);
    icicles(g, SHAFT_R, W);
  }

  /* ---- animated ambience ---- */
  function weeds(g, t) {
    var xs = [36, 52, 210, 228, 410, 560, 590, 742, 760], i, x, h, sw, k, y;
    for (i = 0; i < xs.length; i++) {
      x = xs[i];
      h = 34 + rnd(i + 20) * 34;
      sw = Math.sin(t * 1.2 + i * 1.7) * 7;
      g.beginPath();
      g.moveTo(x - 4, 494);
      for (k = 1; k <= 4; k++) {
        y = 494 - h * k / 4;
        g.lineTo(x - 4 + (4 - k) + sw * k * k / 16 + Math.sin(k * 1.4 + i) * 3, y);
      }
      for (k = 4; k >= 0; k--) {
        y = 494 - h * k / 4;
        g.lineTo(x + 4 - k * 0.9 + sw * k * k / 16 + Math.sin(k * 1.4 + i) * 3, y);
      }
      g.closePath();
      g.fillStyle = i % 2 ? "#2e7466" : "#25645a";
      g.fill();
      g.strokeStyle = "rgba(20,32,43,0.5)";
      g.lineWidth = 1.8;
      g.lineJoin = "round";
      g.stroke();
    }
  }
  function rays(g, t) {
    var a = 0.09 + Math.sin(t * 0.7) * 0.035, i, x, w, k;
    g.save();
    g.fillStyle = "rgba(235,250,255," + a.toFixed(3) + ")";
    g.beginPath();
    g.moveTo(HOLE.x - 30, ICE_Y);
    g.lineTo(HOLE.x + 30, ICE_Y);
    g.lineTo(HOLE.x + 120 + Math.sin(t * 0.5) * 14, H);
    g.lineTo(HOLE.x - 80 + Math.sin(t * 0.5) * 14, H);
    g.closePath();
    g.fill();
    for (i = 0; i < 4; i++) {
      x = [120, 270, 650, 740][i];
      w = 18 + i * 4;
      k = 0.045 + Math.sin(t * 0.9 + i * 2.1) * 0.025;
      g.fillStyle = "rgba(235,250,255," + Math.max(0, k).toFixed(3) + ")";
      g.beginPath();
      g.moveTo(x, ICE_Y);
      g.lineTo(x + w, ICE_Y);
      g.lineTo(x + w + 70, H - 40);
      g.lineTo(x + 30, H - 40);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
  function bubbles(g, t) {
    var i, x, y, r, sp;
    g.lineWidth = 1.3;
    for (i = 0; i < 16; i++) {
      sp = 16 + rnd(i + 3) * 22;
      y = H - 12 - ((t * sp + rnd(i + 7) * 400) % 340);
      if (y < ICE_Y + 8) continue;
      x = rnd(i) * W + Math.sin(t * 1.6 + i) * 4;
      r = 1.4 + rnd(i + 11) * 2.4;
      ell(g, x, y, r, r);
      g.strokeStyle = "rgba(230,248,255,0.6)";
      g.stroke();
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.fillRect(x - r * 0.45, y - r * 0.55, r * 0.4, r * 0.4);
    }
  }
  function snow(g, t) {
    var i, x, y, r;
    g.fillStyle = "rgba(255,255,255,0.95)";
    for (i = 0; i < 30; i++) {
      x = (rnd(i) * W + t * (6 + rnd(i + 1) * 8) + Math.sin(t * 0.8 + i) * 8) % W;
      y = (rnd(i + 2) * 110 + t * (10 + rnd(i + 3) * 10)) % 112 - 4;
      r = 1.1 + rnd(i + 4) * 1.4;
      ell(g, x, y, r, r);
      g.fill();
    }
  }

  function background(g, t) {
    layer(g, "bg", 0, 0, W, H, staticScene);
    rays(g, t);
    weeds(g, t);
    bubbles(g, t);
    snow(g, t);
  }

  /* ---- surface overlay ---- */
  function surfaceStatic(g) {
    iceFace(g, -4, SHAFT_L);
    iceFace(g, SHAFT_R, W + 4);
    icicles(g, 0, SHAFT_L);
    icicles(g, SHAFT_R, W);
  }
  function surface(g, t) {
    layer(g, "surf", 0, ICE_EDGE - 4, W, 44, surfaceStatic);
    // water in the hole
    g.save();
    ell(g, HOLE.x, HOLE.y, HOLE.rx - 1, HOLE.ry);
    g.fillStyle = "rgba(200,236,252,0.28)";
    g.fill();
    g.strokeStyle = "rgba(240,250,255,0.9)";
    g.lineWidth = 1.6;
    g.stroke();
    var k, p;
    for (k = 0; k < 2; k++) {
      p = (t * 0.55 + k * 0.5) % 1;
      ell(g, HOLE.x, HOLE.y, (HOLE.rx - 4) * (0.25 + p * 0.75), HOLE.ry * (0.25 + p * 0.75));
      g.strokeStyle = "rgba(255,255,255," + (0.6 * (1 - p)).toFixed(3) + ")";
      g.lineWidth = 1.2;
      g.stroke();
    }
    g.restore();
  }

  /* ---- crate ---- */
  var PILE = [
    [96, 75, -0.15, 0], [128, 76, 0.1, 0], [160, 75, -0.05, 1], [190, 74, 0.2, 0],
    [110, 68, 0.2, 0], [142, 67, -0.12, 2], [176, 68, 0.15, 0], [92, 66, -0.35, 0],
    [124, 60, -0.1, 0], [156, 59, 0.12, 1], [190, 63, 0.4, 0],
    [138, 53, 0.18, 0], [170, 53, -0.2, 0], [108, 56, -0.3, 0],
    [152, 47, -0.06, 2], [124, 48, 0.1, 0]
  ];
  function crateStatic(count) {
    return function (g) {
      var n = Math.min(count, PILE.length), i, p;
      // inner back
      g.fillStyle = "#5b3b20";
      g.beginPath();
      g.moveTo(72, 76);
      g.lineTo(80, 68);
      g.lineTo(200, 68);
      g.lineTo(208, 76);
      g.closePath();
      g.fill();
      ink(g);
      g.stroke();
      // pile
      for (i = 0; i < n; i++) {
        p = PILE[i];
        g.save();
        g.translate(p[0], p[1]);
        g.rotate(p[2]);
        if (i % 2) g.scale(-1, 1);
        if (p[3] === 1) { g.scale(0.38, 0.38); drawGrouper(g, 0.1, false, 0); }
        else if (p[3] === 2) { g.scale(0.3, 0.3); drawSword(g, 0.1, false, 0); }
        else { g.scale(0.48, 0.48); drawTuna(g, 0.15, false, 0); }
        g.restore();
      }
      // spill on the ice
      if (count > PILE.length) {
        g.save();
        g.translate(236, 113);
        g.rotate(0.08);
        g.scale(0.5, 0.5);
        drawTuna(g, 0.2, false, 0);
        g.restore();
      }
      if (count > PILE.length + 6) {
        g.save();
        g.translate(50, 114);
        g.rotate(-0.05);
        g.scale(-0.42, 0.42);
        drawGrouper(g, 0.2, false, 0);
        g.restore();
      }
      // shadow
      ell(g, 140, 119, 76, 4);
      g.fillStyle = "rgba(120,150,175,0.35)";
      g.fill();
      // front boards
      var gr = g.createLinearGradient(0, 74, 0, 119);
      gr.addColorStop(0, "#c88b4e");
      gr.addColorStop(1, "#a96c36");
      g.fillStyle = gr;
      g.beginPath();
      g.rect(72, 74, 136, 45);
      g.fill();
      g.strokeStyle = "rgba(20,32,43,0.55)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(72, 89);
      g.lineTo(208, 89);
      g.moveTo(72, 104);
      g.lineTo(208, 104);
      g.stroke();
      // grain
      g.strokeStyle = "rgba(110,62,24,0.35)";
      g.lineWidth = 1;
      for (i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(84 + i * 21, 78 + (i % 3) * 15);
        g.quadraticCurveTo(94 + i * 21, 76 + (i % 3) * 15, 104 + i * 21, 79 + (i % 3) * 15);
        g.stroke();
      }
      // corner posts
      g.fillStyle = "#8f5a2b";
      g.fillRect(72, 74, 10, 45);
      g.fillRect(198, 74, 10, 45);
      g.fillStyle = "rgba(255,230,190,0.35)";
      g.fillRect(74, 76, 2, 41);
      g.fillRect(200, 76, 2, 41);
      // nails
      g.fillStyle = INK;
      for (i = 0; i < 3; i++) {
        g.fillRect(76, 80 + i * 15, 2, 2);
        g.fillRect(202, 80 + i * 15, 2, 2);
      }
      g.beginPath();
      g.rect(72, 74, 136, 45);
      ink(g);
      g.stroke();
      g.beginPath();
      g.moveTo(82, 74);
      g.lineTo(82, 119);
      g.moveTo(198, 74);
      g.lineTo(198, 119);
      g.lineWidth = 1.8;
      g.stroke();
      // painted count
      var label = count + " FISH";
      var fsz = label.length > 7 ? 15 : 17;
      g.save();
      g.translate(140, 98);
      g.rotate(-0.03);
      g.font = "bold " + fsz + "px \"Trebuchet MS\", Verdana, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(60,30,10,0.35)";
      g.fillText(label, 1, 1.5);
      g.fillStyle = "#f6ecd2";
      g.fillText(label, 0, 0);
      g.restore();
    };
  }
  function crate(g, count) {
    count = Math.max(0, Math.floor(count || 0));
    layer(g, "crate" + count, 10, 20, 260, 104, crateStatic(count));
  }

  /* ---- worm can ---- */
  function canStatic(g) {
    ell(g, 722, 119, 20, 3.5);
    g.fillStyle = "rgba(120,150,175,0.35)";
    g.fill();
    // lid flap
    g.beginPath();
    g.moveTo(735, 97);
    g.quadraticCurveTo(748, 84, 744, 76);
    g.quadraticCurveTo(733, 82, 731, 96);
    g.closePath();
    fs(g, "#c9d3da", 2);
    // body
    var gr = g.createLinearGradient(708, 0, 736, 0);
    gr.addColorStop(0, "#8e9aa4");
    gr.addColorStop(0.35, "#dfe6eb");
    gr.addColorStop(1, "#7f8b95");
    g.beginPath();
    g.moveTo(708, 97);
    g.lineTo(708, 117);
    g.ellipse(722, 117, 14, 3, 0, Math.PI, 0, true);
    g.lineTo(736, 97);
    g.closePath();
    g.fillStyle = gr;
    g.fill();
    // label
    g.fillStyle = "#c8463c";
    g.fillRect(708, 101, 28, 11);
    g.fillStyle = "#f2c14e";
    g.fillRect(708, 101, 28, 2);
    g.fillRect(708, 110, 28, 2);
    g.strokeStyle = "#f9b8c0";
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(713, 107);
    g.quadraticCurveTo(717, 103, 721, 107);
    g.quadraticCurveTo(725, 111, 730, 106);
    g.stroke();
    g.beginPath();
    g.moveTo(708, 97);
    g.lineTo(708, 117);
    g.ellipse(722, 117, 14, 3, 0, Math.PI, 0, true);
    g.lineTo(736, 97);
    ink(g);
    g.stroke();
    // rim + dirt
    ell(g, 722, 97, 14, 3.5);
    fs(g, "#5a3a22", 2.2);
    g.fillStyle = "#7a5233";
    ell(g, 719, 97, 6, 1.4);
    g.fill();
  }
  function worm(g, pts, w) {
    var i;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length - 1; i++) {
      g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = INK;
    g.lineWidth = w + 2.4;
    g.stroke();
    g.strokeStyle = "#ef8f9c";
    g.lineWidth = w;
    g.stroke();
    g.strokeStyle = "rgba(255,220,226,0.8)";
    g.lineWidth = Math.max(1, w * 0.3);
    g.stroke();
  }
  function wormCan(g, t) {
    layer(g, "can", 700, 70, 52, 54, canStatic);
    var s = Math.sin(t * 2.4), s2 = Math.sin(t * 3.1 + 1);
    // worm peeking out
    worm(g, [[718, 98], [717 + s * 1.5, 92], [719 + s * 4, 86], [721 + s * 6, 82]], 4);
    var hx = 721 + s * 6, hy = 82;
    g.fillStyle = INK;
    g.fillRect(hx - 1.6 + s * 0.4, hy - 1.4, 1.4, 1.4);
    g.fillRect(hx + 0.6 + s * 0.4, hy - 1.2, 1.4, 1.4);
    // worm over the rim
    worm(g, [[725, 97], [730, 94], [735, 95 + s2], [737, 100 + s2 * 1.5]], 3.5);
  }

  /* ---- boy ---- */
  var SKIN = "#f3c9a4", SKIN_SH = "#e2a984", HAIR = "#2b2421";
  var JACKET = "#d6503e", JACKET_SH = "#ad3a2c", SCARF = "#e8b84a", SCARF_SH = "#c48d2a";
  var BEANIE = "#3f7f84", BEANIE_SH = "#2f6266", MITT = "#3f7f84", PANTS = "#2e3d55";
  var ROD_BUTT = { x: 613, y: 89 };

  function rodPt(u, bend) {
    var cx = (ROD_BUTT.x + ROD_TIP.x) / 2 + 0.406 * bend * 2;
    var cy = (ROD_BUTT.y + ROD_TIP.y) / 2 - 0.914 * bend * 2;
    var a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    return [a * ROD_BUTT.x + b * cx + c * ROD_TIP.x, a * ROD_BUTT.y + b * cy + c * ROD_TIP.y];
  }
  function drawRod(g, bend) {
    var cx = (ROD_BUTT.x + ROD_TIP.x) / 2 + 0.406 * bend * 2;
    var cy = (ROD_BUTT.y + ROD_TIP.y) / 2 - 0.914 * bend * 2;
    var h = rodPt(0.26, bend), i, p;
    // blank
    g.beginPath();
    g.moveTo(ROD_BUTT.x, ROD_BUTT.y);
    g.quadraticCurveTo(cx, cy, ROD_TIP.x, ROD_TIP.y);
    g.lineCap = "round";
    g.strokeStyle = INK;
    g.lineWidth = 4.2;
    g.stroke();
    g.strokeStyle = "#3c5a74";
    g.lineWidth = 1.8;
    g.stroke();
    // guides
    for (i = 0; i < 3; i++) {
      p = rodPt(0.45 + i * 0.2, bend);
      ell(g, p[0] - 0.5, p[1] + 2.2, 1.6, 1.6);
      ink(g, 1.3);
      g.stroke();
    }
    ell(g, ROD_TIP.x, ROD_TIP.y, 1.6, 1.6);
    g.fillStyle = "#f2c14e";
    g.fill();
    ink(g, 1.2);
    g.stroke();
    // cork handle
    g.beginPath();
    g.moveTo(ROD_BUTT.x + 1, ROD_BUTT.y + 0.5);
    g.lineTo(h[0], h[1]);
    g.strokeStyle = INK;
    g.lineWidth = 7.5;
    g.stroke();
    g.strokeStyle = "#c99a5e";
    g.lineWidth = 3.5;
    g.stroke();
  }
  function reel(g, a) {
    var r = rodPt(0.15, 0);
    var rx = r[0] - 0.406 * 6, ry = r[1] + 0.914 * 6;
    ell(g, rx, ry, 5, 5);
    fs(g, "#9aa6ae", 2);
    ell(g, rx, ry, 1.6, 1.6);
    g.fillStyle = INK;
    g.fill();
    var hx = rx + Math.cos(a) * 5, hy = ry + Math.sin(a) * 5;
    g.beginPath();
    g.moveTo(rx, ry);
    g.lineTo(hx, hy);
    ink(g, 1.8);
    g.stroke();
    return [hx, hy];
  }
  function mitten(g, x, y, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    ell(g, 0, 0, 5.6, 5);
    fs(g, MITT);
    g.beginPath();
    g.ellipse(-3.6, -3, 2.4, 2, -0.6, 0, TAU);
    fs(g, MITT, 2);
    g.fillStyle = "#e9f0f3";
    g.fillRect(3.2, -4.2, 2.6, 8.4);
    g.restore();
  }

  function boy(g, t, mood) {
    mood = mood || "idle";
    var bob, lx = 0, ly = 0, bend = 1.2, i;
    if (mood === "reel") {
      bob = Math.sin(t * 9) * 0.8;
      lx = 3;
      ly = -1;
      bend = 6 + Math.sin(t * 9) * 1.2;
    } else if (mood === "cheer") {
      bob = -Math.abs(Math.sin(t * 8)) * 3;
      bend = 2;
    } else if (mood === "sad") {
      bob = Math.sin(t * 1.4) * 0.6;
      lx = -2;
      ly = 3;
    } else {
      bob = Math.sin(t * 2.2) * 0.9;
    }
    var ox = lx, oy = ly + bob;
    var blink = (t % 3.7) < 0.12 || ((t + 1.1) % 7.3) < 0.1;

    // bucket
    ell(g, 632, 119, 32, 3.6);
    g.fillStyle = "rgba(120,150,175,0.35)";
    g.fill();
    var bg = g.createLinearGradient(610, 0, 654, 0);
    bg.addColorStop(0, "#557a96");
    bg.addColorStop(0.35, "#8fb0c6");
    bg.addColorStop(1, "#4b6c86");
    g.beginPath();
    g.moveTo(615, 93);
    g.lineTo(649, 93);
    g.lineTo(654, 118);
    g.lineTo(610, 118);
    g.closePath();
    g.fillStyle = bg;
    g.fill();
    ink(g);
    g.stroke();
    g.beginPath();
    g.rect(608.5, 112, 47, 6.5);
    fs(g, "#6f92ab", 2);
    g.strokeStyle = "rgba(20,32,43,0.4)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(616.5, 100);
    g.lineTo(647.5, 100);
    g.stroke();
    // bucket handle
    g.beginPath();
    g.moveTo(612, 108);
    g.quadraticCurveTo(600, 112, 606, 117);
    ink(g, 1.6);
    g.stroke();

    // far leg
    limb(g, [[634, 92], [610 + ox * 0.3, 88], [608, 112]], 11, "#26334a");
    g.beginPath();
    g.moveTo(598, 119);
    g.quadraticCurveTo(598, 110, 606, 109);
    g.lineTo(612, 109);
    g.lineTo(613, 119);
    g.closePath();
    fs(g, "#5b3f28", 2.2);
    // near leg
    limb(g, [[632, 94], [602 + ox * 0.3, 89], [598, 112]], 13, PANTS);
    g.strokeStyle = "rgba(255,255,255,0.15)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(626, 90);
    g.lineTo(606, 86);
    g.stroke();
    // boot
    g.beginPath();
    g.moveTo(585, 119);
    g.quadraticCurveTo(584, 109, 594, 108);
    g.lineTo(604, 108);
    g.lineTo(606, 119);
    g.closePath();
    fs(g, "#6b4a2e");
    g.fillStyle = "#3b2a1c";
    g.fillRect(585, 116.5, 21, 2.5);
    g.fillStyle = "#e9f0f3";
    g.fillRect(593, 106, 12, 3.5);

    // jacket
    g.save();
    g.translate(ox, oy);
    var jp = function () {
      g.beginPath();
      g.moveTo(617, 64);
      g.bezierCurveTo(607, 70, 605, 86, 612, 97);
      g.quadraticCurveTo(630, 102, 648, 96);
      g.bezierCurveTo(653, 84, 651, 70, 641, 63);
      g.quadraticCurveTo(629, 59, 617, 64);
      g.closePath();
    };
    jp();
    g.fillStyle = JACKET;
    g.fill();
    g.save();
    jp();
    g.clip();
    g.fillStyle = JACKET_SH;
    g.beginPath();
    g.ellipse(650, 82, 12, 26, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.beginPath();
    g.ellipse(616, 74, 4, 12, 0.1, 0, TAU);
    g.fill();
    // quilting
    g.strokeStyle = "rgba(20,32,43,0.45)";
    g.lineWidth = 1.5;
    for (i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(604, 74 + i * 8);
      g.quadraticCurveTo(630, 78 + i * 8, 656, 74 + i * 8);
      g.stroke();
    }
    // zipper
    g.strokeStyle = "rgba(20,32,43,0.6)";
    g.beginPath();
    g.moveTo(619, 66);
    g.quadraticCurveTo(613, 82, 616, 99);
    g.stroke();
    g.restore();
    jp();
    ink(g);
    g.stroke();

    // scarf tail
    var sw = Math.sin(t * 2.6) * 1.5;
    g.translate(0, 4);
    g.beginPath();
    g.moveTo(634, 58);
    g.quadraticCurveTo(642 + sw, 66, 640 + sw, 78);
    g.lineTo(647 + sw, 76);
    g.quadraticCurveTo(648 + sw, 64, 640, 56);
    g.closePath();
    fs(g, SCARF);
    g.fillStyle = SCARF_SH;
    g.fillRect(639 + sw, 69, 7, 2.5);
    g.strokeStyle = SCARF;
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(641 + sw, 78);
    g.lineTo(640.5 + sw, 81);
    g.moveTo(644 + sw, 77.5);
    g.lineTo(644 + sw, 80.5);
    g.stroke();
    g.restore();

    // head
    var hx = 624 + ox, hy = 42 + oy, tilt = 0;
    if (mood === "sad") { hx -= 1; tilt = -0.1; }
    if (mood === "cheer") tilt = 0.08;
    g.save();
    g.translate(hx, hy + 14);
    g.rotate(tilt);
    g.scale(1.1, 1.1);
    g.translate(0, -14);
    drawHead(g, t, mood, blink);
    g.restore();
    // sweat drop
    if (mood === "sad") {
      var dy = (t * 0.8) % 1 * 6;
      g.beginPath();
      g.moveTo(hx + 19, hy - 8 + dy);
      g.quadraticCurveTo(hx + 23, hy - 2 + dy, hx + 19, hy + dy);
      g.quadraticCurveTo(hx + 15, hy - 2 + dy, hx + 19, hy - 8 + dy);
      fs(g, "#bfe6f7", 1.6);
    }

    // scarf wrap
    g.save();
    g.translate(ox, oy + 4);
    g.beginPath();
    g.moveTo(610, 52);
    g.quadraticCurveTo(625, 59, 641, 51);
    g.quadraticCurveTo(645, 56, 641, 61);
    g.quadraticCurveTo(625, 67, 611, 61);
    g.quadraticCurveTo(607, 56, 610, 52);
    g.closePath();
    fs(g, SCARF);
    g.strokeStyle = SCARF_SH;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(618, 56.5);
    g.lineTo(617, 63.5);
    g.moveTo(628, 57);
    g.lineTo(628, 64.5);
    g.moveTo(637, 54.5);
    g.lineTo(638, 62.5);
    g.stroke();
    g.restore();

    // arms + rod
    var sA = [620 + ox, 69 + oy], sB = [637 + ox, 69 + oy];
    if (mood === "cheer") sB = [641 + ox, 68 + oy];
    var hA = rodPt(0.32, bend), hB = rodPt(0.07, bend);
    var cr = null;
    if (mood === "cheer") {
      var wav = Math.sin(t * 10) * 3;
      limb(g, [sB, [653 + ox, 50 + oy], [656 + ox + wav, 27 + oy]], 10, JACKET);
    }
    limb(g, [sA, [604, 82], [hA[0] + 2, hA[1] + 1]], 10, JACKET);
    if (mood !== "cheer") {
      if (mood === "reel") {
        drawRod(g, bend);
        cr = reel(g, t * 14);
        limb(g, [sB, [644 + ox, 84], [cr[0] + 2, cr[1] + 2]], 10, JACKET);
      } else if (mood === "sad") {
        limb(g, [sB, [642 + ox, 82 + oy * 0.5], [612, 92]], 10, JACKET);
      } else {
        limb(g, [sB, [643 + ox, 84], [hB[0] + 2, hB[1] + 2]], 10, JACKET);
      }
    }
    if (mood !== "reel") {
      drawRod(g, bend);
      reel(g, 1.2);
    }
    mitten(g, hA[0], hA[1] + 1, -0.4);
    if (mood === "cheer") {
      mitten(g, 656 + ox + Math.sin(t * 10) * 3, 23 + oy, -1.3);
    } else if (mood === "reel") {
      mitten(g, cr[0] + 1, cr[1] + 1, 0.2);
    } else if (mood === "sad") {
      mitten(g, 611, 93, 0.3);
    } else {
      mitten(g, hB[0], hB[1] + 1, -0.4);
    }
  }

  function drawHead(g, t, mood, blink) {
    // hair back
    g.beginPath();
    g.moveTo(4, -10);
    g.bezierCurveTo(18, -8, 19, 8, 12, 14);
    g.lineTo(6, 6);
    g.closePath();
    fs(g, HAIR);
    // head
    ell(g, 0, 0, 15.5, 16.5);
    g.fillStyle = SKIN;
    g.fill();
    g.save();
    ell(g, 0, 0, 15.5, 16.5);
    g.clip();
    g.fillStyle = SKIN_SH;
    ell(g, 12, 6, 8, 14);
    g.fill();
    g.fillStyle = HAIR;
    g.beginPath();
    g.moveTo(4, -10);
    g.bezierCurveTo(16, -8, 18, 4, 16, 10);
    g.lineTo(9, 6);
    g.quadraticCurveTo(8, -2, 2, -6);
    g.closePath();
    g.fill();
    g.restore();
    ell(g, 0, 0, 15.5, 16.5);
    ink(g);
    g.stroke();
    // ear
    ell(g, 11, 3, 3.6, 4.4);
    fs(g, SKIN, 2);
    g.beginPath();
    g.arc(11.3, 3, 1.6, -1.2, 1.4);
    g.strokeStyle = SKIN_SH;
    g.lineWidth = 1.2;
    g.stroke();
    // sideburn
    g.fillStyle = HAIR;
    g.beginPath();
    g.moveTo(5, -6);
    g.lineTo(9, -6);
    g.lineTo(8, 1);
    g.closePath();
    g.fill();

    // cheek blush
    ell(g, -2, 9, 3.6, 2.2);
    g.fillStyle = "rgba(232,120,110,0.4)";
    g.fill();
    // nose
    g.beginPath();
    g.moveTo(-9, 2);
    g.quadraticCurveTo(-15, 6, -10, 8.5);
    g.strokeStyle = SKIN_SH;
    g.lineWidth = 2;
    g.lineCap = "round";
    g.stroke();

    // mouth
    ink(g, 2);
    g.beginPath();
    if (mood === "cheer") {
      g.moveTo(-12, 10);
      g.quadraticCurveTo(-5.5, 20, 1, 10.5);
      g.closePath();
      g.fillStyle = "#7a2b2b";
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = "#ffffff";
      g.fillRect(-13, 9, 16, 3);
      g.fillStyle = "#e7787a";
      ell(g, -5.5, 17, 4, 2.6);
      g.fill();
      g.restore();
      g.stroke();
    } else if (mood === "sad") {
      g.moveTo(-10.5, 13.5);
      g.quadraticCurveTo(-5.5, 9.5, -0.5, 13);
      g.stroke();
    } else if (mood === "reel") {
      g.moveTo(-10, 12.5);
      g.lineTo(-1.5, 12);
      g.stroke();
      g.beginPath();
      g.moveTo(-2, 10.5);
      g.lineTo(-0.5, 13.5);
      g.lineWidth = 1.5;
      g.stroke();
    } else {
      g.moveTo(-10.5, 11);
      g.quadraticCurveTo(-5.5, 15.5, -0.5, 11);
      g.stroke();
    }

    // eyes
    var px = mood === "sad" ? -1 : -1.2, py = mood === "sad" ? 1.6 : 1;
    if (blink && mood !== "cheer") {
      ink(g, 1.8);
      g.beginPath();
      g.moveTo(-15, 4);
      g.lineTo(-10, 4);
      g.moveTo(-2.5, 4);
      g.lineTo(3, 4);
      g.stroke();
    } else if (mood === "cheer") {
      ink(g, 1.8);
      g.beginPath();
      g.moveTo(-15, 4.5);
      g.quadraticCurveTo(-12.5, 1, -10, 4.5);
      g.moveTo(-2.5, 4.5);
      g.quadraticCurveTo(0.2, 1, 3, 4.5);
      g.stroke();
    } else {
      g.fillStyle = INK;
      ell(g, -12.5 + px, 3.2 + py, 1.9, 2.2);
      g.fill();
      ell(g, 0.2 + px, 3.2 + py, 2, 2.3);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillRect(-12.6 + px, 2 + py, 0.9, 0.9);
      g.fillRect(0.2 + px, 2 + py, 0.9, 0.9);
    }

    // glasses
    g.fillStyle = "rgba(210,236,250,0.28)";
    ell(g, -12.5, 3.5, 5.4, 5.6);
    g.fill();
    ell(g, 0.5, 3.5, 6.2, 6.4);
    g.fill();
    ink(g, 2.6);
    ell(g, -12.5, 3.5, 5.4, 5.6);
    g.stroke();
    ell(g, 0.5, 3.5, 6.2, 6.4);
    g.stroke();
    g.beginPath();
    g.moveTo(-7.2, 2.6);
    g.quadraticCurveTo(-6.3, 1.4, -5.6, 2.6);
    g.stroke();
    g.beginPath();
    g.moveTo(6.6, 2.4);
    g.lineTo(10.5, 1.6);
    g.lineWidth = 2;
    g.stroke();
    // glint
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(1.8, -0.6);
    g.lineTo(4.2, 1.8);
    g.moveTo(-11.4, -0.2);
    g.lineTo(-9.6, 1.6);
    g.stroke();

    // brows
    ink(g, 2);
    g.beginPath();
    if (mood === "sad") {
      g.moveTo(-15.5, -2);
      g.lineTo(-10.5, -4);
      g.moveTo(-2.5, -4.5);
      g.lineTo(3.5, -2.5);
    } else if (mood === "reel") {
      g.moveTo(-15.5, -4);
      g.lineTo(-10, -2);
      g.moveTo(-3, -2.2);
      g.lineTo(3.5, -4.2);
    } else if (mood === "cheer") {
      g.moveTo(-15.5, -5);
      g.quadraticCurveTo(-13, -7, -10, -5.5);
      g.moveTo(-3, -5.8);
      g.quadraticCurveTo(0.5, -7.5, 3.5, -5.5);
    } else {
      g.moveTo(-15.5, -3.6);
      g.quadraticCurveTo(-13, -4.8, -10, -3.6);
      g.moveTo(-3, -4);
      g.quadraticCurveTo(0.5, -5.2, 3.5, -3.8);
    }
    g.stroke();

    // beanie
    var bp = function () {
      g.beginPath();
      g.moveTo(-17, -8);
      g.bezierCurveTo(-18, -31, 16, -33, 17.5, -10);
      g.closePath();
    };
    bp();
    g.fillStyle = BEANIE;
    g.fill();
    g.save();
    bp();
    g.clip();
    g.fillStyle = BEANIE_SH;
    ell(g, 14, -14, 8, 14);
    g.fill();
    g.fillStyle = SCARF;
    g.fillRect(-20, -20.5, 40, 3.5);
    g.strokeStyle = "rgba(20,32,43,0.25)";
    g.lineWidth = 1;
    var k;
    for (k = -14; k < 16; k += 4.5) {
      g.beginPath();
      g.moveTo(k, -8);
      g.lineTo(k * 0.7, -28);
      g.stroke();
    }
    g.restore();
    bp();
    ink(g);
    g.stroke();
    // cuff
    g.beginPath();
    g.moveTo(-18.5, -12.5);
    g.quadraticCurveTo(0, -17.5, 18.5, -13.5);
    g.lineTo(18.5, -7);
    g.quadraticCurveTo(0, -11, -18.5, -6);
    g.closePath();
    fs(g, BEANIE_SH);
    g.strokeStyle = "rgba(255,255,255,0.22)";
    g.lineWidth = 1.2;
    for (k = -15; k < 17; k += 4) {
      g.beginPath();
      g.moveTo(k, -14);
      g.lineTo(k, -8);
      g.stroke();
    }
    // pompom
    ell(g, 1, -27.5, 5.3, 5);
    fs(g, "#f6ecd2", 2.2);
    g.strokeStyle = "rgba(196,170,120,0.8)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-1.5, -28.5);
    g.lineTo(0.5, -25.5);
    g.moveTo(2, -30);
    g.lineTo(3.5, -27.5);
    g.stroke();
  }

  /* ---- line + hook ---- */
  function line(g, x1, y1, x2, y2, slack) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    if (ny < 0 || (Math.abs(ny) < 0.2 && nx < 0)) { nx = -nx; ny = -ny; }
    var k = clamp(slack || 0, 0, 1) * len * 0.12;
    var cx = (x1 + x2) / 2 + nx * k, cy = (y1 + y2) / 2 + ny * k;
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo(cx, cy, x2, y2);
    g.lineCap = "round";
    g.strokeStyle = "rgba(15,26,34,0.85)";
    g.lineWidth = 1.5;
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 0.6;
    g.stroke();
  }
  function hook(g, x, y, baited, t) {
    t = t || 0;
    g.save();
    g.translate(x, y);
    // sinker
    ell(g, 0, -20, 3.2, 4.2);
    fs(g, "#7b8792", 1.8);
    if (baited) {
      var a = Math.sin(t * 6), b = Math.sin(t * 7.3 + 1);
      worm(g, [[0, -6], [-5 + a, -3], [-4 + a, 4], [1, 7], [6 - b, 5], [7 - b * 2, 12 + b], [4 - b * 3, 17 + b]], 3.8);
      worm(g, [[0, -6], [5, -9 + a], [9, -6 + a * 1.5]], 3.2);
    }
    // hook
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(0, 3);
    g.quadraticCurveTo(0, 9, 5, 8);
    g.quadraticCurveTo(8.5, 7, 8, 1);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = INK;
    g.lineWidth = 3.6;
    g.stroke();
    g.strokeStyle = "#c9d3da";
    g.lineWidth = 1.6;
    g.stroke();
    g.beginPath();
    g.moveTo(8, 1);
    g.lineTo(5.5, 4);
    ink(g, 1.8);
    g.stroke();
    ell(g, 0, -15, 2, 2);
    ink(g, 1.6);
    g.stroke();
    g.restore();
  }

  /* ---- fish parts ---- */
  function eye(g, x, y, r, shock) {
    ell(g, x, y, r, r);
    fs(g, "#ffffff", 2);
    var pr = shock ? r * 0.3 : r * 0.56;
    var px = x + r * (shock ? 0.05 : 0.22), py = y + (shock ? 0 : 0.2);
    ell(g, px, py, pr, pr);
    g.fillStyle = INK;
    g.fill();
    ell(g, px + pr * 0.3, py - pr * 0.4, Math.max(0.7, pr * 0.38), Math.max(0.7, pr * 0.38));
    g.fillStyle = "#ffffff";
    g.fill();
  }
  function pec(g, x, y, len, rot, fill, edge) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(0, -2.5);
    g.bezierCurveTo(-len * 0.4, -4, -len, -2, -len, 1.5);
    g.bezierCurveTo(-len * 0.85, len * 0.42, -len * 0.3, len * 0.3, 0, 2.5);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = edge;
    g.lineWidth = 1.6;
    g.lineJoin = "round";
    g.stroke();
    g.strokeStyle = edge;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-1, 0);
    g.lineTo(-len * 0.75, 0.5);
    g.moveTo(-1, 1);
    g.lineTo(-len * 0.6, len * 0.25);
    g.stroke();
    g.restore();
  }
  function fin(g, pts, fill, w) {
    var i;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i += 2) g.quadraticCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    g.closePath();
    fs(g, fill, w);
  }

  /* ---- tuna ---- */
  function tunaBody(g) {
    g.beginPath();
    g.moveTo(33, 2);
    g.bezierCurveTo(31, -11, 8, -16, -10, -13.5);
    g.bezierCurveTo(-22, -11, -28, -4, -31, 0);
    g.bezierCurveTo(-28, 4, -22, 10, -10, 13.5);
    g.bezierCurveTo(8, 16, 30, 13, 33, 2);
    g.closePath();
  }
  function drawTuna(g, sw, shock, tt) {
    // tail
    g.save();
    g.translate(-28, 0);
    g.rotate(sw);
    fin(g, [[0, -3], [-8, -6], [-17, -15], [-12, -4], [-11, 0], [-12, 4], [-17, 15], [-8, 6], [0, 3]], "#e0a22e");
    g.restore();
    // dorsal + anal fins
    fin(g, [[4, -13], [-4, -25], [-14, -21], [-12, -16], [-13, -11]], "#c4831d");
    fin(g, [[-4, 12], [-10, 20], [-17, 17], [-15, 13], [-15, 9]], "#e0a22e", 2);
    // body
    tunaBody(g);
    g.fillStyle = "#f2c14e";
    g.fill();
    g.save();
    tunaBody(g);
    g.clip();
    g.fillStyle = "#c98a1f";
    g.beginPath();
    g.moveTo(-40, -3);
    g.bezierCurveTo(-10, -7, 12, -9, 40, -6);
    g.lineTo(40, -30);
    g.lineTo(-40, -30);
    g.closePath();
    g.fill();
    g.fillStyle = "#fbe7a6";
    ell(g, 4, 12, 30, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.4)";
    ell(g, 0, -7, 13, 2);
    g.fill();
    // finlets
    g.fillStyle = "#f2c14e";
    var i;
    for (i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(-14 - i * 5, -9 + i * 2.4);
      g.lineTo(-17 - i * 5, -12 + i * 2.4);
      g.lineTo(-18 - i * 5, -7.5 + i * 2.4);
      g.fill();
    }
    g.restore();
    tunaBody(g);
    ink(g);
    g.stroke();
    // gill
    g.beginPath();
    g.arc(4, 1, 9, -0.9, 0.9);
    g.strokeStyle = "rgba(20,32,43,0.55)";
    g.lineWidth = 1.6;
    g.stroke();
    // pectoral
    pec(g, 7, 6, 11, 0.7 + Math.sin((tt || 0) * 7) * 0.25, "rgba(255,236,170,0.9)", "#c4831d");
    eye(g, 19, -3, 6, shock);
    // mouth
    g.beginPath();
    if (shock) {
      ell(g, 30, 5, 2, 2.4);
      g.fillStyle = "#7a2b2b";
      g.fill();
      ink(g, 1.6);
      g.stroke();
    } else {
      g.moveTo(32.5, 3.5);
      g.quadraticCurveTo(29, 7, 25.5, 5.2);
      ink(g, 1.8);
      g.stroke();
    }
  }

  /* ---- grouper ---- */
  function grouperBody(g) {
    g.beginPath();
    g.moveTo(49, -5);
    g.bezierCurveTo(44, -25, 10, -30, -18, -24);
    g.bezierCurveTo(-36, -20, -46, -10, -50, -1);
    g.bezierCurveTo(-46, 10, -34, 20, -16, 24);
    g.bezierCurveTo(12, 30, 44, 22, 49, 10);
    g.closePath();
  }
  function drawGrouper(g, sw, shock, tt) {
    // tail
    g.save();
    g.translate(-46, 0);
    g.rotate(sw * 0.8);
    fin(g, [[0, -8], [-12, -18], [-22, -14], [-17, 0], [-22, 14], [-12, 18], [0, 8]], "#c94a40");
    g.strokeStyle = "rgba(20,32,43,0.35)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-3, -3);
    g.lineTo(-16, -9);
    g.moveTo(-3, 3);
    g.lineTo(-16, 9);
    g.stroke();
    g.restore();
    // dorsal fin
    g.beginPath();
    g.moveTo(14, -25);
    g.quadraticCurveTo(8, -36, 0, -31);
    g.quadraticCurveTo(-6, -37, -12, -30);
    g.quadraticCurveTo(-19, -35, -24, -27);
    g.quadraticCurveTo(-32, -30, -38, -17);
    g.closePath();
    fs(g, "#c94a40");
    // anal + pelvic fins
    fin(g, [[-14, 22], [-24, 33], [-34, 24], [-32, 20], [-30, 14]], "#c94a40", 2);
    fin(g, [[14, 22], [8, 34], [0, 30], [2, 26], [2, 22]], "#c94a40", 2);
    // body
    grouperBody(g);
    g.fillStyle = "#e45b4f";
    g.fill();
    g.save();
    grouperBody(g);
    g.clip();
    g.fillStyle = "#f6a48f";
    ell(g, 4, 24, 46, 11);
    g.fill();
    g.fillStyle = "rgba(150,40,35,0.35)";
    ell(g, -6, -26, 52, 12);
    g.fill();
    var sp = [[-30, -6, 3], [-18, -12, 3.6], [-6, -16, 3], [-22, 6, 3.2], [-8, 0, 3.8], [6, -8, 3],
      [-34, 6, 2.4], [8, 10, 2.8], [20, -16, 2.4], [-12, 13, 2.4]], i;
    for (i = 0; i < sp.length; i++) {
      ell(g, sp[i][0], sp[i][1], sp[i][2], sp[i][2] * 0.9);
      g.fillStyle = i % 3 === 2 ? "rgba(255,214,190,0.75)" : "#b23a33";
      g.fill();
    }
    g.fillStyle = "rgba(255,255,255,0.3)";
    ell(g, 6, -16, 18, 3);
    g.fill();
    g.restore();
    grouperBody(g);
    ink(g);
    g.stroke();
    // gill
    g.beginPath();
    g.arc(14, 1, 16, -1, 1);
    g.strokeStyle = "rgba(20,32,43,0.55)";
    g.lineWidth = 1.8;
    g.stroke();
    // pectoral
    pec(g, 16, 11, 17, 0.75 + Math.sin((tt || 0) * 5) * 0.25, "rgba(255,190,170,0.85)", "#b23a33");
    // lips
    var lo = shock ? 2.5 : 0;
    g.beginPath();
    g.ellipse(50, -2 - lo * 0.4, 6.5, 4.4, -0.2, 0, TAU);
    fs(g, "#f39a88");
    g.beginPath();
    g.ellipse(49, 7 + lo, 7, 4.8, 0.2, 0, TAU);
    fs(g, "#f39a88");
    if (shock) {
      ell(g, 53, 2.5, 2.2, 1.8);
      g.fillStyle = "#6e2323";
      g.fill();
    }
    eye(g, 30, -9, 6.4, shock);
    // brow
    g.beginPath();
    g.moveTo(23, -17);
    g.quadraticCurveTo(30, -20, 37, -16);
    ink(g, 2.4);
    g.stroke();
  }

  /* ---- swordfish ---- */
  function swordBody(g) {
    g.beginPath();
    g.moveTo(47, -1);
    g.bezierCurveTo(40, -15, 12, -19, -14, -16);
    g.bezierCurveTo(-34, -13, -46, -6, -54, -1);
    g.bezierCurveTo(-46, 5, -34, 12, -14, 15);
    g.bezierCurveTo(12, 18, 40, 13, 47, 3);
    g.closePath();
  }
  function drawSword(g, sw, shock, tt) {
    // tail
    g.save();
    g.translate(-52, 0);
    g.rotate(sw * 0.7);
    fin(g, [[0, -2], [-12, -10], [-27, -25], [-18, -8], [-16, 0], [-18, 8], [-27, 25], [-12, 10], [0, 2]], "#2f557a");
    g.restore();
    // tall dorsal
    fin(g, [[18, -15], [10, -34], [-2, -44], [0, -30], [-14, -15]], "#2f557a");
    fin(g, [[-40, -7], [-44, -14], [-48, -12], [-46, -8], [-46, -4]], "#2f557a", 2);
    // bill
    g.beginPath();
    g.moveTo(44, -4);
    g.lineTo(80, -1.2);
    g.lineTo(80, 0.4);
    g.lineTo(44, 3);
    g.closePath();
    fs(g, "#3d6386", 2.2);
    // body
    swordBody(g);
    g.fillStyle = "#5584ad";
    g.fill();
    g.save();
    swordBody(g);
    g.clip();
    g.fillStyle = "#2f557a";
    g.beginPath();
    g.moveTo(-60, -2);
    g.bezierCurveTo(-20, -5, 10, -7, 50, -5);
    g.lineTo(50, -30);
    g.lineTo(-60, -30);
    g.closePath();
    g.fill();
    g.fillStyle = "#dfe8ee";
    ell(g, 2, 13, 50, 8);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.45)";
    ell(g, -2, -4, 26, 1.8);
    g.fill();
    g.restore();
    swordBody(g);
    ink(g);
    g.stroke();
    // gill
    g.beginPath();
    g.arc(22, 1, 9, -0.9, 0.9);
    g.strokeStyle = "rgba(20,32,43,0.55)";
    g.lineWidth = 1.6;
    g.stroke();
    // pectoral
    pec(g, 22, 7, 22, 0.55 + Math.sin((tt || 0) * 8) * 0.15, "rgba(200,220,236,0.85)", "#2f557a");
    eye(g, 32, -4.5, 4.8, shock);
    g.beginPath();
    g.moveTo(45, 2.5);
    g.lineTo(38, 4.2);
    ink(g, 1.6);
    g.stroke();
  }
  function streaks(g, t) {
    var i, y, off, len;
    g.lineCap = "round";
    for (i = 0; i < 4; i++) {
      y = [-11, -3, 5, 12][i];
      off = (t * 260 + i * 37) % 70;
      len = 24 + rnd(i + 5) * 26;
      g.strokeStyle = "rgba(240,250,255," + (0.6 - off / 140).toFixed(3) + ")";
      g.lineWidth = i % 2 ? 2 : 2.6;
      g.beginPath();
      g.moveTo(-84 - off, y);
      g.lineTo(-84 - off - len, y);
      g.stroke();
    }
  }

  /* ---- fish ---- */
  function fish(g, kind, x, y, dir, t, hooked) {
    dir = dir < 0 ? -1 : 1;
    t = t || 0;
    var ph = (x * 0.013 + y * 0.029) % 7;
    g.save();
    g.translate(x, y);
    var sw, tt = t + ph;
    if (hooked) {
      g.rotate(Math.sin(t * 12) * 0.2 + Math.sin(t * 4.7) * 0.1);
      g.scale(dir, 1);
      g.rotate(-Math.PI / 2);
      g.translate(-(MOUTH[kind] || 30), 0);
      sw = Math.sin(t * 22) * 0.45;
      tt = t * 2.2;
    } else {
      g.scale(dir, 1);
      sw = Math.sin(tt * (kind === "swordfish" ? 16 : 8)) * 0.28;
    }
    if (kind === "grouper") drawGrouper(g, sw, !!hooked, tt);
    else if (kind === "swordfish") {
      if (!hooked) streaks(g, t);
      drawSword(g, sw, !!hooked, tt);
    } else drawTuna(g, sw, !!hooked, tt);
    g.restore();
  }

  /* ---- shark ---- */
  function sharkBody(g) {
    g.beginPath();
    g.moveTo(116, 5);
    g.bezierCurveTo(112, -13, 82, -30, 32, -32);
    g.bezierCurveTo(-20, -33, -60, -20, -88, -6);
    g.quadraticCurveTo(-93, 0, -88, 6);
    g.bezierCurveTo(-60, 20, -12, 33, 40, 30);
    g.bezierCurveTo(80, 27, 108, 20, 116, 5);
    g.closePath();
  }
  function drawShark(g, t) {
    var sw = Math.sin(t * 6) * 0.2;
    // tail
    g.save();
    g.translate(-86, 0);
    g.rotate(sw);
    fin(g, [[0, -5], [-14, -18], [-34, -40], [-26, -12], [-22, 0], [-24, 10], [-30, 28], [-14, 12], [0, 5]], "#6b7c8b");
    g.restore();
    // far pectoral
    fin(g, [[52, 20], [44, 34], [34, 40], [38, 30], [36, 22]], "#5e6e7c", 2);
    // dorsal fins
    fin(g, [[14, -31], [0, -48], [-14, -66], [-16, -44], [-38, -27]], "#6b7c8b");
    fin(g, [[-60, -16], [-66, -24], [-72, -26], [-71, -18], [-74, -11]], "#6b7c8b", 2);
    fin(g, [[-56, 18], [-64, 25], [-70, 27], [-69, 20], [-72, 13]], "#6b7c8b", 2);
    // body
    sharkBody(g);
    g.fillStyle = "#7d8e9d";
    g.fill();
    g.save();
    sharkBody(g);
    g.clip();
    g.fillStyle = "#5f7080";
    ell(g, 0, -34, 120, 18);
    g.fill();
    g.fillStyle = "#eef2f4";
    g.beginPath();
    g.moveTo(-90, 4);
    g.bezierCurveTo(-40, 6, 20, 2, 60, 8);
    g.bezierCurveTo(90, 10, 110, 4, 120, 6);
    g.lineTo(120, 40);
    g.lineTo(-90, 40);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.35)";
    ell(g, 10, -18, 50, 3.5);
    g.fill();
    // mouth
    g.beginPath();
    g.moveTo(64, 13);
    g.quadraticCurveTo(90, 26, 112, 10);
    g.quadraticCurveTo(90, 17, 64, 13);
    g.closePath();
    g.fillStyle = "#6e2b33";
    g.fill();
    g.restore();
    sharkBody(g);
    ink(g);
    g.stroke();
    // teeth
    var i, tx;
    g.fillStyle = "#ffffff";
    ink(g, 1.4);
    for (i = 0; i < 6; i++) {
      tx = 70 + i * 6.6;
      g.beginPath();
      g.moveTo(tx, 14.5 + i * 0.5 - (i > 3 ? (i - 3) * 1.6 : 0));
      g.lineTo(tx + 3.2, 21 - (i > 3 ? (i - 3) * 2 : 0));
      g.lineTo(tx + 6.2, 15 + i * 0.4 - (i > 3 ? (i - 3) * 1.8 : 0));
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.moveTo(64, 13);
    g.quadraticCurveTo(90, 26, 112, 10);
    ink(g, 2.2);
    g.stroke();
    g.beginPath();
    g.moveTo(64, 13);
    g.quadraticCurveTo(60, 12, 58, 9);
    g.stroke();
    // gills
    g.strokeStyle = "rgba(20,32,43,0.6)";
    g.lineWidth = 1.8;
    for (i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(40 + i * 7, -4);
      g.quadraticCurveTo(43 + i * 7, 4, 40 + i * 7, 12);
      g.stroke();
    }
    // near pectoral
    fin(g, [[40, 20], [26, 38], [10, 54], [14, 34], [12, 24]], "#6b7c8b");
    // eye + brow
    ell(g, 86, -7, 5.4, 5.4);
    fs(g, "#ffffff", 2);
    ell(g, 87.5, -6.2, 2.8, 2.8);
    g.fillStyle = INK;
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(87.6, -8.2, 1.2, 1.2);
    g.beginPath();
    g.moveTo(77, -16);
    g.lineTo(95, -10);
    ink(g, 3);
    g.stroke();
    // nostril
    g.fillStyle = INK;
    ell(g, 108, -3, 1.6, 1);
    g.fill();
  }

  /* ---- eel ---- */
  function drawEel(g, t) {
    var n = 22, i, s, top = [], bot = [], pts = [], nx = [], ny = [], wd = [];
    for (i = 0; i <= n; i++) {
      s = i / n;
      pts.push([-80 + s * 140, Math.sin(s * 9.5 - t * 6) * 7 * (1 - s * 0.6)]);
    }
    for (i = 0; i <= n; i++) {
      s = i / n;
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      nx.push(-dy / l);
      ny.push(dx / l);
      wd.push(1.2 + 6.3 * Math.pow(s, 0.5));
      top.push([pts[i][0] - nx[i] * wd[i], pts[i][1] - ny[i] * wd[i]]);
      bot.push([pts[i][0] + nx[i] * wd[i], pts[i][1] + ny[i] * wd[i]]);
    }
    // fin ribbons
    var ribbon = function (side) {
      g.beginPath();
      for (i = 1; i <= 17; i++) {
        var f = 3.2 * Math.sin((i - 1) / 16 * Math.PI) + 1, e = side < 0 ? top[i] : bot[i];
        var fx = e[0] + nx[i] * side * f, fy = e[1] + ny[i] * side * f;
        if (i === 1) g.moveTo(fx, fy); else g.lineTo(fx, fy);
      }
      for (i = 17; i >= 1; i--) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      fs(g, "#5f9a55", 1.6);
    };
    ribbon(-1);
    ribbon(1);
    var outline = function () {
      g.beginPath();
      g.moveTo(top[0][0], top[0][1]);
      for (i = 1; i <= n; i++) g.lineTo(top[i][0], top[i][1]);
      for (i = n; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
      g.closePath();
    };
    outline();
    g.fillStyle = "#2f5d3a";
    g.fill();
    g.save();
    outline();
    g.clip();
    g.strokeStyle = "#9cbf5e";
    g.lineWidth = 3.4;
    g.lineCap = "round";
    g.beginPath();
    for (i = 2; i <= n; i++) {
      var bx = bot[i][0] * 0.75 + pts[i][0] * 0.25, by = bot[i][1] * 0.75 + pts[i][1] * 0.25;
      if (i === 2) g.moveTo(bx, by); else g.lineTo(bx, by);
    }
    g.stroke();
    g.fillStyle = "rgba(170,230,140,0.4)";
    for (i = 3; i < n; i += 2) {
      ell(g, pts[i][0], pts[i][1] - wd[i] * 0.35, 1.8, 1.1);
      g.fill();
    }
    g.restore();
    outline();
    ink(g);
    g.stroke();
    // head
    var hp = pts[n], ang = Math.atan2(pts[n][1] - pts[n - 2][1], pts[n][0] - pts[n - 2][0]);
    g.save();
    g.translate(hp[0], hp[1]);
    g.rotate(ang);
    var hd = function () {
      g.beginPath();
      g.moveTo(-4, -7.5);
      g.bezierCurveTo(8, -10, 19, -7, 21, -1);
      g.quadraticCurveTo(21, 4, 15, 6);
      g.bezierCurveTo(8, 9, 0, 9, -4, 7.5);
      g.closePath();
    };
    hd();
    g.fillStyle = "#2f5d3a";
    g.fill();
    g.save();
    hd();
    g.clip();
    g.fillStyle = "#9cbf5e";
    ell(g, 6, 9, 14, 4);
    g.fill();
    g.restore();
    hd();
    ink(g);
    g.stroke();
    g.beginPath();
    g.moveTo(20, 2);
    g.quadraticCurveTo(13, 4.5, 7, 3);
    ink(g, 1.6);
    g.stroke();
    ell(g, 10, -3, 3.6, 3.4);
    fs(g, "#ffd23f", 1.8);
    g.fillStyle = INK;
    g.fillRect(9.8, -5.8, 1.4, 5.4);
    g.fillStyle = INK;
    ell(g, 18, -3.5, 0.9, 0.9);
    g.fill();
    g.restore();
    // sparks
    var k, ph, si, sx, sy, sd;
    for (k = 0; k < 3; k++) {
      ph = Math.floor(t * 8 + k * 2.3);
      if (rnd(ph * 1.7 + k) < 0.35) continue;
      si = 3 + Math.floor(rnd(ph + k * 5) * (n - 5));
      sd = rnd(ph + 3) < 0.5 ? -1 : 1;
      sx = pts[si][0] + nx[si] * sd * 14;
      sy = pts[si][1] + ny[si] * sd * 14;
      spark(g, sx, sy, 6, ph);
    }
  }
  function spark(g, x, y, r, seed) {
    var i, a, pts = [];
    g.beginPath();
    for (i = 0; i < 4; i++) {
      a = i * Math.PI / 2 + rnd(seed + i) * 0.6;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    g.moveTo(pts[0][0], pts[0][1]);
    g.lineTo(x + 1, y - 1);
    g.lineTo(pts[2][0], pts[2][1]);
    g.moveTo(pts[1][0], pts[1][1]);
    g.lineTo(x - 1, y + 1);
    g.lineTo(pts[3][0], pts[3][1]);
    g.lineCap = "round";
    g.strokeStyle = INK;
    g.lineWidth = 3.4;
    g.stroke();
    g.strokeStyle = "#ffe14d";
    g.lineWidth = 1.6;
    g.stroke();
  }

  /* ---- jellyfish ---- */
  function drawJelly(g, t) {
    var pu = Math.sin(t * 3.2);
    var rx = 27 * (1 + pu * 0.07), ry = 13.5 * (1 - pu * 0.08), by = -8;
    var i, k, x0, y, x;
    // tentacles
    for (i = 0; i < 5; i++) {
      x0 = -18 + i * 9;
      g.beginPath();
      g.moveTo(x0, by);
      for (k = 1; k <= 8; k++) {
        y = by + k * (46 - Math.abs(i - 2) * 4) / 8;
        x = x0 * (1 - k * 0.04) + Math.sin(t * 2.6 + k * 0.9 + i * 1.3) * (1 + k * 0.6);
        g.lineTo(x, y);
      }
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "rgba(20,32,43,0.75)";
      g.lineWidth = 3.4;
      g.stroke();
      g.strokeStyle = "#f2b4e4";
      g.lineWidth = 1.6;
      g.stroke();
    }
    // oral arms
    for (i = 0; i < 2; i++) {
      x0 = i ? 6 : -6;
      g.beginPath();
      g.moveTo(x0, by);
      for (k = 1; k <= 6; k++) {
        g.lineTo(x0 + Math.sin(t * 3 + k * 1.2 + i * 2) * 3.5, by + k * 5);
      }
      g.strokeStyle = "rgba(20,32,43,0.75)";
      g.lineWidth = 7.5;
      g.stroke();
      g.strokeStyle = "#c37ad6";
      g.lineWidth = 4.5;
      g.stroke();
    }
    // bell
    var bell = function () {
      g.beginPath();
      g.moveTo(-rx, by);
      g.bezierCurveTo(-rx, by - ry * 3, rx, by - ry * 3, rx, by);
      for (k = 0; k < 5; k++) {
        var xa = rx - (k + 0.5) * rx * 2 / 5, xb = rx - (k + 1) * rx * 2 / 5;
        g.quadraticCurveTo(xa, by + 6, xb, by);
      }
      g.closePath();
    };
    var gr = g.createRadialGradient(-6, by - ry * 1.8, 2, 0, by - ry, rx * 1.2);
    gr.addColorStop(0, "rgba(252,222,250,0.95)");
    gr.addColorStop(0.6, "rgba(214,140,230,0.82)");
    gr.addColorStop(1, "rgba(170,96,205,0.85)");
    bell();
    g.fillStyle = gr;
    g.fill();
    g.save();
    bell();
    g.clip();
    g.strokeStyle = "rgba(240,160,220,0.9)";
    g.lineWidth = 2.2;
    for (i = 0; i < 4; i++) {
      ell(g, -12 + i * 8, by - ry * 0.9, 3, 3.6);
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.18)";
    ell(g, 0, by - ry * 0.7, rx * 0.65, ry * 1.1);
    g.fill();
    g.restore();
    bell();
    ink(g);
    g.stroke();
    // shine
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.beginPath();
    g.ellipse(0, by, rx * 0.7, ry * 1.9, 0, Math.PI * 1.18, Math.PI * 1.4);
    g.stroke();
  }

  /* ---- trash can ---- */
  function drawTrash(g, t) {
    var i, b;
    // bubbles
    g.lineWidth = 1.3;
    for (i = 0; i < 3; i++) {
      b = (t * 0.9 + i * 0.33) % 1;
      ell(g, -6 + i * 7 + Math.sin(t * 3 + i) * 2, -30 - b * 26, 1.6 + i * 0.6, 1.6 + i * 0.6);
      g.strokeStyle = "rgba(230,248,255," + (0.8 * (1 - b)).toFixed(3) + ")";
      g.stroke();
    }
    g.save();
    g.rotate(Math.sin(t * 0.9) * 0.32);
    var body = function () {
      g.beginPath();
      g.moveTo(-19, -16);
      g.lineTo(19, -16);
      g.lineTo(16, 4);
      g.quadraticCurveTo(10, 8, 15, 12);
      g.lineTo(15, 27);
      g.lineTo(-16, 27);
      g.closePath();
    };
    body();
    var gr = g.createLinearGradient(-19, 0, 19, 0);
    gr.addColorStop(0, "#6f7b84");
    gr.addColorStop(0.3, "#c2cbd1");
    gr.addColorStop(0.55, "#9aa6ae");
    gr.addColorStop(1, "#66727b");
    g.fillStyle = gr;
    g.fill();
    g.save();
    body();
    g.clip();
    g.strokeStyle = "rgba(20,32,43,0.35)";
    g.lineWidth = 1.4;
    for (i = -12; i <= 12; i += 6) {
      g.beginPath();
      g.moveTo(i, -14);
      g.lineTo(i * 0.88, 26);
      g.stroke();
    }
    g.fillStyle = "rgba(20,32,43,0.18)";
    ell(g, 13, 8, 6, 5);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.fillRect(-12, -12, 3, 36);
    // rust
    g.fillStyle = "rgba(160,92,40,0.45)";
    ell(g, -8, 20, 4, 2.5);
    g.fill();
    g.restore();
    body();
    ink(g);
    g.stroke();
    // rim bands
    g.beginPath();
    g.rect(-20, -18, 40, 4.5);
    fs(g, "#8d99a2", 2);
    g.beginPath();
    g.moveTo(-16.5, 22);
    g.lineTo(15.5, 22);
    ink(g, 1.8);
    g.stroke();
    // fish bone poking out
    g.save();
    g.translate(8, -20);
    g.rotate(-0.7);
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -14);
    g.stroke();
    g.strokeStyle = "#f4efe2";
    g.lineWidth = 1.8;
    g.stroke();
    for (i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(-3.5, -3 - i * 4);
      g.lineTo(3.5, -3 - i * 4);
      g.strokeStyle = INK;
      g.lineWidth = 3.4;
      g.stroke();
      g.strokeStyle = "#f4efe2";
      g.lineWidth = 1.4;
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(-3.5, -19);
    g.lineTo(3.5, -19);
    g.closePath();
    fs(g, "#f4efe2", 1.8);
    g.restore();
    // lid
    g.save();
    g.translate(-4, -22);
    g.rotate(-0.32);
    g.beginPath();
    g.moveTo(-22, 2);
    g.quadraticCurveTo(0, -7, 22, 2);
    g.lineTo(22, 4.5);
    g.lineTo(-22, 4.5);
    g.closePath();
    fs(g, "#a9b4bb");
    g.beginPath();
    g.moveTo(-5, -2.5);
    g.quadraticCurveTo(0, -9, 5, -2.5);
    ink(g, 2.2);
    g.stroke();
    g.restore();
    g.restore();
  }

  function hazard(g, kind, x, y, dir, t) {
    dir = dir < 0 ? -1 : 1;
    t = t || 0;
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    if (kind === "shark") drawShark(g, t);
    else if (kind === "eel") drawEel(g, t);
    else if (kind === "jelly") drawJelly(g, t);
    else drawTrash(g, t);
    g.restore();
  }

  /* ---- effects ---- */
  function splash(g, x, y, p) {
    p = clamp(p, 0, 1);
    var i, a, v, tt, dx, dy, r, al = p < 0.65 ? 1 : (1 - p) / 0.35;
    g.save();
    g.globalAlpha = al;
    // ring
    ell(g, x, y, 20 + ease(p) * 44, 5 + ease(p) * 9);
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 3 * (1 - p) + 0.5;
    g.stroke();
    // jets
    var lift = Math.sin(Math.min(1, p * 1.5) * Math.PI), off, h, w, bx, tx, ty, ln;
    for (i = 0; i < 5; i++) {
      off = i - 2;
      h = (44 - Math.abs(off) * 10) * lift;
      if (h < 3) continue;
      ln = off * 0.32;
      w = 7 - Math.abs(off) * 1.2;
      bx = x + off * 11;
      tx = bx + ln * h;
      ty = y - h;
      g.beginPath();
      g.moveTo(bx - w, y);
      g.quadraticCurveTo(bx + ln * h * 0.4 - w * 0.4, y - h * 0.55, tx, ty);
      g.quadraticCurveTo(bx + ln * h * 0.4 + w * 0.4, y - h * 0.55, bx + w, y);
      g.closePath();
      fs(g, "#d9f1fb", 2);
      g.beginPath();
      g.moveTo(bx - w * 0.4, y - 3);
      g.quadraticCurveTo(bx + ln * h * 0.4 - w * 0.2, y - h * 0.5, tx - ln * 3, ty + 6);
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 1.4;
      g.stroke();
      r = 2.6 + (2 - Math.abs(off)) * 0.6;
      ell(g, tx + ln * 6, ty - 5 - (1 - lift) * 6, r, r * 1.1);
      fs(g, "#d9f1fb", 1.6);
    }
    // foam
    for (i = 0; i < 8; i++) {
      r = (4.5 + rnd(i + 20) * 2.5) * (1 - p * 0.6);
      ell(g, x + (i - 3.5) * 8.5, y + 1 + Math.abs(i - 3.5) * 0.4, r, r * 0.8);
      fs(g, "#ffffff", 1.6);
    }
    // droplets
    tt = p * 0.9;
    for (i = 0; i < 12; i++) {
      a = -Math.PI / 2 + (rnd(i + 1) - 0.5) * 2.2;
      v = 140 + rnd(i + 2) * 120;
      dx = Math.cos(a) * v * tt;
      dy = Math.sin(a) * v * tt + 300 * tt * tt;
      r = (2.4 + rnd(i + 3) * 2.6) * (1 - p * 0.5);
      if (y + dy > y + 4) continue;
      ell(g, x + dx, y + dy, r, r * 1.15);
      g.fillStyle = "#d9f1fb";
      g.fill();
      ink(g, 1.6);
      g.stroke();
      g.fillStyle = "#ffffff";
      g.fillRect(x + dx - r * 0.4, y + dy - r * 0.5, r * 0.45, r * 0.45);
    }
    g.restore();
  }

  function zap(g, x, y, p) {
    p = clamp(p, 0, 1);
    var al = p < 0.7 ? 1 : (1 - p) / 0.3, i, k, a, r, seed = Math.floor(p * 14);
    g.save();
    g.globalAlpha = al;
    // flash
    var fr = 20 + ease(p) * 50;
    var gr = g.createRadialGradient(x, y, 0, x, y, fr);
    gr.addColorStop(0, "rgba(255,255,220,0.95)");
    gr.addColorStop(0.4, "rgba(255,230,90,0.55)");
    gr.addColorStop(1, "rgba(255,230,90,0)");
    g.fillStyle = gr;
    ell(g, x, y, fr, fr);
    g.fill();
    // bolts
    for (i = 0; i < 8; i++) {
      a = i * TAU / 8 + rnd(seed + i) * 0.5;
      r = 18 + ease(p) * 34 + rnd(seed * 3 + i) * 10;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      for (k = 1; k <= 3; k++) {
        var rr = 6 + (r - 6) * k / 3, j = (k < 3 ? (rnd(seed + i * 5 + k) - 0.5) * 0.7 : 0);
        g.lineTo(x + Math.cos(a + j) * rr, y + Math.sin(a + j) * rr);
      }
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.stroke();
      g.strokeStyle = "#ffe14d";
      g.lineWidth = 2.6;
      g.stroke();
    }
    // core
    ell(g, x, y, 7 * (1 - p * 0.5), 7 * (1 - p * 0.5));
    g.fillStyle = "#fffbe0";
    g.fill();
    ink(g, 2);
    g.stroke();
    g.restore();
  }

  function snap(g, x, y, p) {
    p = clamp(p, 0, 1);
    var al = p < 0.6 ? 1 : (1 - p) / 0.4, i, a, r1, r2, e = ease(p);
    g.save();
    g.globalAlpha = al;
    // burst star
    var sr = 10 + e * 22;
    g.beginPath();
    for (i = 0; i < 16; i++) {
      a = i * TAU / 16 + p * 0.6;
      r1 = i % 2 ? sr * 0.45 : sr;
      if (i === 0) g.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      else g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    g.closePath();
    fs(g, "#fff3c4", 2.2);
    // speed lines
    g.lineCap = "round";
    for (i = 0; i < 8; i++) {
      a = i * TAU / 8 + 0.2;
      r1 = sr + 4 + e * 10;
      r2 = r1 + 10 * (1 - p) + 4;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
      ink(g, 2.4);
      g.stroke();
    }
    // loose line ends
    g.lineWidth = 1.6;
    g.strokeStyle = "rgba(15,26,34,0.9)";
    for (i = 0; i < 2; i++) {
      var s = i ? 1 : -1, ex = x + s * (6 + e * 26), ey = y + (i ? 1 : -1) * e * 18;
      g.beginPath();
      g.moveTo(x + s * 3, y + (i ? 6 : -6));
      g.bezierCurveTo(x + s * 12, ey - 10 * s, ex + s * 8, ey + 6, ex, ey);
      g.arc(ex - s * 3, ey, 3, i ? 0 : Math.PI, i ? Math.PI * 1.6 : Math.PI * 2.6, !!i);
      g.stroke();
    }
    g.restore();
  }

  function popText(g, text, x, y, p) {
    p = clamp(p, 0, 1);
    var al = p < 0.65 ? 1 : (1 - p) / 0.35;
    var sc = p < 0.15 ? 0.6 + p / 0.15 * 0.6 : 1.2 - Math.min(1, (p - 0.15) / 0.15) * 0.2;
    g.save();
    g.globalAlpha = al;
    g.translate(x, y - ease(p) * 42);
    g.scale(sc, sc);
    g.font = "34px " + HUD_FONT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.strokeText(text, 0, 0);
    g.fillStyle = "#ffe27a";
    g.fillText(text, 0, 0);
    g.restore();
  }

  function wormIcon(g, x, y, s) {
    s = s || 1;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    worm(g, [[-11, 3], [-6, -4], [-1, 3], [4, -4], [9, 1], [11, -2]], 4.4);
    g.fillStyle = INK;
    g.fillRect(9.2, -3.6, 1.6, 1.6);
    g.restore();
  }

  /* ---- picker thumbnail ---- */
  function thumb(canvas) {
    if (!canvas || !canvas.getContext) return;
    var g = canvas.getContext("2d"), cw = canvas.width, ch = canvas.height;
    var vx = 318, vy = 0, vw = 464, vh = 290, t = 1.35;
    var s = Math.max(cw / vw, ch / vh);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.translate((cw - vw * s) / 2, (ch - vh * s) / 2);
    g.scale(s, s);
    g.translate(-vx, -vy);
    background(g, t);
    fish(g, "tuna", 400, 236, 1, t, false);
    fish(g, "grouper", 690, 262, -1, t + 0.5, false);
    line(g, ROD_TIP.x, ROD_TIP.y, HOLE.x, HOLE.y, 0);
    line(g, HOLE.x, HOLE.y, 536, 196, 0.1);
    fish(g, "tuna", 536, 196, -1, t, true);
    hook(g, 536, 196, false, t);
    surface(g, t);
    wormCan(g, t);
    boy(g, 0.6, "reel");
    g.restore();
  }

  window.FISHART = {
    W: W, H: H, ICE_Y: ICE_Y, HOLE: HOLE, ROD_TIP: ROD_TIP, SIZE: SIZE, MOUTH: MOUTH,
    background: background,
    surface: surface,
    crate: crate,
    wormCan: wormCan,
    boy: boy,
    line: line,
    hook: hook,
    fish: fish,
    hazard: hazard,
    splash: splash,
    zap: zap,
    snap: snap,
    popText: popText,
    wormIcon: wormIcon,
    thumb: thumb
  };
})();
