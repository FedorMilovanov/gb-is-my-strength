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
  `    '.manuscript-quote',
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
    '.ancient-epigraph',`,
  `    '.manuscript-quote',
    '.flip-card',
    '.heart-flip-card',
    '.error-flip-card',
    '.ancient-epigraph',`,
  'outer reversible-card candidate registration'
);
runtime = replaceOnce(
  runtime,
  `var ROLE_CLASS_RE = /(?:^|[\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\s_-])/i;`,
  `var ROLE_CLASS_RE = /(?:^|[\s_-])(timeline|chronology|milestone|roadmap|series-map|series-overview|diagram|callout|flip-card|note-box|info-box|warn-box|quote-box|summary-card|fact-card|source-card|author-card|closing-mark|devotional-tail|epilogue)(?:$|[\s_-])/i;`,
  'reversible-card semantic role registration'
);
runtime = replaceOnce(
  runtime,
  `      '  html body { orphans: 3; widows: 3; }',
      '  html body [data-print-flow="atomic"],`,
  `      '  html body { orphans: 3; widows: 3; }',
      '  /* GB_PRINT_DECORATION_PAGINATION_V3 */',
      '  html body [data-print-flow="atomic"],`,
  'print decoration pagination marker'
);
write(runtimePath, runtime);

let contract = read(contractPath);
contract = replaceOnce(
  contract,
  `      const bodyBefore = getComputedStyle(document.body, '::before');
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
      return { runtime, atomic, keepers, rootPseudo, flipFaces };`,
  `      const bodyBefore = getComputedStyle(document.body, '::before');
      const bodyAfter = getComputedStyle(document.body, '::after');
      const rootPseudo = {
        before: { content: bodyBefore.content, display: bodyBefore.display, background: bodyBefore.background, height: bodyBefore.height, opacity: bodyBefore.opacity },
        after: { content: bodyAfter.content, display: bodyAfter.display, background: bodyAfter.background, height: bodyAfter.height, opacity: bodyAfter.opacity }
      };
      const flipCards = [...scope.querySelectorAll('.flip-card,.heart-flip-card,.error-flip-card')]
        .filter(visible)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName.toLowerCase(),
            className: typeof node.className === 'string' ? node.className.slice(0, 140) : '',
            flow: node.getAttribute('data-print-flow') || '',
            breakInside: getComputedStyle(node).breakInside,
            height: Math.round(rect.height),
            text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100)
          };
        });
      const flipFaces = [...scope.querySelectorAll('.flip-card-front,.flip-card-back,.heart-flip-front,.heart-flip-back,.error-flip-front,.error-flip-back')]
        .filter(visible)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className.slice(0, 140) : '',
          breakInside: getComputedStyle(node).breakInside,
          text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100)
        }));
      return { runtime, atomic, keepers, rootPseudo, flipCards, flipFaces };`,
  'separate outer-card and visible-face evidence'
);
contract = replaceOnce(
  contract,
  `    const visiblePseudo = Object.entries(setup.rootPseudo || {}).filter(([, pseudo]) =>
      pseudo && pseudo.display !== 'none' && pseudo.content !== 'none' && pseudo.content !== 'normal' && pseudo.opacity !== '0'
    );
    if (visiblePseudo.length) report.failures.push(\`${'${id}'}: root pseudo decoration remains printable: ${'${JSON.stringify(visiblePseudo)}'}\`);
    const badFlipFaces = (setup.flipFaces || []).filter((item) => item.flow !== 'atomic' || !String(item.breakInside).includes('avoid'));
    if (badFlipFaces.length) report.failures.push(\`${'${id}'}: reversible-card faces are not atomic: ${'${JSON.stringify(badFlipFaces.slice(0, 8))}'}\`);`,
  `    const visiblePseudo = Object.entries(setup.rootPseudo || {}).filter(([, pseudo]) => {
      const contentVisible = pseudo?.content && pseudo.content !== 'none' && pseudo.content !== 'normal' && pseudo.content !== '""';
      return !pseudo || contentVisible || pseudo.display !== 'none' || pseudo.height !== '0px' || pseudo.opacity !== '0';
    });
    if (visiblePseudo.length) report.failures.push(\`${'${id}'}: root pseudo decoration remains printable: ${'${JSON.stringify(visiblePseudo)}'}\`);
    if (id === 'gill-part1' && !(setup.flipCards || []).length) report.failures.push(\`${'${id}'}: visible reversible-card fixture missing\`);
    const badFlipCards = (setup.flipCards || []).filter((item) => item.flow !== 'atomic' || !String(item.breakInside).includes('avoid'));
    if (badFlipCards.length) report.failures.push(\`${'${id}'}: reversible-card outer container is not atomic: ${'${JSON.stringify(badFlipCards.slice(0, 8))}'}\`);
    const badFlipFaces = (setup.flipFaces || []).filter((item) => !String(item.breakInside).includes('avoid'));
    if (badFlipFaces.length) report.failures.push(\`${'${id}'}: reversible-card face can split: ${'${JSON.stringify(badFlipFaces.slice(0, 8))}'}\`);`,
  'strict pseudo and card assertions'
);
contract = replaceOnce(
  contract,
  `      keepNextCount: setup.keepers.length,
      markerPdf: \`markers/${'${id}'}.pdf\`,`,
  `      keepNextCount: setup.keepers.length,
      rootPseudo: setup.rootPseudo,
      flipCards: setup.flipCards,
      flipFaces: setup.flipFaces,
      markerPdf: \`markers/${'${id}'}.pdf\`,`,
  'report card and decoration evidence'
);
write(contractPath, contract);

for (const path of [runtimePath, contractPath]) {
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
}
execFileSync('python3', ['-m', 'py_compile', rasterPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  changedProductFiles: [runtimePath, contractPath],
  outerAtomicRoles: ['flip-card', 'heart-flip-card', 'error-flip-card'],
  visibleFaceContract: 'break-inside avoid-page',
  rasterContract: 'paper-aware obsolete-header-strip detection',
  marker: 'GB_PRINT_DECORATION_PAGINATION_V3'
}, null, 2));
