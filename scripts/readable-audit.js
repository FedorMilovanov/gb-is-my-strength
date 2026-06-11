#!/usr/bin/env node
/**
 * Publication/readable-layer audit.
 * Catches issues that are invisible in visual screenshots but leak into
 * reader-mode, screen readers, document.body.innerText, snippets, and LLM readers.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const issues = [];
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }
function fail(kind, file, detail) { issues.push({ kind, file, detail }); }
const htmlFiles = walk(ROOT).filter(f => f.endsWith('.html'));

// R1. Raw image paths must not be visible reader text. Pagefind hidden metadata is allowed.
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  let inHead = false, inScript = false, inPicture = false;
  html.split(/\n/).forEach((line, idx) => {
    const low = line.toLowerCase();
    if (/<head\b/.test(low)) inHead = true;
    if (/<script\b/.test(low)) inScript = true;
    if (/<picture\b/.test(low)) inPicture = true;
    const hasImagePath = /\/images\/[^<\s]+\.(?:webp|jpe?g|png|avif)/i.test(line);
    if (hasImagePath) {
      const allowed =
        inHead || inScript || inPicture ||
        /data-pagefind-meta=["']image["'][^>]*\bhidden\b/i.test(line) ||
        /\bhidden\b[^>]*data-pagefind-meta=["']image["']/i.test(line) ||
        /<(?:meta|img|source|link)\b/i.test(line) ||
        /(?:src|srcset|href|content|url|contentUrl|image)\s*[:=]/i.test(line) ||
        /--gbs2-cover\s*:\s*url\(/i.test(line) ||
        /background(?:-image)?\s*:/i.test(line);
      if (!allowed) fail('raw-image-path-readable-leak', rel(f), `line ${idx + 1}: ${line.trim().slice(0, 180)}`);
    }
    if (/<\/picture>/.test(low)) inPicture = false;
    if (/<\/script>/.test(low)) inScript = false;
    if (/<\/head>/.test(low)) inHead = false;
  });
}

// R2. Decorative summary numbers must be hidden from assistive/readable layers.
// They should be empty spans with data-num for CSS-generated visual content.
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const re = /<span\b(?=[^>]*class=["'][^"']*\bsummary-card__num\b)[^>]*>([\s\S]*?)<\/span>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const body = (m[1] || '').trim();
    const line = html.slice(0, m.index).split(/\n/).length;
    if (!/aria-hidden=["']true["']/i.test(tag)) fail('summary-card-number-not-aria-hidden', rel(f), `line ${line}`);
    if (!/data-num=["']0[1-9]["']/i.test(tag)) fail('summary-card-number-missing-data-num', rel(f), `line ${line}`);
    if (body) fail('summary-card-number-readable-text', rel(f), `line ${line}: ${body.slice(0, 20)}`);
  }
}

// R3. Home H1 brand must be readable with spaces around dash.
{
  const f = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(f, 'utf8');
  if (/Господь Бог—Сила Моя/.test(html)) fail('home-h1-brand-missing-dash-spaces', 'index.html', 'Господь Бог—Сила Моя');
  if (!/(?:h-title-dash[^>]*>\s+—\s+<\/span>|h-title-static[^>]*>Господь Бог<\/span>\s+<span class="h-title-dash"[^>]*>—<\/span>\s+<span class="h-title-accent">Сила Моя<\/span>)/.test(html)) fail('home-h1-dash-span-not-spaced', 'index.html', 'H1 should read Господь Бог — Сила Моя');
}

// R4. Over-claiming badge in Da Vinci article.
{
  const f = path.join(ROOT, 'articles/kod-da-vinchi/index.html');
  const html = fs.readFileSync(f, 'utf8');
  if (/Проверено историками/.test(html)) fail('overclaim-badge-checked-by-historians', rel(f), 'Use source-grounded wording instead');
}

// R5. Internal enum labels should not leak into Nagornaya sources reader layer.
{
  const f = path.join(ROOT, 'nagornaya/istochniki/index.html');
  const html = fs.readFileSync(f, 'utf8');
  const bad = [...html.matchAll(/>(Book|Confession|ChicagoDoc|Warning|Father|Academic)</g)].map(m => m[1]);
  if (bad.length) fail('source-enum-label-leak', rel(f), [...new Set(bad)].join(', '));
  if (/<span class="mx-1 text-stone-300">·<\/span>/.test(html)) fail('bibliography-dot-glue-risk', rel(f), 'Use spaced separator, e.g. —');
}

// R6. Obvious punctuation spacing glitches in public HTML text.
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  let inHead = false, inScript = false, inStyle = false;
  html.split(/\n/).forEach((line, idx) => {
    const low = line.toLowerCase();
    if (/<head\b/.test(low)) inHead = true;
    if (/<script\b/.test(low)) inScript = true;
    if (/<style\b/.test(low)) inStyle = true;
    if (!inHead && !inScript && !inStyle && (/\s,/.test(line) || /\d{4}·/.test(line))) {
      if (!/data:image/i.test(line)) fail('punctuation-spacing-risk', rel(f), `line ${idx + 1}: ${line.trim().slice(0, 160)}`);
    }
    if (/<\/style>/.test(low)) inStyle = false;
    if (/<\/script>/.test(low)) inScript = false;
    if (/<\/head>/.test(low)) inHead = false;
  });
}


// R7. Home positioning/readable hero contract.
{
  const f = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(f, 'utf8');
  if (/Богословская библиотека|Библиотека материалов|О библиотеке|Поиск по библиотеке/.test(html)) {
    fail('home-outdated-library-positioning', 'index.html', 'Use precise site/materials wording, not old library-only wording');
  }
  if (!/<div\b[^>]*class=["'][^"']*\bh-sacred-block\b[^"']*["'][^>]*aria-hidden=["']true["'][^>]*>/i.test(html)) {
    fail('home-sacred-block-not-aria-hidden', 'index.html', 'Decorative Hebrew hero layer should be aria-hidden with separate readable verse');
  }
  if (!/Девиз проекта\s+—\s+Аввакум 3:19/.test(html)) {
    fail('home-sacred-readable-summary-missing', 'index.html', 'Missing readable Habakkuk 3:19 summary');
  }
  const sacredMatch = html.match(/<div\b[^>]*class=["'][^"']*\bh-sacred-block\b[\s\S]*?<\/div>\s*<p class=["']sr-only["']/i);
  if (sacredMatch && /tabindex=["']0["']/.test(sacredMatch[0])) {
    fail('home-sacred-hidden-focusable', 'index.html', 'aria-hidden decorative Hebrew layer must not contain tabindex=0 elements');
  }
  const siteCss = fs.readFileSync(path.join(ROOT, 'css/site.css'), 'utf8');
  if (!/--f-hebrew-display:[^;]*Noto Serif Hebrew/.test(siteCss)) {
    fail('home-hebrew-display-font-regression', 'css/site.css', 'Hebrew hero must use Noto Serif Hebrew first, not sans override');
  }
  if (!/\.h-sacred-block \.hb-w\{[^}]*overflow:visible/.test(siteCss)) {
    fail('home-hebrew-hover-clipping-risk', 'css/site.css', 'Hebrew hover translation wrappers must not clip long Russian translations');
  }
}

console.log('\nGB READABLE AUDIT');
if (issues.length) {
  const byKind = issues.reduce((a, i) => (a[i.kind] = (a[i.kind] || 0) + 1, a), {});
  console.log(`❌ ${issues.length} issue(s)`, byKind);
  issues.slice(0, 80).forEach(i => console.log(`- ${i.kind} ${i.file}: ${i.detail}`));
  process.exit(1);
}
console.log('✅ Readable/publication layer passed');
