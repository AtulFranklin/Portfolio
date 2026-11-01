# BLOG POST - one post per folder. Copy this whole folder and rename the copy,
# for example blog/my-first-post. The folder name is the web address:
# atulabraham.site/blog/my-first-post/  (lowercase and hyphens, no spaces).
# Folders starting with _ (like this one) are skipped.
#
# Lines starting with # are ignored up here in the header only.
# Below the --- line, # starts a heading instead.
#
# title:    the post title
# date:     YYYY-MM-DD, for example 2026-11-01 (newest post shows first)
# summary:  one or two sentences for the blog list and Google
# tags:     comma separated, for example flutter, python
# draft:    yes  (optional - hides the post until I remove the line)
#
# After the --- line, write the post in markdown:
#   ## Heading, ### Smaller heading
#   **bold**, *italic*, `code`, [link text](https://address)
#   - list item, 1. numbered item, > quote, --- for a divider line
#   ```python  (then the code, then ``` on its own line)
#   ![what the photo shows](photo.jpg)  - a bare file name means a photo in this folder
#
# Commit (or run preview.command) and the blog pages are rebuilt.

title: My new post
date: 2026-11-01
summary: One or two sentences about what this post covers.
tags: flutter, python
draft: yes
---
A first paragraph that says what I built or fixed, and why.

## What I did

- First step
- Second step

```python
print("hello")
```

![What the photo shows](photo.jpg)
