import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const shots = process.env.READER_STRUCTURED_SHOTS || path.join(root, '.cache', 'reader-structured-shots');
fs.mkdirSync(shots, { recursive: true });
const mime = { '.html': 'text/html;charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  try {
    const u = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const f = path.resolve(dist, '.' + (u.endsWith('/') ? u + 'index.html' : u));
    const rel = path.relative(dist, f);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { res.writeHead(500).end(String(e)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port + '/articles/dzhon-gill-istoricheskiy-kontekst/';
let scenarios = 0;
try {
  for (const [engine, driver] of Object.entries({ chromium, webkit })) {
    const browser = await driver.launch();
    for (const width of [320, 390, 430, 768, 1440]) {
      for (const theme of ['light', 'dark']) {
        const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 500, hasTouch: width < 500, serviceWorkers: 'block', reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        assert.equal(response.status(), 200);
        if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
        await page.waitForTimeout(90);
        const info = await page.evaluate(() => {
          const all = [...document.querySelectorAll('article.article-body table[data-responsive-layout="stacked-prose"]')];
          return { overflow: document.documentElement.scrollWidth - innerWidth, entries: all.map(t => {
            const r = t.getBoundingClientRect(), parent = t.parentElement.getBoundingClientRect();
            const headings = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim());
            const rows = [...t.querySelectorAll('tbody tr')];
            const cells = rows.flatMap(x => [...x.querySelectorAll('td')]);
            const labels = rows.every(x => [...x.querySelectorAll('td')].every((c, i) => c.dataset.label === headings[i]));
            const pseudo = getComputedStyle(cells[1], '::before');
            return {
              rows: rows.length, cells: cells.length, labels, w: r.width, parentW: parent.width,
              scroll: t.parentElement.scrollWidth - t.parentElement.clientWidth,
              tbody: getComputedStyle(t.tBodies[0]).display,
              row: getComputedStyle(rows[0]).display,
              cell: getComputedStyle(cells[0]).display,
              pseudoDisplay: pseudo.display, pseudoPosition: pseudo.position,
              allCellsInside: cells.every(c => { const q = c.getBoundingClientRect(); return q.width > 0 && q.height > 0 && q.left >= -1 && q.right <= innerWidth + 1; })
            };
          }) };
        });
        const key = engine + ' ' + width + ' ' + theme;
        assert.equal(info.entries.length, 7, key + ': seven tables');
        assert.equal(info.entries.reduce((s, e) => s + e.rows, 0), 34, key + ': 34 rows');
        assert.equal(info.entries.reduce((s, e) => s + e.cells, 0), 97, key + ': 97 cells');
        assert.ok(info.entries.every(e => e.labels), key + ': all source column labels');
        assert.equal(info.overflow, 0, key + ': no horizontal page overflow');
        if (width <= 700) {
          assert.ok(info.entries.every(e => e.tbody === 'grid' && e.row === 'grid' && e.cell === 'block'), key + ': stacked cards');
          assert.ok(info.entries.every(e => e.w <= e.parentW + 1 && e.scroll <= 1 && e.allCellsInside), key + ': no hidden table column');
          assert.ok(info.entries.every(e => e.pseudoDisplay === 'block' && e.pseudoPosition === 'static'), key + ': visible labels never overlap');
        } else assert.ok(info.entries.every(e => e.tbody !== 'grid'), key + ': desktop table remains');
        const ax = await page.locator('table[data-responsive-layout]').nth(1).ariaSnapshot();
        assert.ok(ax.includes('table:') && ax.includes('rowgroup:') && ax.includes('cell "'), key + ': semantic table cells accessible');
        if ((width === 320 || width === 390 || width === 1440) && theme === 'light') {
          await page.locator('table[data-responsive-layout]').nth(1).scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(shots, engine + '-' + width + '-historical-context.jpg'), type: 'jpeg', quality: 75 });
        }
        assert.deepEqual(errors, [], key + ': zero JS errors');
        scenarios++;
        await ctx.close();
      }
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const nojs = await page.evaluate(() => {
      const t = document.querySelector('table[data-responsive-layout]');
      return { tbody: getComputedStyle(t.tBodies[0]).display, labels: [...t.querySelectorAll('tbody td')].every(x => Boolean(x.dataset.label)) };
    });
    assert.equal(nojs.tbody, 'grid', engine + ': no-JS cards');
    assert.ok(nojs.labels, engine + ': no-JS labels');
    await page.emulateMedia({ media: 'print' });
    const pr = await page.evaluate(() => {
      const t = document.querySelector('table[data-responsive-layout]');
      return { table: getComputedStyle(t).display, header: getComputedStyle(t.tHead).display,
        body: getComputedStyle(t.tBodies[0]).display,
        row: getComputedStyle(t.tBodies[0].rows[0]).display,
        cell: getComputedStyle(t.tBodies[0].rows[0].cells[0]).display,
        labelsSuppressed: getComputedStyle(t.tBodies[0].rows[0].cells[1], '::before').content === 'none' };
    });
    assert.equal(pr.table, 'table', engine + ': print uses real table');
    assert.equal(pr.header, 'table-header-group', engine + ': print headers retained');
    assert.equal(pr.body, 'table-row-group', engine + ': print tbody restored');
    assert.equal(pr.row, 'table-row', engine + ': print rows restored');
    assert.equal(pr.cell, 'table-cell', engine + ': print columns restored');
    assert.ok(pr.labelsSuppressed, engine + ': mobile labels not duplicated in print');
    scenarios += 2;
    await ctx.close();
    await browser.close();
  }
} finally { await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify({ passed: scenarios, screenshots: shots }));
