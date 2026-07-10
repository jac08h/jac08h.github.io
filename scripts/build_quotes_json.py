import glob
import hashlib
import json
import os
import re
from typing import Dict, List, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUOTES_ROOT = os.path.join("books", "quotes")
OUTPUT_PATH = os.path.join(QUOTES_ROOT, "data", "quotes.json")

DOUBLE_UNDERSCORE_RE = re.compile(r"^(\d{2})_(.+?)__(.+)$")
SINGLE_UNDERSCORE_RE = re.compile(r"^(\d{2})_([^_]+)_(.+)$")
HEADING_RE = re.compile(r"^## ")
FOOTER_RE = re.compile(r"^###### \d{4}\s*$")
BLOCK_SEP_RE = re.compile(r"\n\s*\n")


def parse_filename(basename: str) -> Tuple[int, str, str]:
    """Parse year, author, title from a book filename (without extension)."""
    match = DOUBLE_UNDERSCORE_RE.match(basename)
    if match is None:
        match = SINGLE_UNDERSCORE_RE.match(basename)
    if match is None:
        raise ValueError("Cannot parse filename: %s" % basename)
    yy, author_raw, title_raw = match.group(1), match.group(2), match.group(3)
    year = 2000 + int(yy)
    author = author_raw.replace("_", " ")
    title = title_raw.replace("_", " ")
    return year, author, title


def extract_quotes(text: str) -> List[str]:
    """Split file body into quote blocks, preserving internal newlines."""
    lines = text.split("\n")
    body_lines: List[str] = []
    for index, line in enumerate(lines):
        if index == 0 and HEADING_RE.match(line):
            continue
        if FOOTER_RE.match(line):
            continue
        body_lines.append(line)
    body = "\n".join(body_lines)
    blocks = BLOCK_SEP_RE.split(body)
    quotes: List[str] = []
    for block in blocks:
        trimmed = block.strip()
        if trimmed:
            quotes.append(trimmed)
    return quotes


def compute_seeds(author: str, title: str) -> Tuple[int, float]:
    """Compute deterministic hue and spine_seed from author and title."""
    digest = hashlib.md5(("%s|%s" % (author, title)).encode("utf-8")).hexdigest()
    hue = int(digest[0:4], 16) % 360
    spine_seed = int(digest[4:8], 16) / 0xFFFF
    return hue, spine_seed


def build_book(path: str) -> Dict[str, object]:
    """Build a single book entry from its markdown file path."""
    rel_path = os.path.relpath(path, REPO_ROOT).replace(os.sep, "/")
    basename = os.path.splitext(os.path.basename(path))[0]
    year, author, title = parse_filename(basename)
    slug = os.path.relpath(path, os.path.join(REPO_ROOT, QUOTES_ROOT))
    slug = os.path.splitext(slug)[0].replace(os.sep, "/")
    with open(path, "r", encoding="utf-8") as handle:
        text = handle.read()
    quotes = extract_quotes(text)
    if not quotes:
        raise ValueError("No quotes found in %s" % rel_path)
    hue, spine_seed = compute_seeds(author, title)
    return {
        "id": slug,
        "author": author,
        "title": title,
        "year": year,
        "path": rel_path,
        "url": "/%s/%s" % (QUOTES_ROOT, slug),
        "quotes": quotes,
        "hue": hue,
        "spine_seed": round(spine_seed, 4),
    }


def build_all() -> Dict[str, object]:
    """Build the full quotes dataset from all year-subdir markdown files."""
    pattern = os.path.join(REPO_ROOT, QUOTES_ROOT, "*", "*.md")
    paths = sorted(glob.glob(pattern))
    books: List[Dict[str, object]] = [build_book(path) for path in paths]
    books.sort(key=lambda b: (b["year"], b["author"].lower(), b["title"].lower()))
    return {
        "generated_from": "books/quotes/**/*.md",
        "count": len(books),
        "books": books,
    }


def main() -> None:
    data = build_all()
    output_abs = os.path.join(REPO_ROOT, OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_abs), exist_ok=True)
    with open(output_abs, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    total_quotes = sum(len(b["quotes"]) for b in data["books"])
    print("Books: %d" % data["count"])
    print("Total quotes: %d" % total_quotes)
    print("Written to: %s" % OUTPUT_PATH)


if __name__ == "__main__":
    main()
