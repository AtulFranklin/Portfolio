#!/usr/bin/env python3
# blog build: assets/maintenance/blog/<slug>/post.md -> blog/
import hashlib
import html
import json
import math
import re
import shutil
import struct
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "assets/maintenance/blog"
OUT = ROOT / "blog"
SITEMAP = ROOT / "sitemap.xml"
LINKER = ROOT / "assets/maintenance/domain-linker.txt"
LOCATION = ROOT / "assets/maintenance/location.txt"
CONTACT = ROOT / "assets/maintenance/contact/contact.txt"

NAME = "Atul Abraham"
FULL_NAME = "Atul Franklin Abraham"
BLOG_LEAD = "Notes on things I build as well as my other hobbies."
PLACE_FALLBACK = "Hoboken, NJ, USA"
RESUME_FALLBACK = "assets/Atul_Abraham_Resume.pdf"
FIELDS = ("title", "date", "summary", "tags", "draft")
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


def esc(s):
    return html.escape(str(s), quote=True)


def fail(msg):
    sys.exit("blog: " + msg)


# ---- settings from maintenance files ----

def clean_domain(d):
    d = d.strip().lower()
    d = re.sub(r"^https?://", "", d)
    d = re.sub(r"^www\.", "", d)
    return d.split("/")[0].strip()


def read_domain():
    if not LINKER.exists():
        fail(f"missing {LINKER.relative_to(ROOT)}")
    for line in LINKER.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            d = clean_domain(line)
            if not re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)+", d):
                fail(f"'{line}' doesn't look like a domain")
            return d
    fail("domain-linker.txt is empty")


def read_key(path, key, fallback):
    if not path.exists():
        return fallback
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#"):
            continue
        m = re.match(re.escape(key) + r"\s*:\s*(.*)$", line, re.I)
        if m and m.group(1).strip():
            return re.sub(r"\s+", " ", m.group(1)).strip()
    return fallback


def site_href(p):
    # site path -> root-relative link
    if re.match(r"^[a-z]+:", p, re.I) or p.startswith("/"):
        return p
    return "/" + p.lstrip("./")


# ---- image sizes ----

def image_size(path):
    try:
        b = path.read_bytes()[:65536]
    except OSError:
        return None
    try:
        if b[:8] == b"\x89PNG\r\n\x1a\n":
            return struct.unpack(">II", b[16:24])
        if b[:6] in (b"GIF87a", b"GIF89a"):
            return struct.unpack("<HH", b[6:10])
        if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
            kind = b[12:16]
            if kind == b"VP8X":
                return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")
            if kind == b"VP8 ":
                w, h = struct.unpack("<HH", b[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if kind == b"VP8L":
                v = int.from_bytes(b[21:25], "little")
                return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
        if b[:2] == b"\xff\xd8":
            data = path.read_bytes()
            i = 2
            while i < len(data) - 9:
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", data[i + 5:i + 9])
                    return w, h
                if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                    i += 2
                    continue
                i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    except (struct.error, IndexError):
        return None
    return None


# ---- markdown ----

FENCE = re.compile(r"^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)\s*$")
HEADING = re.compile(r"^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$")
HR = re.compile(r"^\s{0,3}([-*_])(?:\s*\1){2,}\s*$")
UL = re.compile(r"^(\s*)([-*+])\s+(.*)$")
OL = re.compile(r"^(\s*)(\d{1,9})[.)]\s+(.*)$")
QUOTE = re.compile(r"^\s{0,3}>\s?(.*)$")
IMAGE = re.compile(r'!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)')
LINK = re.compile(r'\[((?:[^\[\]]|\[[^\]]*\])+)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)')
LONE_IMAGE = re.compile(r'^\s*!\[[^\]]*\]\([^)]*\)\s*$')


def indent(line):
    return len(line) - len(line.lstrip(" "))


def plain(s):
    # tags and entities out
    return html.unescape(re.sub(r"<[^>]+>", "", s))


class Markdown:
    def __init__(self, folder, domain):
        self.folder = folder
        self.domain = domain
        self.copies = set()
        self.ids = set()
        self.images = []
        self.store = []
        self.warnings = []

    # links and image paths
    def url(self, href, image=False):
        h = href.strip()
        low = h.lower()
        if re.match(r"^(https?:|mailto:|tel:)", low):
            return h, None
        if re.match(r"^[a-z][a-z0-9+.-]*:", low):
            return "#", None
        if h.startswith(("#", "/", "../", "?")):
            return h, None
        if h.startswith("./"):
            h = h[2:]
        if "/" not in h:
            name = re.split(r"[?#]", h)[0]
            src = self.folder / name
            if name and src.is_file():
                self.copies.add(name)
                return h, src
            if image:
                self.warnings.append(f"{self.folder.name}/post.md: {name} not found in the post folder")
            return h, None
        return "/" + h, ROOT / re.split(r"[?#]", h)[0]

    def external(self, href):
        m = re.match(r"^https?://(?:www\.)?([^/:?#]+)", href, re.I)
        return bool(m) and m.group(1).lower() != self.domain

    def keep(self, s):
        self.store.append(s)
        return f"\x00{len(self.store) - 1}\x00"

    def img(self, alt, src, title=None):
        href, file = self.url(src, image=True)
        size = image_size(file) if file and file.is_file() else None
        dims = f' width="{size[0]}" height="{size[1]}"' if size else ""
        self.images.append(href)
        t = f' title="{esc(title)}"' if title else ""
        return f'<img src="{esc(href)}" alt="{esc(alt)}"{dims}{t} loading="lazy" decoding="async" />'

    def inline(self, text):
        self.store = []
        s = self._inl(text)
        while "\x00" in s:
            s = re.sub(r"\x00(\d+)\x00", lambda m: self.store[int(m.group(1))], s)
        return s

    def _inl(self, text):
        keep = self.keep
        text = text.replace("\x00", "")
        text = re.sub(r"\\([\\`*_{}\[\]()#+\-.!>|~])", lambda m: keep(esc(m.group(1))), text)

        def code(m):
            c = m.group(2)
            if len(c) > 1 and c[0] == " " and c[-1] == " " and c.strip():
                c = c[1:-1]
            return keep("<code>" + html.escape(c, quote=False) + "</code>")

        text = re.sub(r"(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)", code, text)
        text = IMAGE.sub(lambda m: keep(self.img(m.group(1), m.group(2), m.group(3))), text)

        def link(m):
            href, _ = self.url(m.group(2))
            attrs = f' title="{esc(m.group(3))}"' if m.group(3) else ""
            if self.external(href):
                attrs += ' target="_blank" rel="noopener"'
            return keep(f'<a href="{esc(href)}"{attrs}>') + self._inl(m.group(1)) + keep("</a>")

        text = LINK.sub(link, text)
        text = re.sub(r"<(https?://[^\s>]+)>", lambda m: keep(
            f'<a href="{esc(m.group(1))}" target="_blank" rel="noopener">{esc(m.group(1))}</a>'), text)
        text = html.escape(text, quote=False)
        text = re.sub(r"\*\*(?=\S)(.+?)(?<=\S)\*\*", r"<strong>\1</strong>", text)
        text = re.sub(r"(?<!\w)__(?=\S)(.+?)(?<=\S)__(?!\w)", r"<strong>\1</strong>", text)
        text = re.sub(r"\*(?=\S)(.+?)(?<=\S)\*", r"<em>\1</em>", text)
        text = re.sub(r"(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)", r"<em>\1</em>", text)
        text = re.sub(r" {2,}\n", "<br />\n", text)
        return text

    def heading_id(self, text):
        base = re.sub(r"[^a-z0-9]+", "-", plain(text).lower()).strip("-") or "section"
        hid, n = base, 2
        while hid in self.ids:
            hid, n = f"{base}-{n}", n + 1
        self.ids.add(hid)
        return hid

    def code_block(self, lines, lang):
        while lines and not lines[-1].strip():
            lines.pop()
        body = html.escape("\n".join(lines), quote=False)
        cls = f' class="language-{esc(lang.lower())}"' if lang else ""
        label = f'<span class="code-lang mono">{esc(lang)}</span>' if lang else '<span class="code-lang mono"></span>'
        return f'<div class="code">\n<div class="code-bar">{label}</div>\n<pre><code{cls}>{body}</code></pre>\n</div>'

    def interrupts(self, line):
        # lines that end a paragraph
        if FENCE.match(line) or HEADING.match(line) or HR.match(line) or QUOTE.match(line) or UL.match(line):
            return True
        m = OL.match(line)
        return bool(m) and m.group(2) == "1"

    def list_block(self, lines, i):
        first = lines[i]
        ordered = bool(OL.match(first)) and not UL.match(first)
        pat = OL if ordered else UL
        base = indent(first)
        start = int(OL.match(first).group(2)) if ordered else 1
        items, cur, blank, loose = [], None, False, False
        width = 2
        while i < len(lines):
            line = lines[i].expandtabs(4)
            if not line.strip():
                blank = True
                i += 1
                continue
            ind = indent(line)
            m = pat.match(line)
            if m and base <= ind < base + 2 and not HR.match(line):
                if blank and cur is not None:
                    loose = True
                width = m.start(3) - ind
                cur = [m.group(3)]
                items.append(cur)
                blank = False
                i += 1
                continue
            if cur is not None and ind > base:
                if blank:
                    cur.append("")
                    if not (UL.match(line) or OL.match(line)):
                        loose = True
                cur.append(line[min(ind, base + width):])
                blank = False
                i += 1
                continue
            if cur is not None and not blank and not self.interrupts(line):
                cur.append(line.strip())
                i += 1
                continue
            break
        tag = "ol" if ordered else "ul"
        attr = f' start="{start}"' if ordered and start != 1 else ""
        lis = "\n".join(f"<li>{self.blocks(it, tight=not loose)}</li>" for it in items)
        return f"<{tag}{attr}>\n{lis}\n</{tag}>", i

    def blocks(self, lines, tight=False):
        out = []
        i, n = 0, len(lines)
        while i < n:
            raw = lines[i]
            if not raw.strip():
                i += 1
                continue
            m = FENCE.match(raw)
            if m:
                pad, fence, lang = m.groups()
                close = re.compile(r"^\s*" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}\s*$")
                code = []
                i += 1
                while i < n and not close.match(lines[i]):
                    ln = lines[i]
                    code.append(ln[min(len(pad), indent(ln)):])
                    i += 1
                i += 1
                out.append(self.code_block(code, lang))
                continue
            line = raw.expandtabs(4)
            m = HEADING.match(line)
            if m:
                level = min(max(len(m.group(1)), 2), 4)
                text = self.inline(m.group(2))
                out.append(f'<h{level} id="{self.heading_id(text)}">{text}</h{level}>')
                i += 1
                continue
            if HR.match(line):
                out.append("<hr />")
                i += 1
                continue
            if QUOTE.match(line):
                q = []
                while i < n and lines[i].strip():
                    mq = QUOTE.match(lines[i])
                    if mq:
                        q.append(mq.group(1))
                    elif self.interrupts(lines[i]):
                        break
                    else:
                        q.append(lines[i].strip())
                    i += 1
                    if i < n and not lines[i].strip() and i + 1 < n and QUOTE.match(lines[i + 1]):
                        q.append("")
                        i += 1
                out.append("<blockquote>\n" + self.blocks(q) + "\n</blockquote>")
                continue
            if UL.match(line) or OL.match(line):
                block, i = self.list_block(lines, i)
                out.append(block)
                continue
            para = [line.strip() if not line.endswith("  ") else line.lstrip()]
            i += 1
            while i < n and lines[i].strip() and not self.interrupts(lines[i].expandtabs(4)):
                ln = lines[i].expandtabs(4)
                para.append(ln.lstrip() if ln.endswith("  ") else ln.strip())
                i += 1
            text = "\n".join(para)
            if LONE_IMAGE.match(text):
                m = IMAGE.match(text.strip())
                fig = self.inline(text.strip())
                cap = m.group(3) if m else None
                cap = f"\n<figcaption>{self.inline(cap)}</figcaption>" if cap else ""
                out.append(f"<figure>\n{fig}{cap}\n</figure>")
            elif tight:
                out.append(self.inline(text))
            else:
                out.append(f"<p>{self.inline(text)}</p>")
        return "\n".join(out)


# ---- posts ----

def parse_post(folder):
    path = folder / "post.md"
    text = path.read_text(encoding="utf-8").lstrip("﻿").replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    meta, key, body = {}, None, None
    for i, line in enumerate(lines):
        s = line.strip()
        if s == "---":
            body = lines[i + 1:]
            break
        if not s or s.startswith("#"):
            continue
        m = re.match(r"([a-z]+)\s*:\s*(.*)$", s, re.I)
        if m and m.group(1).lower() in FIELDS:
            key = m.group(1).lower()
            meta[key] = m.group(2).strip()
        elif key:
            meta[key] = (meta[key] + " " + s).strip()
    rel = f"{folder.name}/post.md"
    if meta.get("draft", "").lower() in ("yes", "y", "true", "1"):
        return None
    if body is None:
        fail(f"{rel}: needs a --- line between the header and the post")
    if not SLUG.fullmatch(folder.name):
        fail(f"{folder.name}: folder name must be lowercase letters, numbers and hyphens")
    if not meta.get("title"):
        fail(f"{rel}: title is empty")
    try:
        day = date.fromisoformat(meta.get("date", ""))
    except ValueError:
        fail(f"{rel}: date must look like 2026-11-01")
    tags = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
    return {"slug": folder.name, "folder": folder, "title": meta["title"], "date": day,
            "summary": meta.get("summary", ""), "tags": tags, "body": body}


def nice_date(d):
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def read_minutes(lines):
    words = len(re.findall(r"[\w'-]+", "\n".join(lines)))
    return max(1, math.ceil(words / 200))


def tags_html(tags, box="ul", item="li"):
    if not tags:
        return ""
    pills = "".join(f'<{item} class="pill mono">{esc(t)}</{item}>' for t in tags)
    label = ' aria-label="Tags"' if box == "ul" else ""
    return f'<{box} class="post-tags"{label}>{pills}</{box}>'


def ld_json(data):
    s = json.dumps(data, ensure_ascii=False, indent=2)
    return s.replace("</", "<\\/").replace("\n", "\n  ")


# ---- page shell ----
# file hash for cache busting
def ver(rel):
    f = ROOT / rel
    return hashlib.md5(f.read_bytes()).hexdigest()[:8] if f.exists() else "1"



def page(c, title, desc, url, og_type, image, ld, main, current, scripts="", extra_meta=""):
    nav_cur = ' aria-current="page"' if current == "page" else ' aria-current="true"'
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}" />
  <meta name="author" content="{FULL_NAME}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="{esc(url)}" />
  <meta name="theme-color" content="#0A0C10" />
  <meta name="color-scheme" content="dark" />
  <!-- stop dark reader recolouring -->
  <meta name="darkreader-lock" />
  <meta property="og:type" content="{og_type}" />
  <meta property="og:site_name" content="{NAME}" />
  <meta property="og:url" content="{esc(url)}" />
  <meta property="og:title" content="{esc(title)}" />
  <meta property="og:description" content="{esc(desc)}" />
  <meta property="og:image" content="{esc(image)}" />
{extra_meta}  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{esc(title)}" />
  <meta name="twitter:description" content="{esc(desc)}" />
  <meta name="twitter:image" content="{esc(image)}" />
  <!-- icons -->
  <link rel="icon" href="/favicon-96.png?v=2" type="image/png" sizes="96x96" />
  <link rel="icon" href="/favicon-48.png?v=2" type="image/png" sizes="48x48" />
  <link rel="icon" href="/favicon.ico?v=2" sizes="16x16 32x32 48x48" />
  <link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180" />
  <link rel="manifest" href="/site.webmanifest?v=2" />
  <!-- structured data -->
  <script type="application/ld+json">
  {ld_json(ld)}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/styles.css?v={ver("css/styles.css")}" />
  <link rel="stylesheet" href="/css/blog.css?v={ver("css/blog.css")}" />
{scripts}</head>
<body class="blog-page">
  <a class="skip" href="#main">Skip to content</a>

  <!-- top bar -->
  <header class="topbar topbar-blog" id="top">
    <a class="brand" href="/" aria-label="{NAME}, home">
      <span class="brand-name">{NAME}</span>
      <span class="brand-meta mono">{esc(c["place"])}</span>
    </a>
    <nav class="topnav" aria-label="Main">
      <a class="nav-home" href="/"><span aria-hidden="true">← </span>Desk</a>
      <a href="/#projects">Projects</a>
      <a href="/#about">About</a>
      <a class="nav-on" href="/blog/"{nav_cur}>Blog</a>
      <a class="btn btn-secondary btn-sm" href="{esc(c["resume"])}" target="_blank" rel="noopener">Résumé</a>
    </nav>
  </header>

  <main id="main" tabindex="-1">
{main}
  </main>

  <footer class="footer">
    <div class="wrap footer-row">
      <span>{FULL_NAME} · {esc(c["place"])}</span>
      <a href="#top">Back to top ↑</a>
    </div>
  </footer>
</body>
</html>
"""


def person(c):
    return {"@type": "Person", "@id": f"{c['base']}/#person", "name": NAME, "url": f"{c['base']}/"}


def row_html(p, level="h2"):
    return f"""      <li>
        <a class="post-row" href="/blog/{p['slug']}/">
          <span class="post-row-date mono" data-nosnippet>{nice_date(p['date'])}</span>
          <div class="post-row-main">
            <{level} class="post-row-title">{esc(p['title'])}</{level}>
            <p class="post-row-summary">{esc(p['summary'])}</p>
            {tags_html(p['tags'], "div", "span")}
          </div>
          <span class="post-row-go" aria-hidden="true">→</span>
        </a>
      </li>"""


def build_index(c, posts):
    url = f"{c['base']}/blog/"
    if posts:
        rows = "\n".join(row_html(p) for p in posts)
        listing = f'    <ol class="post-list" aria-label="Posts">\n{rows}\n    </ol>'
    else:
        listing = '    <p class="post-empty">No posts yet.</p>'
    main = f"""    <div class="blog-wrap">
      <header class="blog-head">
        <p class="num mono">Blog</p>
        <h1 class="blog-title">Blog.</h1>
        <p class="blog-lead">{esc(BLOG_LEAD)}</p>
      </header>
{listing}
    </div>"""
    ld = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": f"{url}#blog",
        "url": url,
        "name": f"{NAME} - Blog",
        "description": BLOG_LEAD,
        "inLanguage": "en",
        "isPartOf": {"@id": f"{c['base']}/#website"},
        "author": person(c),
        "publisher": person(c),
        "blogPost": [{"@type": "BlogPosting", "@id": f"{url}{p['slug']}/#post", "headline": p["title"],
                      "url": f"{url}{p['slug']}/"} for p in posts],
    }
    return page(c, f"Blog - {NAME}", f"{NAME}'s blog. {BLOG_LEAD}", url, "website", c["photo"], ld, main, "page")


def build_post(c, p, posts):
    url = f"{c['base']}/blog/{p['slug']}/"
    md = Markdown(p["folder"], c["domain"])
    body = md.blocks(p["body"])
    c["warnings"] += md.warnings
    summary = p["summary"] or plain(re.sub(r"</p>.*", "", body, flags=re.S))[:160].strip()
    image = c["photo"]
    if md.images:
        first = md.images[0]
        image = first if re.match(r"^https?:", first) else (
            f"{c['base']}{first}" if first.startswith("/") else f"{url}{first}")
    others = [o for o in posts if o["slug"] != p["slug"]][:3]
    if others:
        more = "\n".join(row_html(o, "h3") for o in others)
        more = f"""      <section class="more" aria-labelledby="more-h">
        <h2 class="more-h mono" id="more-h">More posts</h2>
        <ol class="post-list post-list-sm">
{more}
        </ol>
        <a class="btn btn-secondary" href="/blog/">All posts <span aria-hidden="true">→</span></a>
      </section>"""
    else:
        more = """      <section class="more">
        <a class="btn btn-secondary" href="/blog/">More posts <span aria-hidden="true">→</span></a>
      </section>"""
    main = f"""    <article class="post">
      <header class="post-head">
        <a class="back mono" href="/blog/"><span aria-hidden="true">← </span>All posts</a>
        <h1 class="post-title">{esc(p['title'])}</h1>
        <p class="post-meta mono"><span data-nosnippet>{nice_date(p['date'])}</span><span class="sep" aria-hidden="true">·</span><span>{read_minutes(p['body'])} min read</span></p>
        {tags_html(p['tags'])}
      </header>
      <div class="prose">
{body}
      </div>
    </article>
    <div class="post-end">
{more}
    </div>"""
    ld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": f"{url}#post",
        "headline": p["title"],
        "description": summary,
        "url": url,
        "mainEntityOfPage": url,
        "image": image,
        "inLanguage": "en",
        "isPartOf": {"@id": f"{c['base']}/blog/#blog"},
        "author": person(c),
        "publisher": person(c),
        "keywords": ", ".join(p["tags"]),
    }
    if not p["tags"]:
        del ld["keywords"]
    extra = "".join(f'  <meta property="article:tag" content="{esc(t)}" />\n' for t in p["tags"])
    scripts = f'  <script src="/js/blog.js?v={ver("js/blog.js")}" defer></script>\n'
    html_ = page(c, f"{p['title']} - {NAME}", summary, url, "article", image, ld, main, "true", scripts, extra)
    return html_, md.copies


# ---- output ----

def write(path, text, changed):
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    changed.append(str(path.relative_to(ROOT)))


def copy(src, dst, changed):
    if dst.exists() and dst.read_bytes() == src.read_bytes():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    changed.append(str(dst.relative_to(ROOT)))


BLOG_URL = re.compile(r"[ \t]*<url>\s*<loc>https?://[^/<]+/blog/[^<]*</loc>.*?</url>[ \t]*\n?", re.S)


def sync_sitemap(c, posts, changed):
    # sitemap entries
    entries = []
    newest = f"\n    <lastmod>{posts[0]['date'].isoformat()}</lastmod>" if posts else ""
    entries.append(f"  <url>\n    <loc>{c['base']}/blog/</loc>{newest}\n  </url>\n")
    for p in posts:
        entries.append(f"  <url>\n    <loc>{c['base']}/blog/{p['slug']}/</loc>\n"
                       f"    <lastmod>{p['date'].isoformat()}</lastmod>\n  </url>\n")
    if SITEMAP.exists():
        s = SITEMAP.read_text(encoding="utf-8")
    else:
        s = ('<?xml version="1.0" encoding="UTF-8"?>\n'
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n')
    t = BLOG_URL.sub("", s)
    head, sep, tail = t.rpartition("</urlset>")
    if not sep:
        fail("sitemap.xml has no </urlset>")
    if not head.endswith("\n"):
        head += "\n"
    t = head + "".join(entries) + sep + tail
    if t != s:
        SITEMAP.write_text(t, encoding="utf-8")
        changed.append("sitemap.xml")


def main():
    domain = read_domain()
    base = f"https://{domain}"
    resume = read_key(CONTACT, "resume", RESUME_FALLBACK)
    c = {"domain": domain, "base": base, "place": read_key(LOCATION, "place", PLACE_FALLBACK),
         "resume": site_href(resume), "photo": f"{base}/assets/photo.jpg", "warnings": []}
    posts = []
    if POSTS.is_dir():
        for folder in sorted(POSTS.iterdir()):
            if folder.is_dir() and not folder.name.startswith(("_", ".")) and (folder / "post.md").is_file():
                p = parse_post(folder)
                if p:
                    posts.append(p)
    posts.sort(key=lambda p: (-p["date"].toordinal(), p["slug"]))

    changed = []
    write(OUT / "index.html", build_index(c, posts), changed)
    for p in posts:
        page_html, copies = build_post(c, p, posts)
        write(OUT / p["slug"] / "index.html", page_html, changed)
        for name in sorted(copies):
            copy(p["folder"] / name, OUT / p["slug"] / name, changed)
    sync_sitemap(c, posts, changed)

    for w in c["warnings"]:
        print("blog: warning: " + w)
    live = {p["slug"] for p in posts}
    for d in sorted(OUT.iterdir()):
        if d.is_dir() and d.name not in live:
            print(f"blog: blog/{d.name}/ is not a post any more - delete that folder by hand")
    count = f"{len(posts)} post" + ("" if len(posts) == 1 else "s")
    if changed:
        print(f"blog: {count}")
        print("updated: " + ", ".join(changed))
    else:
        print(f"blog: {count} (no change)")


if __name__ == "__main__":
    main()
