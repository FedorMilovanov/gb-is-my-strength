const { chromium, devices } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const PAGES = [
  '/', '/articles/kod-da-vinchi/', '/articles/dzhon-gill-chast-1-chelovek/',
  '/baptisty-rossii/goneniya-i-sovest/', '/baptisty-rossii/noch-na-kure/',
  '/about/', '/articles/', '/biografii/', '/hard-texts/', '/nagornaya/chast-1/'
];
(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const p of PAGES) {
    const ctx = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    try {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      const r = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        // find widest element causing overflow
        let widest = '';
        let maxOver = 0;
        if (docW > winW + 1) {
          document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.right > winW + 1 && r.width > maxOver) { maxOver = r.width; widest = (el.className||el.tagName)+' '+(el.id?'#'+el.id:''); }
          });
        }
        return { overflow: docW - winW, widest: widest.slice(0,60), maxOver: Math.round(maxOver) };
      });
      const status = r.overflow <= 1 && errs.length === 0 ? '✅' : '❌';
      console.log(`${status} ${p}: overflow=${r.overflow}px${r.overflow>1?' widest=['+r.widest+']':''} errors=${errs.length}`);
      if (errs.length) errs.slice(0,1).forEach(e=>console.log(`     ${e.slice(0,100)}`));
      if (r.overflow > 1 || errs.length) problems.push(p);
    } catch(e) { console.log(`❌ ${p}: ${e.message.slice(0,80)}`); problems.push(p); }
    await ctx.close();
  }
  await browser.close();
  console.log('\n'+(problems.length? '❌ Overflow/problems: '+problems.join(', ') : '✅ All content pages mobile-clean'));
  process.exit(problems.length?1:0);
})();
