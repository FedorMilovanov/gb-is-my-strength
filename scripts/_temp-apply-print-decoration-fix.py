#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]

# 1) Remove the obsolete global gold reading-progress pseudo-element entirely.
floating_path = root / 'css/floating-cluster.css'
floating = floating_path.read_text('utf-8')
pattern = re.compile(
    r'\n?/\* --- 2\. Gold mobile progress — top thin bar \+ bottom bar gold track --- \*/\n'
    r'html body::before \{\n'
    r"  content: '';\n"
    r'  position: fixed;\n'
    r'  top: 0; left: 0; right: 0;\n'
    r'  height: 3px;\n'
    r'  z-index: 3000;\n'
    r'  background: linear-gradient\(90deg, #d4a857, #ffd18b, #d4a857\);\n'
    r'  transform-origin: left;\n'
    r'  transform: scaleX\(var\(--gb-read-pct, 0\)\);\n'
    r'  opacity: var\(--gb-read-active, 0\);\n'
    r'  transition: transform \.25s ease, opacity \.3s ease;\n'
    r'  pointer-events: none;\n'
    r'\}\n'
)
floating, count = pattern.subn('\n/* Global gold progress pseudo-element removed: reading progress is represented by existing reader controls. */\n', floating, count=1)
if count != 1:
    raise SystemExit(f'expected one gold progress block, removed {count}')
if 'html body::before' in floating:
    raise SystemExit('legacy global body::before still present in floating-cluster.css')
floating_path.write_text(floating, 'utf-8')

# 2) Add flip-card families to the universal semantic pagination engine.
head_path = root / 'js/reader-preferences-head.js'
head = head_path.read_text('utf-8')
needle = "    '.manuscript-quote',\n"
insert = """    '.manuscript-quote',
    '.flip-card',
    '.flip-card-inner',
    '.flip-card-front',
    '.flip-card-back',
    '.heart-flip-card',
    '.heart-flip-inner',
    '.heart-flip-front',
    '.heart-flip-back',
    '.error-flip-card',
    '.error-flip-inner',
    '.error-flip-front',
    '.error-flip-back',
"""
if head.count(needle) != 1:
    raise SystemExit(f'expected one manuscript selector anchor, found {head.count(needle)}')
head = head.replace(needle, insert, 1)
head_path.write_text(head, 'utf-8')

# 3) Add a final universal paper rule: no body decorations, atomic flip-card faces.
site_path = root / 'css/site.css'
site = site_path.read_text('utf-8')
marker = '/* GB PRINT CONTRACT v2.8 — decoration purge and reversible-card pagination. */'
if marker in site:
    raise SystemExit('v2.8 marker already exists')
site += r'''

/* GB PRINT CONTRACT v2.8 — decoration purge and reversible-card pagination. */
@media print {
  /* Root pseudo-elements are screen chrome. They must never become repeated
     page furniture in paged media. */
  html body::before,
  html body::after {
    content: none !important;
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: none !important;
    background-image: none !important;
    border: 0 !important;
    box-shadow: none !important;
    opacity: 0 !important;
    transform: none !important;
  }

  /* Reversible cards are semantic reading modules in print. A face may move
     to the next sheet, but it may not be cut between its text and source. */
  html body :where(
    .flip-card-front, .flip-card-back,
    .heart-flip-front, .heart-flip-back,
    .error-flip-front, .error-flip-back,
    .manuscript-quote, .ancient-epigraph
  ) {
    break-inside: avoid-page !important;
    page-break-inside: avoid !important;
  }
}
'''
site_path.write_text(site, 'utf-8')

# 4) Strengthen the Playwright/PDF contract with computed-style evidence.
contract_path = root / 'scripts/print-pagination-contract.mjs'
contract = contract_path.read_text('utf-8')
return_needle = '      return { runtime, atomic, keepers };'
return_replacement = r'''      const bodyBefore = getComputedStyle(document.body, '::before');
      const bodyAfter = getComputedStyle(document.body, '::after');
      const rootPseudo = {
        before: { content: bodyBefore.content, display: bodyBefore.display, background: bodyBefore.background, height: bodyBefore.height, opacity: bodyBefore.opacity },
        after: { content: bodyAfter.content, display: bodyAfter.display, background: bodyAfter.background, height: bodyAfter.height, opacity: bodyAfter.opacity }
      };
      const flipFaces = [...scope.querySelectorAll('.flip-card-front,.flip-card-back,.heart-flip-front,.heart-flip-back,.error-flip-front,.error-flip-back')]
        .filter(visible)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className.slice(0, 140) : '',
          flow: node.getAttribute('data-print-flow') || '',
          breakInside: getComputedStyle(node).breakInside,
          text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100)
        }));
      return { runtime, atomic, keepers, rootPseudo, flipFaces };'''
if contract.count(return_needle) != 1:
    raise SystemExit(f'expected one contract return anchor, found {contract.count(return_needle)}')
contract = contract.replace(return_needle, return_replacement, 1)
check_needle = "    const badKeep = setup.keepers.filter((item) => !String(item.breakAfter).includes('avoid'));\n    if (badKeep.length) report.failures.push(`${id}: keep-with-next computed style is not avoid-page: ${JSON.stringify(badKeep.slice(0, 4))}`);"
check_replacement = check_needle + r'''
    const visiblePseudo = Object.entries(setup.rootPseudo || {}).filter(([, pseudo]) =>
      pseudo && pseudo.display !== 'none' && pseudo.content !== 'none' && pseudo.content !== 'normal' && pseudo.opacity !== '0'
    );
    if (visiblePseudo.length) report.failures.push(`${id}: root pseudo decoration remains printable: ${JSON.stringify(visiblePseudo)}`);
    const badFlipFaces = (setup.flipFaces || []).filter((item) => item.flow !== 'atomic' || !String(item.breakInside).includes('avoid'));
    if (badFlipFaces.length) report.failures.push(`${id}: reversible-card faces are not atomic: ${JSON.stringify(badFlipFaces.slice(0, 8))}`);'''
if contract.count(check_needle) != 1:
    raise SystemExit(f'expected one check anchor, found {contract.count(check_needle)}')
contract = contract.replace(check_needle, check_replacement, 1)
contract_path.write_text(contract, 'utf-8')

# 5) Detect long amber/gold horizontal strips in the upper paper region.
raster_path = root / 'scripts/print-pagination-raster-audit.py'
raster = raster_path.read_text('utf-8')
helper_anchor = '\n\ndef audit_pdf(pdf: Path, out: Path) -> dict:\n'
helper = r'''

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
'''
if raster.count(helper_anchor) != 1:
    raise SystemExit(f'expected raster helper anchor once, found {raster.count(helper_anchor)}')
raster = raster.replace(helper_anchor, helper + helper_anchor, 1)
diag_needle = "        diagnostics.append(\n            {\n                \"page\": index,\n                \"nonWhiteFraction\": round(non_white, 4),\n                \"flatSaturated\": flat_saturated,\n            }\n        )"
diag_replacement = """        amber_bars = find_amber_header_bars(image)
        diagnostics.append(
            {
                \"page\": index,
                \"nonWhiteFraction\": round(non_white, 4),
                \"flatSaturated\": flat_saturated,
                \"amberHeaderBars\": amber_bars,
            }
        )"""
if raster.count(diag_needle) != 1:
    raise SystemExit(f'expected diagnostics anchor once, found {raster.count(diag_needle)}')
raster = raster.replace(diag_needle, diag_replacement, 1)
fail_needle = "        if flat_saturated:\n            failures.append(f\"page {index}: large saturated flat fill {flat_saturated}\")"
fail_replacement = fail_needle + "\n        if amber_bars:\n            failures.append(f\"page {index}: repeated amber/gold header bar {amber_bars}\")"
if raster.count(fail_needle) != 1:
    raise SystemExit(f'expected failure anchor once, found {raster.count(fail_needle)}')
raster = raster.replace(fail_needle, fail_replacement, 1)
raster_path.write_text(raster, 'utf-8')

print('Applied print decoration purge and reversible-card pagination contract.')
