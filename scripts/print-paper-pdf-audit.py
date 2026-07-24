#!/usr/bin/env python3
"""Raster/text audit for the canonical reader A4 PDF."""
from __future__ import annotations

import argparse
import colorsys
import json
import math
import re
import subprocess
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not args.pdf.is_file() or args.pdf.stat().st_size < 1000:
        raise SystemExit(f"PDF is missing or empty: {args.pdf}")

    out = args.out
    rendered = out / "rendered"
    rendered.mkdir(parents=True, exist_ok=True)
    text_path = out / "reader-print-a4.txt"
    run(["pdftoppm", "-png", "-r", "120", str(args.pdf), str(rendered / "page")])
    run(["pdftotext", "-layout", str(args.pdf), str(text_path)])

    pages = sorted(rendered.glob("page-*.png"))
    if not pages:
        raise SystemExit("No rendered PDF pages")

    diagnostics: list[dict] = []
    failures: list[str] = []
    thumbs: list[tuple[int, Image.Image]] = []
    for index, path in enumerate(pages, 1):
        image = Image.open(path).convert("RGB")
        preview = image.copy()
        preview.thumbnail((280, 390))
        thumbs.append((index, preview))

        sample = image.copy()
        sample.thumbnail((700, 1000))
        quantized = sample.quantize(colors=96).convert("RGB")
        counts = Counter(quantized.getdata())
        total = quantized.width * quantized.height
        flat_saturated: list[dict] = []
        for rgb, pixel_count in counts.most_common(96):
            r, g, b = [value / 255 for value in rgb]
            _, saturation, value = colorsys.rgb_to_hsv(r, g, b)
            fraction = pixel_count / total
            if (
                saturation > 0.30
                and max(r, g, b) - min(r, g, b) > 0.12
                and 0.18 < value < 0.98
                and fraction > 0.018
            ):
                flat_saturated.append({"rgb": rgb, "fraction": round(fraction, 4)})
        non_white = sum(pixel_count for rgb, pixel_count in counts.items() if min(rgb) < 242) / total
        diagnostics.append(
            {
                "page": index,
                "nonWhiteFraction": round(non_white, 4),
                "flatSaturated": flat_saturated,
            }
        )
        if non_white < 0.004:
            failures.append(f"page {index}: effectively blank ({non_white:.4f})")
        if flat_saturated:
            failures.append(f"page {index}: large saturated flat fill {flat_saturated}")

    text = text_path.read_text("utf-8", errors="ignore")
    text_pages = text.split("\f")
    normalize = lambda value: re.sub(r"\s+", " ", value).strip().upper()
    date_pages = [i for i, value in enumerate(text_pages) if "23 НОЯБРЯ 1697" in normalize(value)]
    name_pages = [i for i, value in enumerate(text_pages) if "JOHN GILL" in normalize(value)]
    if not date_pages or not name_pages or not set(date_pages) & set(name_pages):
        failures.append(f"biography masthead split across pages: dates={date_pages}, name={name_pages}")

    series_label_pages = [
        i for i, value in enumerate(text_pages)
        if "СЕРИЯ О ДЖОНЕ ГИЛЛЕ" in normalize(value)
    ]
    series_intro_pages = [
        i for i, value in enumerate(text_pages)
        if (
            "СЕРИЯ О ДЖОНЕ ГИЛЛЕ СОСТОИТ" in normalize(value)
            or "БИОГРАФИЯ ДЖОНА ГИЛЛА" in normalize(value)
        )
    ]
    if (
        not series_label_pages
        or not series_intro_pages
        or not set(series_label_pages) & set(series_intro_pages)
    ):
        failures.append(
            "series overview split across pages: "
            f"label={series_label_pages}, intro={series_intro_pages}"
        )

    known_headings = {
        "I. СТАНОВЛЕНИЕ И ПРИЗВАНИЕ",
        "ОТКУДА РОЖДАЮТСЯ ГЕНИИ БЕЗ УНИВЕРСИТЕТОВ",
        "БЫТИЕ 3:9 — ВОПРОС, ИЗМЕНИВШИЙ ЖИЗНЬ",
        "КРЕЩЕНИЕ И ПЕРВЫЕ ШАГИ СЛУЖЕНИЯ",
    }
    for page_index, value in enumerate(text_pages[:-1], 1):
        lines = [normalize(line) for line in value.splitlines() if normalize(line)]
        if lines and lines[-1] in known_headings:
            failures.append(f"page {page_index}: orphan heading at page bottom: {lines[-1]}")

    columns, cell_w, cell_h = 4, 310, 430
    rows = math.ceil(len(thumbs) / columns)
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    for slot, (number, thumb) in enumerate(thumbs):
        x = (slot % columns) * cell_w + (cell_w - thumb.width) // 2
        y = (slot // columns) * cell_h + 26
        sheet.paste(thumb, (x, y))
        draw.text((slot % columns * cell_w + 10, slot // columns * cell_h + 6), f"Page {number}", fill="black")
    sheet.save(out / "pdf-contact-sheet-paper.png")

    report = {"pages": len(pages), "diagnostics": diagnostics, "failures": failures}
    (out / "pdf-visual-audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), "utf-8"
    )
    print(json.dumps({"pages": len(pages), "failures": failures}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
