#!/bin/bash
# domain sync - double-click after editing domain-linker.txt
cd "$(dirname "$0")" || exit 1
# turn on the commit hook (once per computer)
git rev-parse --git-dir >/dev/null 2>&1 && git config core.hooksPath .githooks
python3 tools/link-domain.py
# location sync
python3 tools/link-location.py
read -r -p "Press Return to close." _
