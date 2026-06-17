const { chromium } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const MAPS = ['revelation','yeshua','maccabim','early-church','shvatim','pavel'];
(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const m of MAPS) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
    try {
      await page.goto(`${BASE}/karty/${m}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const svgCircles = await page.locator('svg circle').count().catch(()=>0);
      const mapW = await page.evaluate(()=>{const el=document.querySelector('.me-map,#mapRoot');return el?el.getBoundingClientRect().width:0;}).catch(()=>0);
      const overflow = await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth).catch(()=>0);
      const status = errors.length===0 && mapW>0 ? '✅' : '❌';
      console.log(`${status} ${m}: svgCircles=${svgCircles}, mapW=${Math.round(mapW)}px, overflow=${overflow}px, errors=${errors.length}`);
      if(errors.length) errors.slice(0,3).forEach(e=>console.log(`     ${e.slice(0,150)}`));
      if(errors.length||mapW===0) problems.push(m);
    } catch(e){ console.log(`❌ ${m}: ${e.message.slice(0,100)}`); problems.push(m); }
    await ctx.close();
  }
  await browser.close();
  console.log('\n'+(problems.length===0?'✅ All maps render cleanly':'❌ Problems: '+problems.join(', ')));
  process.exit(problems.length?1:0);
})();
