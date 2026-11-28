import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const out = {};
for (const w of [1280, 1360, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-gill-settings-open], #railSettingsBtn, .np-u-type-open, .np-u-type-compact')]
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
    el && el.click();
  });
  await page.waitForTimeout(900);
  out[w] = await page.evaluate(() => {
    const p = document.getElementById('npUFontPanel');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const cs = getComputedStyle(p);
    const last = p.lastElementChild;
    const lr = last ? last.getBoundingClientRect() : null;
    const lastBtn = [...p.querySelectorAll('button')].pop();
    const lbr = lastBtn ? lastBtn.getBoundingClientRect() : null;
    // what sits at the panel's bottom edge inside it
    const probeY = Math.min(innerHeightIn(), r.bottom) - 6;
    function innerHeightIn() { return window.innerHeight; }
    const atBottom = document.elementFromPoint(r.left + r.width / 2, probeY);
    return {
      viewport: { w: innerWidth, h: innerHeight },
      panel: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) },
      cssMaxHeight: cs.maxHeight, overflowY: cs.overflowY,
      scrollH: p.scrollHeight, clientH: p.clientHeight,
      lastRow: lr ? { y: Math.round(lr.y), bottom: Math.round(lr.bottom), h: Math.round(lr.height) } : null,
      lastButton: lastBtn ? { text: lastBtn.textContent.trim(), x: Math.round(lbr.x), right: Math.round(lbr.right),
        w: Math.round(lbr.width), bottom: Math.round(lbr.bottom) } : null,
      bottomEdgeBelowViewport: Math.round(r.bottom - innerHeight),
      atBottomEdge: atBottom ? (atBottom.id || String(atBottom.className).slice(0, 40) || atBottom.tagName) : null,
    };
  });
  await page.screenshot({ path: `/tmp/audit-shots/FIX_d3_probe_${w}x800.png` });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
