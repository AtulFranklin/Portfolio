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

  let THREE, RoundedBoxGeometry, RoomEnvironment, mergeGeometries;
  try {
    THREE = await import("three");
    ({ RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js"));
    ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js"));
    ({ mergeGeometries } = await import("three/addons/utils/BufferGeometryUtils.js"));
  } catch (e) {
    console.warn("Three.js could not load", e);
    return fail();
  }

  // wait briefly for fonts so canvas textures use Geist
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 64px "Geist"'), document.fonts.load('500 32px "Geist Mono"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (_) {}

  const FONT = '"Geist", system-ui, sans-serif';
  const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
  const C = { amber: "#F5B041", up: "#3DDC97", down: "#FF6B6B", paper: "#F3EEE4", ink: "#16130E" };

  // The view out of the window: a photo (assets/skyline.jpg) when it can be used,
  // otherwise the procedural 3D city further down.
  const SKY_PHOTO = "assets/skyline.jpg";
  const skyPhoto = await Promise.race([loadImage(SKY_PHOTO), new Promise((r) => setTimeout(() => r(null), 5000))]);

  /* ---------------- seeded random ---------------- */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  /* ---------------- renderer / scene / camera ---------------- */
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: !!SNAP, preserveDrawingBuffer: !!SNAP });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#07080B");
  scene.fog = new THREE.Fog("#57557F", 150, 560);   // dusk haze over the city; far beyond the room

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.18;

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
  function woodTex(base, dark, w = 512, h = 512, vertical = false) {
    return canvasTex(w, h, (g) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 220; i++) {
        const y = rnd() * h, a = 0.04 + rnd() * 0.08;
        g.strokeStyle = `rgba(${dark},${a})`;
        g.lineWidth = 0.6 + rnd() * 2.2;
        g.beginPath();
        if (vertical) { g.moveTo(y, 0); g.bezierCurveTo(y + rnd() * 8 - 4, h * 0.3, y + rnd() * 8 - 4, h * 0.7, y + rnd() * 6 - 3, h); }
        else { g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + rnd() * 8 - 4, w * 0.7, y + rnd() * 8 - 4, w, y + rnd() * 6 - 3); }
        g.stroke();
      }
    }, { repeat: true });
  }

  /* ---------------- materials ---------------- */
  const M = {
    wall: new THREE.MeshStandardMaterial({ color: "#14161B", roughness: 0.92 }),
    floor: new THREE.MeshStandardMaterial({ color: "#1B1714", roughness: 0.75, metalness: 0.0 }),
    desk: new THREE.MeshStandardMaterial({ map: woodTex("#5A3A24", "20,10,4"), roughness: 0.55, metalness: 0.02 }),
    deskLeg: new THREE.MeshStandardMaterial({ color: "#1C1D21", roughness: 0.5, metalness: 0.6 }),
    crateWood: new THREE.MeshStandardMaterial({ map: woodTex("#8A5A35", "40,20,8", 256, 256, false), roughness: 0.8 }),
    crateDark: new THREE.MeshStandardMaterial({ color: "#5E3C22", roughness: 0.85 }),
    beige: new THREE.MeshStandardMaterial({ color: "#CDBFA6", roughness: 0.6 }),
    beigeDark: new THREE.MeshStandardMaterial({ color: "#8F8370", roughness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: "#121318", roughness: 0.45, metalness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: "#2A2C31", roughness: 0.35, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: "#B88A45", roughness: 0.3, metalness: 0.9 }),
    paper: new THREE.MeshStandardMaterial({ color: C.paper, roughness: 0.9 }),
    gear: new THREE.MeshPhysicalMaterial({ color: "#E8E0CB", roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.2 }),
    mug: new THREE.MeshStandardMaterial({ color: "#E9E4DA", roughness: 0.35 }),
  };

  /* ---------------- lights ---------------- */
  scene.add(new THREE.HemisphereLight("#33405F", "#1A140E", 1.1));

  const moon = new THREE.DirectionalLight("#8C86C8", 1.0);
  moon.position.set(-2.5, 4, -6);
  scene.add(moon);

  const lampLight = new THREE.SpotLight("#FFC27A", 28, 0, 0.82, 0.65, 2);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  lampLight.shadow.bias = -0.0004;
  lampLight.shadow.radius = 4;
  scene.add(lampLight, lampLight.target);

  const fill = new THREE.SpotLight("#FFB066", 9, 0, 0.9, 0.9, 2);
  fill.position.set(0.4, 2.6, 2.8);
  fill.target.position.set(0, 0.2, 0.5);
  scene.add(fill, fill.target);

  const glow = new THREE.PointLight("#FF9A3D", 1.2, 4, 2);
  scene.add(glow);

  /* ---------------- room ---------------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 1;
  floor.receiveShadow = true;
  scene.add(floor);

  // rug under the desk
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.8),
    new THREE.MeshStandardMaterial({
      map: canvasTex(512, 320, (g, w, h) => {
        g.fillStyle = "#2A221D"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "rgba(245,176,65,.18)"; g.lineWidth = 3; g.strokeRect(18, 18, w - 36, h - 36);
        g.strokeStyle = "rgba(245,176,65,.08)"; g.lineWidth = 1; g.strokeRect(30, 30, w - 60, h - 60);
        for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.03})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
      }),
      roughness: 1,
    })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.1, 0.002, 0.15);
  rug.receiveShadow = true;
  scene.add(rug);

  // back wall with a window opening
  const WALL_Z = -1.85, WIN = { x0: -2.7, x1: 2.7, y0: 1.0, y1: 3.4 };
  function wallBox(x0, x1, y0, y1) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.2), M.wall);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z - 0.1);
    m.receiveShadow = true;
    scene.add(m);
  }
  wallBox(-14, WIN.x0, 0, 6); wallBox(WIN.x1, 14, 0, 6);
  wallBox(WIN.x0, WIN.x1, 0, WIN.y0); wallBox(WIN.x0, WIN.x1, WIN.y1, 6);
  // window frame + mullions
  const frameMat = M.black;
  [[WIN.x0, WIN.x1, WIN.y0 - 0.05, WIN.y0 - 0.012], [WIN.x0, WIN.x1, WIN.y1 + 0.006, WIN.y1 + 0.046]].forEach(([a, b, c, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, d - c, 0.26), frameMat);
    m.position.set((a + b) / 2, (c + d) / 2, WALL_Z - 0.08); scene.add(m);
  });
  [WIN.x0 + 0.02, -0.9, 0.9, WIN.x1 - 0.02].forEach((x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, WIN.y1 - WIN.y0, 0.1), frameMat);
    m.position.set(x, (WIN.y0 + WIN.y1) / 2, WALL_Z - 0.1); scene.add(m);
  });
  { const m = new THREE.Mesh(new THREE.BoxGeometry(WIN.x1 - WIN.x0, 0.035, 0.08), frameMat); m.position.set(0, 2.3, WALL_Z - 0.1); scene.add(m); }
  // sill
  { const m = new THREE.Mesh(new THREE.BoxGeometry(WIN.x1 - WIN.x0 + 0.2, 0.04, 0.28), M.beigeDark); m.position.set(0, WIN.y0 - 0.008, WALL_Z + 0.06); m.receiveShadow = true; scene.add(m); }

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
  const SKY = { dist: 60, wDeg: 48 };
  function buildPhotoView(img) {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.needsUpdate = true;
    const w = 2 * SKY.dist * Math.tan(THREE.MathUtils.degToRad(SKY.wDeg / 2));
    const h = w * (img.height / img.width);
    skyPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t, fog: false, toneMapped: false, color: "#D9D6E0" })
    );
    skyPlane.userData.h = h;
    skyPlane.position.set(0, 0, 5.1 - SKY.dist);
    scene.add(skyPlane);
  }
  if (skyPhoto) { buildPhotoView(skyPhoto); camera.far = 140; } else buildCity();
  camera.updateProjectionMatrix();

  /* ---------------- desk ---------------- */
  const DESK_Y = 0.76, DESK_Z = -0.62, DESK_W = 2.7, DESK_D = 1.08;
  const TOP = DESK_Y + 0.025;
  const deskTop = new THREE.Mesh(new RoundedBoxGeometry(DESK_W, 0.05, DESK_D, 2, 0.012), M.desk);
  deskTop.position.set(0.05, DESK_Y, DESK_Z);
  deskTop.castShadow = deskTop.receiveShadow = true;
  scene.add(deskTop);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, DESK_Y - 0.025, 0.05), M.deskLeg);
    leg.position.set(0.05 + sx * (DESK_W / 2 - 0.08), (DESK_Y - 0.025) / 2, DESK_Z + sz * (DESK_D / 2 - 0.08));
    leg.castShadow = true;
    scene.add(leg);
  });

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
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.5, 0.5, 4, 0.05), M.beige);
    body.position.y = 0.33;
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.38, 0.22, 3, 0.04), M.beige);
    back.position.set(0, 0.32, -0.3);
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.42, 0.02, 3, 0.012), M.beigeDark);
    bezel.position.set(0, 0.35, 0.252);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.345), new THREE.MeshBasicMaterial({ map: crtTex, toneMapped: false }));
    screen.position.set(0, 0.355, 0.265);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 32), M.beigeDark);
    stand.position.y = 0.04;
    const knob1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), M.black);
    knob1.rotation.x = Math.PI / 2; knob1.position.set(0.22, 0.13, 0.255);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.007, 12), new THREE.MeshBasicMaterial({ color: C.up }));
    led.position.set(0.17, 0.13, 0.252);
    crt.add(body, back, bezel, screen, stand, knob1, led);
    crt.position.set(-0.32, TOP, DESK_Z - 0.2);
    crt.rotation.y = 0.1;
  }
  hot(crt, "Why hire Atul?", () => DESK.openPanel("why"));
  glow.position.set(-0.3, TOP + 0.36, DESK_Z + 0.2);
  glow.color.set("#3DDC97"); glow.intensity = 0.5;

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
    kb.position.set(-0.28, TOP, DESK_Z + 0.27);
    kb.rotation.y = 0.06;
  }
  hotCrate(kb, "tools", "Tools & AI");

  /* ---- photo frame ---- */
  const frame = new THREE.Group();
  const photoMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  {
    const PW = 0.24, PH = 0.32;
    const border = new THREE.Mesh(new RoundedBoxGeometry(PW + 0.04, PH + 0.04, 0.025, 2, 0.006), new THREE.MeshStandardMaterial({ color: "#2A1C12", roughness: 0.5 }));
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), photoMat);
    photo.position.z = 0.0135;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.012), new THREE.MeshStandardMaterial({ color: "#2A1C12" }));
    strut.position.set(0, -0.03, -0.07); strut.rotation.x = -0.45;
    const inner = new THREE.Group();
    inner.add(border, photo, strut);
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
    lamp.add(base, rod(L0, J1, 0.01, M.black), rod(J1, J2, 0.009, M.black), rod(J2, cap.position, 0.008, M.black), j1, j2, cap, shade, bulb, inner);
    lamp.position.copy(LAMP_BASE);
  }
  const lampEntry = hot(lamp, "Lamp - click to switch", () => setLamp(!lampOn));
  lampEntry.noLift = true;
  const lampWorld = SH.clone().add(LAMP_BASE).addScaledVector(lampDir, 0.04);
  lampLight.position.copy(lampWorld);
  lampLight.target.position.copy(lampAim);
  let lampOn = true, lampLevel = 1;
  function setLamp(on) { lampOn = on; }

  /* ---- crates on the floor ---- */
  const crateGroups = [];
  const CRATE = { w: 0.6, h: 0.36, d: 0.44, t: 0.022 };
  S.crates.forEach((c, i) => {
    const g = new THREE.Group();
    const { w, h, d, t } = CRATE;
    const label = canvasTex(600, 360, (cx, W, H) => {
      cx.drawImage(M.crateWood.map.userData.canvas, 0, 0, W, H);
      cx.fillStyle = "rgba(0,0,0,.18)"; cx.fillRect(0, 0, W, H);
      cx.fillStyle = "rgba(0,0,0,.45)"; roundRect(cx, W / 2 - 52, 40, 104, 22, 11); cx.fill();
      cx.fillStyle = "rgba(255,240,220,.92)"; cx.font = `600 50px ${FONT}`; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.fillText(c.title, W / 2, H / 2 + 20);
      cx.fillStyle = c.color; cx.fillRect(W / 2 - 30, H / 2 + 62, 60, 5);
    });
    const front = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), [M.crateWood, M.crateWood, M.crateWood, M.crateWood, new THREE.MeshStandardMaterial({ map: label, roughness: 0.8 }), M.crateWood]);
    front.position.set(0, h / 2, d / 2 - t / 2);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), M.crateWood); back.position.set(0, h / 2, -d / 2 + t / 2);
    const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, d - t * 2), M.crateWood); left.position.set(-w / 2 + t / 2, h / 2, 0);
    const right = left.clone(); right.position.x = w / 2 - t / 2;
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), M.crateDark); bottom.position.y = t / 2;
    g.add(front, back, left, right, bottom);
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
    g.scale.setScalar(g.userData.rowScale);
    g.position.copy(g.userData.rowPos);
    g.rotation.y = g.userData.rowRot;
    const entry = hot(g, `${c.title} · ${ps.length} project${ps.length === 1 ? "" : "s"}`, () => openFromCrate(entry, c.id));
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

  /* ---------------- layout / resize ---------------- */
  let W = 1, H = 1, portrait = false;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
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
  resize();
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
  let visible = true, modalOpen = false, running = false;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; kick(); }, { threshold: 0.01 }).observe(host);
  window.addEventListener("desk:modal", (e) => { modalOpen = e.detail; kick(); });
  document.addEventListener("visibilitychange", kick);

  const clock = new THREE.Clock();
  let introT = reduce ? 1 : 0;
  const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3(), labelPos = new THREE.Vector3();
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function frame_() {
    if (!(visible && !modalOpen && !document.hidden)) { running = false; return; }
    requestAnimationFrame(frame_);
    const dt = Math.min(clock.getDelta(), 0.05);
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
    lampLight.intensity = 28 * lampLevel;
    fill.intensity = 3 + 6 * lampLevel;
    bulbMat.color.setRGB(0.25 + 0.75 * lampLevel, 0.22 + 0.67 * lampLevel, 0.18 + 0.51 * lampLevel);

    if (skylineBeacon) skylineBeacon.visible = reduce || Math.floor(t * 1.2) % 2 === 0;

    // label follows hovered object
    if (hovered) {
      const box = new THREE.Box3().setFromObject(hovered.group);
      labelPos.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(camera);
      labelEl.style.left = ((labelPos.x + 1) / 2) * W + "px";
      labelEl.style.top = ((1 - labelPos.y) / 2) * H + "px";
    }

    renderer.render(scene, camera);
  }
  function kick() {
    if (running || SNAP) return;
    if (visible && !modalOpen && !document.hidden) { running = true; clock.getDelta(); requestAnimationFrame(frame_); }
  }

  // first frame, then reveal
  if (SNAP) return snapObject(SNAP);

  camera.position.copy(reduce ? camHome : camStart);
  camera.lookAt(lookHome);
  renderer.render(scene, camera);
  kick();
  setTimeout(() => loader.classList.add("done"), 150);

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
    renderer.render(scene, camera);
    window.__snap = renderer.domElement.toDataURL("image/png");
  }
})();
