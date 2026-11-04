// copy buttons on code blocks
(function () {
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, no) {
      var t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;top:-9999px;opacity:0";
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy") ? ok() : no(); } catch (e) { no(e); }
      t.remove();
    });
  }

  document.querySelectorAll(".code").forEach(function (box) {
    var code = box.querySelector("pre code");
    var bar = box.querySelector(".code-bar");
    if (!code || !bar) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "code-copy mono";
    b.textContent = "Copy";
    b.setAttribute("aria-live", "polite");
    var timer;
    b.addEventListener("click", function () {
      copyText(code.textContent).then(
        function () { b.textContent = "Copied"; b.classList.add("is-done"); },
        function () { b.textContent = "Select and copy"; }
      );
      // restart the outline spin
      b.classList.remove("is-spin");
      void b.offsetWidth;
      b.classList.add("is-spin");
      clearTimeout(timer);
      timer = setTimeout(function () { b.textContent = "Copy"; b.classList.remove("is-done", "is-spin"); }, 1900);
    });
    bar.appendChild(b);
  });
})();
