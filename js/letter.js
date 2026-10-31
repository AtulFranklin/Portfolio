/* letter form - web3forms, mailto fallback */
(function () {
  "use strict";
  const S = window.SITE || {};
  const C = S.contact || {};
  const EMAIL = (S.links && S.links.email) || "";
  const KEY = (C.formKey || "").trim();
  const HAS_KEY = KEY && !/paste|your/i.test(KEY);
  const ENDPOINT = "https://api.web3forms.com/submit";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let n = 0;

  function html(where) {
    const id = "letter-" + where + "-" + ++n;
    return `<div class="letter letter-${esc(where)}">
      <div class="letter-paper">
        <div class="letter-stamp" aria-hidden="true"><span>AA</span><small>Airmail</small></div>
        <h3 class="letter-title" id="${id}-t">Leave me a message</h3>
        <form class="letter-form" novalidate aria-labelledby="${id}-t">
          <label class="sr-only" for="${id}-m">Your message</label>
          <textarea id="${id}-m" name="message" rows="6" maxlength="4000" placeholder="Dear Atul," required></textarea>
          <div class="letter-from">
            <label class="sr-only" for="${id}-n">Your name (optional)</label>
            <input id="${id}-n" name="name" type="text" maxlength="120" autocomplete="name" placeholder="Your name">
            <label class="sr-only" for="${id}-e">Your email (optional)</label>
            <input id="${id}-e" name="from" type="email" maxlength="200" autocomplete="email" placeholder="Your email, if you would like a reply">
          </div>
          <input class="letter-trap" name="botcheck" type="checkbox" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="letter-send">
            <button type="submit" class="btn btn-primary btn-sm">Send<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/></svg></button>
            <p class="letter-status" aria-live="polite"></p>
            ${EMAIL ? `<a class="letter-mail" href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a>` : ""}
          </div>
        </form>
      </div>
    </div>`;
  }

  function mailtoFallback(message, name, from) {
    const body = message + (name || from ? `\n\n- ${[name, from].filter(Boolean).join(", ")}` : "");
    location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Hello Atul")}&body=${encodeURIComponent(body)}`;
  }

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest && e.target.closest(".letter-form");
    if (!form) return;
    e.preventDefault();
    const status = form.querySelector(".letter-status");
    const button = form.querySelector('button[type="submit"]');
    const say = (text, kind) => {
      status.textContent = text;
      status.classList.toggle("is-error", kind === "error");
      status.classList.toggle("is-ok", kind === "ok");
    };
    const message = form.message.value.trim();
    const name = form.name.value.trim();
    const from = form.from.value.trim();
    if (message.length < 2) { say("Write a few words first.", "error"); form.message.focus(); return; }
    if (from && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from)) { say("That email address does not look right.", "error"); form.from.focus(); return; }
    if (form.botcheck.checked) { form.reset(); say("Sent. Thank you, I will read it soon.", "ok"); return; }
    if (!HAS_KEY) { say("Opening your mail app...", "ok"); mailtoFallback(message, name, from); return; }

    button.disabled = true;
    say("Sending...");
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: KEY,
          subject: "New message from your portfolio" + (name ? " - " + name : ""),
          from_name: name || "Portfolio visitor",
          name: name || "Not given",
          email: from || "",
          replyto: from || "",
          message,
          page: location.href,
          botcheck: false,
        }),
        signal: ctrl ? ctrl.signal : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.message || "failed");
      form.reset();
      form.classList.add("is-sent");
      setTimeout(() => form.classList.remove("is-sent"), 1600);
      say("Sent. Thank you, I will read it soon.", "ok");
    } catch (_) {
      say("It did not send. Please email me instead, at the address beside this.", "error");
    } finally {
      if (timer) clearTimeout(timer);
      button.disabled = false;
    }
  });

  window.LETTER = { html, hasKey: !!HAS_KEY };
})();

/* contact letter, focus on open (not touch) */
(function () {
  "use strict";
  if (!window.LETTER) return;
  const slot = document.getElementById("contactLetter");
  if (slot) slot.innerHTML = window.LETTER.html("section");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  window.addEventListener("desk:modal", (e) => {
    if (!e.detail || !fine) return;
    requestAnimationFrame(() => {
      const ta = document.querySelector("#panelBody .letter textarea");
      if (ta) ta.focus({ preventScroll: true });
    });
  });
})();
