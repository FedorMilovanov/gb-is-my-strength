#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const runtimePath = 'js/reader-preferences-head.js';
const contractPath = 'scripts/print-pagination-contract.mjs';
const rasterPath = 'scripts/print-pagination-raster-audit.py';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(oldText, newText);
}

let runtime = read(runtimePath);
runtime = replaceOnce(
  runtime,
  `    '.manuscript-quote',\n    '.flip-card',\n    '.flip-card-inner',\n    '.flip-card-front',\n    '.flip-card-back',\n    '.heart-flip-card',\n    '.heart-flip-inner',\n    '.heart-flip-front',\n    '.heart-flip-back',\n    '.error-flip-card',\n    '.error-flip-inner',\n    '.error-flip-front',\n    '.error-flip-back',\n    '.ancient-epigraph',`,
  `    '.manuscript-quote',\n    '.flip-card',\n    '.heart-flip-card',\n    '.error-flip-card',\n    '.ancient-epigraph',`,
  'outer reversible-card candidate registration'
);
runtime = replaceOnce(
  runtime,
  `var ROLE_CLASS_RE = /(?:^|[\\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\\s_-])/i;`,
  `var ROLE_CLASS_RE = /(?:^|[\\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|flip-card|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\\s_-])/i;`,
  'reversible-card semantic role registration'
);
runtime = replaceOnce(
  runtime,
  `      '  html body { orphans: 3; widows: 3; }',\n      '  html body [data-print-flow="atomic"],`,
  `      '  html body { orphans: 3; widows: 3; }',\n      '  /* GB_PRINT_DECORATION_PAGINATION_V3 */',\n      '  html body [data-print-flow="atomic"],`,
  'print decoration pagination marker'
);
write(runtimePath, runtime);

let contract = read(contractPath);
contract = replaceOnce(
  contract,
  `      const bodyBefore = getComputedStyle(document.body, '::before');\n      const bodyAfter = getComputedStyle(document.body, '::after');\n      const rootPseudo = {\n        before: { content: bodyBefore.content, display: bodyBefore.display, background: bodyBefore.background, height: bodyBefore.height, opacity: bodyBefore.opacity },\n        after: { content: bodyAfter.content, display: bodyAfter.display, background: bodyAfter.background, height: bodyAfter.height, opacity: bodyAfter.opacity }\n      };\n      const flipFaces = [...scope.querySelectorAll('.flip-card-front,.flip-card-back,.heart-flip-front,.heart-flip-back,.error-flip-front,.error-flip-back')]\n        .filter(visible)\n        .map((node) => ({\n          tag: node.tagName.toLowerCase(),\n          className: typeof node.className === 'string' ? node.className.slice(0, 140) : '',\n          flow: node.getAttribute('data-print-flow') || '',\n          breakInside: getComputedStyle(node).breakInside,\n          text: String(node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 100)\n        }));\n      return { runtime, atomic, keepers, rootPseudo, flipFaces };`,
  `      const bodyBefore = getComputedStyle(document.body, '::before');\n      const bodyAfter = getComputedStyle(document.body, '::after');\n      const rootPseudo = {\n        before: { content: bodyBefore.content, display: bodyBefore.display, background: bodyBefore.background, height: bodyBefore.height, opacity: bodyBefore.opacity },\n        after: { content: bodyAfter.content, display: bodyAfter.display, background: bodyAfter.background, height: bodyAfter.height, opacity: bodyAfter.opacity }\n      };\n      const flipCards = [...scope.querySelectorAll('.flip-card,.heart-flip-card,.error-flip-card')]\n        .filter(visible)\n        .map((node) => {\n          const rect = node.getBoundingClientRect();\n          return {\n            tag: node.tagName.toLowerCase(),\n            className: typeof node.className === 'string' ? node.className.slice(0, 140) : '',\n            flow: node.getAttribute('data-print-flow') || '',\n            breakInside: getComputedStyle(node).breakInside,\n            height: Math.round(rect.height),\n            text: String(node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 100)\n          };\n        });\n      const flipFaces = [...scope.querySelectorAll('.flip-card-front,.flip-card-back,.heart-flip-front,.heart-flip-back,.error-flip-front,.error-flip-back')]\n        .filter(visible)\n        .map((node) => ({\n          tag: node.tagName.toLowerCase(),\n          className: typeof node.className === 'string' ? node.className.slice(0, 140) : '',\n          breakInside: getComputedStyle(node).breakInside,\n          text: String(node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 100)\n        }));\n      return { runtime, atomic, keepers, rootPseudo, flipCards, flipFaces };`,
  'separate outer-card and visible-face evidence'
);
contract = replaceOnce(
  contract,
  `    const visiblePseudo = Object.entries(setup.rootPseudo || {}).filter(([, pseudo]) =>\n      pseudo && pseudo.display !== 'none' && pseudo.content !== 'none' && pseudo.content !== 'normal' && pseudo.opacity !== '0'\n    );\n    if (visiblePseudo.length) report.failures.push(\`${'${id}'}: root pseudo decoration remains printable: ${'${JSON.stringify(visiblePseudo)}'}\`);\n    const badFlipFaces = (setup.flipFaces || []).filter((item) => item.flow !== 'atomic' || !String(item.breakInside).includes('avoid'));\n    if (badFlipFaces.length) report.failures.push(\`${'${id}'}: reversible-card faces are not atomic: ${'${JSON.stringify(badFlipFaces.slice(0, 8))}'}\`);`,
  `    const visiblePseudo = Object.entries(setup.rootPseudo || {}).filter(([, pseudo]) => {\n      const contentVisible = pseudo?.content && pseudo.content !== 'none' && pseudo.content !== 'normal' && pseudo.content !== '\"\"';\n      return !pseudo || contentVisible || pseudo.display !== 'none' || pseudo.height !== '0px' || pseudo.opacity !== '0';\n    });\n    if (visiblePseudo.length) report.failures.push(\`${'${id}'}: root pseudo decoration remains printable: ${'${JSON.stringify(visiblePseudo)}'}\`);\n    if (id === 'gill-part1' && !(setup.flipCards || []).length) report.failures.push(\`${'${id}'}: visible reversible-card fixture missing\`);\n    const badFlipCards = (setup.flipCards || []).filter((item) => item.flow !== 'atomic' || !String(item.breakInside).includes('avoid'));\n    if (badFlipCards.length) report.failures.push(\`${'${id}'}: reversible-card outer container is not atomic: ${'${JSON.stringify(badFlipCards.slice(0, 8))}'}\`);\n    const badFlipFaces = (setup.flipFaces || []).filter((item) => !String(item.breakInside).includes('avoid'));\n    if (badFlipFaces.length) report.failures.push(\`${'${id}'}: reversible-card face can split: ${'${JSON.stringify(badFlipFaces.slice(0, 8))}'}\`);`,
  'strict pseudo and card assertions'
);
contract = replaceOnce(
  contract,
  `      keepNextCount: setup.keepers.length,\n      markerPdf: \`markers/${'${id}'}.pdf\`,`,
  `      keepNextCount: setup.keepers.length,\n      rootPseudo: setup.rootPseudo,\n      flipCards: setup.flipCards,\n      flipFaces: setup.flipFaces,\n      markerPdf: \`markers/${'${id}'}.pdf\`,`,
  'report card and decoration evidence'
);
write(contractPath, contract);

let raster = read(rasterPath);
raster = replaceOnce(
  raster,
  `    \"\"\"Find thin, long warm-gold strips in the upper 22% of a paper page.\"\"\"\n    width, height = image.size\n    limit_y = max(1, int(height * 0.22))`,
  `    \"\"\"Find broad warm-gold page chrome in the upper 12% of a paper page.\"\"\"\n    width, height = image.size\n    limit_y = max(1, int(height * 0.12))`,
  'amber detector vertical region'
);
raster = replaceOnce(
  raster,
  `    min_run = max(36, int(width * 0.14))`,
  `    min_run = max(72, int(width * 0.32))`,
  'amber detector minimum page-width run'
);
write(rasterPath, raster);

for (const path of [runtimePath, contractPath]) {
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
}
execFileSync('python3', ['-m', 'py_compile', rasterPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  changedProductFiles: [runtimePath, contractPath, rasterPath],
  outerAtomicRoles: ['flip-card', 'heart-flip-card', 'error-flip-card'],
  visibleFaceContract: 'break-inside avoid-page',
  amberDetector: { upperPageFraction: 0.12, minimumWidthFraction: 0.32 },
  marker: 'GB_PRINT_DECORATION_PAGINATION_V3'
}, null, 2));
