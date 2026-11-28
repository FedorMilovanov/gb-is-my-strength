import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(900);
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => {
  const rec = (extra) => ({
    id: 'probe-a',
    text: 'Диссентеры',
    articleTitle: 't',
    url: location.href,
    before: 'после спора в Солтерс-Холле (1719). ',
    after: ' — на следующий год',
    savedAt: Date.now(),
    annotation: Object.assign({
      version: 1, kind: 'marker', color: 'amber',
      anchor: {
        blockId: 'gill-search-p-012', blockIndex: 12,
        start: 8, end: 18, exact: 'Диссентеры',
        prefix: 'после спора в Солтерс-Холле (1719). ',
        suffix: ' — на следующий год',
        fingerprint: 'f',
      },
    }, extra || {}),
  });
  const exact = rec();
  const noBlockId = rec({ anchor: Object.assign({}, rec().annotation.anchor, { blockId: '' }) });
  localStorage.setItem('gb-highlights-v1', JSON.stringify([exact]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1800);
const paintState = await page.evaluate(() => {
  const names = [];
  if (window.CSS && CSS.highlights) for (const [n] of CSS.highlights) names.push(n);
  const painted = [];
  if (window.CSS && CSS.highlights) {
    for (const [n, reg] of CSS.highlights) {
      for (const range of reg) painted.push({ n, text: range.toString().slice(0, 60) });
    }
  }
  const api = window.__NP_W57_ANNOTATIONS__;
  const keys = api ? Object.keys(api) : [];
  return {
    registries: names, painted, apiKeys: keys,
    apiText: api ? JSON.stringify(Object.fromEntries(keys.map((k) => {
      const v = api[k];
      if (typeof v === 'function') return [k, 'fn'];
      try { return [k, Array.isArray(v) ? ('array:' + v.length) : String(v).slice(0, 60)]; }
      catch (e) { return [k, '?']; }
    }))) : null,
    notesList: (document.getElementById('npW57NotesList') || {}).children?.length ?? null,
    countBadge: document.getElementById('npW57NotesCount')?.textContent,
  };
});
console.log(JSON.stringify(paintState, null, 1));
await browser.close();
