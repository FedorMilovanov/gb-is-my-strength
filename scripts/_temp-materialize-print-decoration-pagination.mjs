#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const runtimePath = 'js/reader-preferences-head.js';
const contractPath = 'scripts/print-pagination-contract.mjs';

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
  `    '.manuscript-quote',\n    '.ancient-epigraph',\n    '.note-box',`,
  `    '.manuscript-quote',\n    '.ancient-epigraph',\n    '.flip-card',\n    '.error-flip-card',\n    '.heart-flip-card',\n    '.note-box',`,
  'flip-card candidate registration'
);
runtime = replaceOnce(
  runtime,
  `var ROLE_CLASS_RE = /(?:^|[\\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\\s_-])/i;`,
  `var ROLE_CLASS_RE = /(?:^|[\\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|flip-card|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\\s_-])/i;`,
  'flip-card semantic role registration'
);
runtime = replaceOnce(
  runtime,
  `      '  html body { orphans: 3; widows: 3; }',\n      '  html body [data-print-flow="atomic"],`,
  `      '  html body { orphans: 3; widows: 3; }',\n      '  /* GB_PRINT_DECORATION_PAGINATION_V2 */',\n      '  html body::before, html body::after { content: none !important; display: none !important; border: 0 !important; background: none !important; box-shadow: none !important; }',\n      '  html body [data-print-flow="atomic"],`,
  'print body pseudo suppression'
);
write(runtimePath, runtime);

let contract = read(contractPath);
contract = replaceOnce(
  contract,
  `      return { runtime, atomic, keepers };`,
  `      const bodyBefore = getComputedStyle(document.body, '::before');\n      const bodyAfter = getComputedStyle(document.body, '::after');\n      const flipCards = [...scope.querySelectorAll('.flip-card,.error-flip-card,.heart-flip-card')]\n        .filter(visible)\n        .map((node) => {\n          const rect = node.getBoundingClientRect();\n          const style = getComputedStyle(node);\n          return {\n            className: typeof node.className === 'string' ? node.className.slice(0, 120) : '',\n            text: String(node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120),\n            height: Math.round(rect.height),\n            flow: node.getAttribute('data-print-flow') || '',\n            breakInside: style.breakInside,\n            pageBreakInside: style.pageBreakInside\n          };\n        });\n      return {\n        runtime, atomic, keepers, flipCards,\n        bodyPseudo: {\n          before: { content: bodyBefore.content, display: bodyBefore.display, borderBottomWidth: bodyBefore.borderBottomWidth, backgroundImage: bodyBefore.backgroundImage },\n          after: { content: bodyAfter.content, display: bodyAfter.display, borderBottomWidth: bodyAfter.borderBottomWidth, backgroundImage: bodyAfter.backgroundImage }\n        }\n      };`,
  'browser setup decoration evidence'
);
contract = replaceOnce(
  contract,
  `    if (!setup.atomic.length) report.failures.push(\`${'${id}'}: runtime classified no atomic components\`);\n    const badComputed = setup.atomic.filter((item) => !String(item.breakInside).includes('avoid'));`,
  `    if (!setup.atomic.length) report.failures.push(\`${'${id}'}: runtime classified no atomic components\`);\n    for (const [pseudoName, pseudo] of Object.entries(setup.bodyPseudo || {})) {\n      const contentVisible = pseudo.content && pseudo.content !== 'none' && pseudo.content !== 'normal' && pseudo.content !== '\"\"';\n      if (contentVisible || pseudo.display !== 'none' || pseudo.borderBottomWidth !== '0px' || pseudo.backgroundImage !== 'none') {\n        report.failures.push(\`${'${id}'}: body::${'${pseudoName}'} remains printable: ${'${JSON.stringify(pseudo)}'}\`);\n      }\n    }\n    if (id === 'gill-part1') {\n      if (!setup.flipCards?.length) report.failures.push(\`${'${id}'}: visible flip-card fixture missing\`);\n      const badFlipCards = (setup.flipCards || []).filter((item) => item.flow !== 'atomic' || !String(item.breakInside).includes('avoid'));\n      if (badFlipCards.length) report.failures.push(\`${'${id}'}: flip-card is not atomic: ${'${JSON.stringify(badFlipCards)}'}\`);\n    }\n    const badComputed = setup.atomic.filter((item) => !String(item.breakInside).includes('avoid'));`,
  'decoration and flip-card assertions'
);
contract = replaceOnce(
  contract,
  `      keepNextCount: setup.keepers.length,\n      markerPdf: \`markers/${'${id}'}.pdf\`,`,
  `      keepNextCount: setup.keepers.length,\n      bodyPseudo: setup.bodyPseudo,\n      flipCards: setup.flipCards,\n      markerPdf: \`markers/${'${id}'}.pdf\`,`,
  'report decoration evidence'
);
write(contractPath, contract);

for (const path of [runtimePath, contractPath]) {
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
}
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  changedProductFiles: [runtimePath, contractPath],
  printDecoration: 'body pseudo-elements suppressed',
  semanticAtomicRoles: ['flip-card', 'error-flip-card', 'heart-flip-card'],
  marker: 'GB_PRINT_DECORATION_PAGINATION_V2'
}, null, 2));
