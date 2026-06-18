const { chromium } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const MAPS = ['ishod','pavel','melachim','shoftim','shvatim','yeshua','maccabim','early-church','revelation'];
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
      const routeViz = await page.evaluate(()=>({
        underlays: document.querySelectorAll('.me-route-underlay').length,
        routeLabels: document.querySelectorAll('.me-route-label').length,
        mainRoutes: document.querySelectorAll('.me-route-main').length,
      })).catch(()=>({underlays:0,routeLabels:0,mainRoutes:0}));
      const sci = await page.evaluate(async () => {
        try {
          const route = await fetch('./route.json').then(r => r.json());
          const variants = route.scientific_variants || route.variants || {};
          const place = (route.places || []).find(p => variants[p.id] && document.querySelector(`[data-place-id="${p.id}"]`));
          if (!place) return {tested:false, reason:'no-place-with-variants'};
          const marker = document.querySelector(`[data-place-id="${place.id}"]`);
          marker.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
          await new Promise(r => setTimeout(r, 180));
          const sciTab = document.querySelector('.me-tab[data-tab="sci"]');
          if (!sciTab) return {tested:true, ok:false, reason:'no-sci-tab', place:place.id};
          sciTab.click();
          await new Promise(r => setTimeout(r, 120));
          const items = document.querySelectorAll('.me-sci-item').length;
          const statuses = [...document.querySelectorAll('.me-sci-status')].map(el => el.textContent.trim()).filter(Boolean);
          return {tested:true, ok:items>0 && statuses.length>0, place:place.id, items, statuses:statuses.slice(0,3)};
        } catch (e) { return {tested:true, ok:false, reason:String(e && e.message || e)}; }
      }).catch(e=>({tested:true,ok:false,reason:String(e)}));
      const routeVizOk = routeViz.underlays > 0 && routeViz.mainRoutes > 0;
      const sciOk = !sci.tested || sci.ok;
      const status = errors.length===0 && mapW>0 && routeVizOk && sciOk ? '✅' : '❌';
      console.log(`${status} ${m}: svgCircles=${svgCircles}, routes=${routeViz.mainRoutes}/${routeViz.underlays}, labels=${routeViz.routeLabels}, sci=${sci.tested?(sci.ok?'ok':'BAD'):'skip'}, mapW=${Math.round(mapW)}px, overflow=${overflow}px, errors=${errors.length}`);
      if(errors.length) errors.slice(0,3).forEach(e=>console.log(`     ${e.slice(0,150)}`));
      if(!routeVizOk) console.log(`     route visual missing: ${JSON.stringify(routeViz)}`);
      if(!sciOk) console.log(`     sci tab problem: ${JSON.stringify(sci)}`);
      if(errors.length||mapW===0||!routeVizOk||!sciOk) problems.push(m);
    } catch(e){ console.log(`❌ ${m}: ${e.message.slice(0,100)}`); problems.push(m); }
    await ctx.close();
  }
  await browser.close();
  console.log('\n'+(problems.length===0?'✅ All maps render cleanly':'❌ Problems: '+problems.join(', ')));
  process.exit(problems.length?1:0);
})();
