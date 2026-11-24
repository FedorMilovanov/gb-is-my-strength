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


def paper_ratio_around(image: Image.Image, bar: dict) -> float:
    pixels = image.load()
    width, height = image.size
    pad_x = max(4, int(width * 0.006))
    pad_y = max(4, int(height * 0.004))
    x0 = max(0, bar["x"] - pad_x)
    x1 = min(width, bar["x"] + bar["width"] + pad_x)
    rows = list(range(max(0, bar["y"] - pad_y), bar["y"]))
    rows += list(range(bar["y"] + bar["height"], min(height, bar["y"] + bar["height"] + pad_y)))
    neutral = 0
    total = 0
    for y in rows:
        for x in range(x0, x1):
            r, g, b = pixels[x, y]
            total += 1
            if min(r, g, b) >= 232 and max(r, g, b) - min(r, g, b) <= 20:
                neutral += 1
    return neutral / total if total else 0.0


def find_amber_header_bars(image: Image.Image) -> list[dict]:
    """Find the obsolete broad gold progress strip on otherwise neutral paper."""
    width, height = image.size
    limit_y = max(1, int(height * 0.16))
    qualifying_rows: list[tuple[int, int, int]] = []
    pixels = image.load()
    min_run = max(48, int(width * 0.28))
    for y in range(limit_y):
        longest = 0
        run_length = 0
        run_start = 0
        longest_start = 0
        for x in range(width):
            r, g, b = pixels[x, y]
            warm_gold = r >= 165 and g >= 105 and b <= 170 and r >= g + 18 and g >= b + 12
            if warm_gold:
                if run_length == 0:
                    run_start = x
                run_length += 1
                if run_length > longest:
                    longest = run_length
                    longest_start = run_start
            else:
                run_length = 0
        if longest >= min_run:
            qualifying_rows.append((y, longest_start, longest))
    bars: list[dict] = []
    group: list[tuple[int, int, int]] = []
    for row in qualifying_rows:
        if group and row[0] > group[-1][0] + 1:
            if len(group) >= 2:
                bars.append({
                    "y": group[0][0],
                    "height": group[-1][0] - group[0][0] + 1,
                    "x": min(item[1] for item in group),
                    "width": max(item[2] for item in group),
                })
            group = []
        group.append(row)
    if len(group) >= 2:
        bars.append({
            "y": group[0][0],
            "height": group[-1][0] - group[0][0] + 1,
            "x": min(item[1] for item in group),
            "width": max(item[2] for item in group),
        })
    confirmed: list[dict] = []
    for bar in bars:
        geometry_matches = (
            2 <= bar["height"] <= max(20, int(height * 0.018))
            and bar["x"] <= int(width * 0.28)
            and int(width * 0.28) <= bar["width"] <= int(width * 0.78)
        )
        if not geometry_matches:
            continue
        paper_ratio = paper_ratio_around(image, bar)
        if paper_ratio >= 0.82:
            confirmed.append({**bar, "paperRatio": round(paper_ratio, 4)})
    return confirmed



import re, subprocess, unicodedata, xml.etree.ElementTree as ET

def tok(t): return re.findall(r'[^\W_]+',unicodedata.normalize('NFKC',t).casefold().replace('\u00ad',''))
def read(p):
 d=ET.fromstring(subprocess.check_output(['pdftotext','-bbox-layout',str(p),'-'])); out=[]
 for page in d.findall('.//{*}page'):
  words=[]
  for word in page.findall('.//{*}word'):
   for t in tok(word.text or ''): words.append({'t':t,'x':float(word.attrib['xMin']),'y':float(word.attrib['yMin']),'r':float(word.attrib['xMax']),'b':float(word.attrib['yMax'])})
  out.append({'w':float(page.attrib['width']),'h':float(page.attrib['height']),'words':words})
 return out
def matches(ws,q):
 t=tok(q);return [ws[i:i+len(t)] for i in range(len(ws)-len(t)+1) if [w['t'] for w in ws[i:i+len(t)]]==t] if t else []
def witness(pages, rows, heads):
 anchors=[]
 for i,p in enumerate(pages):
  ws=p['words']; hits=[matches(ws,h) for h in heads]
  # Header candidates require all 4 labels on one horizontal band, ordered left to right.
  for a in hits[0]:
   y=a[0]['y']; other=[[v for v in h if abs(v[0]['y']-y)<3] for h in hits[1:]]
   if all(len(v)==1 for v in other):
    h=[a]+[v[0] for v in other]; xs=[v[0]['x'] for v in h]
    if all(b-a>30 for a,b in zip(xs,xs[1:])): anchors.append((i,xs,max(w['b'] for v in h for w in v)))
 if len(anchors)!=1:return {'status':'REVIEW','reason':'ambiguous or missing table header','headers':len(anchors)}
 i,xs,y=anchors[0];p=pages[i]; ws=p['words']; cols=[[w for w in ws if w['y']>y and w['x']>=x-1 and (j==3 or w['x']<xs[j+1]-1)] for j,x in enumerate(xs)]
 # First-column row boundaries are independently sourced, not inferred from the clipped right column.
 rstarts=[]
 for r in rows:
  m=matches(cols[0],r[0]);
  if len(m)!=1:return {'status':'REVIEW','reason':'row anchor ambiguous/missing','row':len(rstarts)+1}
  rstarts.append(m[0][0]['y'])
 if rstarts!=sorted(rstarts) or len(set(rstarts))!=len(rows):return {'status':'FAIL','reason':'row ordering'}
 # Locate the last row's last word in first column; use a conservative trailing row band.
 # No body text outside the table allowed to satisfy a cell: it must start at the matching row top.
 missing=[]
 for ri,r in enumerate(rows):
  y0=rstarts[ri]; y1=rstarts[ri+1] if ri+1<len(rows) else max(w['b'] for w in matches(cols[0],r[0])[0])+30
  for ci,expected in enumerate(r):
   ws2=[w for w in cols[ci] if y0-2<=w['y']<y1-2]
   m=[v for v in matches(ws2,expected) if abs(v[0]['y']-y0)<3]
   if len(m)!=1:missing.append([ri+1,ci+1])
 return {'status':'PASS' if not missing else 'FAIL','page':i+1,'present':sum(map(len, rows))-len(missing),'missing':missing}
def phrase_pages(pages,q): return [i+1 for i,p in enumerate(pages) if matches(p['words'],q)]

NG_ROWS = [
  [
    "Матфей помещает речь на горе; Лука — на ровном месте.",
    "Одно событие на ровной площадке горного склона.",
    "Два близких эпизода или повторение сходного учения.",
    "Наблюдение: высокая; реконструкция: средняя."
  ],
  [
    "Матфей передаёт значительно больший объём материала, чем Лука.",
    "Различный отбор и сокращение одной проповеди.",
    "Повторное обучение либо литературная композиция из близких речений.",
    "Объём: высокая; механизм: средняя/низкая."
  ],
  [
    "После речевого блока оба повествования переходят к исцелению слуги сотника.",
    "Общий последующий контекст поддерживает связь рассказов.",
    "Евангелисты могли располагать материал тематически.",
    "Последовательность: высокая; вывод о едином событии: средняя."
  ],
  [
    "Матфей и Лука различаются формулировками, адресацией и набором тем.",
    "Разные ракурсы, перевод и богодухновенный отбор.",
    "Разные события, устная традиция или редакционная композиция.",
    "Различия: высокая; объяснение зависит от модели."
  ]
]
NG_HEADS = ["Наблюдение","Возможное объяснение","Конкурирующее объяснение","Уверенность"]

def nagornaya_paper_witness(pdf):
    pages = read(pdf)
    table = witness(pages, NG_ROWS, NG_HEADS)
    heading = phrase_pages(pages, 'III. Мф 5:17–20 — Богословский стержень')
    subtitle = phrase_pages(pages, 'Здесь проповедь получает свой центр тяжести')
    body = phrase_pages(pages, 'Стихи 17–20 пятой главы Матфея')
    group_ok = len(heading) == 1 and heading == subtitle == body
    return {'table': table, 'heading': heading, 'subtitle': subtitle, 'body': body, 'groupOk': group_ok}

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
            failures.append(f"page {index}: obsolete amber/gold paper-header bar {amber_bars}")

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
    nagornaya = None
    if re.fullmatch(r'nagornaya-(a4|letter)-(js|nojs)-(390|1240)', pdf.stem):
        nagornaya = nagornaya_paper_witness(pdf)
        if nagornaya['table']['status'] != 'PASS' or not nagornaya['groupOk']:
            failures.append('Nagornaya physical table/heading witness: ' + json.dumps(nagornaya, ensure_ascii=False))
    return {
        "pdf": pdf.name,
        "pages": len(pages),
        "diagnostics": diagnostics,
        "nagornaya": nagornaya,
        "failures": failures,
    }


def paper_format_inventory(pdfs):
    """Exact required CI artifacts; do not infer coverage from a directory existing."""
    expected = {
        f"herm-{paper}-{mode}.pdf"
        for paper in ("a4", "letter") for mode in ("js", "nojs")
    } | {
        f"nagornaya-{paper}-{mode}-{width}.pdf"
        for paper in ("a4", "letter") for mode in ("js", "nojs")
        for width in (390, 1240)
    }
    names = [p.name for p in pdfs]
    missing = sorted(expected - set(names))
    duplicates = sorted(name for name, count in Counter(names).items() if count > 1)
    unexpected = sorted(set(names) - expected)
    invalid = []
    for p in pdfs:
        try:
            with p.open("rb") as stream:
                if stream.read(5) != b"%PDF-":
                    invalid.append(p.name)
        except OSError:
            invalid.append(p.name)
    failures = []
    for label, items in (("missing", missing), ("duplicate", duplicates),
                         ("unexpected", unexpected), ("invalid PDF header", invalid)):
        if items:
            failures.append(f"paper-formats {label}: {', '.join(items)}")
    return {"expected": sorted(expected), "observed": sorted(names),
            "failures": failures}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="PDF file or directory containing PDFs")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--require-paper-formats", action="store_true")
    args = parser.parse_args()
    pdfs = [args.input] if args.input.is_file() else sorted(args.input.glob("*.pdf"))
    inventory = paper_format_inventory(pdfs) if args.require_paper_formats else None
    if not pdfs and inventory is None:
        raise SystemExit(f"No PDFs found in {args.input}")
    args.out.mkdir(parents=True, exist_ok=True)
    results = []
    for pdf in pdfs:
        try:
            results.append(audit_pdf(pdf, args.out))
        except Exception as error:
            results.append({"pdf": pdf.name, "pages": 0, "failures": [f"audit failed: {type(error).__name__}: {error}"]})
    failures = [f"{item['pdf']}: {failure}" for item in results for failure in item["failures"]]
    if inventory is not None:
        failures.extend(inventory["failures"])
    report = {"pdfs": results, "inventory": inventory, "failures": failures}
    (args.out / "raster-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), "utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
