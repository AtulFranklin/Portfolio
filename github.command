#!/bin/bash
# push to github - double-click on the mac
cd "$(dirname "$0")" || exit 1

# commit hook on
git rev-parse --git-dir >/dev/null 2>&1 && git config core.hooksPath .githooks

echo "Repo: $(pwd)"
echo
git status --short
echo

# nothing changed
if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing to commit."
  if [ -n "$(git log @{u}.. --oneline 2>/dev/null)" ]; then
    echo "Pushing earlier commits..."
    git push
  fi
  read -r -p "Press Return to close." _
  exit 0
fi

echo "Commit description:"
echo "  1. New Features"
echo "  2. Clean - Up"
echo "  3. Full Revamp"
echo "  4. Optimization"
echo

while true; do
  read -r -p "Pick 1-4: " pick
  case "$pick" in
    1) MSG="New Features"; break ;;
    2) MSG="Clean - Up"; break ;;
    3) MSG="Full Revamp"; break ;;
    4) MSG="Optimization"; break ;;
    *) echo "Type 1, 2, 3 or 4." ;;
  esac
done

echo
echo "Committing \"$MSG\"..."
if git add . && git commit -m "$MSG" && git push; then
  echo
  echo "Done - pushed to $(git rev-parse --abbrev-ref HEAD)."
else
  echo
  echo "Something failed, see above."
fi

read -r -p "Press Return to close." _
