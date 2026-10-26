# Updating the website

Everything you update often lives in this folder as plain text files.
Edit a file, save it, push to GitHub - done. No code, no build step.

## What each folder controls

| Folder / file | What it changes on the site |
| --- | --- |
| `hero/hero.txt` | The top of the page: small line above the title, big title, tagline |
| `about-me/about-me.txt` | About me: panel heading, portrait photo, lead paragraph, body paragraphs, role cards |
| `projects/books.txt` | Which project books are on the desk, and their order |
| `projects/<book>/book.txt` | A book's cover: title, blurb, colour, emblem |
| `projects/<book>/projects.txt` | The projects inside that book (plus their photos in the same folder) |
| `projects/_new-book-template/` | A blank book to copy when you want a new one |
| `experience/experience.txt` | Jobs and internships |
| `education-and-skills/education.txt` | Schools and degrees |
| `education-and-skills/skills.txt` | Skill rows (Category: items) |
| `education-and-skills/certifications.txt` | Certificates |
| `why-hire-me/why-hire-me.txt` | The "why hire me" cards |
| `contact/contact.txt` | Email, profile links, resume, contact headline and message |

Every .txt file starts with a short note and a copy-paste example.

## Format rules

- A line starting with `#` is a comment - the site ignores it.
- A line with three dashes `---` separates one entry (project, job, card) from the next.
- `key: value` sets a field, for example `title: Trade on Paper`. Only the known keys for that file count, so a colon inside a sentence is fine.
- `points:` is followed by one line per point, each starting with `- ` (dash and a space).
- A long text can wrap: any other line just continues the field above it.
- Blank lines are ignored, so use them freely to keep things readable.
- Images: a bare file name (`trade-on-paper.jpg`) means the photo is in the same folder as the text file. A path with a `/` (`assets/photo.jpg`) starts from the website folder. Full `https://` links work too.
- Links: `link: Label | https://address` - add one `link:` line per link.

## Change the hero or About me

- `hero/hero.txt` has three fields: `kicker` (small line above the title), `title` and `tagline`.
- `about-me/about-me.txt`: `greeting` (the panel heading), `photo`, `lead` (the first, larger paragraph), one `paragraph:` line per body paragraph in order, and `roles` (role cards, separated by commas).
- To add a paragraph, add another `paragraph:` line where you want it. To remove one, delete its line or put `#` in front.
- New photo: drop it in the `about-me` folder and write its file name after `photo:` (or keep `photo: assets/photo.jpg` and replace that file).
- If a field is left empty, the site keeps its built-in text for it and the preview banner tells you.

## Add a project

1. Open the book's `projects.txt`, for example `projects/tools-and-ai/projects.txt`.
2. Add a `---` line, then paste the example from the top of the file and fill it in (remove the `#` marks).
3. Put the project photo in the same folder and write its file name after `image:`.
4. The order in the file is the order on the site.

## Add a new book

1. Copy the `projects/_new-book-template` folder and rename the copy, for example `projects/games`. Use lowercase and hyphens, no spaces.
2. In the new folder, fill in `book.txt`: title, blurb, a `color` (hex code like `#B48CFF`) and an `icon` (one of: fintech, apps, tools, engineering, star).
3. Add your projects to its `projects.txt` and drop the photos in the folder.
4. Add the folder name (`games`) to `projects/books.txt` on the line where you want it to appear.

## Hide something

- Hide a whole book: remove its line from `projects/books.txt`, or put `#` in front of it. The folder stays, so you can bring it back later.
- Hide one project (or job, card, certificate): put `#` at the start of each of its lines.

## Preview before you push

- Easiest: double-click `preview.command` in the website folder. It starts a small local server and opens the site in your browser.
- Or in Terminal, inside the website folder: `python3 -m http.server 8000`, then open http://localhost:8000
- Opening `index.html` directly will not load these files - use one of the options above.
- If a file has a problem, the preview shows a small banner naming the file.

## Tips

- Use a plain text editor: VS Code, or TextEdit in plain-text mode (Format > Make Plain Text). Word processors add hidden formatting.
- Project photos: 1200x750 jpg works best.
- Keep file and folder names lowercase with hyphens, and match them exactly in the text files.
