// map-mobile-smoke.js — mobile (iPhone 12) render check for engine maps.
const { chromium, devices } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const MAPS = ['revelation','yeshua','maccabim','early-church','shvatim','pavel'];
(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const m of MAPS) {
    const ctx = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    try {
      await page.goto(`${BASE}/karty/${m}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => {
        const canvas = document.querySelector('.me-canvas');
        const map = document.querySelector('.me-map,#mapRoot');
        const cs = canvas ? getComputedStyle(canvas) : {};
        return {
          mapW: map ? Math.round(map.getBoundingClientRect().width) : 0,
          touchAction: cs.touchAction || 'n/a',
          overflow: document.documentElement.scrollWidth - window.innerWidth
        };
      }).catch(()=>({}));
      const status = errors.length===0 && r.mapW>0 ? '✅' : '❌';
      console.log(`${status} ${m}: mapW=${r.mapW}px, touch-action=${r.touchAction}, overflow=${r.overflow}px, errors=${errors.length}`);
      if(errors.length||r.mapW===0||(r.overflow>2)) problems.push(m);
    } catch(e){ console.log(`❌ ${m}: ${e.message.slice(0,90)}`); problems.push(m); }
    await ctx.close();
  }
  await browser.close();
  console.log('\n'+(problems.length===0?'✅ Mobile maps clean':'❌ Mobile problems: '+problems.join(', ')));
  process.exit(problems.length?1:0);
})();
