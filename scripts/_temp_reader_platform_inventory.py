#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "reader-platform-inventory"
SNAPSHOT = OUT / "snapshot"

INCLUDE_SUFFIXES = {
    ".astro", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs",
    ".css", ".scss", ".html", ".md", ".mdx", ".json", ".yaml", ".yml", ".toml",
}
EXCLUDED_PARTS = {
    ".git", "node_modules", "dist", ".astro", ".cache", ".vercel", "coverage",
    "reader-platform-inventory",
}
EXCLUDED_PREFIXES = (
    "public/images/", "public/audio/", "public/video/", "public/fonts/",
    "images/", "audio/", "video/", "fonts/",
)
SPECIAL_FILES = {
    "package.json", "astro.config.mjs", "tsconfig.json", "AGENTS.md", "README.md",
}
MAX_FILE_BYTES = 2_000_000

PATTERNS = {
    "reader_terms": re.compile(r"reader|reading|book[-_ ]?mode|series|article[-_ ]?mode|content[-_ ]?mode", re.I),
    "theme_terms": re.compile(r"sepia|theme|dark|light|night|day|font[-_ ]?size|line[-_ ]?height|content[-_ ]?width", re.I),
    "chrome_terms": re.compile(r"mobile[-_ ]?bar|bottom[-_ ]?bar|top[-_ ]?bar|floating[-_ ]?cluster|settings[-_ ]?sheet|toc|contents", re.I),
    "learning_terms": re.compile(r"bookmark|highlight|note|glossar|learning|quiz|confidence|calibration|spaced[-_ ]?repetition", re.I),
    "storage_terms": re.compile(r"localStorage|sessionStorage|indexedDB|BroadcastChannel|CustomEvent", re.I),
    "performance_terms": re.compile(r"IntersectionObserver|ResizeObserver|MutationObserver|requestAnimationFrame|passive\s*:\s*true|content-visibility|contain-intrinsic", re.I),
}


def run(*args: str) -> str:
    result = subprocess.run(args, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    return result.stdout


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def eligible(path: Path) -> bool:
    if not path.is_file():
        return False
    relative = rel(path)
    if any(part in EXCLUDED_PARTS for part in path.relative_to(ROOT).parts):
        return False
    if relative.startswith(EXCLUDED_PREFIXES):
        return False
    if path.name in SPECIAL_FILES:
        return True
    if path.suffix.lower() not in INCLUDE_SUFFIXES:
        return False
    try:
        return path.stat().st_size <= MAX_FILE_BYTES
    except OSError:
        return False


def classify(relative: str, text: str) -> list[str]:
    tags: list[str] = []
    haystack = relative + "\n" + text[:200_000]
    for name, pattern in PATTERNS.items():
        if pattern.search(haystack):
            tags.append(name)
    lower = relative.lower()
    if lower.endswith(".astro") or "/src/" in f"/{lower}":
        tags.append("astro_native")
    if lower.endswith(".html"):
        tags.append("legacy_html")
    if lower.startswith("docs/") or lower.endswith(".md"):
        tags.append("documentation")
    if lower.startswith("css/") or lower.endswith(".css"):
        tags.append("styles")
    if lower.startswith("js/") or lower.endswith(".js"):
        tags.append("runtime_js")
    return sorted(set(tags))


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    SNAPSHOT.mkdir(parents=True)

    files: list[dict[str, object]] = []
    tag_counts: Counter[str] = Counter()
    keyword_files: defaultdict[str, list[str]] = defaultdict(list)
    storage_keys: Counter[str] = Counter()
    custom_events: Counter[str] = Counter()
    css_variables: Counter[str] = Counter()

    for path in sorted(ROOT.rglob("*")):
        if not eligible(path):
            continue
        relative = rel(path)
        try:
            raw = path.read_bytes()
            text = raw.decode("utf-8", errors="replace")
        except OSError:
            continue
        tags = classify(relative, text)
        for tag in tags:
            tag_counts[tag] += 1
            keyword_files[tag].append(relative)
        for key in re.findall(r"(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['\"]([^'\"]+)", text):
            storage_keys[key] += 1
        for event in re.findall(r"(?:new\s+CustomEvent|dispatchEvent\s*\(\s*new\s+Event)\(\s*['\"]([^'\"]+)", text):
            custom_events[event] += 1
        for variable in re.findall(r"--[a-zA-Z0-9_-]+", text):
            css_variables[variable] += 1

        target = SNAPSHOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        files.append({
            "path": relative,
            "size": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "tags": tags,
            "lines": text.count("\n") + 1,
        })

    (OUT / "file-index.json").write_text(json.dumps(files, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "tree.txt").write_text("\n".join(item["path"] for item in files) + "\n", encoding="utf-8")

    report: list[str] = []
    report.append("# Reader platform repository inventory")
    report.append(f"files_copied={len(files)}")
    report.append("\n## Tag counts")
    for tag, count in tag_counts.most_common():
        report.append(f"{tag}={count}")
    for tag in sorted(keyword_files):
        report.append(f"\n## {tag}")
        report.extend(keyword_files[tag])
    report.append("\n## Storage keys")
    report.extend(f"{count:4d} {key}" for key, count in storage_keys.most_common())
    report.append("\n## Custom events")
    report.extend(f"{count:4d} {event}" for event, count in custom_events.most_common())
    report.append("\n## CSS variables")
    report.extend(f"{count:4d} {name}" for name, count in css_variables.most_common(500))
    (OUT / "reader-patterns.txt").write_text("\n".join(report) + "\n", encoding="utf-8")

    history = []
    history.append("# branches")
    history.append(run("git", "branch", "-a", "--no-color"))
    history.append("# recent log")
    history.append(run("git", "log", "--all", "--date=short", "--pretty=format:%h %ad %d %s", "-n", "1200"))
    history.append("\n# reader/theme/book/series/article related log")
    history.append(run(
        "git", "log", "--all", "--date=short", "--pretty=format:%h %ad %d %s",
        "--regexp-ignore-case", "--extended-regexp",
        "--grep=reader|book|series|article|mobile|chrome|theme|sepia|Gill|Hermenevtika|floating|bookmark|highlight|learning",
        "-n", "1200",
    ))
    (OUT / "git-history.txt").write_text("\n".join(history), encoding="utf-8")

    route_like: list[str] = []
    for item in files:
        path_value = str(item["path"])
        if path_value.endswith((".astro", ".html")) and any(token in path_value.lower() for token in ("article", "book", "series", "gill", "herm", "page", "layout", "reader")):
            route_like.append(path_value)
    (OUT / "candidate-surfaces.txt").write_text("\n".join(route_like) + "\n", encoding="utf-8")

    archive = shutil.make_archive(str(ROOT / "reader-platform-inventory"), "zip", root_dir=OUT)
    print(f"inventory_files={len(files)}")
    print(f"inventory_archive={archive}")


if __name__ == "__main__":
    main()
