# Tweaks plan - low spec desk row, book labels, Productivity Plus link

Mode: Ultra (3 agents, one task each, no shared files)

## Task 1 - low spec desk row (css/styles.css only)
- Scope: low spec version only (`.desk-lite`, min-width 721px). 3D and mobile untouched.
- Current: block "lite desk, copy up top" (~line 606) uses a 6-col grid,
  row 2 = `"edu msg blog . . about"` so all three small objects sit bunched on the left.
- Target:
  - Education stays in column 1.
  - Blog moves under the "Why hire Atul?" CRT, centred under it.
  - Leave a message sits halfway between Education and Blog.
  - Equal distance between the three, objects keep their current size.
- Approach: switch that block to a 12-col grid (each old col = 2 new cols).
  - Row 1: copy 1-6, crt 7-10, exp 11-12 (same as before).
  - Row 2: edu 1-2 (centre 1), msg 4-5 (centre 4.5), blog 8-9 (centre 8, under crt), about 11-12.
  - Centres 1 / 4.5 / 8 = equal 3.5 col gaps.
- Check the 721-1040px media block still works.

## Task 2 - remove "No. 01" labels in books (js/books.js only)
- `leftHTML()` line ~568: `<p class="bk-pk">No. 01 · 2026</p>`.
- Drop the "No. NN" part, keep the year. If a project has no year, skip the `<p>` entirely.
- Leave css/books.css spacing as is unless the title jumps.

## Task 3 - Productivity Plus link text (maintenance file only)
- `assets/maintenance/projects/mobile-apps/projects.txt`
- `link: Try the web demo | ...` -> `link: Launch website | ...` (url unchanged).
- No code change, content stays in maintenance per DEV-README.

## Verify
- Preview low spec at ~1440px and ~900px, open a book page, check Productivity Plus link.
