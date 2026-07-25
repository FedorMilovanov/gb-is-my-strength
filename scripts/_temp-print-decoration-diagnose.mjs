import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const base = process.env.PRINT_DIAG_BASE_URL || 'http://127.0.0.1:4173';
const route = '/articles/dzhon-gill-chast-1-chelovek/';
const outDir = 'reports/print-decoration-diagnose';
await mkdir(outDir, { recursive: true });

function grep(pattern) {
  try {
    return execFileSync('grep', ['-RInE', '--exclude-dir=node_modules', '--exclude-dir=.git', pattern, '.'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    return `${error.stdout || ''}${error.stderr || ''}`;
  }
}

const sourceMatches = {
  russianTranslation: grep('Русский перевод|РУССКИЙ ПЕРЕВОД|Чтоб следовать за Агнцем|Его святым заветам'),
  bodyPseudo: grep('body::before|body:before|body::after|body:after'),
  goldColors: grep('#d8b068|#e8b878|#d4a574|#eec886|#c28a48|gold|linear-gradient\\([^)]*(d8b068|e8b878|d4a574|eec886|c28a48)'),
  quoteClasses: grep('manuscript-quote|quote-box|biography-epigraph|pull-quote|translation'),
};
await writeFile(`${outDir}/source-matches.json`, JSON.stringify(sourceMatches, null, 2));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print', colorScheme: 'light' });
await page.evaluate(async () => {
  await document.fonts.ready;
  if (window.GBPrintPagination?.prepare) await window.GBPrintPagination.prepare();
  else window.dispatchEvent(new Event('beforeprint'));
});

const dom = await page.evaluate(() => {
  const norm = value => String(value || '').replace(/\s+/g, ' ').trim();
  const chain = node => {
    const result = [];
    let current = node;
    for (let depth = 0; current && depth < 9; depth += 1, current = current.parentElement) {
      const rect = current.getBoundingClientRect();
      const css = getComputedStyle(current);
      result.push({
        tag: current.tagName,
        id: current.id || '',
        className: typeof current.className === 'string' ? current.className : '',
        text: norm(current.textContent).slice(0, 220),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        breakInside: css.breakInside,
        pageBreakInside: css.pageBreakInside,
        breakBefore: css.breakBefore,
        breakAfter: css.breakAfter,
        display: css.display,
        position: css.position,
        background: css.background,
        border: css.border,
      });
    }
    return result;
  };

  const textTargets = ['Русский перевод', 'РУССКИЙ ПЕРЕВОД', 'Чтоб следовать за Агнцем', 'Джон Гилл, 1 ноября 1716'];
  const matches = {};
  for (const target of textTargets) {
    const nodes = [...document.querySelectorAll('body *')].filter(el => norm(el.textContent).includes(target));
    const leaves = nodes.filter(el => ![...el.children].some(child => norm(child.textContent).includes(target)));
    matches[target] = leaves.slice(0, 8).map(chain);
  }

  const colorish = value => /d8b068|e8b878|d4a574|eec886|c28a48|rgb\(216, 176, 104\)|rgb\(232, 184, 120\)|rgb\(212, 165, 116\)/i.test(value || '');
  const decorations = [];
  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 45 || rect.height <= 0 || rect.height > 40) continue;
    for (const pseudo of [null, '::before', '::after']) {
      const css = getComputedStyle(el, pseudo);
      const content = css.content;
      const visual = `${css.background} ${css.backgroundColor} ${css.backgroundImage} ${css.borderColor} ${css.color} ${css.boxShadow}`;
      const pseudoVisible = pseudo ? content !== 'none' && content !== 'normal' : true;
      if (!pseudoVisible && css.backgroundImage === 'none' && !colorish(visual)) continue;
      if (colorish(visual) || /linear-gradient/i.test(css.backgroundImage || '')) {
        decorations.push({
          pseudo: pseudo || 'element',
          tag: el.tagName,
          id: el.id || '',
          className: typeof el.className === 'string' ? el.className : '',
          text: norm(el.textContent).slice(0, 100),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          content,
          background: css.background,
          backgroundImage: css.backgroundImage,
          backgroundColor: css.backgroundColor,
          borderColor: css.borderColor,
          display: css.display,
          position: css.position,
          width: css.width,
          height: css.height,
        });
      }
    }
  }

  return { matches, decorations };
});

await writeFile(`${outDir}/dom-report.json`, JSON.stringify(dom, null, 2));
await page.pdf({ path: `${outDir}/diagnostic.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
await page.screenshot({ path: `${outDir}/print-dom.png`, fullPage: true });
await page.evaluate(() => {
  if (window.GBPrintPagination?.restore) window.GBPrintPagination.restore();
  else window.dispatchEvent(new Event('afterprint'));
});
await browser.close();

console.log(JSON.stringify({ route, sourceMatches: Object.fromEntries(Object.entries(sourceMatches).map(([k, v]) => [k, v.split('\n').filter(Boolean).length])), decorations: dom.decorations.length, textTargets: Object.fromEntries(Object.entries(dom.matches).map(([k, v]) => [k, v.length])) }, null, 2));
