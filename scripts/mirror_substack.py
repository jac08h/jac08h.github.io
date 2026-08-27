#!/usr/bin/env python3
"""Mirror the public Unpredictable Tokens Substack archive into this Jekyll site."""

from __future__ import annotations

import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RSS_URL = "https://unpredictabletokens.substack.com/feed"
ARCHIVE = ROOT / "blog" / "index.md"
EXISTING = "ai-escaped-its-sandbox-what-that"


@dataclass
class Node:
    tag: str | None
    attrs: dict[str, str] = field(default_factory=dict)
    children: list["Node | str"] = field(default_factory=list)
    parent: "Node | None" = None


class TreeParser:
    """Small tolerant HTML parser sufficient for Substack's article markup."""

    void = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self) -> None:
        from html.parser import HTMLParser

        class Parser(HTMLParser):
            def __init__(self, outer: TreeParser) -> None:
                super().__init__(convert_charrefs=False)
                self.outer = outer

            def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
                self.outer.start(tag, attrs, self.get_starttag_text() or "")

            def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
                self.outer.start(tag, attrs, self.get_starttag_text() or "", self_closing=True)

            def handle_endtag(self, tag: str) -> None:
                self.outer.end(tag)

            def handle_data(self, data: str) -> None:
                self.outer.add(data)

            def handle_entityref(self, name: str) -> None:
                self.outer.add(f"&{name};")

            def handle_charref(self, name: str) -> None:
                self.outer.add(f"&#{name};")

            def handle_comment(self, data: str) -> None:
                self.outer.add(f"<!--{data}-->")

        self.root = Node(None)
        self.stack = [self.root]
        self.parser = Parser(self)

    def start(self, tag: str, attrs: list[tuple[str, str | None]], raw: str, self_closing: bool = False) -> None:
        node = Node(tag.lower(), {k.lower(): (v or "") for k, v in attrs}, parent=self.stack[-1])
        self.stack[-1].children.append(node)
        if not self_closing and tag.lower() not in self.void:
            self.stack.append(node)

    def end(self, tag: str) -> None:
        tag = tag.lower()
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def add(self, text: str) -> None:
        if text:
            self.stack[-1].children.append(text)

    def feed(self, source: str) -> Node:
        self.parser.feed(source)
        self.parser.close()
        return self.root


def find_first(node: Node, predicate) -> Node | None:
    if node.tag and predicate(node):
        return node
    for child in node.children:
        if isinstance(child, Node):
            result = find_first(child, predicate)
            if result:
                return result
    return None


def text_content(node: Node) -> str:
    return "".join(text_content(c) if isinstance(c, Node) else c for c in node.children)


def decode_url(url: str) -> str:
    return urllib.parse.unquote(html.unescape(url)).replace("\\u0026", "&")


def image_url(node: Node) -> str | None:
    attrs = node.attrs
    data = attrs.get("data-attrs")
    if data:
        try:
            parsed = json.loads(html.unescape(data))
            if parsed.get("src"):
                return decode_url(parsed["src"])
        except (ValueError, TypeError):
            pass
    for key in ("src", "data-src", "href"):
        value = attrs.get(key)
        if value and ("substack" in value or "s3.amazonaws.com" in value):
            decoded = decode_url(value)
            match = re.search(r"https://substack-post-media\.s3\.amazonaws\.com/[^?#'\\\"]+", decoded)
            return match.group(0) if match else decoded
    return None


def safe_filename(url: str, index: int) -> str:
    path = urllib.parse.urlparse(url).path
    name = Path(path).name or f"image-{index}.png"
    name = re.sub(r"[^A-Za-z0-9._-]", "-", name)
    return name


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (archive mirror)"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def extract_body(source: str) -> Node:
    root = TreeParser().feed(source)
    body = find_first(root, lambda n: n.tag == "div" and "body" in n.attrs.get("class", "").split() and "markup" in n.attrs.get("class", "").split())
    if body is None:
        raise RuntimeError("Could not locate article body")
    return body


def extract_metadata(source: str, fallback_slug: str) -> tuple[str, str, str]:
    title_match = re.search(r'<h1[^>]*class="[^"]*post-title[^\"]*"[^>]*>(.*?)</h1>', source, re.S)
    title = html.unescape(re.sub(r"<[^>]+>", "", title_match.group(1))).strip() if title_match else fallback_slug.replace("-", " ").title()
    date_match = re.search(r'"datePublished":"(\d{4}-\d{2}-\d{2})', source)
    if not date_match:
        raise RuntimeError(f"Could not locate date for {fallback_slug}")
    date = date_match.group(1)
    description = ""
    desc_match = re.search(r'"description":"((?:\\.|[^"\\])*)"', source)
    if desc_match:
        try:
            description = json.loads('"' + desc_match.group(1) + '"')
        except ValueError:
            description = html.unescape(desc_match.group(1))
    return title, date, description.strip()


def clean_node(node: Node, slug: str, image_dir: Path, image_paths: dict[str, str], image_counter: list[int]) -> Node | str | None:
    if node.tag in {"script", "style", "button", "noscript"}:
        return None
    if node.tag == "img":
        source = image_url(node)
        if not source:
            return None
        if source not in image_paths:
            image_counter[0] += 1
            filename = safe_filename(source, image_counter[0])
            target = image_dir / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                print(f"  downloading {filename}", flush=True)
                target.write_bytes(fetch(source))
            image_paths[source] = f"/static/blog/{slug}/{filename}"
        local = image_paths[source]
        alt = node.attrs.get("alt", "").strip()
        return Node("img", {"src": local, "alt": alt})
    if node.tag == "source":
        return None
    if node.tag == "a":
        href = decode_url(node.attrs.get("href", ""))
        attrs = {"href": href} if href else {}
        if node.attrs.get("target") == "_blank":
            attrs["target"] = "_blank"
        node.attrs = attrs
    else:
        allowed_attrs = {"alt", "colspan", "height", "href", "src", "start", "target", "title", "type", "width"}
        node.attrs = {k: decode_url(v) for k, v in node.attrs.items() if k in allowed_attrs}
    cleaned: list[Node | str] = []
    for child in node.children:
        if isinstance(child, Node):
            result = clean_node(child, slug, image_dir, image_paths, image_counter)
            if result is not None:
                cleaned.append(result)
        else:
            cleaned.append(child)
    node.children = cleaned
    if node.tag == "div" and not text_content(node).strip() and not find_first(node, lambda n: n.tag == "img"):
        return None
    if node.tag == "a":
        image = find_first(node, lambda n: n.tag == "img" and n.attrs.get("src", "").startswith("/static/blog/"))
        if image:
            node.attrs["href"] = image.attrs["src"]
    return node


def serialize(value: Node | str) -> str:
    if isinstance(value, str):
        return value
    attrs = "".join(f' {k}="{html.escape(v, quote=True)}"' for k, v in value.attrs.items())
    if value.tag in TreeParser.void:
        return f"<{value.tag}{attrs}/>"
    return f"<{value.tag}{attrs}>" + "".join(serialize(c) for c in value.children) + f"</{value.tag}>"


def parse_rss() -> dict[str, tuple[str, str, str, str]]:
    root = ET.fromstring(fetch(RSS_URL))
    ns = {"content": "http://purl.org/rss/1.0/modules/content/"}
    result: dict[str, tuple[str, str, str, str]] = {}
    for item in root.findall("./channel/item"):
        link = item.findtext("link", "")
        slug = urllib.parse.urlparse(link).path.rsplit("/", 1)[-1]
        title = item.findtext("title", "")
        description = item.findtext("description", "")
        pub = item.findtext("pubDate", "")
        date = datetime.strptime(pub, "%a, %d %b %Y %H:%M:%S %Z").date().isoformat()
        body = item.findtext("content:encoded", "", ns)
        result[slug] = (title, date, description, body)
    return result


def archive_posts() -> list[tuple[str, str]]:
    links = []
    for line in ARCHIVE.read_text().splitlines():
        # Match the URL independently of the title: titles such as "[SK] ..."
        # contain escaped closing brackets and are not safely parsed by a
        # simple Markdown-link regex.
        match = re.search(r"\((?:https://unpredictabletokens\.substack\.com/p/|/blog/)([^)]+)\)", line)
        if match:
            slug = match.group(1).removesuffix(".html")
            links.append((slug, slug.replace("-", " ").title()))
    return links


def main() -> int:
    rss = parse_rss()
    posts = archive_posts()
    image_paths: dict[str, str] = {}
    all_metadata: dict[str, tuple[str, str, str]] = {}
    for slug, archive_title in posts:
        if slug == EXISTING:
            all_metadata[slug] = (archive_title, "2026-08-08", "For non-technical readers")
            continue
        print(f"Mirroring {slug}", flush=True)
        if slug in rss:
            title, date, description, body_html = rss[slug]
            body_html = '<div class="body markup">' + body_html + "</div>"
        else:
            page = fetch(f"https://unpredictabletokens.substack.com/p/{slug}").decode("utf-8")
            title, date, description = extract_metadata(page, slug)
            body_html = serialize(extract_body(page))
        body = extract_body(body_html)
        image_dir = ROOT / "static" / "blog" / slug
        cleaned = clean_node(body, slug, image_dir, image_paths, [0])
        if not isinstance(cleaned, Node):
            raise RuntimeError(f"No clean body for {slug}")
        article_html = "".join(serialize(child) for child in cleaned.children).strip()
        output = "---\nlayout: post\ntitle: " + json.dumps(title, ensure_ascii=False) + "\ndate: " + date + "\n---\n\n" + article_html + "\n"
        (ROOT / "blog" / f"{slug}.html").write_text(output)
        all_metadata[slug] = (title, date, description)

    # Make every archive entry local while retaining its existing presentation/subtitles.
    text = ARCHIVE.read_text()
    for slug, _ in posts:
        text = text.replace(f"https://unpredictabletokens.substack.com/p/{slug}", f"/blog/{slug}.html")
    ARCHIVE.write_text(text)
    print(f"Mirrored {len(posts) - 1} posts; archive now links all {len(posts)} locally.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
