#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE_SHA = '555717f81693806ac4e801a79eb92f91f6bf54c2';
const PATHS = {
  floating: 'css/floating-cluster.css',
  site: 'css/site.css',
  runtime: 'js/reader-preferences-head.js',
  contract: 'scripts/print-pagination-contract.mjs',
  raster: 'scripts/print-pagination-raster-audit.py',
};

function fromBase(path) {
  return execFileSync('git', ['show', `${BASE_SHA}:${path}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}
function write(path, source) { fs.writeFileSync(path, source, 'utf8'); }
function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(oldText, newText);
}

// 1. Remove the duplicate global top progress pseudo-element at its source.
let floating = fromBase(PATHS.floating);
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

// 2. Preserve legitimate printed branding, hide only progress UI, and flatten reversible cards.
let site = fromBase(PATHS.site).trimEnd();
site += String.raw`

/* GB PRINT CONTRACT v2.9 — progress chrome isolation and reversible-card flow. */
@media print {
  /* Screen-only progress owners must never repeat on every paper page. */
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

  /* A reversible card becomes one ordinary semantic block in paged media. */
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
write(PATHS.site, site + '\n');

// 3. Register only the outer reversible-card roots with the pagination engine.
let runtime = fromBase(PATHS.runtime);
runtime = replaceOnce(
  runtime,
  `  var CANDIDATE_SELECTOR = [`,
  `  // GB_PRINT_REVERSIBLE_CARD_ROOTS_V1\n  var CANDIDATE_SELECTOR = [`,
  'runtime contract marker'
);
runtime = replaceOnce(
  runtime,
  `    '.manuscript-quote',\n    '.ancient-epigraph',`,
  `    '.manuscript-quote',\n    '.flip-card',\n    '.heart-flip-card',\n    '.error-flip-card',\n    '.ancient-epigraph',`,
  'outer reversible-card candidates'
);
write(PATHS.runtime, runtime);

// 4. Extend the permanent browser/PDF contract without suppressing print branding.
let contract = fromBase(PATHS.contract);
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

// 5. Add a physical raster gate for the exact repeated warm-gold strip defect.
let raster = fromBase(PATHS.raster);
const helperAnchor = '\n\ndef audit_pdf(pdf: Path, out: Path) -> dict:\n';
const helper = String.raw`

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
`;
raster = replaceOnce(raster, helperAnchor, helper + helperAnchor, 'amber detector helper');
raster = replaceOnce(
  raster,
  `        diagnostics.append(\n            {\n                "page": index,\n                "nonWhiteFraction": round(non_white, 4),\n                "flatSaturated": flat_saturated,\n            }\n        )`,
  `        amber_bars = find_amber_header_bars(image)\n        diagnostics.append(\n            {\n                "page": index,\n                "nonWhiteFraction": round(non_white, 4),\n                "flatSaturated": flat_saturated,\n                "amberHeaderBars": amber_bars,\n            }\n        )`,
  'amber diagnostics'
);
raster = replaceOnce(
  raster,
  `        if flat_saturated:\n            failures.append(f"page {index}: large saturated flat fill {flat_saturated}")`,
  `        if flat_saturated:\n            failures.append(f"page {index}: large saturated flat fill {flat_saturated}")\n        if amber_bars:\n            failures.append(f"page {index}: repeated amber/gold header bar {amber_bars}")`,
  'amber failure gate'
);
write(PATHS.raster, raster);

for (const path of [PATHS.runtime, PATHS.contract]) {
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
}
execFileSync('python3', ['-m', 'py_compile', PATHS.raster], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  baseSha: BASE_SHA,
  changedProductFiles: Object.values(PATHS),
  progressOwner: 'canonical reader controls; global body pseudo removed',
  printChrome: ['#reading-progress', '.h-reading-progress'],
  reversibleCards: ['flip-card', 'heart-flip-card', 'error-flip-card'],
  printBranding: 'preserved and asserted',
  marker: 'GB_PRINT_REVERSIBLE_CARD_ROOTS_V1',
}, null, 2));
