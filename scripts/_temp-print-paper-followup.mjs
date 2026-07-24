#!/usr/bin/env node
import fs from 'node:fs';

const cssPath = 'css/site.css';
const sweepPath = 'scripts/engine-sweep.mjs';
let css = fs.readFileSync(cssPath, 'utf8');
let sweep = fs.readFileSync(sweepPath, 'utf8');

const marker = '/* GB PRINT CONTRACT v2.5 — terminal navigation, headings and box geometry. */';
if (css.includes(marker)) throw new Error('v2.5 paper follow-up already present');
css += `

${marker}
@media print {
  /* End-of-reader navigation is application chrome, not article content. */
  html body [data-gill-v16] :where(.gbs2-next-card, .gbs2-next-cover),
  html body [data-reader-root] :where(.gbs2-next-card, .gbs2-next-cover),
  html body :where(.gbs2-next-card, .gbs2-next-cover) {
    display: none;
    background: none;
    background-image: none;
  }

  /* Some book routes place their headings outside .article-body. The paper
     line-breaking contract therefore belongs to the semantic article itself. */
  html body article :where(h1, h2, h3, h4, h5, h6),
  html body main :where(h1, h2, h3, h4, h5, h6) {
    hyphens: none;
    word-break: normal;
    overflow-wrap: normal;
    text-wrap: balance;
    break-after: avoid-page;
    page-break-after: avoid;
  }

  html body article :where(h2, h3, h4) + *,
  html body main :where(h2, h3, h4) + * {
    break-before: avoid-page;
    page-break-before: avoid;
  }

  /* Neutralise the remaining low-contrast route cards without flattening
     photographs. This also removes the 3px scroll-width drift caused by
     decorated card borders/pseudo-surfaces in print media. */
  html body article :where(
    .summary-card, .note-box, .flip-card-front, .flip-card-back,
    .info-box, .warn-box, .quote-box, .author-card,
    .timeline-card, .fact-card, .source-card, .callout
  ),
  html body main article :where(
    .summary-card, .note-box, .flip-card-front, .flip-card-back,
    .info-box, .warn-box, .quote-box, .author-card,
    .timeline-card, .fact-card, .source-card, .callout
  ) {
    max-width: 100%;
    box-sizing: border-box;
    background: #fff;
    background-image: none;
    color: #111;
    box-shadow: none;
    text-shadow: none;
  }

  html body article,
  html body article.article-body,
  html body .article-body {
    box-sizing: border-box;
    max-width: 100%;
    overflow-x: visible;
  }

  html body article > *,
  html body .article-body > * {
    box-sizing: border-box;
    max-width: 100%;
  }
}
`;

const oldReturn = '      return { r, g, b, a, sat, light };';
const newReturn = '      return { r, g, b, a, sat, light, chroma: max - min };';
if ((sweep.split(oldReturn).length - 1) !== 1) throw new Error('paper color return marker missing');
sweep = sweep.replace(oldReturn, newReturn);

const oldCondition = 'bg && bg.a > .05 && bg.sat > .22 && bg.light > .08 && bg.light < .97';
const newCondition = 'bg && bg.a > .05 && bg.chroma > .12 && bg.sat > .28 && bg.light > .08 && bg.light < .92';
if ((sweep.split(oldCondition).length - 1) !== 1) throw new Error('paper saturation condition marker missing');
sweep = sweep.replace(oldCondition, newCondition);

const oldOverflow = '    const headings = [...root.querySelectorAll(\'h2, h3, h4\')].slice(0, 20).map((node) => ({';
const newOverflow = `    const rootRect = root.getBoundingClientRect();
    const overflowNodes = [...root.querySelectorAll('*')].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        cls: String(node.className || node.tagName).slice(0, 90),
        left: Math.round(rect.left - rootRect.left),
        right: Math.round(rect.right - rootRect.right),
        width: Math.round(rect.width),
      };
    }).filter((item) => item.left < -1 || item.right > 1).slice(0, 12);
    const headings = [...root.querySelectorAll('h2, h3, h4')].slice(0, 20).map((node) => ({`;
if ((sweep.split(oldOverflow).length - 1) !== 1) throw new Error('paper overflow diagnostic marker missing');
sweep = sweep.replace(oldOverflow, newOverflow);

const oldObject = '      overflow: root.scrollWidth - root.clientWidth,\n      heroBreak:';
const newObject = '      overflow: root.scrollWidth - root.clientWidth,\n      overflowNodes,\n      heroBreak:';
if ((sweep.split(oldObject).length - 1) !== 1) throw new Error('paper return overflow marker missing');
sweep = sweep.replace(oldObject, newObject);

const oldDetail = '    JSON.stringify({ overflow: paper?.overflow, headingBad: paper?.headingBad }));';
const newDetail = '    JSON.stringify({ overflow: paper?.overflow, overflowNodes: paper?.overflowNodes, headingBad: paper?.headingBad }));';
if ((sweep.split(oldDetail).length - 1) !== 1) throw new Error('paper overflow detail marker missing');
sweep = sweep.replace(oldDetail, newDetail);

fs.writeFileSync(cssPath, css);
fs.writeFileSync(sweepPath, sweep);
const important = (css.match(/!important/g) || []).length;
if (important > 200) throw new Error(`site.css priority ratchet exceeded: ${important} > 200`);
console.log(JSON.stringify({ marker, important }, null, 2));
