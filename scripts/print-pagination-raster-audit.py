#!/usr/bin/env python3
"""Generic raster audit for a directory of reader PDFs.

This audit is deliberately content-agnostic: every PDF is rendered page by
page, checked for effectively blank sheets and large saturated screen fills,
and emitted as an individual contact sheet for visual inspection.
"""
from __future__ import annotations

import argparse
import colorsys
import json
import math
import subprocess
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def find_amber_header_bars(image: Image.Image) -> list[dict]:
    """Find thin, long warm-gold strips in the upper 22% of a paper page."""
    width, height = image.size
    limit_y = max(1, int(height * 0.22))
    qualifying_rows: list[tuple[int, int, int]] = []
    pixels = image.load()
    min_run = max(36, int(width * 0.14))
    for y in range(limit_y):
        longest = 0
        run = 0
        start = 0
        longest_start = 0
        for x in range(width):
            r, g, b = pixels[x, y]
            warm_gold = r >= 165 and g >= 105 and b <= 170 and r >= g + 18 and g >= b + 12
            if warm_gold:
                if run == 0:
                    start = x
                run += 1
                if run > longest:
                    longest = run
                    longest_start = start
            else:
                run = 0
        if longest >= min_run:
            qualifying_rows.append((y, longest_start, longest))
    bars: list[dict] = []
    group: list[tuple[int, int, int]] = []
    for row in qualifying_rows:
        if group and row[0] > group[-1][0] + 1:
            if len(group) >= 2:
                bars.append({
                    'y': group[0][0],
                    'height': group[-1][0] - group[0][0] + 1,
                    'x': min(item[1] for item in group),
                    'width': max(item[2] for item in group),
                })
            group = []
        group.append(row)
    if len(group) >= 2:
        bars.append({
            'y': group[0][0],
            'height': group[-1][0] - group[0][0] + 1,
            'x': min(item[1] for item in group),
            'width': max(item[2] for item in group),
        })
    return [bar for bar in bars if bar['height'] <= max(24, int(height * 0.025))]


def audit_pdf(pdf: Path, out: Path) -> dict:
    route_out = out / pdf.stem
    rendered = route_out / "rendered"
    rendered.mkdir(parents=True, exist_ok=True)
    run(["pdftoppm", "-png", "-r", "120", str(pdf), str(rendered / "page")])
    pages = sorted(rendered.glob("page-*.png"))
    if not pages:
        return {"pdf": pdf.name, "pages": 0, "failures": ["no rendered pages"]}

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
        non_white = sum(count for rgb, count in counts.items() if min(rgb) < 242) / total
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
        amber_bars = find_amber_header_bars(image)
        diagnostics.append(
            {
                "page": index,
                "nonWhiteFraction": round(non_white, 4),
                "flatSaturated": flat_saturated,
                "amberHeaderBars": amber_bars,
            }
        )
        if non_white < 0.004:
            failures.append(f"page {index}: effectively blank ({non_white:.4f})")
        if flat_saturated:
            failures.append(f"page {index}: large saturated flat fill {flat_saturated}")
        if amber_bars:
            failures.append(f"page {index}: repeated amber/gold header bar {amber_bars}")

    columns, cell_w, cell_h = 4, 310, 430
    rows = math.ceil(len(thumbs) / columns)
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    for slot, (number, thumb) in enumerate(thumbs):
        x = (slot % columns) * cell_w + (cell_w - thumb.width) // 2
        y = (slot // columns) * cell_h + 26
        sheet.paste(thumb, (x, y))
        draw.text(
            (slot % columns * cell_w + 10, slot // columns * cell_h + 6),
            f"Page {number}",
            fill="black",
        )
    sheet.save(route_out / "contact-sheet.png")
    return {
        "pdf": pdf.name,
        "pages": len(pages),
        "diagnostics": diagnostics,
        "failures": failures,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="PDF file or directory containing PDFs")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    pdfs = [args.input] if args.input.is_file() else sorted(args.input.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"No PDFs found in {args.input}")
    args.out.mkdir(parents=True, exist_ok=True)
    results = [audit_pdf(pdf, args.out) for pdf in pdfs]
    failures = [f"{item['pdf']}: {failure}" for item in results for failure in item["failures"]]
    report = {"pdfs": results, "failures": failures}
    (args.out / "raster-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), "utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
