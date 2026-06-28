// map-mobile-smoke.js — mobile (iPhone 12) render check for engine maps.
const { chromium, devices } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const DEFAULT_LIVE_MAPS = ['ishod','avraam'];
const HOLDING_MAPS = ['pavel','melachim','shoftim','shvatim','yeshua','maccabim','early-church','revelation'];
const MAPS = (process.env.MAP_SMOKE_ROUTES || DEFAULT_LIVE_MAPS.join(','))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
(async () => {
  if (!process.env.MAP_SMOKE_ROUTES && HOLDING_MAPS.length) {
    console.log(`ℹ️ Skipping holding map routes until owner-approved live MapEngine launch: ${HOLDING_MAPS.join(', ')}`);
  }
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
        const vb = (document.querySelector('.me-canvas svg')?.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        return {
          mapW: map ? Math.round(map.getBoundingClientRect().width) : 0,
          viewW: vb[2] || 0,
          touchAction: cs.touchAction || 'n/a',
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          smallControls: [...document.querySelectorAll('button')].filter(el => {
            const box = el.getBoundingClientRect();
            const inViewport = box.right > 0 && box.bottom > 0 && box.left < window.innerWidth && box.top < window.innerHeight;
            return inViewport && box.width > 0 && box.height > 0 && box.width < 44 && box.height < 44;
          }).slice(0, 8).map(el => {
            const box = el.getBoundingClientRect();
            return `${el.className || el.id || el.tagName}:${Math.round(box.width)}x${Math.round(box.height)}`;
          })
        };
      }).catch(()=>({}));
      const status = errors.length===0 && r.mapW>0 ? '✅' : '❌';
      const small = Array.isArray(r.smallControls) ? r.smallControls : [];
      console.log(`${status} ${m}: mapW=${r.mapW}px, viewW=${Math.round(r.viewW||0)}, touch-action=${r.touchAction}, overflow=${r.overflow}px, errors=${errors.length}, smallControls=${small.length}`);
      if (small.length) small.forEach(x => console.log(`     small ${x}`));
      if(errors.length||r.mapW===0||(r.viewW||0)<=50||(r.overflow>2)||small.length) problems.push(m);
    } catch(e){ console.log(`❌ ${m}: ${e.message.slice(0,90)}`); problems.push(m); }
    await ctx.close();
  }
  await browser.close();
  console.log('\n'+(problems.length===0?'✅ Mobile maps clean':'❌ Mobile problems: '+problems.join(', ')));
  process.exit(problems.length?1:0);
})();
