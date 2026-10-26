#!/bin/bash
# preview.command - double-click on the Mac to preview the site with your
# assets/maintenance files. Starts a small local web server in this folder
# and opens the browser. Close this Terminal window (or press Ctrl+C) to stop.

cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 was not found. Install it (for example: xcode-select --install) and try again."
  read -r -p "Press Return to close." _
  exit 1
fi

# port 8000, or the next free one
PORT=8000
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://127.0.0.1:$PORT/"
echo "Previewing $(pwd)"
echo "Open $URL - press Ctrl+C or close this window to stop."

# open the browser a second after the server starts
( sleep 1; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null ) &

# --bind keeps the preview on this Mac only (not visible to other devices on the network)
exec python3 -m http.server "$PORT" --bind 127.0.0.1
