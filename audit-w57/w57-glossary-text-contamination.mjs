import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(900);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1000);

// measure the DOM-side inflation first: the abbr contains the tooltip span
const domFacts = await page.evaluate(() => {
  const p = document.getElementById('gill-search-p-012');
  p.scrollIntoView({ block: 'center', behavior: 'instant' });
  const abbr = p.querySelector('abbr.gterm');
  const gtip = abbr.querySelector('.gtip');
  const r = document.createRange();
  r.selectNodeContents(abbr);
  return {
    abbrTextContent: abbr.textContent.replace(/\s+/g, ' ').trim(),
    abbrTextContentLen: abbr.textContent.trim().length,
    labelOnlyLen: (abbr.firstChild.nodeValue || '').trim().length,
    rangeToStringLen: r.toString().replace(/\s+/g, ' ').trim().length,
    rangeToStringHead: r.toString().replace(/\s+/g, ' ').trim().slice(0, 120),
    gtipInsideAbbr: !!gtip,
    gtipTextLen: gtip ? gtip.textContent.replace(/\s+/g, ' ').trim().length : 0,
    gtipVisible: gtip ? getComputedStyle(gtip).display : null,
    innerTextOfAbbr: abbr.innerText ? abbr.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) : null,
  };
});
// natural user gesture: double-click on the glossary word selects it
const pos = await page.evaluate(() => {
  const p = document.getElementById('gill-search-p-012');
  const abbr = p.querySelector('abbr.gterm');
  const rects = [...abbr.getClientRects()].filter((r) => r.width > 2);
  const r = rects[0];
  return { x: Math.round(r.left + Math.min(30, r.width / 2)), y: Math.round(r.top + r.height / 2) };
});
await page.mouse.dblclick(pos.x, pos.y);
await page.waitForTimeout(900);
const afterDbl = await page.evaluate(() => {
  const tb = document.getElementById('npW57SelectionToolbar');
  return {
    selection: window.getSelection().toString(),
    selectionLen: window.getSelection().toString().length,
    toolbarOpen: !!(tb && !tb.hidden),
    actions: tb && !tb.hidden
      ? [...tb.querySelectorAll('[data-w57-action]')].map((b) => b.dataset.w57Action) : [],
  };
});
if (afterDbl.toolbarOpen) {
  await page.click('#npW57SelectionToolbar [data-w57-action="marker"]');
  await page.waitForTimeout(1200);
}
const stored = await page.evaluate(() => {
  const arr = JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]');
  const r = arr[0];
  if (!r) return { none: true };
  return {
    text: r.text,
    textLen: (r.text || '').length,
    anchorExact: r.annotation?.anchor?.exact,
    after: (r.after || '').slice(0, 80),
  };
});
await page.screenshot({ path: '/tmp/audit-shots/R14_glossary_dblclick.png' });
// reload: does the painted highlight match the visible label?
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 25000 });
await page.waitForTimeout(1600);
const painted = await page.evaluate(() => {
  const out = [];
  if (!window.CSS || !CSS.highlights) return { api: false };
  for (const [name, reg] of CSS.highlights) {
    for (const range of reg) out.push({ name, text: range.toString().replace(/\s+/g, ' ').trim() });
  }
  return { api: true, ranges: out };
});
console.log(JSON.stringify({ domFacts, afterDbl, stored, painted }, null, 1));
await browser.close();
