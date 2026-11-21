import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const BASE = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/';
const VARIANTS = [
  { name: 'native', url: BASE },
  { name: 'w57', url: BASE + '?reader-pilot=1&paper=space' },
];
const INVENTORY = () => {
  const vis = (el) => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    if (r.width < 4 || r.height < 4) return false;
    if (r.bottom <= 0 || r.top >= innerHeight) return false;
    return true;
  };
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('title')
    || el.textContent.replace(/\s+/g, ' ').trim() || el.id || el.className).slice(0, 40);
  const items = [];
  for (const el of document.querySelectorAll('button, a, [role="button"]')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const zone = r.top < 120 ? 'top' : r.top > innerHeight - 150 ? 'bottom' : 'body';
    items.push({
      zone, id: el.id || null, cls: String(el.className).split(' ').filter(Boolean).slice(0, 2).join('.'),
      label: label(el), x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      small: r.width < 44 || r.height < 44,
    });
  }
  return {
    bodyClasses: [...document.body.classList].filter((c) => c.startsWith('np-')).join(' '),
    scrollH: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    items,
  };
};

const out = [];
for (const v of VARIANTS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  await page.goto(v.url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true || true, null, { timeout: 20000 });
  await page.waitForTimeout(3500);
  const inv = await page.evaluate(INVENTORY);
  await page.screenshot({ path: `/tmp/audit-shots/R31_mobile_${v.name}_top.png` });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(1200);
  const invScrolled = await page.evaluate(INVENTORY);
  await page.screenshot({ path: `/tmp/audit-shots/R32_mobile_${v.name}_scrolled.png` });
  out.push({ variant: v.name, inv, invScrolled });
  await ctx.close();
}

// diff: which native owners disappear under W57
const key = (i) => (i.id || i.label || i.cls);
const natBottom = out[0].inv.items.filter((i) => i.zone === 'bottom').map(key);
const w57Bottom = out[1].inv.items.filter((i) => i.zone === 'bottom').map(key);
const natTop = out[0].inv.items.filter((i) => i.zone === 'top').map(key);
const w57Top = out[1].inv.items.filter((i) => i.zone === 'top').map(key);
console.log(JSON.stringify({
  native: { classes: out[0].inv.bodyClasses, bottom: out[0].inv.items.filter((i) => i.zone === 'bottom'),
    top: out[0].inv.items.filter((i) => i.zone === 'top'), overflowX: out[0].inv.overflowX },
  w57: { classes: out[1].inv.bodyClasses, bottom: out[1].inv.items.filter((i) => i.zone === 'bottom'),
    top: out[1].inv.items.filter((i) => i.zone === 'top'), overflowX: out[1].inv.overflowX },
  missingBottom: natBottom.filter((k) => !w57Bottom.includes(k)),
  addedBottom: w57Bottom.filter((k) => !natBottom.includes(k)),
  missingTop: natTop.filter((k) => !w57Top.includes(k)),
  addedTop: w57Top.filter((k) => !natTop.includes(k)),
  nativeScrolledBottom: out[0].invScrolled.items.filter((i) => i.zone === 'bottom'),
  w57ScrolledBottom: out[1].invScrolled.items.filter((i) => i.zone === 'bottom'),
}, null, 1));
await browser.close();
