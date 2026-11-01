#!/usr/bin/env python3
# location sync: copies assets/maintenance/location.txt into the site files
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCATION = ROOT / "assets/maintenance/location.txt"
INDEX = ROOT / "index.html"
CONTENT = ROOT / "js/content.js"

COUNTRIES = {
    "usa": "US", "us": "US", "u.s.a.": "US", "u.s.a": "US", "u.s.": "US", "united states": "US",
    "united states of america": "US", "uk": "GB", "u.k.": "GB", "united kingdom": "GB", "india": "IN",
}

PLACE_SPAN = re.compile(r"(<span\b[^>]*\sdata-place(?=[\s>=])[^>]*>)([^<]*)(</span>)")
ADDRESS = re.compile(r'"address"\s*:\s*\{\s*"@type"\s*:\s*"PostalAddress"[^}]*\}')
CONTENT_PLACE = re.compile(r'^(\s*place:\s*)"(?:[^"\\]|\\.)*"', re.M)


def read_place():
    if not LOCATION.exists():
        sys.exit(f"missing {LOCATION.relative_to(ROOT)}")
    for line in LOCATION.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#"):
            continue
        m = re.match(r"place\s*:\s*(.*)$", line, re.I)
        if m:
            place = re.sub(r"\s+", " ", m.group(1)).strip()
            if not place:
                sys.exit("location.txt: place is empty")
            return place
    sys.exit("location.txt has no place: line")


def address(place):
    # 1 part = city, 2 = city + country, 3+ = city, region, country
    parts = [p.strip() for p in place.split(",") if p.strip()]
    fields = [("@type", "PostalAddress"), ("addressLocality", parts[0])]
    if len(parts) >= 3:
        fields.append(("addressRegion", ", ".join(parts[1:-1])))
    if len(parts) >= 2:
        fields.append(("addressCountry", COUNTRIES.get(parts[-1].lower(), parts[-1])))
    body = ", ".join(f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in fields)
    return '"address": { ' + body + " }"


def sync_index(place):
    s = INDEX.read_text(encoding="utf-8")
    text = html.escape(place, quote=False)
    t = PLACE_SPAN.sub(lambda m: m.group(1) + text + m.group(3), s)
    t = ADDRESS.sub(lambda m: address(place), t, count=1)
    if t != s:
        INDEX.write_text(t, encoding="utf-8")
        return True
    return False


def sync_content(place):
    s = CONTENT.read_text(encoding="utf-8")
    m = CONTENT_PLACE.search(s)
    old = json.loads(m.group(0)[len(m.group(1)):]) if m else ""
    t = CONTENT_PLACE.sub(lambda m: m.group(1) + json.dumps(place, ensure_ascii=False), s, count=1)
    if t != s:
        CONTENT.write_text(t, encoding="utf-8")
        return old, True
    return old, False


def main():
    place = read_place()
    changed = []
    if INDEX.exists() and sync_index(place):
        changed.append("index.html")
    old = ""
    if CONTENT.exists():
        old, hit = sync_content(place)
        if hit:
            changed.append("js/content.js")
    if not changed:
        print(f"location: {place} (no change)")
        return
    print(f"location: {old or '(none)'} -> {place}" if old != place else f"location: {place}")
    print("updated: " + ", ".join(changed))


if __name__ == "__main__":
    main()
