#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cssPath = path.join(root, 'css/site.css');
const sweepPath = path.join(root, 'scripts/engine-sweep.mjs');

let css = fs.readFileSync(cssPath, 'utf8');
const cssMarker = '/* GB PRINT CONTRACT v2.4 — neutral paper surfaces and pagination integrity. */';
if (css.includes(cssMarker)) throw new Error('print paper contract already present');

const paperCss = `

${cssMarker}
@media print {
  /* The route themes remain expressive on screen, but paper is intentionally
     neutral. High-specificity selectors beat later route styles without
     increasing the repository !important ratchet. */
  html body [data-gill-v16],
  html body [data-reader-root] {
    color-scheme: light;
    --color-bg: #fff;
    --color-surface: #fff;
    --color-surface-alt: #f4f4f2;
    --color-text: #111;
    --color-text-muted: #444;
    --color-text-faint: #666;
    --color-border: #b9b9b4;
    --color-accent: #333;
    --color-accent-strong: #111;
  }

  html body [data-gill-v16] .article-body,
  html body [data-reader-root] .article-body,
  html body [data-gill-v16] .article-body :where(p, li, td, th, figcaption, small, span, strong, em),
  html body [data-reader-root] .article-body :where(p, li, td, th, figcaption, small, span, strong, em) {
    color: #111;
    text-shadow: none;
  }

  html body [data-gill-v16] .article-body :where(
    .biography-hero, .biography-meta, .biography-info, .biography-dates,
    .biography-epigraph, .biography-stats, .stat-item, .hebrew-inscription,
    .manuscript-quote, .manuscript-quote-text, .manuscript-quote-source,
    .summary-card, .quote-box, .info-box, .warn-box, .author-card,
    .foliant-mark, .timeline-card, .fact-card, .source-card, .callout,
    details, summary, pre, code
  ),
  html body [data-reader-root] .article-body :where(
    .biography-hero, .biography-meta, .biography-info, .biography-dates,
    .biography-epigraph, .biography-stats, .stat-item, .hebrew-inscription,
    .manuscript-quote, .manuscript-quote-text, .manuscript-quote-source,
    .summary-card, .quote-box, .info-box, .warn-box, .author-card,
    .foliant-mark, .timeline-card, .fact-card, .source-card, .callout,
    details, summary, pre, code
  ) {
    background: #fff;
    background-image: none;
    color: #111;
    border-color: #b9b9b4;
    box-shadow: none;
    text-shadow: none;
    filter: none;
  }

  html body [data-gill-v16] .article-body :where(
    .biography-hero, .biography-meta, .biography-info, .biography-dates,
    .biography-epigraph, .biography-stats, .hebrew-inscription,
    .manuscript-quote, .summary-card, .quote-box, .info-box, .warn-box,
    .author-card, .foliant-mark
  )::before,
  html body [data-gill-v16] .article-body :where(
    .biography-hero, .biography-meta, .biography-info, .biography-dates,
    .biography-epigraph, .biography-stats, .hebrew-inscription,
    .manuscript-quote, .summary-card, .quote-box, .info-box, .warn-box,
    .author-card, .foliant-mark
  )::after,
  html body [data-reader-root] .article-body :where(
    .biography-hero, .biography-meta, .biography-info, .biography-dates,
    .biography-epigraph, .biography-stats, .hebrew-inscription,
    .manuscript-quote, .summary-card, .quote-box, .info-box, .warn-box,
    .author-card, .foliant-mark
  )::before,
  html body [data-reader-root] .article-body :where(
    .biography-hero, .biography-meta, .biography-info, .biography-dates,
    .biography-epigraph, .biography-stats, .hebrew-inscription,
    .manuscript-quote, .summary-card, .quote-box, .info-box, .warn-box,
    .author-card, .foliant-mark
  )::after {
    background: none;
    box-shadow: none;
    text-shadow: none;
  }

  /* A biography masthead is one semantic unit. The date strip may never be
     orphaned at the bottom of one sheet while the name starts on the next. */
  html body [data-gill-v16] .article-body .biography-hero,
  html body [data-gill-v16] .article-body .biography-meta,
  html body [data-gill-v16] .article-body .biography-info,
  html body [data-reader-root] .article-body .biography-hero,
  html body [data-reader-root] .article-body .biography-meta,
  html body [data-reader-root] .article-body .biography-info {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  html body [data-gill-v16] .article-body .biography-hero,
  html body [data-reader-root] .article-body .biography-hero {
    margin: 0 0 8mm;
  }

  html body [data-gill-v16] .article-body .biography-dates,
  html body [data-reader-root] .article-body .biography-dates {
    display: block;
    margin: 0 0 4mm;
    padding: 3mm 4mm;
    border: 1px solid #b9b9b4;
    border-left: 3px solid #666;
    border-radius: 0;
    break-after: avoid-page;
    page-break-after: avoid;
    font-size: 10pt;
    line-height: 1.35;
    letter-spacing: .02em;
    hyphens: none;
    word-break: normal;
    overflow-wrap: normal;
  }

  html body [data-gill-v16] .article-body .biography-info,
  html body [data-reader-root] .article-body .biography-info {
    padding: 5mm 6mm;
    border: 1px solid #b9b9b4;
    border-radius: 0;
  }

  html body [data-gill-v16] .article-body .biography-title,
  html body [data-reader-root] .article-body .biography-title {
    margin: 0 0 3mm;
    font-size: 24pt;
    line-height: 1.12;
    letter-spacing: .01em;
    hyphens: none;
    word-break: normal;
    overflow-wrap: normal;
    text-wrap: balance;
  }

  html body [data-gill-v16] .article-body .biography-title::first-letter,
  html body [data-reader-root] .article-body .biography-title::first-letter {
    float: none;
    margin: 0;
    padding: 0;
    font: inherit;
    line-height: inherit;
    color: inherit;
  }

  html body [data-gill-v16] .article-body .biography-subtitle,
  html body [data-reader-root] .article-body .biography-subtitle {
    margin: 0 0 3mm;
    font-size: 12pt;
    line-height: 1.35;
    hyphens: none;
    word-break: normal;
    overflow-wrap: normal;
    text-wrap: balance;
  }

  html body [data-gill-v16] .article-body .biography-epigraph,
  html body [data-reader-root] .article-body .biography-epigraph {
    margin: 4mm 0;
    padding: 3mm 4mm;
    border: 0;
    border-left: 2px solid #777;
    font-size: 10.5pt;
    line-height: 1.45;
  }

  html body [data-gill-v16] .article-body .biography-stats,
  html body [data-reader-root] .article-body .biography-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3mm 6mm;
    margin: 4mm 0 0;
    padding: 4mm 0 0;
    border-top: 1px solid #b9b9b4;
  }

  html body [data-gill-v16] .article-body .stat-item,
  html body [data-reader-root] .article-body .stat-item {
    min-width: 0;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  html body [data-gill-v16] .article-body .stat-value,
  html body [data-reader-root] .article-body .stat-value {
    font-size: 17pt;
    line-height: 1.1;
  }

  html body [data-gill-v16] .article-body .stat-label,
  html body [data-reader-root] .article-body .stat-label {
    white-space: normal;
    hyphens: none;
    word-break: normal;
    overflow-wrap: normal;
    font-size: 8.5pt;
    line-height: 1.25;
  }

  html body [data-gill-v16] .article-body .hebrew-inscription,
  html body [data-reader-root] .article-body .hebrew-inscription {
    margin: 6mm 0;
    padding: 5mm 0;
    border-top: 1px solid #c9c9c4;
    border-bottom: 1px solid #c9c9c4;
    break-inside: avoid-page;
    page-break-inside: avoid;
    isolation: isolate;
  }

  html body [data-gill-v16] .article-body :where(.hebrew-line, [lang="he"]),
  html body [data-reader-root] .article-body :where(.hebrew-line, [lang="he"]) {
    direction: rtl;
    unicode-bidi: isolate;
    hyphens: none;
    word-break: normal;
    overflow-wrap: normal;
  }

  html body [data-gill-v16] .article-body :where(h1, h2, h3, h4, h5, h6),
  html body [data-reader-root] .article-body :where(h1, h2, h3, h4, h5, h6) {
    color: #111;
    background: transparent;
    text-shadow: none;
    hyphens: none;
    word-break: normal;
    overflow-wrap: normal;
    text-wrap: balance;
    break-after: avoid-page;
    page-break-after: avoid;
  }

  html body [data-gill-v16] .article-body :where(h2, h3, h4) + *,
  html body [data-reader-root] .article-body :where(h2, h3, h4) + * {
    break-before: avoid-page;
    page-break-before: avoid;
  }

  html body [data-gill-v16] .article-body :where(p, li, blockquote),
  html body [data-reader-root] .article-body :where(p, li, blockquote) {
    orphans: 3;
    widows: 3;
    word-break: normal;
    overflow-wrap: break-word;
    text-wrap: pretty;
  }

  html body [data-gill-v16] .article-body table,
  html body [data-reader-root] .article-body table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    color: #111;
    break-inside: auto;
    page-break-inside: auto;
  }

  html body [data-gill-v16] .article-body thead,
  html body [data-reader-root] .article-body thead {
    display: table-header-group;
  }

  html body [data-gill-v16] .article-body tr,
  html body [data-reader-root] .article-body tr {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  html body [data-gill-v16] .article-body th,
  html body [data-reader-root] .article-body th {
    background: #f1f1ef;
    color: #111;
  }
}
`;

css += paperCss;
fs.writeFileSync(cssPath, css);

let sweep = fs.readFileSync(sweepPath, 'utf8');
const sweepMarker = '/* ============ PRINT PAPER PALETTE + PAGINATION — REGRESSION CONTRACT ============ */';
if (sweep.includes(sweepMarker)) throw new Error('print paper sweep already present');
const insertBefore = '/* ============ READERSTATE R6 — ЕДИНЫЙ ДИАПАЗОН/ПРОГРЕСС/RESUME ============ */';
if (!sweep.includes(insertBefore)) throw new Error('engine sweep insertion marker missing');

const sweepBlock = `
${sweepMarker}
for (const [id, url] of [
  ['paper-gill', '/articles/dzhon-gill-chast-1-chelovek/'],
  ['paper-book', '/articles/novoe-serdce/'],
  ['paper-single', '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],
]) {
  const { ctx, page } = await newPage({ width: 1240, height: 900 });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);

  const paper = await page.evaluate(() => {
    const root = document.querySelector('[data-gill-v16] .article-body, [data-reader-root] .article-body, article.article-body, article');
    if (!root) return null;
    const color = (value) => {
      const nums = String(value || '').match(/[\\d.]+/g)?.map(Number) || [];
      if (nums.length < 3) return null;
      const [r, g, b] = nums;
      const a = nums.length > 3 ? nums[3] : 1;
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const light = (max + min) / 2;
      const delta = max - min;
      const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
      return { r, g, b, a, sat, light };
    };
    const saturated = [];
    const gradients = [];
    for (const node of root.querySelectorAll('*')) {
      if (/^(IMG|PICTURE|SOURCE|SVG|PATH|CANVAS|VIDEO)$/.test(node.tagName)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width * rect.height < 5000) continue;
      const style = getComputedStyle(node);
      const bg = color(style.backgroundColor);
      if (bg && bg.a > .05 && bg.sat > .22 && bg.light > .08 && bg.light < .97) {
        saturated.push({ cls: String(node.className || node.tagName).slice(0, 90), bg: style.backgroundColor, area: Math.round(rect.width * rect.height) });
      }
      if (style.backgroundImage !== 'none' && /gradient\\(/.test(style.backgroundImage)) {
        gradients.push({ cls: String(node.className || node.tagName).slice(0, 90), image: style.backgroundImage.slice(0, 110) });
      }
    }
    const title = root.querySelector('.biography-title');
    const first = title ? getComputedStyle(title, '::first-letter') : null;
    const titleStyle = title ? getComputedStyle(title) : null;
    const hero = root.querySelector('.biography-hero');
    const headings = [...root.querySelectorAll('h2, h3, h4')].slice(0, 20).map((node) => ({
      text: (node.textContent || '').trim().slice(0, 60),
      breakAfter: getComputedStyle(node).breakAfter,
      hyphens: getComputedStyle(node).hyphens,
      wordBreak: getComputedStyle(node).wordBreak,
    }));
    const tableHead = root.querySelector('table thead');
    const tableRow = root.querySelector('table tbody tr');
    const hebrew = root.querySelector('.hebrew-line, [lang="he"]');
    return {
      saturated: saturated.slice(0, 12),
      gradients: gradients.slice(0, 12),
      overflow: root.scrollWidth - root.clientWidth,
      heroBreak: hero ? getComputedStyle(hero).breakInside : null,
      firstLetterRatio: first && titleStyle ? Number.parseFloat(first.fontSize) / Number.parseFloat(titleStyle.fontSize) : null,
      firstLetterFloat: first?.float || null,
      titleHyphens: titleStyle?.hyphens || null,
      titleWordBreak: titleStyle?.wordBreak || null,
      headingBad: headings.filter((item) => !String(item.breakAfter).includes('avoid') || item.hyphens !== 'none' || item.wordBreak !== 'normal'),
      tableHead: tableHead ? getComputedStyle(tableHead).display : null,
      tableRowBreak: tableRow ? getComputedStyle(tableRow).breakInside : null,
      hebrewDirection: hebrew ? getComputedStyle(hebrew).direction : null,
      hebrewBidi: hebrew ? getComputedStyle(hebrew).unicodeBidi : null,
    };
  });

  R(id, 'print: no saturated screen surfaces or decorative gradients',
    !!paper && paper.saturated.length === 0 && paper.gradients.length === 0,
    JSON.stringify({ saturated: paper?.saturated, gradients: paper?.gradients }));
  R(id, 'print: normal line breaking and no horizontal overflow',
    !!paper && paper.overflow <= 1 && paper.headingBad.length === 0,
    JSON.stringify({ overflow: paper?.overflow, headingBad: paper?.headingBad }));
  R(id, 'print: tables and RTL lines remain atomic and directional',
    !!paper && (!paper.tableHead || paper.tableHead === 'table-header-group') &&
      (!paper.tableRowBreak || String(paper.tableRowBreak).includes('avoid')) &&
      (!paper.hebrewDirection || paper.hebrewDirection === 'rtl'),
    JSON.stringify({ tableHead: paper?.tableHead, tableRowBreak: paper?.tableRowBreak, hebrewDirection: paper?.hebrewDirection, hebrewBidi: paper?.hebrewBidi }));
  if (id === 'paper-gill') {
    R(id, 'print: biography masthead stays together without decorative drop cap',
      !!paper && String(paper.heroBreak).includes('avoid') &&
        paper.firstLetterRatio !== null && paper.firstLetterRatio <= 1.2 && paper.firstLetterFloat === 'none' &&
        paper.titleHyphens === 'none' && paper.titleWordBreak === 'normal',
      JSON.stringify({ heroBreak: paper?.heroBreak, ratio: paper?.firstLetterRatio, float: paper?.firstLetterFloat, hyphens: paper?.titleHyphens, wordBreak: paper?.titleWordBreak }));
  }
  await ctx.close();
}

`;

sweep = sweep.replace(insertBefore, sweepBlock + insertBefore);
fs.writeFileSync(sweepPath, sweep);

const totalImportant = (css.match(/!important/g) || []).length;
if (totalImportant > 200) throw new Error(`site.css !important ratchet exceeded: ${totalImportant} > 200`);
console.log(JSON.stringify({ cssMarker, sweepMarker, totalImportant }, null, 2));
