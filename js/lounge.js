/* lounge.js - quiet lounge music in the desk area, desktop only.
   - assets/lounge_music.mp3, looped, at 35% volume. Never loaded on phones / tablets.
   - Browsers block sound until the visitor interacts, so it starts on the first click or key press
     (or right away if the browser allows it). A visitor who mutes stays muted (remembered per browser).
   - The volume follows the scroll: full in the lounge (the 3D desk at the top), fading to silence
     as the desk scrolls away, and back in when scrolling up. The speaker button under Résumé fades with it. */
(function () {
  "use strict";
  const desktop = window.matchMedia("(min-width: 721px) and (hover: hover) and (pointer: fine)").matches;
  if (!desktop) return;

  const SRC = "assets/lounge_music.mp3";
  const MAX = 0.35;          // 35% volume in the lounge
  const STORE = "lounge-muted";
  const hero = document.getElementById("top");
  const topbar = document.getElementById("topbar");
  const resumeBtn = topbar && topbar.querySelector(".topnav [data-resume]");
  if (!hero || !topbar) return;

  let muted = false;
  try { muted = localStorage.getItem(STORE) === "1"; } catch (_) {}

  const audio = new Audio();
  audio.src = SRC;
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0;

  let started = false;   // play() has succeeded at least once
  let level = 0;         // current volume factor 0..1 (smoothed)
  let target = 0;        // where the scroll says it should be
  let raf = 0;

  /* ---- speaker button under the Résumé button ---- */
  const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="w1" d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path class="w2" d="M18 6.8a7.4 7.4 0 0 1 0 10.4"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sound-btn";
  topbar.appendChild(btn);

  function paintButton() {
    const on = !muted;
    btn.innerHTML = on ? ICON_ON : ICON_OFF;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "Mute lounge music" : "Play lounge music");
    btn.title = on ? "Mute music" : "Play music";
    btn.classList.toggle("is-on", on && started && !audio.paused);
  }
  function placeButton() {
    // centre it under the Résumé button
    if (!resumeBtn) return;
    const r = resumeBtn.getBoundingClientRect(), t = topbar.getBoundingClientRect();
    btn.style.left = Math.round(r.left - t.left + r.width / 2) + "px";
    btn.style.top = Math.round(r.bottom - t.top + 10) + "px";
  }

  /* ---- volume follows the scroll ---- */
  function lounge() {
    // 1 while the desk fills the screen, 0 once ~70% of it has scrolled away
    const h = hero.offsetHeight || window.innerHeight;
    const y = window.scrollY;
    const t = Math.min(1, Math.max(0, (y - h * 0.12) / (h * 0.58)));
    return 1 - t * t * (3 - 2 * t); // smoothstep
  }
  let last = 0;
  function tick(now) {
    raf = 0;
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60;
    last = now;
    const want = muted || document.hidden || !started ? 0 : target;
    level += (want - level) * (1 - Math.exp(-dt / 0.3)); // ~0.3s ease, frame-rate independent
    if (Math.abs(want - level) < 0.004) level = want;
    audio.volume = Math.max(0, Math.min(1, MAX * level));
    // nobody hears it at zero: pause, and resume when it comes back
    if (level === 0 && !audio.paused && started) audio.pause();
    if (want > 0 && audio.paused && started) audio.play().catch(() => {});
    if (level !== want) raf = requestAnimationFrame(tick);
    else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  function onScroll() {
    target = lounge();
    // the button lives in the lounge too
    btn.style.opacity = String(Math.max(0, (target - 0.15) / 0.85));
    btn.classList.toggle("is-away", target < 0.15);
    kick();
  }

  /* ---- starting (needs a user gesture in most browsers) ---- */
  function start() {
    if (started || muted) return Promise.resolve();
    return audio.play().then(() => {
      started = true;
      paintButton();
      kick();
      removeGestures();
    }, () => {});
  }
  const gestureEvents = ["pointerdown", "keydown", "touchend"];
  function onGesture(e) {
    if (e.target && e.target.closest && e.target.closest(".sound-btn")) return; // the button handles itself
    start();
  }
  function addGestures() { gestureEvents.forEach((t) => window.addEventListener(t, onGesture, { capture: true, passive: true })); }
  function removeGestures() { gestureEvents.forEach((t) => window.removeEventListener(t, onGesture, { capture: true })); }

  btn.addEventListener("click", () => {
    muted = !muted;
    try { localStorage.setItem(STORE, muted ? "1" : "0"); } catch (_) {}
    if (!muted) start();
    paintButton();
    kick();
  });
  audio.addEventListener("play", paintButton);
  audio.addEventListener("pause", paintButton);
  document.addEventListener("visibilitychange", kick);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { placeButton(); onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeButton);

  window.LOUNGE = { audio, get level() { return level; } };
  paintButton();
  placeButton();
  onScroll();
  addGestures();
  start(); // works straight away when the browser allows autoplay
})();
