#!/usr/bin/env node
import fs from 'node:fs';

const cssPath = 'css/site.css';
let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* GB PRINT CONTRACT v2.6 — compact terminal signature without phantom sheet. */';
if (css.includes(marker)) throw new Error('v2.6 tail fix already present');
css += `

${marker}
@media print {
  html body .article-end-sdg-wrap {
    display: block;
    min-height: 0;
    height: auto;
    margin: 0;
    padding: 0;
    break-inside: avoid-page;
    page-break-inside: avoid;
    break-after: auto;
    page-break-after: auto;
  }

  html body .article-end-sdg {
    display: block;
    min-height: 0;
    height: auto;
    margin: 10mm auto 0;
    padding: 4mm 0 0;
    line-height: 1.2;
    break-inside: avoid-page;
    page-break-inside: avoid;
    break-after: auto;
    page-break-after: auto;
  }

  html body .article-end-sdg span {
    display: block;
    margin: 0 0 2mm;
  }

  html body .article-end-sdg svg {
    display: block;
    width: 22pt;
    height: 28pt;
    margin: 0 auto;
    overflow: visible;
  }

  html body :where(.gbs2-world, .page-wrap, main, article, .article-body) > :last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    break-after: auto;
    page-break-after: auto;
  }
}
`;
fs.writeFileSync(cssPath, css);
const count = (css.match(/!important/g) || []).length;
if (count > 200) throw new Error(`site.css priority ratchet exceeded: ${count} > 200`);
console.log(JSON.stringify({ marker, count }, null, 2));

const auditPath = 'scripts/print-paper-pdf-audit.py';
if (fs.existsSync(auditPath)) throw new Error(`${auditPath} already exists`);
fs.writeFileSync(auditPath, `#!/usr/bin/env python3
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
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if not args.pdf.is_file() or args.pdf.stat().st_size < 1000:
        raise SystemExit(f'PDF is missing or empty: {args.pdf}')

    out = args.out
    rendered = out / 'rendered'
    rendered.mkdir(parents=True, exist_ok=True)
    text_path = out / 'reader-print-a4.txt'
    run(['pdftoppm', '-png', '-r', '120', str(args.pdf), str(rendered / 'page')])
    run(['pdftotext', '-layout', str(args.pdf), str(text_path)])

    pages = sorted(rendered.glob('page-*.png'))
    if not pages:
        raise SystemExit('No rendered PDF pages')

    diagnostics: list[dict] = []
    failures: list[str] = []
    thumbs: list[tuple[int, Image.Image]] = []
    for index, path in enumerate(pages, 1):
        image = Image.open(path).convert('RGB')
        preview = image.copy()
        preview.thumbnail((280, 390))
        thumbs.append((index, preview))

        sample = image.copy()
        sample.thumbnail((700, 1000))
        quantized = sample.quantize(colors=96).convert('RGB')
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
                flat_saturated.append({'rgb': rgb, 'fraction': round(fraction, 4)})
        non_white = sum(pixel_count for rgb, pixel_count in counts.items() if min(rgb) < 242) / total
        diagnostics.append({
            'page': index,
            'nonWhiteFraction': round(non_white, 4),
            'flatSaturated': flat_saturated,
        })
        if non_white < 0.004:
            failures.append(f'page {index}: effectively blank ({non_white:.4f})')
        if flat_saturated:
            failures.append(f'page {index}: large saturated flat fill {flat_saturated}')

    text = text_path.read_text('utf-8', errors='ignore')
    text_pages = text.split('\\f')
    normalize = lambda value: re.sub(r'\\s+', ' ', value).strip().upper()
    date_pages = [i for i, value in enumerate(text_pages) if '23 НОЯБРЯ 1697' in normalize(value)]
    name_pages = [i for i, value in enumerate(text_pages) if 'JOHN GILL' in normalize(value)]
    if not date_pages or not name_pages or not set(date_pages) & set(name_pages):
        failures.append(f'biography masthead split across pages: dates={date_pages}, name={name_pages}')

    known_headings = {
        'I. СТАНОВЛЕНИЕ И ПРИЗВАНИЕ',
        'ОТКУДА РОЖДАЮТСЯ ГЕНИИ БЕЗ УНИВЕРСИТЕТОВ',
        'БЫТИЕ 3:9 — ВОПРОС, ИЗМЕНИВШИЙ ЖИЗНЬ',
        'КРЕЩЕНИЕ И ПЕРВЫЕ ШАГИ СЛУЖЕНИЯ',
    }
    for page_index, value in enumerate(text_pages[:-1], 1):
        lines = [normalize(line) for line in value.splitlines() if normalize(line)]
        if lines and lines[-1] in known_headings:
            failures.append(f'page {page_index}: orphan heading at page bottom: {lines[-1]}')

    columns, cell_w, cell_h = 4, 310, 430
    rows = math.ceil(len(thumbs) / columns)
    sheet = Image.new('RGB', (columns * cell_w, rows * cell_h), 'white')
    draw = ImageDraw.Draw(sheet)
    for slot, (number, thumb) in enumerate(thumbs):
        x = (slot % columns) * cell_w + (cell_w - thumb.width) // 2
        y = (slot // columns) * cell_h + 26
        sheet.paste(thumb, (x, y))
        draw.text((slot % columns * cell_w + 10, slot // columns * cell_h + 6), f'Page {number}', fill='black')
    sheet.save(out / 'pdf-contact-sheet-paper.png')

    report = {'pages': len(pages), 'diagnostics': diagnostics, 'failures': failures}
    (out / 'pdf-visual-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), 'utf-8')
    print(json.dumps({'pages': len(pages), 'failures': failures}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
`);

const workflowPath = '.github/workflows/print-paper-contract.yml';
if (fs.existsSync(workflowPath)) throw new Error(`${workflowPath} already exists`);
fs.writeFileSync(workflowPath, `name: Print Paper Contract

on:
  pull_request:
    branches: [main]
    paths:
      - 'css/**'
      - 'js/**'
      - 'articles/**'
      - 'src/components/**'
      - 'scripts/engine-sweep.mjs'
      - 'scripts/print-paper-pdf-audit.py'
      - '.github/workflows/print-paper-contract.yml'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: print-paper-\\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  a4-paper:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: |
          sudo apt-get update
          sudo apt-get install -y poppler-utils python3-pil
      - run: npm run strangler:build:production-like
      - name: Generate canonical reader PDF
        env:
          GB_READER_UI_ARTIFACT_DIR: reports/print-paper
        run: node scripts/engine-sweep.mjs
      - name: Audit rendered pages, palette and pagination
        run: python3 scripts/print-paper-pdf-audit.py reports/print-paper/reader-print-a4.pdf --out reports/print-paper
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: print-paper-contract-\\${{ github.sha }}
          path: reports/print-paper
          if-no-files-found: error
          retention-days: 7
`);
console.log(JSON.stringify({ auditPath, workflowPath }, null, 2));
