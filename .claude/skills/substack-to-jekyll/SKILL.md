---
name: substack-to-jekyll
description: Mirror a public Substack post into this Jekyll site. Use when asked to import, archive, or mirror a Substack post, especially the latest post, while preserving its content and media in the native site theme.
---

# Substack to Jekyll

## Workflow

1. Inspect `_config.yml`, the relevant layouts (`_layouts/post.html`), and an existing page. Use the site's native Jekyll layout and navigation; do not recreate Substack UI or add a duplicate header/footer. `_layouts/post.html` already carries the styling from step 4/6 below (image sizing, captions, footnotes) — don't re-add it per-post.
2. For a latest-post request, verify the latest post through the public RSS feed or archive API. Extract title, subtitle, date, substack post URL, article body, figures, captions, links, italics, quotes, footnotes, and code from the public post HTML.
3. Keep semantic markup and remove Substack product UI (likes, share controls, sign-in prompts, comments, cookie banners, and generated classes).
4. Download every article image to `static/blog/<slug>/` and use local paths. Preserve captions and their source links; use meaningful image alt text. Images are capped to `max-height: 500px` and scaled responsively by `_layouts/post.html` — do not hardcode width/height on `<img>`.
5. Front matter must include `substack_url: "<original post URL>"` so the layout renders a "Read on Substack" link next to the date (`_layouts/post.html` also renders a fixed "All posts" link back to `/blog/` next to it — that one needs no per-post front matter). Create the mirrored page with front matter and the existing layout. Keep the article's formatting, but no separate Substack-style chrome or attribution footer is needed.
6. Footnotes: Substack's raw markup (`<a href="#footnote-N">` inline refs pointing to broken `<div><a href="#footnote-anchor-N">` blocks) does not work once mirrored — the ids don't match on either side. Rewrite them:
   - Inline ref: `<sup id="footnote-ref-N"><a href="#footnote-N">N</a></sup>`
   - Footnote list: wrap all footnotes in `<ol class="footnotes">`, each item as `<li id="footnote-N"><p>...text... <a href="#footnote-ref-N" class="footnote-backref">&#8617;</a></p></li>`
   - `_layouts/post.html` styles `.footnotes` (numbered hanging-indent list with a muted back-arrow); don't duplicate that CSS per-post.
7. Maintain `/blog/` as a compact Markdown archive matching `projects.md`: group posts by year, use bullets, muted fixed-width month/day before the title, and optional short muted subtitles. Only the title is clickable. Link mirrored posts locally (for example, `AI Escaped Its Sandbox`); link other posts to their original Substack URLs.

## Required validation

Before completing, serve the site locally and inspect screenshots of the final mirrored post at desktop and mobile widths (including the footnotes section, near the bottom), plus the archive at desktop width. Confirm the existing site theme is inherited, images are capped in size with styled captions, footnote links jump correctly in both directions, the Substack link and "All posts" link render next to the date, formatting is preserved, and no content overflows horizontally. Fix visible issues and repeat if necessary. Run `git diff --check`.

Note: `jekyll serve` (even with `--detach`) does not reliably pick up layout/include changes made after the server started, and in sandboxed/multi-agent sessions the background process can get killed between tool calls — if edits aren't showing up or the server won't stay up, kill any stale jekyll processes and either restart the server or fall back to `jekyll build --destination <dir>` plus grepping the generated HTML (or serving that directory with `python3 -m http.server`) instead of trusting the watcher.
