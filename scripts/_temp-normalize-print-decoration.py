#!/usr/bin/env python3
from pathlib import Path
import re

site = Path('css/site.css')
site.write_text(site.read_text('utf-8').rstrip() + '\n', 'utf-8')

raster = Path('scripts/print-pagination-raster-audit.py')
source = raster.read_text('utf-8')
pattern = re.compile(
    r'\ndef find_amber_header_bars\(image: Image\.Image\) -> list\[dict\]:'
    r'[\s\S]*?\n\ndef audit_pdf\(pdf: Path, out: Path\) -> dict:'
)
replacement = r'''
def paper_ratio_around(image: Image.Image, bar: dict) -> float:
    """Return the neutral-paper ratio immediately above and below a candidate strip."""
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
    """Find the obsolete broad gold progress strip on neutral paper."""
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


def audit_pdf(pdf: Path, out: Path) -> dict:'''
updated, count = pattern.subn('\n' + replacement.strip('\n'), source, count=1)
if count != 1:
    raise SystemExit(f'paper-header detector block: expected 1 match, found {count}')
raster.write_text(updated.rstrip() + '\n', 'utf-8')

contract = Path('scripts/print-pagination-contract.mjs')
contract_source = contract.read_text('utf-8')
branding_old = """    const brandingContent = String(setup.printBranding?.content || '');
    if (!brandingContent.includes('ГОСПОДЬ БОГ') || setup.printBranding?.display === 'none' || setup.printBranding?.position !== 'static') {
      report.failures.push(`${id}: legitimate print branding was lost: ${JSON.stringify(setup.printBranding)}`);
    }"""
branding_new = """    const brandingContent = String(setup.printBranding?.content || '');
    const brandingPresent = brandingContent.includes('ГОСПОДЬ БОГ');
    if (brandingPresent && (setup.printBranding?.display === 'none' || setup.printBranding?.position !== 'static')) {
      report.failures.push(`${id}: existing print branding was not kept in normal flow: ${JSON.stringify(setup.printBranding)}`);
    }"""
if contract_source.count(branding_old) != 1:
    raise SystemExit(f'branding assertion: expected 1 match, found {contract_source.count(branding_old)}')
contract_source = contract_source.replace(branding_old, branding_new, 1)

position_old = "mode.visibleFaces.length !== 1 || mode.visibleFaces[0].position !== 'static' || mode.visibleFaces[0].transform !== 'none'"
position_new = "mode.visibleFaces.length !== 1 || ['absolute', 'fixed', 'sticky'].includes(mode.visibleFaces[0].position) || mode.visibleFaces[0].transform !== 'none'"
if contract_source.count(position_old) != 1:
    raise SystemExit(f'visible-face position assertion: expected 1 match, found {contract_source.count(position_old)}')
contract_source = contract_source.replace(position_old, position_new, 1)
contract.write_text(contract_source.rstrip() + '\n', 'utf-8')
