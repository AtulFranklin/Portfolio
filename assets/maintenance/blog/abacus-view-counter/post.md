title: Adding a free view counter to an HTML and JS site with Abacus
date: 2026-10-28
summary: My portfolio is mainly HTML and JS with no backend. Abacus gives me a free view counter with one fetch call, here's how I set it up.
tags: javascript, html, github-pages, web
---
My site is mainly HTML and JS, so there's no server of my own to count visits. I didn't want a full analytics dashboard either, just a small "views" number under my name. Abacus is a free counting API that does exactly that: you call a URL, it adds one and sends back the new number.

## How Abacus works

A counter is a namespace plus a key. The namespace is something unique to you (your domain is a good pick) and the key is what you're counting, like `views`.

- `GET https://abacus.jasoncameron.dev/hit/<namespace>/<key>` adds 1 and returns `{"value": 1234}`. If the counter doesn't exist yet, it gets created.
- `GET https://abacus.jasoncameron.dev/get/<namespace>/<key>` reads the number without adding to it.

No sign up and no API key for these two, and CORS is on, so it works straight from the browser.

## The basic version

This is all it takes to have a working counter:

```html
<span id="views"></span>

<script>
  fetch("https://abacus.jasoncameron.dev/hit/my-site.com/views")
    .then((r) => r.json())
    .then((d) => {
      document.getElementById("views").textContent = d.value.toLocaleString() + " views";
    })
    .catch(() => {});
</script>
```

Every page load adds one and shows the total.

## Making the number honest

The basic version counts every refresh, including mine. A few things I added:

1. **Count once per visit.** After a hit I save a flag in `sessionStorage`. Reloads in the same tab call `/get` instead of `/hit`.
2. **Don't count local previews.** On `localhost` or `127.0.0.1` it only reads the number, so testing doesn't push it up.
3. **Timeout.** An `AbortController` cancels the request after 4 seconds, so a slow API never holds anything up.
4. **Fallback.** The last number I got is kept in `localStorage`. If the API is down, the site shows that instead of nothing.
5. **Fade in when ready.** The counter stays hidden until there's a number, so there's no flash of an empty or zero count.

The core of it looks like this:

```js
const API = "https://abacus.jasoncameron.dev";
const NS = "my-site.com";
const KEY = "views";

const el = document.getElementById("views");
const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const action = !isLocal && !sessionStorage.getItem("views-hit") ? "hit" : "get";

function show(n) {
  el.textContent = n.toLocaleString("en-US") + " views";
  el.classList.add("ready");
}

const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 4000);

fetch(`${API}/${action}/${NS}/${KEY}`, { cache: "no-store", signal: ctrl.signal })
  .then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  })
  .then((d) => {
    if (action === "hit") sessionStorage.setItem("views-hit", "1");
    localStorage.setItem("views-last", d.value);
    show(d.value);
  })
  .catch(() => {
    const last = +localStorage.getItem("views-last");
    if (last) show(last);
  });
```

And the CSS for the fade:

```css
#views { opacity: 0; transition: opacity .4s; }
#views.ready { opacity: .75; }
```

## Things to know

- Counters that get no hits for 6 months expire. On a live site that never really happens, since every visit resets the clock.
- There's a rate limit of about 30 requests per 10 seconds per IP. That's plenty for a counter, just don't call it in a loop.
- Anyone can call your counter URL, so treat the number as a fun stat, not real analytics. For real numbers I use Google Search Console.
- If you want to start from a set number or be able to reset it later, create the counter first with `/create/<namespace>/<key>?initializer=N`. That returns an admin key exactly once, so save it somewhere safe.

## Why I like it

One fetch call, no backend, no cookies and no sign up, and it works on any static host. For a personal site that's all I need.
