#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const PATHS = {
  floating: 'css/floating-cluster.css',
  site: 'css/site.css',
  runtime: 'js/reader-preferences-head.js',
  contract: 'scripts/print-pagination-contract.mjs',
  raster: 'scripts/print-pagination-raster-audit.py',
};

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, source) { fs.writeFileSync(path, source, 'utf8'); }
function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(oldText, newText);
}

// Remove the obsolete global warm-gold progress pseudo-element completely.
let floating = read(PATHS.floating);
const progressStart = floating.indexOf('/* --- 2. Gold mobile progress — top thin bar + bottom bar gold track --- */');
const progressEnd = floating.indexOf('@media (max-width: 899px)', progressStart);
if (progressStart < 0 || progressEnd < 0 || progressEnd <= progressStart) {
  throw new Error('global gold progress source block not found');
}
floating = floating.slice(0, progressStart)
  + '/* Global top progress pseudo-element removed: canonical reader controls own progress. */\n'
  + floating.slice(progressEnd);
if (floating.includes('transform: scaleX(var(--gb-read-pct, 0))')) {
  throw new Error('global gold progress transform remains');
}
write(PATHS.floating, floating);

// Preserve useful print branding, hide only progress UI, flatten the visible card face.
let site = read(PATHS.site).trimEnd();
if (/GB PRINT CONTRACT v2\.(8|9)/.test(site)) {
  throw new Error('unexpected pre-existing decoration pagination contract');
}
site += String.raw`

/* GB PRINT CONTRACT v2.9 — progress chrome isolation and reversible-card flow. */
@media print {
  html body :where(#reading-progress, .h-reading-progress) {
    display: none !important;
    visibility: hidden !important;
    position: static !important;
    width: 0 !important;
    height: 0 !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: none !important;
    box-shadow: none !important;
    transform: none !important;
    opacity: 0 !important;
  }

  html body :where(.flip-card, .heart-flip-card, .error-flip-card) {
    perspective: none !important;
    min-height: 0 !important;
    height: auto !important;
    cursor: default !important;
    break-inside: avoid-page !important;
    page-break-inside: avoid !important;
  }
  html body :where(.flip-card-inner, .heart-flip-inner, .error-flip-inner) {
    position: static !important;
    min-height: 0 !important;
    height: auto !important;
    transform: none !important;
    transform-style: flat !important;
    transition: none !important;
  }
  html body :where(.flip-card-front, .heart-flip-front, .error-flip-front,
                   .flip-card-back, .heart-flip-back, .error-flip-back) {
    position: static !important;
    inset: auto !important;
    width: 100% !important;
    min-height: 0 !important;
    height: auto !important;
    transform: none !important;
    backface-visibility: visible !important;
    -webkit-backface-visibility: visible !important;
    break-inside: avoid-page !important;
    page-break-inside: avoid !important;
  }
  html body :where(.flip-card-front, .heart-flip-front, .error-flip-front) {
    display: flex !important;
  }
  html body :where(.flip-card-back, .heart-flip-back, .error-flip-back) {
    display: none !important;
  }
  html body .flip-card.flipped > .flip-card-inner > .flip-card-front,
  html body .heart-flip-card.flipped > .heart-flip-inner > .heart-flip-front,
  html body .error-flip-card.flipped > .error-flip-inner > .error-flip-front {
    display: none !important;
  }
  html body .flip-card.flipped > .flip-card-inner > .flip-card-back,
  html body .heart-flip-card.flipped > .heart-flip-inner > .heart-flip-back,
  html body .error-flip-card.flipped > .error-flip-inner > .error-flip-back {
    display: flex !important;
  }
}
`;
write(PATHS.site, site.trimEnd() + '\n');

// Register only outer reversible-card roots in the generic pagination engine.
let runtime = read(PATHS.runtime);
runtime = replaceOnce(
  runtime,
  '  var CANDIDATE_SELECTOR = [',
  '  // GB_PRINT_REVERSIBLE_CARD_ROOTS_V1\n  var CANDIDATE_SELECTOR = [',
  'runtime contract marker'
);
runtime = replaceOnce(
  runtime,
  "    '.manuscript-quote',\n    '.ancient-epigraph',",
  "    '.manuscript-quote',\n    '.flip-card',\n    '.heart-flip-card',\n    '.error-flip-card',\n    '.ancient-epigraph',",
  'outer reversible-card candidates'
);
runtime = replaceOnce(
  runtime,
  String.raw`var ROLE_CLASS_RE = /(?:^|[\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\s_-])/i;`,
  String.raw`var ROLE_CLASS_RE = /(?:^|[\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|flip-card|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\s_-])/i;`,
  'reversible-card semantic role'
);
write(PATHS.runtime, runtime);

// Strengthen the permanent Playwright/PDF proof.
let contract = read(PATHS.contract);
contract = replaceOnce(
  contract,
  `    await page.goto(base + url, { waitUntil: 'networkidle' });\n    await page.emulateMedia({ media: 'print' });`,
  `    await page.goto(base + url, { waitUntil: 'networkidle' });\n    await page.evaluate(() => {\n      const root = document.querySelector('[data-reader-range], [data-reader-root] article.article-body, [data-gill-v16] article.article-body, article.article-body, article[data-pagefind-body], main article, article');\n      if (!root) return;\n      const rect = root.getBoundingClientRect();\n      const absoluteTop = rect.top + window.scrollY;\n      const target = absoluteTop + Math.min(Math.max(rect.height * 0.32, 500), Math.max(500, rect.height - window.innerHeight));\n      window.scrollTo(0, Math.max(0, target));\n    });\n    await page.waitForTimeout(120);\n    await page.emulateMedia({ media: 'print' });`,
  'nonzero progress reproduction'
);
contract = replaceOnce(
  contract,
  `      return { runtime, atomic, keepers };`,
  `      const bodyBefore = getComputedStyle(document.body, '::before');\n      const printBranding = {\n        content: bodyBefore.content,\n        display: bodyBefore.display,\n        position: bodyBefore.position,\n        borderBottomWidth: bodyBefore.borderBottomWidth,\n        height: bodyBefore.height\n      };\n      const progressChrome = [...document.querySelectorAll('#reading-progress,.h-reading-progress')].map((node) => {\n        const style = getComputedStyle(node);\n        const rect = node.getBoundingClientRect();\n        return {\n          selector: node.id ? '#' + node.id : '.' + [...node.classList].join('.'),\n          display: style.display,\n          visibility: style.visibility,\n          position: style.position,\n          width: Math.round(rect.width),\n          height: Math.round(rect.height),\n          opacity: style.opacity\n        };\n      });\n      const flipCards = [...scope.querySelectorAll('.flip-card,.heart-flip-card,.error-flip-card')].filter(visible).map((node) => {\n        const inner = node.querySelector('.flip-card-inner,.heart-flip-inner,.error-flip-inner');\n        const faces = [...node.querySelectorAll('.flip-card-front,.flip-card-back,.heart-flip-front,.heart-flip-back,.error-flip-front,.error-flip-back')];\n        const snapshot = () => {\n          const faceStates = faces.map((face) => {\n            const style = getComputedStyle(face);\n            const rect = face.getBoundingClientRect();\n            return {\n              className: typeof face.className === 'string' ? face.className.slice(0, 120) : '',\n              display: style.display,\n              visibility: style.visibility,\n              position: style.position,\n              transform: style.transform,\n              width: Math.round(rect.width),\n              height: Math.round(rect.height)\n            };\n          });\n          return {\n            flipped: node.classList.contains('flipped'),\n            visibleFaces: faceStates.filter((face) => face.display !== 'none' && face.visibility !== 'hidden' && face.width > 8 && face.height > 4),\n            faces: faceStates\n          };\n        };\n        const initial = snapshot();\n        const wasFlipped = node.classList.contains('flipped');\n        node.classList.toggle('flipped', !wasFlipped);\n        const toggled = snapshot();\n        node.classList.toggle('flipped', wasFlipped);\n        const style = getComputedStyle(node);\n        const innerStyle = inner ? getComputedStyle(inner) : null;\n        return {\n          className: typeof node.className === 'string' ? node.className.slice(0, 140) : '',\n          flow: node.getAttribute('data-print-flow') || '',\n          breakInside: style.breakInside,\n          height: Math.round(node.getBoundingClientRect().height),\n          innerPosition: innerStyle?.position || '',\n          innerTransform: innerStyle?.transform || '',\n          initial,\n          toggled\n        };\n      });\n      return { runtime, atomic, keepers, printBranding, progressChrome, flipCards };`,
  'print chrome and reversible-card evidence'
);
contract = replaceOnce(
  contract,
  `    const badKeep = setup.keepers.filter((item) => !String(item.breakAfter).includes('avoid'));\n    if (badKeep.length) report.failures.push(\`${'${id}'}: keep-with-next computed style is not avoid-page: ${'${JSON.stringify(badKeep.slice(0, 4))}'}\`);`,
  `    const badKeep = setup.keepers.filter((item) => !String(item.breakAfter).includes('avoid'));\n    if (badKeep.length) report.failures.push(\`${'${id}'}: keep-with-next computed style is not avoid-page: ${'${JSON.stringify(badKeep.slice(0, 4))}'}\`);\n    const brandingContent = String(setup.printBranding?.content || '');\n    if (!brandingContent.includes('ГОСПОДЬ БОГ') || setup.printBranding?.display === 'none' || setup.printBranding?.position !== 'static') {\n      report.failures.push(\`${'${id}'}: legitimate print branding was lost: ${'${JSON.stringify(setup.printBranding)}'}\`);\n    }\n    const visibleProgress = (setup.progressChrome || []).filter((item) => item.display !== 'none' && item.visibility !== 'hidden' && item.opacity !== '0' && item.width > 0 && item.height > 0);\n    if (visibleProgress.length) report.failures.push(\`${'${id}'}: screen progress chrome remains printable: ${'${JSON.stringify(visibleProgress)}'}\`);\n    if (id === 'gill-part1' && !(setup.flipCards || []).length) report.failures.push(\`${'${id}'}: reversible-card fixture missing\`);\n    const badCards = (setup.flipCards || []).filter((item) => {\n      const modes = [item.initial, item.toggled];\n      return item.flow !== 'atomic'\n        || !String(item.breakInside).includes('avoid')\n        || item.innerPosition !== 'static'\n        || item.innerTransform !== 'none'\n        || modes.some((mode) => mode.visibleFaces.length !== 1 || mode.visibleFaces[0].position !== 'static' || mode.visibleFaces[0].transform !== 'none');\n    });\n    if (badCards.length) report.failures.push(\`${'${id}'}: reversible-card print flow is not atomic/single-face: ${'${JSON.stringify(badCards.slice(0, 4))}'}\`);`,
  'permanent print assertions'
);
contract = replaceOnce(
  contract,
  `      keepNextCount: setup.keepers.length,\n      markerPdf: \`markers/${'${id}'}.pdf\`,`,
  `      keepNextCount: setup.keepers.length,\n      printBranding: setup.printBranding,\n      progressChrome: setup.progressChrome,\n      flipCards: setup.flipCards,\n      markerPdf: \`markers/${'${id}'}.pdf\`,`,
  'report print evidence'
);
write(PATHS.contract, contract);

// Add a physical raster gate for the exact broad gold strip on neutral paper.
let raster = read(PATHS.raster);
const helperAnchor = '\n\ndef audit_pdf(pdf: Path, out: Path) -> dict:\n';
const helper = String.raw`

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
`;
raster = replaceOnce(raster, helperAnchor, helper + helperAnchor, 'paper-aware amber detector');
raster = replaceOnce(
  raster,
  `        diagnostics.append(\n            {\n                "page": index,\n                "nonWhiteFraction": round(non_white, 4),\n                "flatSaturated": flat_saturated,\n            }\n        )`,
  `        amber_bars = find_amber_header_bars(image)\n        diagnostics.append(\n            {\n                "page": index,\n                "nonWhiteFraction": round(non_white, 4),\n                "flatSaturated": flat_saturated,\n                "amberHeaderBars": amber_bars,\n            }\n        )`,
  'amber diagnostics'
);
raster = replaceOnce(
  raster,
  `        if flat_saturated:\n            failures.append(f"page {index}: large saturated flat fill {flat_saturated}")`,
  `        if flat_saturated:\n            failures.append(f"page {index}: large saturated flat fill {flat_saturated}")\n        if amber_bars:\n            failures.append(f"page {index}: obsolete amber/gold paper-header bar {amber_bars}")`,
  'amber failure gate'
);
write(PATHS.raster, raster.trimEnd() + '\n');

for (const path of [PATHS.runtime, PATHS.contract]) {
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
}
execFileSync('python3', ['-m', 'py_compile', PATHS.raster], { stdio: 'inherit' });

console.log(JSON.stringify({
  changedProductFiles: Object.values(PATHS),
  progressOwner: 'canonical reader controls; global body pseudo removed',
  reversibleCards: ['flip-card', 'heart-flip-card', 'error-flip-card'],
  printBranding: 'preserved and asserted',
  rasterGate: 'paper-aware obsolete-header-strip detector',
  marker: 'GB_PRINT_REVERSIBLE_CARD_ROOTS_V1'
}, null, 2));
