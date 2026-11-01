title: Running all my Flutter apps in release mode with one Python script
date: 2026-11-01
summary: I test a few Flutter apps on my phone every few days. Instead of opening each project and typing flutter run --release, a tiny Python script on my Mac runs them one after another.
tags: flutter, python, macos, automation
---
I work on a few Flutter apps side by side: Bible Plus, Productivity Plus and Trade on Paper. Before I push changes I like to run each one in release mode on my phone, because release builds behave differently from debug. Performance is real, there's no hot reload, and some bugs only show up there.

Doing that by hand means opening Terminal, going into the first project, running `flutter run --release`, testing, quitting, going into the next one and doing it all again. It isn't hard, just boring, and I kept skipping one of the apps.

## The idea

A small Python script keeps a list of my app folders and runs `flutter run --release` in each one, one after another. When I'm done with an app I quit it (q, or Ctrl+C) and the script moves on to the next one. That's the whole thing.

## What the script does

1. Keeps a list of apps, a name and a folder for each.
2. Finds the folder with `pubspec.yaml` in it. Some of my repos keep the Flutter project one folder down, so it checks one level deep too.
3. Runs `flutter run --release` inside that folder with `subprocess`, so the Flutter output shows up live in the same Terminal window.
4. Skips an app with a short note if its folder is missing or isn't a Flutter project, instead of crashing.
5. Treats Ctrl+C as "next app" instead of stopping the whole script.
6. Has an optional `DEVICE` setting to pin a device id from `flutter devices`. Left as `None`, Flutter picks whatever is plugged in.

## The core of it

```python
APPS = [
    ("Bible Plus", "~/Documents/Projects/bible_plus"),
    ("Productivity Plus", "~/Documents/Projects/Productivity-Plus-IOS"),
    ("Trade on Paper", "~/Documents/Projects/trade_on_paper"),
]

for name, path in APPS:
    root = find_flutter_root(os.path.expanduser(path))
    if not root:
        print(f"skipping {name}, no pubspec.yaml")
        continue
    try:
        subprocess.run(["flutter", "run", "--release"], cwd=root)
    except KeyboardInterrupt:
        print(f"{name} interrupted, moving on")
```

`find_flutter_root` just checks the folder for `pubspec.yaml`, then each folder inside it, and returns the first match.

## Running it on a Mac

- Save it as `run_apps.py`, then `chmod +x run_apps.py` once.
- Plug in the phone and run `./run_apps.py` (or `python3 run_apps.py`).
- Release mode doesn't run on the iOS Simulator, so this needs a real iPhone or an Android device.
- I added an alias in `~/.zshrc` so it's one word: `alias runapps="python3 ~/Development/run_apps.py"`.

## Why it's worth it

It saves a few minutes every round, I never forget an app, and adding a new app is one more line in the list.

## What I might add next

- Pass app names as arguments to run only some of them.
- Run `flutter pub get` before each app.
- Write a short log of which apps built and which failed.
