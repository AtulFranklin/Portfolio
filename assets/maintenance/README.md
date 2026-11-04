# Updating the website

Everything I update often lives in this folder as plain text files.

## What each folder controls

| Folder / file | What it changes on the site |
| --- | --- |
| `hero/hero.txt` | The top of the page: small line above the title, big title, tagline |
| `about-me/about-me.txt` | About me: panel heading, portrait photo, lead paragraph, body paragraphs, role cards |
| `projects/books.txt` | Which project books are on the desk, and their order |
| `projects/<book>/book.txt` | A book's cover: title, blurb, colour, emblem |
| `projects/<book>/projects.txt` | The projects inside that book (plus their photos in the same folder) |
| `projects/_new-book-template/` | A blank book to copy for a new one |
| `experience/experience.txt` | Jobs and internships |
| `education-and-skills/education.txt` | Schools and degrees |
| `education-and-skills/skills.txt` | Skill rows (Category: items) |
| `education-and-skills/certifications.txt` | Certificates |
| `why-hire-me/why-hire-me.txt` | The section title (`title:` in the first block - used on the desk links, the section heading, the retro computer document and the 3D computer screen), then the "why hire me" cards |
| `why-hire-me/closing.txt` | The last paragraph of the why hire me letter, above "Thanks for reading" |
| `contact/contact.txt` | Email, profile links, resume, contact headline and message, and the `form key` that lets the Leave a message letter send to my inbox |
| `loading/fun-facts.txt` | The fun facts typed out on the 3D desk loading screen, one per line |
| `location.txt` | Where I am: the place under my name (top-left), in the footer and on the retro computer letter, plus the weather and local time under my name |
| `domain-linker.txt` | The website domain (just the name, e.g. `atulabraham.site`) - copied into every file that needs it |
| `blog/<post>/post.md` | Blog posts: one folder per post, the folder name is the web address (`/blog/<post>/`). `blog/_new-post-template/` is a blank post to copy |

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
- To add a paragraph, add another `paragraph:` line where it should go. To remove one, delete its line or put `#` in front.
- New photo: drop it in the `about-me` folder and write its file name after `photo:` (or keep `photo: assets/photo.jpg` and replace that file).
- If a field is left empty, the site keeps its built-in text for it and the preview banner flags it.

## Change the why hire me title

- The first block of `why-hire-me/why-hire-me.txt` is `title: Why hire Atul?` followed by a `---` line. It is not a card.
- That one line names the section everywhere: the desk links, the section heading, the retro computer document and window, and the 3D computer screen.
- The section heading adds a full stop unless the title already ends in `?`, `!` or `.`. On the computer screens the last word goes on its own big line.
- Leave it out or empty and the site uses "Why hire Atul?" (the preview banner flags it).

## Add a project

1. Open the book's `projects.txt`, for example `projects/tools-and-ai/projects.txt`.
2. Add a `---` line, then paste the example from the top of the file and fill it in (remove the `#` marks).
3. Put the project photo in the same folder and write its file name after `image:`.
4. The order in the file is the order on the site.

## Add a new book

1. Copy the `projects/_new-book-template` folder and rename the copy, for example `projects/games`. Use lowercase and hyphens, no spaces.
2. In the new folder, fill in `book.txt`: title, blurb, a `color` (hex code like `#B48CFF`) and an `icon` (one of: fintech, apps, tools, engineering, star).
3. Add the projects to its `projects.txt` and drop the photos in the folder.
4. Add the folder name (`games`) to `projects/books.txt` on the line where it should appear.

## Hide something

- Hide a whole book: remove its line from `projects/books.txt`, or put `#` in front of it. The folder stays, so it can come back later.
- Hide one project (or job, card, certificate): put `#` at the start of each of its lines.

## Write a blog post

1. Copy the `blog/_new-post-template` folder and rename the copy, for example `blog/my-first-post`. The folder name becomes the address `atulabraham.site/blog/my-first-post/`, so use lowercase and hyphens, no spaces.
2. In `post.md`, fill in the header: `title`, `date` (YYYY-MM-DD), `summary` (one or two sentences for the list and Google) and `tags` (comma separated). Remove the `draft: yes` line when it's ready to go live.
3. Below the `---` line, write the post in markdown: `## Heading`, `**bold**`, `*italic*`, `` `code` ``, `[link](https://address)`, `- list`, `1. list`, `> quote`. Code block: a line of three backticks plus the language (e.g. `python`), the code, then three backticks on their own line. In the header `#` lines are comments, below `---` a `#` starts a heading.
4. Photos: drop them in the post folder and write `![what it shows](photo.jpg)`.
5. Preview with `preview.command` (or just commit). Both rebuild the pages in `blog/` and add the post to `sitemap.xml`. Newest date shows first.

Remove a post: delete its folder (or add `draft: yes` to hide it), then commit. The old page stays in the website's `blog/<post>/` folder until I delete that folder by hand - the build prints a reminder.

## Change the location

1. Open `location.txt` and change `place:` (City, State, Country, e.g. `place: Jersey City, NJ, USA`).
2. Optional: add `lat:` and `lon:` lines for an exact weather spot. Leave them out and the site looks the place up by name.
3. Preview or commit. `preview.command`, `link-domain.command` and every commit copy the place into `index.html` and `js/content.js`.
4. The weather and local time under my name follow the new place on their own.

`education.txt` keeps each school's own `place:`, so changing my location doesn't move my schools.

## Change the domain

1. Put the new domain in `domain-linker.txt` (just the name, e.g. `newname.dev`).
2. Double-click `link-domain.command` in the website folder (`preview.command` and every commit also run it). It updates `CNAME`, `robots.txt`, `sitemap.xml` and the links in `index.html`.
3. Push.
4. Outside the code:
   - DNS for the new domain: same records as the old one (4 GitHub `A` records + `www` CNAME to `atulfranklin.github.io`).
   - GitHub repo > Settings > Pages: check the custom domain shows the new one, tick Enforce HTTPS once it's ready.
   - Google Search Console: add the new domain, verify, submit `https://<new domain>/sitemap.xml`, then on the old property use Settings > Change of address.
   - Update the website link on LinkedIn, GitHub, résumé and email signature.
   - Keep the old domain pointing at the site for a few months if possible.

## Preview before pushing

- Easiest: double-click `preview.command` in the website folder. It starts a small local server and opens the site in the browser.
- Or in Terminal, inside the website folder: `python3 -m http.server 8000`, then open http://localhost:8000
- Opening `index.html` directly will not load these files - use one of the options above.
- If a file has a problem, the preview shows a small banner naming the file.

## Tips

- Use a plain text editor: VS Code, or TextEdit in plain-text mode (Format > Make Plain Text). Word processors add hidden formatting.
- Project photos: 1200x750 jpg works best.
- Keep file and folder names lowercase with hyphens, and match them exactly in the text files.
