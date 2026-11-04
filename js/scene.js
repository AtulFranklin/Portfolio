/* scene.js - three.js night desk scene */
(async function () {
  "use strict";
  const S = window.SITE;
  const DESK = window.DESK;
  const host = document.getElementById("scene");
  const loader = document.getElementById("loader");
  const labelEl = document.getElementById("sceneLabel");
  const reduce = DESK.reduceMotion;
  const isFile = location.protocol === "file:";

  // flat desk took over
  const lite = () => !!window.DESK_LITE && !new URLSearchParams(location.search).get("snap");
  function fail() {
    if (window.DESK_GO_LITE && !new URLSearchParams(location.search).get("snap")) return window.DESK_GO_LITE(false);
    document.getElementById("sceneFallback").hidden = false;
    const hint = document.getElementById("heroHint");
    if (hint) hint.hidden = true;
    loader.classList.add("done");
  }

  const DP = window.DESK_PRELOAD || {};

  // webgl check
  let GL2 = false;
  try {
    if (DP.gl2) GL2 = true;
    else {
      const c = document.createElement("canvas");
      GL2 = !!c.getContext("webgl2");
      if (!(GL2 || c.getContext("webgl"))) return fail();
    }
  } catch (_) { return fail(); }

  // phones use the flat grid instead
  // ?snap=<object> renders one object for export
  const SNAP = new URLSearchParams(location.search).get("snap");
  if (!SNAP && window.matchMedia("(max-width: 720px)").matches) { loader.classList.add("done"); return; }
  if (lite()) return;

  const params = new URLSearchParams(location.search);
  const DEBUG = params.has("debug");
  const FXQ = params.get("fx");          // 0 = no fx, 1-4 = fixed quality
  const tStart = performance.now();
  const marks = { start: tStart };

  // procedural textures, workers started in maintenance.js
  const texP = DP.tex || new Promise((res, rej) => {
    if (window.DESK_TEX) return res(DESK_TEX.start());
    const s = document.createElement("script");
    s.src = "js/desk-textures.js";
    s.onload = () => res(DESK_TEX.start());
    s.onerror = rej;
    document.head.appendChild(s);
  });
  texP.catch(() => {});

  let THREE, RoundedBoxGeometry, mergeGeometries;
  try {
    [THREE, { RoundedBoxGeometry }, { mergeGeometries }] = await Promise.all([
      DP.three || import("three"),
      DP.rbox || import("three/addons/geometries/RoundedBoxGeometry.js"),
      DP.merge || import("three/addons/utils/BufferGeometryUtils.js"),
    ]);
  } catch (e) {
    console.warn("Three.js could not load", e);
    return fail();
  }
  marks.three = performance.now();
  if (lite()) return;
  // optional extras: area light + post fx
  let RectAreaLightUniformsLib = null, PP = null;
  const optional = [
    (DP.area || import("three/addons/lights/RectAreaLightUniformsLib.js"))
      .then((m) => { RectAreaLightUniformsLib = m.RectAreaLightUniformsLib; })
      .catch(() => {}),
  ];
  // msaa targets need webgl2
  if (!SNAP && FXQ !== "0" && GL2) {
    optional.push((DP.fx || Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
      import("three/addons/postprocessing/ShaderPass.js"),
    ])).then((m) => {
      PP = { EffectComposer: m[0].EffectComposer, RenderPass: m[1].RenderPass, GTAOPass: m[2].GTAOPass, UnrealBloomPass: m[3].UnrealBloomPass, OutputPass: m[4].OutputPass, ShaderPass: m[5].ShaderPass };
    }).catch((e) => { console.warn("Post-processing unavailable, rendering directly", e); }));
  }

  const FONT = '"Geist", system-ui, sans-serif';
  const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
  const C = { amber: "#F5B041", up: "#3DDC97", down: "#FF6B6B", paper: "#F3EEE4", ink: "#16130E" };

  // window view: skyline photo, else procedural city
  const SKY_PHOTO = "assets/skyline.jpg";
  const skyPhotoP = Promise.race([DP.sky || loadImage(SKY_PHOTO), new Promise((r) => setTimeout(() => r(null), 5000))]);
  // wait for fonts before drawing textures
  const fontsP = Promise.race([
    Promise.all([document.fonts.load('700 64px "Geist"'), document.fonts.load('500 32px "Geist Mono"')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => {});

  /* ---------------- seeded random ---------------- */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  let TX;
  try { TX = await texP; } catch (e) { console.warn("Desk textures could not load", e); return fail(); }
  if (lite()) return;
  if (DEBUG && window.DESK_TEX && DESK_TEX.stats) { const st = DESK_TEX.stats; console.log("[scene] textures", st.ms, "ms (" + st.mode + "):", st.jobs); }
  await Promise.all([fontsP].concat(optional));
  const skyPhoto = await skyPhotoP;
  if (lite()) return;

  /* ---------------- renderer / scene / camera ---------------- */
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const useFX = !!PP;
  // msaa scene target when post fx is on
  const renderer = new THREE.WebGLRenderer({ antialias: !useFX, powerPreference: "high-performance", alpha: !!SNAP, preserveDrawingBuffer: !!SNAP });
  const DPR = window.devicePixelRatio || 1;
  // pixel ratio per quality level
  const prFor = (lvl) => Math.min(DPR, mobile ? 1.5 : !useFX ? 1.75 : lvl >= 4 ? 2 : 1.5);
  renderer.setPixelRatio(prFor(4));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;        // redrawn on demand in draw()
  host.appendChild(renderer.domElement);
  if (RectAreaLightUniformsLib) RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#07080B");
  scene.fog = new THREE.Fog("#57557F", 150, 560);   // dusk haze over the city

  const pmrem = new THREE.PMREMGenerator(renderer);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 900);
  // seated close-up camera
  const camHome = new THREE.Vector3(0.25, 1.2, 0.9);
  const lookHome = new THREE.Vector3(0.3, 0.9, -0.9);
  const camStart = new THREE.Vector3();
  const DOLLY = new THREE.Vector3(-0.03, 0.08, 0.38);   // intro push-in offset

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
    // file:// images are cross-origin, unusable in webgl
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
  // world-space box uvs so plaster scale matches
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
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function half(cv) { const c = mkCanvas(cv.width >> 1, cv.height >> 1); c.getContext("2d").drawImage(cv, 0, 0, c.width, c.height); return c; }
  const T = {
    floor: tex(TX.floor.map, { repeat: [1, 1] }), floorN: tex(TX.floor.normal, { srgb: false, repeat: [1, 1] }), floorR: tex(half(TX.floor.rough), { srgb: false, repeat: [1, 1] }),
    desk: tex(TX.desk.map), deskN: tex(TX.desk.normal, { srgb: false }), deskR: tex(half(TX.desk.rough), { srgb: false }),
    plaster: tex(TX.plaster.map, { repeat: [1, 1] }), plasterN: tex(TX.plaster.normal, { srgb: false, repeat: [1, 1] }), plasterR: tex(TX.plaster.rough, { srgb: false, repeat: [1, 1] }),
    rug: tex(TX.rug.map), rugN: tex(TX.rug.normal, { srgb: false, repeat: [18, 11] }),
    leather: tex(TX.leather.map), leatherN: tex(TX.leather.normal, { srgb: false }), leatherR: tex(TX.leather.rough, { srgb: false }),
    micro: tex(TX.micro, { srgb: false, repeat: [3, 3] }),
  };
  const v2 = (a, b = a) => new THREE.Vector2(a, b);
  const M = {
    // dark warm plaster
    wall: new THREE.MeshStandardMaterial({ color: "#5E5852", map: T.plaster, normalMap: T.plasterN, normalScale: v2(0.55), roughnessMap: T.plasterR, roughness: 1, envMapIntensity: 0.7 }),
    stone: new THREE.MeshStandardMaterial({ color: "#8E867A", map: T.plaster, normalMap: T.plasterN, normalScale: v2(0.2), roughness: 0.32, envMapIntensity: 1.1 }),
    skirting: new THREE.MeshStandardMaterial({ color: "#1C1A19", roughness: 0.42, normalMap: T.micro, normalScale: v2(0.15) }),
    floor: new THREE.MeshPhysicalMaterial({ map: T.floor, normalMap: T.floorN, normalScale: v2(0.55), roughnessMap: T.floorR, roughness: 1, clearcoat: 0.3, clearcoatRoughness: 0.24, envMapIntensity: 1 }),
    desk: new THREE.MeshPhysicalMaterial({ map: T.desk, normalMap: T.deskN, normalScale: v2(0.45), roughnessMap: T.deskR, roughness: 1, clearcoat: 0.18, clearcoatRoughness: 0.38, envMapIntensity: 0.45 }),
    deskLeg: new THREE.MeshStandardMaterial({ color: "#17181B", roughness: 0.48, metalness: 0.55, normalMap: T.micro, normalScale: v2(0.25) }),
    beige: new THREE.MeshStandardMaterial({ color: "#CDBFA6", roughness: 0.52, normalMap: T.micro, normalScale: v2(0.12) }),
    beigeDark: new THREE.MeshStandardMaterial({ color: "#8F8370", roughness: 0.62, normalMap: T.micro, normalScale: v2(0.12) }),
    black: new THREE.MeshStandardMaterial({ color: "#121318", roughness: 0.42, metalness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: "#2A2C31", roughness: 0.32, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: "#B88A45", roughness: 0.28, metalness: 0.95 }),
    alu: new THREE.MeshStandardMaterial({ color: "#3A3732", roughness: 0.36, metalness: 0.85, envMapIntensity: 1.2 }),
    paper: new THREE.MeshStandardMaterial({ color: C.paper, roughness: 0.9 }),
    gear: new THREE.MeshPhysicalMaterial({ color: "#E8E0CB", roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.2 }),
    leather: new THREE.MeshStandardMaterial({ map: T.leather, normalMap: T.leatherN, normalScale: v2(0.6), roughnessMap: T.leatherR, roughness: 1 }),
    // glass: env reflection only, added on top
    glass: new THREE.MeshBasicMaterial({ color: 0x000000, combine: THREE.AddOperation, reflectivity: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  };

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight("#2C3756", "#1A120C", 0.8);
  scene.add(hemi);
  // warm bounce light near the desk
  const bounce = new THREE.PointLight("#FFAE6B", 1.6, 7, 2);
  bounce.position.set(0, 1.45, -1.15);   // above the lamp pool
  scene.add(bounce);

  const LAMP_CD = 5.5;
  const lampLight = new THREE.SpotLight("#FFC27A", LAMP_CD, 0, 0.66, 0.9, 2);   // soft edge, cone near the shade
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  lampLight.shadow.bias = -0.00025;
  lampLight.shadow.normalBias = 0.012;
  lampLight.shadow.camera.near = 0.12;
  lampLight.shadow.camera.far = 6;
  scene.add(lampLight, lampLight.target);

  const fill = new THREE.SpotLight("#FFB066", 9, 0, 0.9, 0.9, 2);
  fill.position.set(0.4, 2.6, 2.8);
  fill.target.position.set(0.3, 0.78, -0.4);
  scene.add(fill, fill.target);

  const glow = new THREE.PointLight("#FF9A3D", 1.2, 4, 2);
  scene.add(glow);

  // warm ceiling downlights, no shadows
  const CEIL_Y = 4.3, CEIL_CD = 26;
  const ceilingLights = [];
  [[-2.3, -0.9], [0, -0.9], [2.3, -0.9], [-2.3, 1.5], [0, 1.5], [2.3, 1.5]].forEach(([x, z]) => {
    const l = new THREE.SpotLight("#FFC38A", CEIL_CD * (z > 0 ? 1.15 : 1), 9, 1.05, 1, 2);
    l.position.set(x, CEIL_Y, z);
    l.target.position.set(x * 0.92, 0, z + 0.25);
    scene.add(l, l.target);
    ceilingLights.push(l);
  });
  // chandelier, light only
  const CHAND = { x: 0.1, y: 3.7, z: 0.5 };
  [[0, 0, 22], [-0.35, 0.2, 6], [0.35, 0.2, 6], [0, -0.35, 6]].forEach(([dx, dz, cd]) => {
    const l = new THREE.PointLight("#FFB670", cd, 11, 2);
    l.position.set(CHAND.x + dx, CHAND.y, CHAND.z + dz);
    scene.add(l);
    ceilingLights.push(l);
  });
  // ceiling bounce fill
  hemi.color.set("#4A4A5C"); hemi.groundColor.set("#2A1C12"); hemi.intensity = 1.0;

  /* ---------------- room ---------------- */
  const WALL_Z = -1.85, WIN = { x0: -2.7, x1: 2.7, y0: 0.5, y1: 3.4 };   // low sill, glass right behind the desk
  const WALL_T = 0.3, ROOM_X = 4.8, GLASS_Z = WALL_Z - 0.2;

  // oak plank floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 1;
  floor.receiveShadow = true;
  [T.floor, T.floorN, T.floorR].forEach((t) => t.repeat.set(30 / FLOOR_TILE, 14 / FLOOR_TILE));
  scene.add(floor);

  // wool rug under the desk
  const RUG_T = 0.012;
  const rug = new THREE.Mesh(
    new RoundedBoxGeometry(4.6, RUG_T, 2.8, 2, 0.005),
    new THREE.MeshPhysicalMaterial({ map: T.rug, normalMap: T.rugN, normalScale: v2(0.7), roughness: 0.96, sheen: 0.6, sheenRoughness: 0.75, sheenColor: new THREE.Color("#5A4636"), envMapIntensity: 0.4 })
  );
  rug.position.set(0.1, RUG_T / 2, 0.15);
  rug.receiveShadow = true;
  scene.add(rug);

  // back wall, window opening, side walls, skirting
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

  const aoHidden = [];          // transparent bits, skip in ao
  let winGlassMat = null;
  // window: sill, frame, mullions, beads, glass
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
    // glazing beads on each pane
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

    // fake desk + lamp reflection painted on the glass
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
      blob(0.3, 0.95, 1.1, 0.35, "rgba(120,72,34,1)");    // the warm desk area
      blob(-0.14, 1.02, 0.14, 0.14, "rgba(255,190,110,1)"); // the lamp
      blob(-0.14, 1.02, 0.04, 0.04, "rgba(255,230,190,1)");
    });
    winGlassMat.color.setScalar(0.12);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), winGlassMat);
    glass.position.set(0, (WIN.y0 + WIN.y1) / 2, GLASS_Z - 0.004);
    glass.renderOrder = 2;
    scene.add(glass);
    aoHidden.push(glass);
  }

  // cool dusk light through the window
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


  /* ---------------- procedural nyc skyline ---------------- */
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

    /* ---- dusk sky + clouds ---- */
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
      // far horizon silhouettes + lights
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

    /* ---- manhattan blocks ---- */
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
    // avenue lights
    for (let u0 = -60; u0 <= 60; u0 += AV) for (let d = D0; d < FAR; d += 1.2) {
      const u = u0 + centre(d);
      if (Math.abs(u - centre(d)) > halfW(d)) continue;
      const [x, z] = W(u, d); if (inView(x, z, 6)) lights.push(x, GROUND + 0.25, z);
    }

    /* ---- boroughs: low-rise, mostly lights ---- */
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

    /* ---- landmark towers ---- */
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

    /* ---- land, rivers, street lights ---- */
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
    { // harbour past the tip
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

  /* ---------------- photo view ---------------- */
  let skyPlane = null;
  const skyBoost = { value: 0 };
  const SKY = { dist: 60, wDeg: 48, horizon: 455 / 1277 };   // horizon row in skyline.jpg
  function buildPhotoView(img) {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.needsUpdate = true;
    const w = 2 * SKY.dist * Math.tan(THREE.MathUtils.degToRad(SKY.wDeg / 2));
    const h = w * (img.height / img.width);
    const mat = new THREE.MeshBasicMaterial({ map: t, fog: false, toneMapped: false, color: "#D9D6E0" });
    // with bloom, push brightest photo pixels above white
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBoost = skyBoost;
      sh.fragmentShader = "uniform float uBoost;\n" + sh.fragmentShader.replace("#include <map_fragment>",
        "#include <map_fragment>\n  float skyL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\n  diffuseColor.rgb *= 1.0 + uBoost * smoothstep(0.66, 0.8, skyL);");
    };
    skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    skyPlane.userData.w = w; skyPlane.userData.h = h;
    skyPlane.position.set(0, 0, camHome.z - SKY.dist);
    scene.add(skyPlane);
  }
  if (skyPhoto) { buildPhotoView(skyPhoto); camera.far = 140; } else buildCity();
  camera.updateProjectionMatrix();

  /* ---------------- desk ---------------- */
  const DESK_Y = 0.76, DESK_Z = -0.95, DESK_W = 1.6, DESK_D = 0.75, DESK_X = 0.2;   // real desk, 1.6 x 0.75 m
  const TOP = DESK_Y + 0.025;
  // close-up layout: x, z from desk centre, turn
  const LAY = {
    crt: [0.2, -0.12, 0], kb: [0.2, 0.2, 0], frame: [0.64, -0.14, -0.35],
    gear: [0.88, -0.1, -0.3], envelope: [-0.3, 0.14, 0.2], lamp: [-0.47, -0.27, 0],
  };
  // real-world scale per object
  const SCALE = { crt: 0.63, kb: 0.9, gear: 0.66 };
  const place = (g, k, y = TOP) => { const [x, z, ry] = LAY[k]; g.position.set(x, y, DESK_Z + z); g.rotation.y = ry; g.scale.setScalar(SCALE[k] || 1); };
  // walnut slab, 55 mm, soft edges
  const DESK_T = 0.055, UNDER = TOP - DESK_T;
  const deskTop = new THREE.Mesh(new RoundedBoxGeometry(DESK_W, DESK_T, DESK_D, 4, 0.011), M.desk);
  deskTop.position.set(DESK_X, TOP - DESK_T / 2, DESK_Z);
  deskTop.castShadow = deskTop.receiveShadow = true;
  scene.add(deskTop);
  // black steel sled frame
  {
    const parts = [];
    const tube = (w, h, d, x, y, z) => { const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.2); g.translate(x, y, z); parts.push(g); };
    const LX = DESK_W / 2 - 0.13, LZ = DESK_D / 2 - 0.07, S = 0.05, FOOT = 0.012;
    for (const sx of [-1, 1]) {
      const x = DESK_X + sx * LX;
      for (const sz of [-1, 1]) tube(S, UNDER - FOOT - 0.04, S, x, FOOT + 0.04 + (UNDER - FOOT - 0.04) / 2, DESK_Z + sz * LZ);   // posts
      tube(S, 0.04, LZ * 2 + S, x, FOOT + 0.02, DESK_Z);                    // foot rail
      tube(S, 0.035, LZ * 2 + S, x, UNDER - 0.0175, DESK_Z);                // top rail under the slab
      for (const sz of [-1, 1]) { const g = new THREE.CylinderGeometry(0.016, 0.018, FOOT, 16); g.translate(x, FOOT / 2, DESK_Z + sz * (LZ + 0.005)); parts.push(g); }
    }
    tube(LX * 2 - S, 0.05, 0.025, DESK_X, UNDER - 0.025, DESK_Z - LZ);     // back stretcher
    // cable tray under the back edge
    tube(0.9, 0.004, 0.11, DESK_X, UNDER - 0.085, DESK_Z - LZ + 0.08);
    tube(0.9, 0.07, 0.004, DESK_X, UNDER - 0.05, DESK_Z - LZ + 0.135);
    const frameMesh = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), M.deskLeg);
    frameMesh.castShadow = frameMesh.receiveShadow = true;
    scene.add(frameMesh);
  }
  // leather desk pad
  const PAD_T = 0.004;
  {
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.8, PAD_T, 0.4, 1, 0.0015), M.leather);
    pad.position.set(LAY.kb[0], TOP + PAD_T / 2, DESK_Z + LAY.kb[1] - 0.03);
    pad.rotation.y = LAY.kb[2] * 0.5;
    pad.receiveShadow = true; pad.castShadow = true;
    scene.add(pad);
  }
  // contact shadow blobs (one merged mesh)
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
    // blob size per object, placed from LAY
    const BLOB = { crt: [0.62, 0.56], kb: [0.62, 0.26], frame: [0.28, 0.16, 0, -0.02], gear: [0.24, 0.24], envelope: [0.29, 0.15], lamp: [0.26, 0.26] };
    const blobs = new THREE.Mesh(blobGeo(Object.keys(BLOB).map((k) => {
      const [x, z, ry] = LAY[k], [w, d, ox = 0, oz = 0] = BLOB[k], sc = SCALE[k] || 1;
      return [x + ox, y + (k === "kb" ? PAD_T : 0), DESK_Z + z + oz, w * sc, d * sc, ry];
    })), blobMat);
    blobs.renderOrder = 1;
    scene.add(blobs);
    aoHidden.push(blobs);
    // under the desk feet / frame, on the rug
    const fy = RUG_T + 0.0008;
    const legBlobs = new THREE.Mesh(blobGeo([-1, 1].map((sx) => [DESK_X + sx * (DESK_W / 2 - 0.13), fy, DESK_Z, 0.22, DESK_D + 0.08, 0])), blobMat);
    legBlobs.renderOrder = 1;
    scene.add(legBlobs);
    aoHidden.push(legBlobs);
  }

  // led ticker texture
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
  // ticker not added to scene

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

  /* desk objects that open a crate, matched by icon */
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
  // 1024 screen, crisp at close range
  const CRT_W = 1024, CRT_H = 768;
  const crtTex = canvasTex(CRT_W, CRT_H, () => {});
  const WHY_TITLE = String(S.whyTitle || "").trim() || "Why hire Atul?";
  let crtKey = "";
  const candles = [];
  { let v = 0.5; for (let i = 0; i < 40; i++) { const o = v; v = Math.min(0.85, Math.max(0.15, v + (rnd() - 0.47) * 0.12)); candles.push([o, v]); } }
  function drawCRT(t) {
    if (window.RETRO && typeof window.RETRO.drawScreen === "function") {
      // redraw on caret, button or clock change
      const key = reduce ? "s" + new Date().getMinutes() : Math.floor(t * 1.8) % 2 + "" + Math.floor(t * 1.4) % 2 + new Date().getMinutes();
      if (key === crtKey) return;
      crtKey = key;
      window.RETRO.drawScreen(crtTex.userData.ctx, CRT_W, CRT_H, t);
      crtTex.needsUpdate = true;
      return;
    }
    const g = crtTex.userData.ctx, w = 640, h = 480;
    g.setTransform(CRT_W / 640, 0, 0, CRT_H / 480, 0, 0);
    const bg = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h / 2, w * 0.7);
    bg.addColorStop(0, "#10261C"); bg.addColorStop(1, "#040907");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // header
    g.fillStyle = "rgba(61,220,151,.75)"; g.font = `500 20px ${MONO}`; g.textBaseline = "top";
    g.fillText("ATUL.F", 34, 28);
    g.fillStyle = "#3DDC97"; g.fillText("▲ LIVE", w - 120, 28);
    // title, last word on its own line
    const words = WHY_TITLE.split(/\s+/), last = words.pop(), first = words.join(" ").toUpperCase();
    g.font = `700 64px ${FONT}`;
    const fs = Math.min(64, Math.floor(64 * (w - 68) / Math.max(1, g.measureText(first).width, g.measureText(last).width)));
    g.font = `700 ${fs}px ${FONT}`;
    g.fillStyle = "#ECE7DD"; if (first) g.fillText(first, 34, 70);
    g.fillStyle = "#F5B041"; g.fillText(last, 34, first ? 70 + fs * 1.03 : 70);
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
    // same body as the atul-os computer
    const caseMat = new THREE.MeshStandardMaterial({ color: "#CECBC0", roughness: 0.5, normalMap: T.micro, normalScale: v2(0.1) });
    const caseDark = new THREE.MeshStandardMaterial({ color: "#B6B1A3", roughness: 0.58, normalMap: T.micro, normalScale: v2(0.1) });
    const bezelMat = new THREE.MeshStandardMaterial({ color: "#2B2924", roughness: 0.7 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.5, 0.5, 6, 0.028), caseMat);
    body.position.y = 0.33;
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.38, 0.22, 5, 0.03), caseMat);
    back.position.set(0, 0.32, -0.3);
    // dark inner bezel
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.579, 0.438, 0.012, 3, 0.01), bezelMat);
    bezel.position.set(0, 0.336, 0.247);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.556, 0.417), crtScreenMat);
    screen.position.set(0, 0.336, 0.2535);
    crtGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.556, 0.417), M.glass);   // reflections on the tube face
    crtGlass.position.set(0, 0.336, 0.254);
    crtGlass.renderOrder = 2;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 56), caseDark);
    stand.position.y = 0.04;
    // chin: badge, vents, led, power button
    const CHIN_Y = 0.1;
    const BADGE_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    const badgeTex = canvasTex(1024, 128, (g, w, h) => {
      g.font = `700 64px ${BADGE_FONT}`; g.textBaseline = "middle"; g.fillStyle = "#8D846F";
      let x = 6;
      for (const ch of "ATUL-OS") { g.fillText(ch, x, h / 2); x += g.measureText(ch).width + 21; }
      g.font = `400 64px ${BADGE_FONT}`; x += 22;
      for (const ch of "2.6") { g.fillText(ch, x, h / 2); x += g.measureText(ch).width + 6; }
    });
    const decal = (map, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const badge = decal(badgeTex, 0.08, 0.01);
    badge.position.set(-0.287 + 0.04, CHIN_Y, 0.2503);
    const ventTex = canvasTex(512, 32, (g, w, h) => {
      for (let x = 0; x < w; x += 18) { g.fillStyle = "#A9A08A"; g.fillRect(x, 0, 5, h); g.fillStyle = "#ECE6D6"; g.fillRect(x + 5, 0, 2, h); }
    });
    const vents = decal(ventTex, 0.127, 0.009);
    vents.position.set(0.171, CHIN_Y, 0.2503);
    [badge, vents].forEach((m) => { m.castShadow = m.receiveShadow = false; m.renderOrder = 1; aoHidden.push(m); });
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 20), new THREE.MeshBasicMaterial({ color: "#7DD36A" }));
    led.position.set(0.248, CHIN_Y, 0.2505);
    const knob1 = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.015, 0.008, 2, 0.003), new THREE.MeshStandardMaterial({ color: "#CBC3AE", roughness: 0.5 }));
    knob1.position.set(0.273, CHIN_Y, 0.251);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.009, 0.0025), new THREE.MeshStandardMaterial({ color: "#9D937B", roughness: 0.7 }));
    slot.position.set(0.273, CHIN_Y, 0.2552);
    crt.add(body, back, bezel, screen, crtGlass, stand, knob1, slot, led, badge, vents);
    place(crt, "crt");
  }
  hot(crt, WHY_TITLE, () => DESK.openPanel("why"));
  crtGlass.castShadow = crtGlass.receiveShadow = false;
  aoHidden.push(crtGlass);
  glow.position.set(LAY.crt[0], TOP + 0.36 * SCALE.crt, DESK_Z + LAY.crt[1] + 0.4 * SCALE.crt);
  glow.color.set("#3DDC97"); glow.intensity = 0.1;

  /* ---- keyboard ---- */
  const kb = new THREE.Group();
  let kbLegend = null;
  {
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.025, 0.17, 2, 0.008), M.beige);
    base.position.y = 0.0125;
    kb.add(base);
    const keyGeo = new RoundedBoxGeometry(0.026, 0.014, 0.026, 2, 0.004);
    // bottom row: space bar spans cols 4-10
    const SP0 = 4, SP1 = 10;
    const keys = new THREE.InstancedMesh(keyGeo, M.beigeDark, 15 * 5 - (SP1 - SP0));
    const d = new THREE.Object3D(); let k = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) {
      if (r === 4 && c > SP0 && c <= SP1) continue;
      const span = r === 4 && c === SP0 ? SP1 - SP0 + 1 : 1;
      d.position.set(-0.217 + (c + (span - 1) / 2) * 0.031, 0.031, -0.062 + r * 0.031);
      d.scale.set(span > 1 ? (span * 0.031 - 0.005) / 0.026 : 1, 1, 1);
      d.updateMatrix(); keys.setMatrixAt(k++, d.matrix);
    }
    kb.add(keys);
    // key legends decal
    const ROWS = [
      ["Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "\\", "Bk"],
      ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "Del", "Ins"],
      ["Ctrl", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Ret", "Pg", "Up"],
      ["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Shift", "\u2191", "Pg", "Dn"],
      ["Fn", "Alt", "Opt", "Cmd", "", "", "", "", "", "", "", "Cmd", "\u2190", "\u2193", "\u2192"],
    ];
    const KW = 0.031 * 15, KD = 0.031 * 5, PX = 2048 / KW;
    const legend = canvasTex(2048, Math.round(KD * PX), (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(34,28,20,.9)"; g.textAlign = "center"; g.textBaseline = "middle";
      ROWS.forEach((row, r) => row.forEach((t, c) => {
        if (!t) return;
        g.font = `700 ${t.length > 2 ? 30 : t.length > 1 ? 38 : 60}px ${FONT}`;
        g.fillText(t, (c + 0.5) * 0.031 * PX, (r + 0.5) * 0.031 * PX + 2, 0.024 * PX);
      }));
    });
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(KW, KD), new THREE.MeshStandardMaterial({ map: legend, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(-0.217 - 0.0155 + KW / 2, 0.0381, -0.062 - 0.0155 + KD / 2);
    cap.renderOrder = 1;
    kb.add(cap);
    kbLegend = cap;
    place(kb, "kb", TOP + PAD_T);   // resting on the leather pad
  }
  // not clickable, just on the pad
  kb.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(kb);
  kbLegend.castShadow = false;
  aoHidden.push(kbLegend);

  /* ---- photo frame ---- */
  const frame = new THREE.Group();
  const photoMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  let frameGlass;
  {
    const PW = 0.18, PH = 0.23;   // 8x10 frame, 0.22 x 0.27 outside
    const border = new THREE.Mesh(new RoundedBoxGeometry(PW + 0.04, PH + 0.04, 0.025, 2, 0.006), new THREE.MeshPhysicalMaterial({ color: "#2A1C12", roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.25 }));
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), photoMat);
    photo.position.z = 0.0135;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.19, 0.012), new THREE.MeshStandardMaterial({ color: "#2A1C12" }));
    strut.position.set(0, -0.022, -0.052); strut.rotation.x = -0.45;
    frameGlass = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), M.glass);
    frameGlass.position.z = 0.0145; frameGlass.renderOrder = 2;
    const inner = new THREE.Group();
    inner.add(border, photo, strut, frameGlass);
    inner.position.y = (PH + 0.04) / 2;
    inner.rotation.x = -0.1;
    frame.add(inner);
    place(frame, "frame");
    // monogram until the photo loads
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

  /* ---- role cards box ---- */
  const roles = new THREE.Group();
  {
    const BW = 0.36, BD = 0.16, BH = 0.099, T = 0.012;            // width / depth / wall height / thickness
    const shell = new THREE.MeshStandardMaterial({ color: "#1E1F24", roughness: 0.4, metalness: 0.55 });
    const inside = new THREE.MeshStandardMaterial({ color: "#0C0C0F", roughness: 0.9 });
    const wall = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), m || shell); b.position.set(x, y, z); roles.add(b); };
    wall(BW, BH, T, 0, BH / 2, BD / 2 - T / 2);                     // front lip (hides the card bottoms)
    wall(BW, BH + 0.01, T, 0, (BH + 0.01) / 2, -BD / 2 + T / 2);    // back
    wall(T, BH, BD, -BW / 2 + T / 2, BH / 2, 0);                    // sides
    wall(T, BH, BD, BW / 2 - T / 2, BH / 2, 0);
    wall(BW, 0.01, BD, 0, 0.005, 0);                                // floor
    const well = new THREE.Mesh(new THREE.PlaneGeometry(BW - 2 * T, BD - 2 * T), inside);  // dark interior
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
    roles.position.set(0, TOP, DESK_Z);
  }
  // card holder off the desk, snap only

  /* ---- spur gear on a stand ---- */
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
    place(gearGroup, "gear");
  }
  hotCrate(gearGroup, "engineering", "Engineering");

  /* ---- envelope ---- */
  const envelope = new THREE.Group();
  {
    // dl envelope, 0.24 x 0.105
    const top = canvasTex(960, 420, (g, w, h) => {
      g.scale(2, 2); w /= 2; h /= 2;
      g.fillStyle = "#EDE4D2"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(22,19,14,.12)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * 0.55); g.lineTo(w, 0); g.stroke();
      // stamp
      g.fillStyle = "#F5B041"; g.fillRect(w - 74, 16, 54, 64);
      g.strokeStyle = "#1A1206"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(w - 67, 70); g.lineTo(w - 53, 50); g.lineTo(w - 42, 59); g.lineTo(w - 27, 32); g.stroke();
      g.fillStyle = C.ink; g.font = `600 30px ${FONT}`; g.textAlign = "left";
      g.fillText("Leave a message", 30, h - 62);
      g.fillStyle = "#5A5347"; g.font = `500 19px ${MONO}`;
      g.fillText("ATUL ABRAHAM · HOBOKEN", 30, h - 30);
    });
    const env = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.105), [M.paper, M.paper, new THREE.MeshStandardMaterial({ map: top, roughness: 0.9 }), M.paper, M.paper, M.paper]);
    env.position.y = 0.003;
    envelope.add(env);
    place(envelope, "envelope");
  }
  hot(envelope, "Leave a message", () => DESK.openPanel("contact"));

  /* ---- desk lamp (click to toggle) ---- */
  function rod(a, b, r, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 20), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  }
  const lamp = new THREE.Group();
  const bulbMat = new THREE.MeshBasicMaterial({ color: "#FFE2B0" });
  const shadeInMat = new THREE.MeshBasicMaterial({ color: "#FFB866", side: THREE.BackSide });
  const lampHead = [];
  const LAMP_BASE = new THREE.Vector3(LAY.lamp[0], TOP, DESK_Z + LAY.lamp[1]);
  // back-left desk lamp, head beside the monitor
  const L0 = new THREE.Vector3(0, 0.03, 0), J1 = new THREE.Vector3(0.01, 0.27, -0.02), J2 = new THREE.Vector3(0.13, 0.35, 0.08);
  const SH = new THREE.Vector3(0.33, 0.24, 0.2);
  const lampAim = new THREE.Vector3(0.04, TOP, DESK_Z);   // pool beside the monitor
  const lampDir = new THREE.Vector3().subVectors(lampAim, SH.clone().add(LAMP_BASE)).normalize();
  {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.026, 64), M.black);
    base.position.y = 0.015;
    const shadeMat = new THREE.MeshStandardMaterial({ color: "#1A1B20", roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 64, 1, true), shadeMat);
    shade.position.copy(SH);
    shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lampDir);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 20), M.black);
    cap.position.copy(SH).addScaledVector(lampDir, -0.065);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 32, 20), bulbMat);
    bulb.position.copy(SH).addScaledVector(lampDir, 0.025);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.078, 64), new THREE.MeshBasicMaterial({ color: "#FFD08A", side: THREE.DoubleSide, transparent: true, opacity: 0.22 }));
    inner.position.copy(SH).addScaledVector(lampDir, 0.07);
    inner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), lampDir);
    const j1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 24, 16), M.brass); j1.position.copy(J1);
    const j2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 24, 16), M.brass); j2.position.copy(J2);
    // warm inside of the shade
    const shadeIn = new THREE.Mesh(new THREE.ConeGeometry(0.077, 0.135, 64, 1, true), shadeInMat);
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
  let lampOn = false, lampLevel = 0;   // off by default
  function setLamp(on) { lampOn = on; shadowDirty = true; }
  // lamp level to lights, bulb, shade, env
  function applyLamp(L) {
    lampLight.intensity = LAMP_CD * L;
    fill.intensity = 4.5 + 3 * L;
    const hdr = composer ? 1 + 1.5 * L : 1;   // mild bulb bloom
    bulbMat.color.setRGB((0.25 + 0.75 * L) * hdr, (0.22 + 0.67 * L) * hdr, (0.18 + 0.51 * L) * hdr);
    const si = 0.03 + 0.8 * L;
    shadeInMat.color.setRGB(si, 0.5 * si, 0.16 * si);
    const env = L > 0.5 ? envOn : envOff;
    if (scene.environment !== env) scene.environment = M.glass.envMap = winGlassMat.envMap = env;
    winGlassMat.color.setScalar(0.02 + 0.1 * L);
  }

  // crates removed
  /* ---- screen rect for overlay origin ---- */
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
  /* ---------------- room env map (lamp on / off) ---------------- */
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
    const P = new THREE.Vector3(0.05, 1.15, -0.4);           // probe above the desk
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
      put(new THREE.CircleGeometry(1.2, 32), basic(new THREE.Color(0.06, 0.035, 0.018)), -0.25, 1.2, WALL_Z + 0.01);   // lamp spill on the wall
    }
    const rt = pmrem.fromScene(es, 0.02, 0.05, 30);
    es.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    return rt.texture;
  }
  /* group faces by material to cut draw calls */
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

  const envOn = buildEnv(true), envOff = buildEnv(false);
  scene.environment = M.glass.envMap = winGlassMat.envMap = envOff;

  /* ---------------- post fx: ao, bloom, msaa ---------------- */
  let composer = null, gtaoPass = null, bloomPass = null, rtScene = null, rtPost = null, rtMid = null;
  let fxLevel = useFX ? Math.max(1, Math.min(4, +FXQ || 4)) : 0;
  let autoFX = useFX && !FXQ;
  if (useFX) {
    try {
      // msaa instead of smaa
      rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples || 0) });
      composer = new PP.EffectComposer(renderer, rtScene);
      // only the scene buffer is msaa
      composer.renderTarget2.dispose();
      composer.renderTarget2 = rtPost = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
      rtMid = rtPost.clone();
      // squash hdr before the msaa resolve, else bright edges stay jagged
      const squashed = new Set();
      scene.traverse((o) => {
        if (!o.material) return;
        for (const m of [].concat(o.material)) {
          if (squashed.has(m)) continue;
          squashed.add(m);
          const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
          m.onBeforeCompile = (sh, r) => {
            prev.call(m, sh, r);
            sh.fragmentShader = sh.fragmentShader.replace("#include <fog_fragment>", "#include <fog_fragment>\n  gl_FragColor.rgb /= 1.0 + max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));");
          };
          m.customProgramCacheKey = () => "squash" + key;
        }
      });
      composer.addPass(new PP.RenderPass(scene, camera));
      // undo the squash after the resolve
      const unsquash = new PP.ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); c.rgb /= max(1.0 - max(c.r, max(c.g, c.b)), 1e-3); gl_FragColor = c; }",
      });
      // keep fullscreen passes off the msaa buffer
      const uRender = unsquash.render.bind(unsquash);
      unsquash.needsSwap = false;
      unsquash.render = (r, w, rd, dt, mask) => { uRender(r, rtPost, rtScene, dt, mask); composer.readBuffer = rtPost; composer.writeBuffer = rtMid; };
      composer.addPass(unsquash);
      gtaoPass = new PP.GTAOPass(scene, camera, 256, 256);
      gtaoPass.updateGtaoMaterial({ radius: 0.3, distanceExponent: 1.6, thickness: 1, scale: 1.1, samples: 8 });
      gtaoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 8, rings: 2, samples: 8 });
      gtaoPass.blendIntensity = 0.85;
      const gSet = gtaoPass.setSize.bind(gtaoPass);              // AO at half res, quarter pixels
      gtaoPass.setSize = (w, h) => gSet(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
      const gRender = gtaoPass.render.bind(gtaoPass);            // glass / decals stay out of the AO
      gtaoPass.render = (a, b, c, d, e) => { for (const o of aoHidden) o.visible = false; gRender(a, b, c, d, e); for (const o of aoHidden) o.visible = true; };
      composer.addPass(gtaoPass);
      bloomPass = new PP.UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.45, 2.6);
      const bSet = bloomPass.setSize.bind(bloomPass);            // bloom capped at 1.5x res
      bloomPass.setSize = (w, h) => { const k = Math.min(1, 1.5 / renderer.getPixelRatio()); bSet(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); };
      composer.addPass(bloomPass);
      // vignette + dither folded into output
      const outPass = new PP.OutputPass(), fs = outPass.material.fragmentShader, cut = fs.lastIndexOf("}");
      outPass.material.fragmentShader = fs.slice(0, cut) + `
        float vig = smoothstep(0.98, 0.38, length((vUv - 0.5) * vec2(1.0, 1.2)));
        gl_FragColor.rgb *= mix(0.8, 1.0, vig);
        gl_FragColor.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      }`;
      composer.addPass(outPass);
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
  let shadowDirty = true;
  function draw(dt) {
    // once per draw, ao re-renders the scene
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    if (composer) {
      // scene always lands in the msaa buffer
      composer.readBuffer = rtScene; composer.writeBuffer = rtPost;
      composer.render(dt);
    } else renderer.render(scene, camera);
  }

  /* ---------------- layout / resize ---------------- */
  let W = 1, H = 1, portrait = false;
  // camera per aspect: wide, square-ish, portrait
  const VIEWS = {
    wide: { fov: 38, cam: [0.2, 1.2, 0.5], look: [0.2, 0.86, -1.9] },
    square: { fov: 46, cam: [0.2, 1.24, 0.3], look: [0.2, 0.85, -1.85] },
    tall: { fov: 56, cam: [0.2, 1.45, 0.45], look: [0.2, 0.74, -1.5] },
  };
  const fitBox = new THREE.Box3(), fitV = new THREE.Vector3();
  function rectOf(obj) {
    fitBox.setFromObject(obj, true);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      fitV.set(i & 1 ? fitBox.max.x : fitBox.min.x, i & 2 ? fitBox.max.y : fitBox.min.y, i & 4 ? fitBox.max.z : fitBox.min.z).project(camera);
      const x = ((fitV.x + 1) / 2) * W, y = ((1 - fitV.y) / 2) * H;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }
  const projY = (x, y, z) => ((1 - fitV.set(x, y, z).project(camera).y) / 2) * H;
  // tight box per line of hero text
  function heroLines() {
    const el = document.querySelector(".hero-copy"), hr = host.getBoundingClientRect(), out = [];
    if (!el) return out;
    for (const c of el.children) {
      const rg = document.createRange();
      rg.selectNodeContents(c);
      for (const r of rg.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        out.push({ left: r.left - hr.left, right: r.right - hr.left, top: r.top - hr.top, bottom: r.bottom - hr.top });
      }
    }
    return out;
  }
  // pc centred, props clear of the copy
  function fitView() {
    const aspect = W / H, v = portrait ? VIEWS.tall : aspect < 1.25 ? VIEWS.square : VIEWS.wide;
    camHome.fromArray(v.cam); lookHome.fromArray(v.look);
    const lines = heroLines(), pad = Math.max(12, W * 0.012);
    const all = [crt, frame, lamp, kb, gearGroup, envelope];
    let dx = 0, dy = 0;
    for (let i = 0, fov = v.fov; i < 6; i++, fov += 2) {
      camera.fov = fov; camera.clearViewOffset();
      camera.position.copy(camHome); camera.lookAt(lookHome);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      const R = all.map(rectOf), rl = R[2];
      const x0 = Math.min(...R.map((r) => r.x0)), x1 = Math.max(...R.map((r) => r.x1));
      let ok = x1 - x0 <= W - 2 * pad;
      dx = 0;
      if (!ok) dx = (W - x0 - x1) / 2;
      else if (x0 < pad) dx = pad - x0;
      else if (x1 > W - pad) dx = W - pad - x1;
      // front edge low in frame
      const front0 = projY(camHome.x, TOP, DESK_Z + DESK_D / 2);
      dy = H * (portrait ? 0.9 : 0.88) - front0;
      // arm may cross the copy, head may not
      const RH = R.map((r, k) => (all[k] === lamp ? rectOf(lampHead[1]) : r));
      for (let pass = 0; pass < 3; pass++) for (const h of lines) for (const r of RH) {
        if (r.x0 + dx < h.right + pad && r.x1 + dx > h.left - pad && r.y0 + dy < h.bottom + pad && r.y1 + dy > h.top - pad) dy = h.bottom + pad - r.y0;
      }
      // desk front edge stays in frame
      if (front0 + dy > H * 0.95) ok = false;
      // lamp stays under the top bar
      if (rl.y0 + dy < Math.min(40, H * 0.05)) ok = false;
      if (DEBUG) console.log("[scene] fit", fov, JSON.stringify({ dx: Math.round(dx), dy: Math.round(dy), front0: Math.round(front0), crt: [R[0].x0, R[0].y0].map(Math.round) }));
      if (ok) break;
    }
    camera.setViewOffset(W, H, -dx, -dy, W, H);
    camera.updateProjectionMatrix();
    camStart.copy(camHome).add(DOLLY);
    if (DEBUG) console.log("[scene] view", W + "x" + H, "fov", camera.fov, "shift", Math.round(dx), Math.round(dy));
  }
  // skyline photo covers the frustum
  function fitSky() {
    if (!skyPlane) return;
    camera.position.copy(camHome); camera.lookAt(lookHome); camera.updateMatrixWorld();
    const z = camHome.z - SKY.dist, ex = [Infinity, -Infinity], ey = [Infinity, -Infinity];
    for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const d = fitV.set(nx, ny, 0.5).unproject(camera).sub(camHome);
      const k = (z - camHome.z) / d.z, px = camHome.x + d.x * k, py = camHome.y + d.y * k;
      ex[0] = Math.min(ex[0], px); ex[1] = Math.max(ex[1], px); ey[0] = Math.min(ey[0], py); ey[1] = Math.max(ey[1], py);
    }
    const u = skyPlane.userData, m = 1.12;           // margin for parallax + dolly
    const hy = camHome.y - SKY.dist * 0.035;         // horizon a touch below eye level
    const s = Math.max(((ex[1] - ex[0]) * m) / u.w, ((ey[1] - hy) * m) / (u.h * SKY.horizon), ((hy - ey[0]) * m) / (u.h * (1 - SKY.horizon)));
    skyPlane.scale.set(s, s, 1);
    skyPlane.position.set((ex[0] + ex[1]) / 2, hy + u.h * s * (SKY.horizon - 0.5), z);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const pr = prFor(fxLevel);
    if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) {
      composer.setPixelRatio(pr); composer.setSize(W, H);
      rtMid.setSize(rtPost.width, rtPost.height);
      // skip msaa depth resolve
      renderer.properties.get(rtScene).__ignoreDepthValues = true;
    }
    shadowDirty = true;
    const aspect = W / H;
    portrait = aspect < 0.9;
    camera.aspect = aspect;
    fitView();
    fitSky();
  }
  applyFX(fxLevel);           // also runs resize()
  window.addEventListener("resize", resize);
  // refit when the hero copy reflows
  const heroCopy = document.querySelector(".hero-copy");
  if (!SNAP && heroCopy && window.ResizeObserver) new ResizeObserver(() => resize()).observe(heroCopy);

  /* ---------------- pointer / picking ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-9, -9);
  const parallax = new THREE.Vector2(0, 0);
  const parallaxSmooth = new THREE.Vector2(0, 0);
  let hovered = null, downAt = null, lastPointer = -1e9;
  const canvas = renderer.domElement;
  /* ---- static hit boxes ---- */
  const HIT_PAD = 0.008, HIT_PAD_FLAT = 0.022, HIT_HOVER = 0.007, HIT_LIFT = 0.035;
  const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const hitMeshes = [];
  function hitGeo(b, c, pad, padY, up) {
    const g = new THREE.BoxGeometry(b.max.x - b.min.x + 2 * pad, b.max.y - b.min.y + 2 * padY + up, b.max.z - b.min.z + 2 * pad);
    g.translate((b.min.x + b.max.x) / 2 - c.x, (b.min.y + b.max.y) / 2 + up / 2 - c.y, (b.min.z + b.max.z) / 2 - c.z);
    return g;
  }
  function buildHitBoxes() {
    for (const h of hotspots) {
      const g = h.group, ry = g.rotation.y, boxes = [];
      // box at rest, unturned
      g.rotation.y = 0; g.updateMatrixWorld(true);
      if (h.noLift) g.traverse((o) => { if (o.isMesh) boxes.push(new THREE.Box3().setFromObject(o, true)); });
      else boxes.push(new THREE.Box3().setFromObject(g, true));
      g.rotation.y = ry; g.updateMatrixWorld(true);
      h.hit = boxes.map((b) => {
        const flat = b.max.y - b.min.y < 0.05, padY = flat ? HIT_PAD_FLAT : HIT_PAD, up = h.noLift ? 0 : HIT_LIFT;
        const m = new THREE.Mesh(hitGeo(b, g.position, HIT_PAD, padY, 0), hitMat);
        m.userData = { hot: h, geoN: m.geometry, geoH: hitGeo(b, g.position, HIT_PAD + HIT_HOVER, padY + HIT_HOVER, up) };
        m.position.copy(g.position); m.rotation.y = ry;
        m.castShadow = m.receiveShadow = false;
        m.updateMatrix(); m.matrixAutoUpdate = false;
        scene.add(m); m.updateMatrixWorld(true);
        hitMeshes.push(m);
        return m;
      });
    }
  }
  if (!SNAP) buildHitBoxes();

  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hitMeshes, false)[0];
    return hit ? hit.object.userData.hot : null;
  }
  function setHover(h) {
    if (h === hovered) return;
    // wider box while hovered
    if (hovered && hovered.hit) for (const m of hovered.hit) m.geometry = m.userData.geoN;
    if (h && h.hit) for (const m of h.hit) m.geometry = m.userData.geoH;
    hovered = h;
    canvas.style.cursor = h ? "pointer" : "default";
    labelEl.classList.toggle("on", !!h);
    if (h) labelEl.textContent = h.label;
  }
  let ptrIn = false, ptrX = 0, ptrY = 0, repickAt = 0;
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    parallax.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    lastPointer = performance.now();
    if (e.pointerType === "mouse") { ptrIn = true; ptrX = e.clientX; ptrY = e.clientY; setHover(pick(ptrX, ptrY)); }
  });
  canvas.addEventListener("pointerleave", () => { ptrIn = false; setHover(null); parallax.set(0, 0); });
  canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; lastPointer = performance.now(); });
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

  let introT = reduce ? 1 : 0;
  const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3(), labelPos = new THREE.Vector3(), labelBox = new THREE.Box3();
  // quality governor: drop a level below ~40 fps
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

  // 60 fps when active, 30 when idle
  const STEP_ACTIVE = 1000 / 60, STEP_IDLE = 1000 / 30, SHADOW_STEP = 1000 / 15;
  let lastDraw = -1e9, prevT = 0, elapsed = 0, shadowAt = -1e9, animBusy = true, wasActive = false, active = false;
  let labelX = NaN, labelY = NaN;

  function frame_(now) {
    if (!(visible && !modalOpen && !document.hidden)) { running = false; return; }
    requestAnimationFrame(frame_);
    active = animBusy || hovered !== null || now - lastPointer < 1500;
    const step = active ? STEP_ACTIVE : STEP_IDLE, gap = now - lastDraw;
    if (gap < step - 2) return;
    lastDraw = gap > step * 2 ? now : lastDraw + step;
    const rawDt = prevT ? (now - prevT) / 1000 : 1 / 60, dt = Math.min(rawDt, 0.05);
    prevT = now;
    elapsed += rawDt;
    if (DEBUG) renderer.info.reset();
    const t = elapsed;
    let busy = false;

    // intro push-in to the seat
    if (introT < 1) { introT = Math.min(1, introT + dt / 2.6); busy = true; }
    const k = easeOut(introT);
    tmpV.lerpVectors(camStart, camHome, k);
    // smooth the pointer
    if (!reduce) {
      const k = 1 - Math.exp(-dt * 2.2);
      const tx = THREE.MathUtils.clamp(parallax.x, -1, 1), ty = THREE.MathUtils.clamp(parallax.y, -1, 1);
      parallaxSmooth.x += (tx - parallaxSmooth.x) * k;
      parallaxSmooth.y += (ty - parallaxSmooth.y) * k;
      if (Math.abs(tx - parallaxSmooth.x) + Math.abs(ty - parallaxSmooth.y) > 0.002) busy = true;
    }
    // small head turn
    const px = parallaxSmooth.x, py = parallaxSmooth.y;
    tmpV.x += px * 0.05; tmpV.y += -py * 0.025;
    camera.position.copy(tmpV);
    tmpL.copy(lookHome); tmpL.x += px * 0.06; tmpL.y += -py * 0.03;
    camera.lookAt(tmpL);

    // hover lift
    for (const h of hotspots) {
      const target = h === hovered && !h.noLift ? 1 : 0;
      if (h.lift === target) continue;
      h.lift += (target - h.lift) * Math.min(1, dt * 10);
      if (Math.abs(target - h.lift) < 0.001) h.lift = target;
      if (!h.noLift) { h.group.position.y = h.baseY + h.lift * 0.035; shadowDirty = true; }
      busy = true;
    }

    // gear spin
    if (!reduce) gear.rotation.z -= dt * (hovered && hovered.group === gearGroup ? 1.6 : 0.45);
    // gear shadow at 15 fps
    if (!reduce && now - shadowAt >= SHADOW_STEP - 2) shadowDirty = true;
    if (shadowDirty) shadowAt = now;

    // ticker scroll
    if (!reduce) tickerTex.offset.x = (tickerTex.offset.x + dt * 0.035) % 1;

    // CRT at ~12 fps, new candle every ~1.6 s
    crtTick += dt;
    if (crtTick > 0.08) { crtTick = 0; drawCRT(t); }
    if (!reduce && Math.floor(t / 1.6) !== Math.floor((t - rawDt) / 1.6)) stepCandles();

    // lamp fade
    const lt = lampOn ? 1 : 0;
    if (lampLevel !== lt) {
      lampLevel += (lt - lampLevel) * Math.min(1, dt * 8);
      if (Math.abs(lt - lampLevel) < 0.001) lampLevel = lt;
      busy = true;
    }
    applyLamp(lampLevel);

    if (skylineBeacon) skylineBeacon.visible = reduce || Math.floor(t * 1.2) % 2 === 0;

    // label follows hovered object
    if (hovered) {
      const box = labelBox.setFromObject(hovered.group);
      labelPos.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(camera);
      const lx = Math.round(((labelPos.x + 1) / 2) * W), ly = Math.round(((1 - labelPos.y) / 2) * H);
      if (lx !== labelX || ly !== labelY) { labelX = lx; labelY = ly; labelEl.style.left = lx + "px"; labelEl.style.top = ly + "px"; }
    }

    draw(dt);
    // camera drifts under a still mouse
    if (ptrIn && now - repickAt >= 100) { repickAt = now; setHover(pick(ptrX, ptrY)); }
    // only time 60 fps frames
    if (active && wasActive) governor(rawDt);
    wasActive = active;
    animBusy = busy;
    frames++;
  }
  let frames = 0;
  if (DEBUG) renderer.info.autoReset = false;
  if (DEBUG) window.__desk3d = { scene, camera, hotspots, renderer, THREE, deskTop };
  if (DEBUG) window.__deskDebug = () => ({ frames, active, fxLevel, lampOn, lampLevel: +lampLevel.toFixed(3), pr: renderer.getPixelRatio(), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs.length, meshes: (() => { let m = 0, g = 0, cast = 0; scene.traverse((o) => { if (o.isMesh && o.visible) { const n = Array.isArray(o.material) ? o.geometry.groups.length : 1; m++; g += n; if (o.castShadow) cast += n; } }); return { m, g, cast }; })() });
  function kick() {
    if (running || SNAP || !ready) return;
    if (visible && !modalOpen && !document.hidden) {
      running = true; prevT = 0; lastDraw = -1e9; wasActive = false;
      perf.n = 0; perf.sum = 0; perf.skip = Math.max(perf.skip, 20);
      requestAnimationFrame(frame_);
    }
  }

  // first frame, then reveal
  if (SNAP) return snapObject(SNAP);

  marks.built = performance.now();
  applyLamp(lampLevel);
  camera.position.copy(reduce ? camHome : camStart);
  camera.lookAt(lookHome);
  // precompile shaders to avoid intro hitch
  try {
    if (renderer.extensions.has("KHR_parallel_shader_compile")) await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 3000))]);
    else renderer.compile(scene, camera);
  } catch (_) {}
  marks.compiled = performance.now();
  if (lite()) {
    renderer.dispose();
    renderer.domElement.remove();
    return;
  }
  window.DESK_READY = true;
  draw(0);
  ready = true;
  kick();
  setTimeout(() => loader.classList.add("done"), 150);
  if (DEBUG) console.log("[scene] first frame after", Math.round(performance.now() - tStart), "ms, quality level", fxLevel);
  // load breakdown, ms since navigation
  if (DEBUG) {
    const r = (t) => Math.round(t || 0), st = (window.DESK_TEX && DESK_TEX.stats) || {};
    console.log("[scene] timing: scene.js", r(marks.start), "| three ready", r(marks.three), "| textures ready", r(st.done), "| scene built", r(marks.built), "| compiled", r(marks.compiled), "| first frame", r(performance.now()));
  }

  /* ---------------- snap mode: one object, transparent bg ---------------- */
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
  /* ---- notebook, snap only ---- */
  async function buildNotebook() {
    await Promise.race([Promise.all([document.fonts.load('600 64px "Geist"'), document.fonts.load('500 32px "Geist Mono"')]), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
    const nb = new THREE.Group();
    const NW = 0.15, NH = 0.21, NT = 0.017, BT = 0.0024, BEV = 0.0009, CR = 0.011;
    const LEATHER = "#3F2416", FOIL = "#E8CD92";
    // rounded plate in xz, y up
    function plate(w, h, t, rL, rR, bevel) {
      const sh = new THREE.Shape(), x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
      sh.moveTo(x0 + rL, y0); sh.lineTo(x1 - rR, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + rR);
      sh.lineTo(x1, y1 - rR); sh.quadraticCurveTo(x1, y1, x1 - rR, y1); sh.lineTo(x0 + rL, y1);
      sh.quadraticCurveTo(x0, y1, x0, y1 - rL); sh.lineTo(x0, y0 + rL); sh.quadraticCurveTo(x0, y0, x0 + rL, y0);
      const g = new THREE.ExtrudeGeometry(sh, bevel
        ? { depth: t - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 16 }
        : { depth: t, bevelEnabled: false, curveSegments: 16 });
      // lid uvs 0-1 over the plate
      const p = g.attributes.position, uv = g.attributes.uv, lid = g.groups[0];
      for (let i = lid.start; i < lid.start + lid.count; i++) uv.setXY(i, (p.getX(i) + w / 2 + bevel) / (w + 2 * bevel), (p.getY(i) + h / 2 + bevel) / (h + 2 * bevel));
      g.translate(0, 0, bevel ? bevel : 0);
      g.rotateX(-Math.PI / 2);
      return g;
    }
    // cover art: grain, foil title
    const coverTex = canvasTex(1024, Math.round(1024 * NH / NW), (g, w, h) => {
      g.fillStyle = LEATHER; g.fillRect(0, 0, w, h);
      const id = g.getImageData(0, 0, w, h), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n * 0.8; d[i + 2] += n * 0.6; }
      g.putImageData(id, 0, 0);
      const vg = g.createRadialGradient(w * 0.45, h * 0.4, w * 0.2, w / 2, h / 2, h * 0.75);
      vg.addColorStop(0, "rgba(255,220,180,.05)"); vg.addColorStop(1, "rgba(0,0,0,.18)");
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
      const deboss = (txt, x, y) => { g.fillStyle = "rgba(0,0,0,.35)"; g.fillText(txt, x, y - 2); g.fillStyle = FOIL; g.fillText(txt, x, y); };
      g.textBaseline = "alphabetic"; g.textAlign = "left";
      g.font = `600 228px ${FONT}`; deboss("Blog", 92, h - 300);
      g.font = `500 44px ${MONO}`; deboss("ATUL ABRAHAM · NOTES", 100, h - 196);
    });
    // foil shines, leather stays soft
    const coverRM = canvasTex(1024, Math.round(1024 * NH / NW), (g, w, h) => {
      g.fillStyle = "rgb(0,170,0)"; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgb(0,90,150)"; g.textBaseline = "alphabetic"; g.textAlign = "left";
      g.font = `600 228px ${FONT}`; g.fillText("Blog", 92, h - 300);
      g.font = `500 44px ${MONO}`; g.fillText("ATUL ABRAHAM · NOTES", 100, h - 196);
    });
    coverRM.colorSpace = THREE.NoColorSpace;
    // desk pad grain at the same scale
    const grain = T.leatherN.clone();
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(NW / 0.8, NH / 0.4); grain.offset.set(0.35, 0.22); grain.needsUpdate = true;
    const leatherMat = new THREE.MeshStandardMaterial({ color: LEATHER, roughness: 0.62 });
    const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughnessMap: coverRM, metalnessMap: coverRM, roughness: 1, metalness: 1, normalMap: grain, normalScale: v2(0.3) });
    const bottom = new THREE.Mesh(plate(NW, NH, BT, 0.002, CR, BEV), leatherMat);
    const top = new THREE.Mesh(plate(NW, NH, BT, 0.002, CR, BEV), [coverMat, leatherMat]);
    top.position.y = NT - BT;
    // page block, lines along the edge
    const pageTex = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = "#E6DCC6"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) { g.fillStyle = "rgba(120,104,78,.16)"; g.fillRect(0, y + 1, w, 2); }
    }, { repeat: true });
    pageTex.repeat.set(4, 1 / 0.004);
    const pageMat = new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 });
    const pages = new THREE.Mesh(plate(NW - 0.007, NH - 0.005, NT - 2 * BT + 0.0004, 0.001, CR - 0.0025, 0), pageMat);
    pages.position.set(0.001, BT - 0.0002, 0);
    // rounded spine
    const spine = new THREE.Mesh(new RoundedBoxGeometry(0.008, NT, NH + 2 * BEV - 0.0004, 4, 0.0039), leatherMat);
    spine.position.set(-NW / 2 - BEV + 0.004, NT / 2, 0);
    // elastic band
    const bandMat = new THREE.MeshStandardMaterial({ color: "#1C1714", roughness: 0.55 });
    const BX = NW / 2 - 0.016, BW = 0.0065, BTH = 0.0011;
    const band = new THREE.Group();
    const bandTop = new THREE.Mesh(new RoundedBoxGeometry(BW, BTH, NH + 2 * BEV + 0.0016, 2, BTH * 0.45), bandMat);
    bandTop.position.set(BX, NT + BTH / 2, 0);
    band.add(bandTop);
    for (const sz of [-1, 1]) {
      const end = new THREE.Mesh(new RoundedBoxGeometry(BW, NT + BTH * 2, BTH, 2, BTH * 0.45), bandMat);
      end.position.set(BX, NT / 2, sz * (NH / 2 + BEV + BTH / 2));
      band.add(end);
    }
    // ribbon bookmark out of the foot, v cut end
    const RX = -0.035, path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(RX, NT * 0.55, NH / 2 - 0.004), new THREE.Vector3(RX + 0.0005, NT * 0.52, NH / 2 + BEV + 0.0008),
      new THREE.Vector3(RX + 0.0015, NT * 0.3, NH / 2 + 0.0045), new THREE.Vector3(RX + 0.003, 0.0004, NH / 2 + 0.012),
      new THREE.Vector3(RX + 0.007, 0.0003, NH / 2 + 0.022), new THREE.Vector3(RX + 0.011, 0.0003, NH / 2 + 0.032),
    ]);
    const RW = 0.0028, SEG = 40, rp = [], ri = [], up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, c = path.getPointAt(u), t = path.getTangentAt(u);
      side.crossVectors(up, t).normalize().multiplyScalar(RW);
      const notch = i === SEG ? -0.004 : 0, ct = c.clone().addScaledVector(t, notch);
      rp.push(c.x + side.x, c.y + side.y, c.z + side.z, ct.x, ct.y, ct.z, c.x - side.x, c.y - side.y, c.z - side.z);
      if (i) for (const k of [0, 1]) { const a = (i - 1) * 3 + k, b = i * 3 + k; ri.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3)); rg.setIndex(ri); rg.computeVertexNormals();
    const ribbon = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: "#7A1E1A", roughness: 0.5, side: THREE.DoubleSide }));
    nb.add(bottom, top, pages, spine, band, ribbon);
    // pen on the desk, beside the cover
    const pen = new THREE.Group();
    const penMat = new THREE.MeshStandardMaterial({ color: "#16171B", roughness: 0.3, metalness: 0.4 });
    const PL = 0.136, PR = 0.0046;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, PL * 0.78, 40), penMat);
    barrel.position.y = -PL * 0.06;
    const capEnd = new THREE.Mesh(new THREE.SphereGeometry(PR, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), penMat);
    capEnd.position.y = PL * 0.33;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(PR * 1.03, PR * 1.03, 0.004, 40), M.brass);
    ring.position.y = PL * 0.1;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR * 0.55, PL * 0.14, 40), penMat);
    grip.position.y = -PL * 0.52;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(PR * 0.55, PL * 0.05, 32), M.brass);
    tip.rotation.x = Math.PI; tip.position.y = -PL * 0.615;
    const clip = new THREE.Mesh(new RoundedBoxGeometry(0.0024, PL * 0.36, 0.0016, 2, 0.0007), M.brass);
    clip.position.set(0, PL * 0.17, PR + 0.0009);
    pen.add(barrel, capEnd, ring, grip, tip, clip);
    pen.rotation.set(Math.PI / 2, 0, 0);
    const penHold = new THREE.Group();
    penHold.add(pen);
    penHold.rotation.y = -0.22;
    penHold.position.set(NW / 2 + 0.024, PR + 0.0002, 0.012);
    nb.add(penHold);
    // soft contact shadows
    const soft = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0.55 });
    const blob = (w, d, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), soft); m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.0003, z); m.renderOrder = -1; m.userData.noFit = true; nb.add(m); };
    blob(NW * 1.25, NH * 1.2, -0.002, 0.004, 0);
    blob(0.02, PL * 1.12, penHold.position.x, penHold.position.z, penHold.rotation.y);
    nb.position.set(0, TOP, DESK_Z);
    nb.traverse((o) => { if (o.isMesh && o.material !== soft) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(nb);
    return nb;
  }
  async function snapObject(name) {
    const targets = { crt, roles, frame, envelope, gear: gearGroup, lamp };
    const target = name === "nameplate" ? buildNameplate() : name === "notebook" ? await buildNotebook() : targets[name];
    if (!target) { window.__snap = "unknown"; return; }
    if (!target.parent) { target.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); scene.add(target); }
    if (name === "crt" && window.RETRO && RETRO.drawScreen) { RETRO.drawScreen(crtTex.userData.ctx, CRT_W, CRT_H, 1.0); crtTex.needsUpdate = true; } else drawCRT(0.2);
    scene.background = null; scene.fog = null;
    renderer.setClearColor(0x000000, 0);
    // studio lighting for snap shots
    try {
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      scene.environment = M.glass.envMap = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    } catch (_) {}
    hemi.intensity = 1.1; bounce.visible = false; glow.intensity = name === "crt" ? 0.5 : 0;   // green glow on the crt only
    ceilingLights.forEach((l) => (l.visible = false));
    if (winLight) winLight.visible = false;
    const key2 = new THREE.DirectionalLight("#8C86C8", 1.0);
    key2.position.set(-2.5, 4, -6);
    scene.add(key2);
    renderer.toneMappingExposure = 1.05;
    lampHead.slice(0, 3).forEach((m) => { m.castShadow = true; });   // light is off the lamp, so the head can cast
    // hide everything except lights + target
    scene.children.forEach((o) => { if (!o.isLight && o !== target && o !== lampLight.target && o !== fill.target) o.visible = false; });
    target.visible = true;
    target.position.y = TOP;
    // fixed snap angles
    const SNAP_RY = { crt: 0.1, roles: 0.32, frame: -0.38, envelope: 0.18, gear: -0.25, notebook: 0.16 };
    if (name in SNAP_RY) target.rotation.y = SNAP_RY[name];
    target.scale.setScalar(1);
    if (name === "envelope") { target.rotation.x = 0.55; target.position.y = TOP + 0.04; }
    // soft contact shadow under the object
    const box = new THREE.Box3().setFromObject(target), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.32 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.set(c.x, TOP + 0.001, c.z); catcher.receiveShadow = true;
    scene.add(catcher);
    // even front-top light
    lampLight.position.set(c.x + 0.5, TOP + 1.4, c.z + 0.9); lampLight.target.position.copy(c); lampLight.intensity = 16;
    fill.position.set(c.x - 0.8, TOP + 0.9, c.z + 1.6); fill.target.position.copy(c); fill.intensity = 5;
    const S2 = 1100;
    renderer.setPixelRatio(1); renderer.setSize(S2, S2, false);
    camera.clearViewOffset(); camera.aspect = 1; camera.fov = 26; camera.updateProjectionMatrix();
    // notebook lies flat, so a higher camera
    const dir = (name === "notebook" ? new THREE.Vector3(0.14, 1.05, 1) : new THREE.Vector3(0.18, 0.42, 1)).normalize();
    const r = Math.max(size.x, size.y, size.z) * 0.62;
    const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.copy(c).addScaledVector(dir, dist);
    camera.lookAt(c);
    // fit projected outline, 86% of the frame
    if (name === "notebook") {
      camera.updateMatrixWorld(); target.updateMatrixWorld(true);
      const v = new THREE.Vector3(), b = new THREE.Box2().makeEmpty(), v2d = new THREE.Vector2();
      target.traverse((o) => {
        if (!o.isMesh || o.userData.noFit) return;
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(camera); b.expandByPoint(v2d.set(v.x, v.y)); }
      });
      const k = 0.86 / (Math.max(b.max.x - b.min.x, b.max.y - b.min.y) / 2), cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
      camera.zoom = k;
      camera.setViewOffset(S2, S2, (cx * k * S2) / 2, (-cy * k * S2) / 2, S2, S2);
      camera.updateProjectionMatrix();
    }
    loader.classList.add("done");
    await new Promise((res) => setTimeout(res, 2500)); // photo / covers load
    if (name === "crt" && window.RETRO && RETRO.drawScreen) { RETRO.drawScreen(crtTex.userData.ctx, CRT_W, CRT_H, 1.0); crtTex.needsUpdate = true; }
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    window.__snap = renderer.domElement.toDataURL("image/png");
  }
})();
