title: GitHub automation on a Mac: one double-click to commit and push
date: 2026-11-04
summary: I push this site to GitHub a few times a day. A small github.command file in the repo turns git add, commit and push into a double-click and a number from 1 to 8.
tags: git, github, macos, automation, bash
---
This site lives on GitHub Pages, so every change, from a new project to a typo fix, ends with the same three commands: `git add .`, `git commit -m "..."` and `git push`. I was typing them several times a day and making up a new commit message each time. Half of those messages were "update" or "fix", which told me nothing a week later.

So I made it a double-click.

## The idea

macOS treats any file ending in `.command` as a shell script that opens in Terminal when you double-click it in Finder. The repo already had two of these, `preview.command` for a local preview and `link-domain.command` for the domain sync, so a third one for pushing fit right in.

## What github.command does

1. Moves into the folder the file sits in, so it works from wherever Finder opens it.
2. Turns on the repo's commit hook, which rebuilds the blog pages and syncs the domain and location before every commit.
3. Shows which files changed.
4. Stops early if nothing changed, and only pushes any commits that haven't gone up yet.
5. Asks for the kind of change as a number from 1 to 8 and uses that as the commit message.
6. Runs `git add .`, `git commit` and `git push`, then waits for Return so I can read what happened.

## The menu

These are the commit messages I use most:

1. New Features
2. Clean - Up
3. Full Revamp
4. Optimization
5. New Projects
6. Site Updation
7. New Blog
8. New Certifications / Experience

Picking from a fixed list keeps the history readable. When I scroll back through the log I can tell straight away which commits were new projects, which were blog posts and which were performance work.

## The core of it

```bash
#!/bin/bash
cd "$(dirname "$0")" || exit 1

while true; do
  read -r -p "Pick 1-8: " pick
  case "$pick" in
    1) MSG="New Features"; break ;;
    2) MSG="Clean - Up"; break ;;
    3) MSG="Full Revamp"; break ;;
    4) MSG="Optimization"; break ;;
    5) MSG="New Projects"; break ;;
    6) MSG="Site Updation"; break ;;
    7) MSG="New Blog"; break ;;
    8) MSG="New Certifications / Experience"; break ;;
    *) echo "Type a number from 1 to 8." ;;
  esac
done

git add . && git commit -m "$MSG" && git push
read -r -p "Press Return to close." _
```

`cd "$(dirname "$0")"` is the line that matters most. Finder starts the script from your home folder, so without it git would run in the wrong place.

## Setting one up on a Mac

- Save the script as `github.command` in the root of the repo.
- Make it runnable once: `chmod +x github.command`.
- The first time you double-click it, macOS may block it because it came from outside the App Store. Right-click > Open once, or allow it under System Settings > Privacy & Security.
- Git needs to be able to push without asking for a password. A credential helper or an SSH key handles that.

## Why it's worth it

It turns three commands into a double-click and one keypress. I never forget the push. The commit hook still runs every time, and my history reads like a changelog instead of a list of "update" messages.

## What I might add next

- A ninth option for a custom message.
- A `git pull --rebase` before pushing, in case I edited something from another machine.
- A note at the end with the GitHub Pages URL so I can open the live site right away.
