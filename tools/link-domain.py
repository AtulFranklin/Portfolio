#!/usr/bin/env python3
# domain sync: copies assets/maintenance/domain-linker.txt into the site files
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINKER = ROOT / "assets/maintenance/domain-linker.txt"
CNAME = ROOT / "CNAME"
FILES = ["index.html", "sitemap.xml", "robots.txt"]  # files with full https:// links


def clean(d):
    # bare domain: no scheme, www, path or spaces
    d = d.strip().lower()
    d = re.sub(r"^https?://", "", d)
    d = re.sub(r"^www\.", "", d)
    return d.split("/")[0].strip()


def read_domain():
    if not LINKER.exists():
        sys.exit(f"missing {LINKER.relative_to(ROOT)}")
    for line in LINKER.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            d = clean(line)
            if not re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)+", d):
                sys.exit(f"'{line}' doesn't look like a domain")
            return d
    sys.exit("domain-linker.txt is empty")


def main():
    new = read_domain()
    old = clean(CNAME.read_text(encoding="utf-8")) if CNAME.exists() else ""
    if old == new:
        print(f"domain: {new} (no change)")
        return
    changed = []
    if old:
        pat = re.compile(r"https?://(www\.)?" + re.escape(old))
        for name in FILES:
            p = ROOT / name
            if not p.exists():
                continue
            s = p.read_text(encoding="utf-8")
            t = pat.sub("https://" + new, s)
            if name == "sitemap.xml":
                t = re.sub(r"<lastmod>[^<]*</lastmod>", f"<lastmod>{date.today().isoformat()}</lastmod>", t)
            if t != s:
                p.write_text(t, encoding="utf-8")
                changed.append(name)
    CNAME.write_text(new + "\n", encoding="utf-8")
    changed.append("CNAME")
    print(f"domain: {old or '(none)'} -> {new}")
    print("updated: " + ", ".join(changed))


if __name__ == "__main__":
    main()
