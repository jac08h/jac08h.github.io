---
name: substack-to-jekyll
description: Mirror a public Substack post into this Jekyll site. Use when asked to import, archive, or mirror a Substack post, especially the latest post, while preserving its content and media in the native site theme.
---

# Substack to Jekyll

## Workflow

1. Inspect `_config.yml`, the relevant layouts, and an existing page. Use the site's native Jekyll layout and navigation; do not recreate Substack UI or add a duplicate header/footer.
2. For a latest-post request, verify the latest post through the public RSS feed or archive API. Extract title, subtitle, date, article body, figures, captions, links, italics, quotes, and code from the public post HTML.
3. Keep semantic markup and remove Substack product UI (likes, share controls, sign-in prompts, comments, cookie banners, and generated classes).
4. Download every article image to `static/blog/<slug>/` and use local paths. Preserve captions and their source links; use meaningful image alt text.
5. Create the mirrored page with front matter and the existing layout. Keep the article’s formatting, but no separate Substack-style chrome or attribution footer is needed.
6. Maintain `/blog/` as a compact Markdown archive matching `projects.md`: group posts by year, use bullets, muted fixed-width month/day before the title, and optional short muted subtitles. Only the title is clickable. Link mirrored posts locally (for example, `AI Escaped Its Sandbox`); link other posts to their original Substack URLs.

## Required validation

Before completing, serve the site locally and inspect screenshots of the final mirrored post at desktop and mobile widths, plus the archive at desktop width. Confirm the existing site theme is inherited, images/captions render, formatting is preserved, and no content overflows horizontally. Fix visible issues and repeat if necessary. Run `git diff --check`.
